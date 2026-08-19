import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { applyTranslations, applyEntityTranslations } from "@/lib/translation-engine";
import { executeVoiceOtpCall } from "@/lib/voice-otp-engine";
import { buildVoiceOtpHttpDlrPayload, pushDlrToClient } from "@/lib/voice-otp-dlr";
import {
  deliverSmsWithFallback,
  registerDlrCallback,
  filterRoutesByTrunkMcc,
} from "@/lib/smpp-client";
import type { CallAttempt, VoiceOtpCallResult } from "@/lib/voice-otp-engine";
import type { RouteInfo, DlrPayload } from "@/lib/smpp-client";
import { getOnlineOttDevices, sendOttMessage } from "@/lib/ott-pairing-engine";
import type { OttDeviceType } from "@/lib/ott-pairing-engine";
import { deliverBusinessApiRoute } from "@/lib/business-api-send";
import { isBusinessApiRoute } from "@/lib/connection-types";
import { lookupClientRate, lookupSupplierCost } from "@/lib/rates";
import { buildUrl, evaluateCondition, extractFromResponse, parseHeaders } from "@/lib/api-connector-parser";
import { buildRegex } from "@/lib/regex-utils";
import {
  resolveChargingMode,
  isSubmitCharged,
  isDlrCharged,
  isForceDlr,
  isForceDlrTimeout,
  isForceDlrOrTimeout,
  buildForceDlrPayload,
} from "@/lib/charging";
import type { ChargingMode } from "@/lib/charging";
import { isValidDestinationNumber } from "@/lib/number-validation";
import { isDuplicateSmsSubmission, releaseSmsSubmission } from "@/lib/sms-dedupe";

export const dynamic = "force-dynamic";

function extractOtp(content: string): string | null {
  const match = content.match(/\b(\d{4,8})\b/);
  return match ? match[1] : null;
}


// ── TPS Rate Limiter (in-memory, per-tenant and per-client) ──
const tpsBuckets = new Map<string, { count: number; windowStart: number }>();

// Periodic cleanup of stale TPS buckets (every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of tpsBuckets) {
    if (now - bucket.windowStart > 5000) tpsBuckets.delete(key);
  }
}, 60000);

function checkTpsLimit(key: string, maxTps: number): boolean {
  if (maxTps <= 0) return true; // no limit
  const now = Date.now();
  const bucket = tpsBuckets.get(key);
  if (!bucket || now - bucket.windowStart > 1000) {
    tpsBuckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= maxTps) return false;
  bucket.count++;
  return true;
}

export async function POST(request: Request) {
  // Try cookie-based auth first (dashboard user)
  let tenant = getTenantFromRequest(request);

  // REST API key auth — used when clients connect via HTTP API
  let apiClientId: number | null = null;
  if (!tenant) {
    const apiKey = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (apiKey) {
      // Find client by API key — iterate all active tenants (simplified: use default for now)
      // In production with multi-tenant, this would use a global client lookup
      const allTenants = await db.select({ id: tenants.id, schemaName: tenants.schemaName })
        .from(tenants).where(eq(tenants.isActive, true));
      for (const t of allTenants) {
        // Unified credential: accept http_api_key OR smpp_username as API key
        const clientResult = await tenantQuery(
          t.schemaName,
          "SELECT id FROM clients WHERE (http_api_key = $1 OR smpp_username = $1) AND is_active = true AND enable_http_api = true",
          [apiKey]
        );
        if (clientResult.rows.length > 0) {
          tenant = { tenantId: t.id, email: "api@client", schemaName: t.schemaName, companyName: "" };
          apiClientId = clientResult.rows[0].id;
          break;
        }
      }
      if (!tenant) {
        return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
      }
    }
  }

  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [tenantData] = await db
    .select({
      costPerSms: tenants.costPerSms, smsCounter: tenants.smsCounter,
      smsLimit: tenants.smsLimit, packageType: tenants.packageType,
      maxTps: tenants.maxTps, voiceOtpEnabled: tenants.voiceOtpEnabled,
      maxConcurrentCalls: tenants.maxConcurrentCalls,
    })
    .from(tenants)
    .where(eq(tenants.id, tenant.tenantId));

  // ── TPS Rate Limit Check ──
  const maxTps = tenantData?.maxTps || 0;
  if (!checkTpsLimit(`tenant:${tenant.tenantId}`, maxTps)) {
    return NextResponse.json({ error: `TPS limit exceeded (max ${maxTps}/s)` }, { status: 429 });
  }

  const body = await request.json();
  // Use API-authenticated client ID if available, otherwise require clientId in body
  const clientId = apiClientId || body.clientId;
  const { sender: origSender, destination: origDestination, content: origContent, testRouteId } = body;

  let sender = origSender;
  let destination = origDestination;
  let content = origContent;

  if (!clientId || !sender || !destination || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Get client
  const clientResult = await tenantQuery(
    tenant.schemaName,
    "SELECT * FROM clients WHERE id = $1 AND is_active = true",
    [clientId]
  );
  if (clientResult.rows.length === 0) {
    return NextResponse.json({ error: "Client not found or inactive" }, { status: 404 });
  }

  const client = clientResult.rows[0];
  const clientChargingMode = resolveChargingMode(client);
  const clientDlrTimeout = parseInt(client.dlr_timeout as string || "300");
  const ratePerSms = await lookupClientRate(destination, clientId as number, tenant.schemaName);
  const clientMaxTps = parseInt(client.max_tps || "0");
  
  // Supplier cost and profit will be calculated after route resolution
  let supplierCost = 0;
  let profit = 0;

  // ── SMS Credit Counter Check (tenant-level) ──
  const smsRemaining = (tenantData?.smsLimit || 0) - (tenantData?.smsCounter || 0);
  if (tenantData?.smsLimit && tenantData.smsLimit > 0 && smsRemaining <= 0) {
    return NextResponse.json({
      error: "SMS credit exhausted. Please top-up to continue sending.",
      smsBalance: 0,
      smsTotal: tenantData.smsLimit,
      smsSent: tenantData.smsCounter,
    }, { status: 402 });
  }

  // ── Per-Client TPS Rate Limit Check ──
  if (!checkTpsLimit(`client:${tenant.tenantId}:${clientId}`, clientMaxTps)) {
    return NextResponse.json({ error: `Client TPS limit exceeded (max ${clientMaxTps}/s)` }, { status: 429 });
  }

  // ── Apply Client-Level Translations ──
  let appliedTranslations: string[] = [];
  let routePlanId = client.route_plan_id;
  let routePlanName: string | null = null;
  let selectedRoute: Record<string, unknown> = {};
  let supplierId: number | null = null;

  // Apply client translations first (before routing)
  let tonNpiOverrides: { srcTon?: number; srcNpi?: number; dstTon?: number; dstNpi?: number } = {};
  try {
    const clientTransResult = await applyTranslations(
      tenant.schemaName, clientId, null,
      sender, destination, content
    );
    sender = clientTransResult.sender;
    destination = clientTransResult.destination;
    content = clientTransResult.content;
    tonNpiOverrides = {
      srcTon: clientTransResult.srcTon,
      srcNpi: clientTransResult.srcNpi,
      dstTon: clientTransResult.dstTon,
      dstNpi: clientTransResult.dstNpi,
    };
    appliedTranslations.push(...clientTransResult.appliedProfiles);
  } catch (err) {
    console.error("Client translation error:", err);
    // Continue with original values on error
  }

  let status = "SENT";
  let dlrStatus = "SENT";
  let otpCode: string | null = null;
  let language: string | null = null;
  let callSid: string | null = null;
  let langResolution: { mcc: string; country: string; primaryLanguage: string; fallbackLanguage: string; isEnglishPrimary: boolean } | null = null;
  let callAttempts: CallAttempt[] = [];
  let callSuccess = false;
  let allRoutes: RouteInfo[] = [];

  // Capture DLR callback URL from client early (used by SMS delivery + OTT Worker)
  const dlrCallbackUrl = (client.dlr_callback_url || client.webhook_url || null) as string | null;

  // Generate message ID early (used by voice OTP handler for external API)
  const messageId = "MSG_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);

  // Fetch route plan name (used in both testRoute and routePlan branches)
  if (routePlanId) {
    try {
      const rpResult = await tenantQuery(
        tenant.schemaName,
        "SELECT name FROM route_plans WHERE id = $1",
        [routePlanId]
      );
      routePlanName = (rpResult.rows[0]?.name as string) || null;
    } catch { /* non-critical */ }
  }

  // Resolve routes (all of them for fallback capability)
  if (testRouteId) {
    const routeResult = await tenantQuery(
      tenant.schemaName,
      `SELECT r.*, t.name as trunk_name, t.supplier_id,
              t.mcc_allow_list, t.mcc_deny_list,
              s.name as supplier_name, s.connection_type
       FROM routes r
       LEFT JOIN trunks t ON r.trunk_id = t.id AND t.is_active = true
       LEFT JOIN suppliers s ON t.supplier_id = s.id AND s.is_active = true AND s.bind_status IN ('BOUND', 'ACTIVE')
       WHERE r.id = $1 AND r.is_active = true`,
      [testRouteId]
    );
    if (routeResult.rows.length === 0) {
      return NextResponse.json({ error: "Route not found or inactive" }, { status: 404 });
    }
    const r = routeResult.rows[0];
    // Route exists but supplier is unbound — return clear error
    if (!r.supplier_id) {
      return NextResponse.json({ error: "Route found but supplier is currently unbound. Please wait for the supplier to reconnect." }, { status: 503 });
    }
    selectedRoute = r;
    allRoutes = [{
      routeId: r.id as number,
      routeName: r.name as string,
      trunkId: r.trunk_id as number,
      trunkName: r.trunk_name as string,
      trunkMccAllowList: (r.mcc_allow_list as string) || null,
      trunkMccDenyList: (r.mcc_deny_list as string) || null,
      supplierId: r.supplier_id as number,
      supplierName: r.supplier_name as string,
      connectionType: r.connection_type as string,
      priority: 1,
    }];
  } else if (routePlanId) {
    const routeResult = await tenantQuery(
      tenant.schemaName,
      `SELECT rpr.priority as plan_priority, r.id as route_id, r.name as route_name,
              r.trunk_id as single_trunk_id,
              rt.priority as trunk_priority,
              COALESCE(rt.trunk_id, r.trunk_id) as trunk_id,
              t.name as trunk_name, t.supplier_id, t.is_active as trunk_active,
              t.mcc_allow_list, t.mcc_deny_list,
              s.name as supplier_name, s.connection_type, s.is_active as supplier_active
       FROM route_plan_routes rpr
       JOIN routes r ON rpr.route_id = r.id AND r.is_active = true
       LEFT JOIN route_trunks rt ON rt.route_id = r.id AND rt.is_active = true
       JOIN trunks t ON COALESCE(rt.trunk_id, r.trunk_id) = t.id AND t.is_active = true
       JOIN suppliers s ON t.supplier_id = s.id AND s.is_active = true AND s.bind_status IN ('BOUND', 'ACTIVE')
       WHERE rpr.route_plan_id = $1
       ORDER BY rpr.priority ASC, COALESCE(rt.priority, 0) ASC`,
      [routePlanId]
    );
    if (routeResult.rows.length === 0) {
      return NextResponse.json({
        error: "No active routes in plan. Add routes via Dashboard → Routes, link them to the plan via Dashboard → Route Plans.",
        hint: "route_plan_id=" + routePlanId,
      }, { status: 400 });
    }
    selectedRoute = routeResult.rows[0];
    allRoutes = routeResult.rows.map((r: Record<string,unknown>) => ({
      routeId: r.route_id as number,
      routeName: r.route_name as string,
      trunkId: r.trunk_id as number,
      trunkName: r.trunk_name as string,
      trunkMccAllowList: (r.mcc_allow_list as string) || null,
      trunkMccDenyList: (r.mcc_deny_list as string) || null,
      supplierId: r.supplier_id as number,
      supplierName: r.supplier_name as string,
      connectionType: r.connection_type as string,
      priority: ((r.plan_priority as number) || 0) * 100 + ((r.trunk_priority as number) || 0),
    }));
  } else {
    return NextResponse.json({ error: "No route plan or route specified" }, { status: 400 });
  }

  // ── Trunk-level MCC/MNC filtering ──
  allRoutes = filterRoutesByTrunkMcc(allRoutes, destination);
  if (allRoutes.length === 0) {
    return NextResponse.json({ error: "No routes available for this destination (MCC filtering)" }, { status: 400 });
  }

  // Re-extract supplier ID from the first remaining route AFTER MCC filtering
  supplierId = (allRoutes[0]?.supplierId as number) || null;
  // Also update selectedRoute to the first active route post-filter
  selectedRoute = { ...selectedRoute, ...allRoutes[0] as unknown as Record<string, unknown> };

  // --- Apply Supplier-Level Translations ---
  if (supplierId) {
    try {
      const suppTransResult = await applyEntityTranslations(
        tenant.schemaName, "supplier", supplierId,
        sender, destination, content,
        false // includeGlobal=false — global profiles already applied at client level
      );
      sender = suppTransResult.sender;
      destination = suppTransResult.destination;
      content = suppTransResult.content;
      tonNpiOverrides = {
        srcTon: suppTransResult.srcTon,
        srcNpi: suppTransResult.srcNpi,
        dstTon: suppTransResult.dstTon,
        dstNpi: suppTransResult.dstNpi,
      };
      appliedTranslations.push(...suppTransResult.appliedNames.map((n: string) => `[Supplier] ${n}`));
    } catch (err) {
      console.error("Supplier translation error:", err);
    }
  }

  // ── NUMBER_BLACKLIST enforcement ──
  try {
    const blResult = await tenantQuery(
      tenant.schemaName,
      `SELECT tp.name, tp.match_pattern FROM translation_profiles tp
       JOIN translation_assignments ta ON ta.profile_id = tp.id
       WHERE tp.category = 'NUMBER_BLACKLIST'
         AND tp.is_active = true AND ta.is_active = true
         AND (ta.client_id = $1 OR ta.supplier_id IS NULL ${supplierId ? "OR ta.supplier_id = $2" : ""})
       ORDER BY ta.priority ASC`,
      supplierId ? [clientId, supplierId] : [clientId]
    );
    for (const row of blResult.rows) {
      try {
        if (buildRegex(row.match_pattern as string).test(destination)) {
          // Log the blocked attempt
          tenantQuery(tenant.schemaName,
            `INSERT INTO blocked_sms_log (rule_name, category, destination, content, client_id)
             VALUES ($1, 'NUMBER_BLACKLIST', $2, $3, $4)`,
            [row.name as string, destination, content || null, clientId]
          ).catch(e => console.error("Block log insert error:", e));
          return NextResponse.json({
            error: `SMS blocked: destination number matches blacklist rule "${row.name}"`,
            blockedBy: row.name,
          }, { status: 403 });
        }
      } catch { /* invalid regex — skip */ }
    }
  } catch (err) {
    console.error("Number blacklist check error:", err);
  }

  // ── CONTENT_FILTER enforcement ──
  try {
    const cfResult = await tenantQuery(
      tenant.schemaName,
      `SELECT tp.name, tp.match_pattern, tp.replacement_fixed as filter_mode
       FROM translation_profiles tp
       JOIN translation_assignments ta ON ta.profile_id = tp.id
       WHERE tp.category = 'CONTENT_FILTER'
         AND tp.is_active = true AND ta.is_active = true
         AND (ta.client_id = $1 OR ta.supplier_id IS NULL ${supplierId ? "OR ta.supplier_id = $2" : ""})
       ORDER BY ta.priority ASC`,
      supplierId ? [clientId, supplierId] : [clientId]
    );
    // Classify rules: replace, blacklist (incl. url_block), and whitelist
    const isReplaceMode = (m: string): boolean => {
      try { const j = JSON.parse(m); return !!(j && j.mode === "replace"); } catch { return false; }
    };
    const replaceRules = cfResult.rows.filter((r: Record<string, unknown>) => isReplaceMode((r.filter_mode as string) || ""));
    const blacklistRules = cfResult.rows.filter((r: Record<string, unknown>) => !isReplaceMode((r.filter_mode as string) || "") && (r.filter_mode as string) !== "whitelist");
    const whitelistRules = cfResult.rows.filter((r: Record<string, unknown>) => (r.filter_mode as string) === "whitelist");

    // Replace rules: transform content in-place before block/allow checks
    for (const row of replaceRules) {
      try {
        const meta = JSON.parse((row.filter_mode as string) || "{}");
        const replacement = meta.replacement != null ? String(meta.replacement) : "";
        content = content.replace(buildRegex(row.match_pattern as string, "gm"), replacement);
      } catch { /* invalid regex — skip */ }
    }

    for (const row of blacklistRules) {
      try {
        if (buildRegex(row.match_pattern as string).test(content)) {
          // Log the blocked attempt
          tenantQuery(tenant.schemaName,
            `INSERT INTO blocked_sms_log (rule_name, category, destination, content, client_id)
             VALUES ($1, 'CONTENT_FILTER', $2, $3, $4)`,
            [row.name as string, destination, content, clientId]
          ).catch(e => console.error("Block log insert error:", e));
          return NextResponse.json({
            error: `SMS blocked: content matches blacklist rule "${row.name}"`,
            blockedBy: row.name,
          }, { status: 403 });
        }
      } catch { /* invalid regex — skip */ }
    }

    // Whitelist: if any whitelist rules exist, content MUST match at least one
    if (whitelistRules.length > 0) {
      let whitelistMatch = false;
      for (const row of whitelistRules) {
        try {
          if (buildRegex(row.match_pattern as string).test(content)) {
            whitelistMatch = true;
            break;
          }
        } catch { /* invalid regex — skip */ }
      }
      if (!whitelistMatch) {
        // Log the blocked attempt
        tenantQuery(tenant.schemaName,
          `INSERT INTO blocked_sms_log (rule_name, category, destination, content, client_id)
           VALUES ($1, 'CONTENT_FILTER', $2, $3, $4)`,
          ['whitelist (no match)', destination, content, clientId]
        ).catch(e => console.error("Block log insert error:", e));
        return NextResponse.json({
          error: "SMS blocked: content does not match any whitelist rule",
          whitelistRules: whitelistRules.map((r: Record<string,unknown>) => r.name),
        }, { status: 403 });
      }
    }
  } catch (err) {
    console.error("Content filter check error:", err);
  }

  // ── Duplicate request guard ──
  // Placed AFTER all validation (auth, credit, TPS, routes, translations,
  // blacklist, content filter) and immediately BEFORE any delivery. Identical
  // submissions (same schema, client, sender, destination and content) within
  // a short window are skipped so a client retry / double-submit can never
  // send the same SMS twice or bill it twice — while a request that FAILED
  // validation is never marked (its retry is allowed).
  const dedupeInput = {
    schemaName: tenant.schemaName,
    clientId: clientId as number,
    sender: String(origSender || ""),
    destination: String(origDestination || ""),
    content: String(origContent || ""),
  };
  const isDup = isDuplicateSmsSubmission(dedupeInput);
  if (isDup) {
    console.log(`[SEND-SMS] Duplicate request skipped (same sender/destination/content within window): ${String(origDestination).slice(0, 20)}`);
    return NextResponse.json({
      success: true,
      duplicate: true,
      message: "Duplicate request skipped — identical message was already submitted.",
    });
  }

  // ── Voice OTP handling (shared engine-based flow with retry) ──
  if (
    selectedRoute.connection_type === "VOICE_OTP" ||
    selectedRoute.connection_type === "Voice OTP"
  ) {
    otpCode = extractOtp(content);
    if (!otpCode) {
      // Invalid content for a Voice OTP route — release the dedupe marker so a
      // corrected retry is not blocked.
      releaseSmsSubmission(dedupeInput);
      return NextResponse.json({ error: "No 4-8 digit OTP in content" }, { status: 400 });
    }

    const maxConcurrent = tenantData?.maxConcurrentCalls ?? 10;
    const votpResult: VoiceOtpCallResult = await executeVoiceOtpCall({
      schemaName: tenant.schemaName,
      tenantId: tenant.tenantId,
      destination,
      sender,
      otpCode,
      messageId,
      supplierId,
      maxConcurrentCalls: maxConcurrent,
    });

    language = votpResult.language;
    langResolution = votpResult.langResolution;
    callAttempts = votpResult.callAttempts;
    callSid = votpResult.callSid;
    callSuccess = votpResult.success;
    dlrStatus = votpResult.success ? "DELIVERED" : "FAILED";
    status = votpResult.success ? "DELIVERED" : "FAILED";

    // ── Push instant DLR to external client webhook ──
    if (dlrCallbackUrl) {
      const votpDlrPayload = buildVoiceOtpHttpDlrPayload({
        messageId,
        destination: origDestination,
        source: origSender,
        status: dlrStatus as "DELIVERED" | "FAILED",
        cost: ratePerSms,
        routeName: (selectedRoute.route_name as string) || (selectedRoute.name as string) || "",
        supplierName: (selectedRoute.supplier_name as string) || "",
        otpCode: otpCode!,
        language: votpResult.language,
        callSid: votpResult.callSid,
        callAttempts: votpResult.callAttempts,
      });
      pushDlrToClient(dlrCallbackUrl, votpDlrPayload, tenant.schemaName).catch(() => {});
      console.log(`[VOICE-OTP] DLR pushed to client webhook: ${messageId} → ${dlrStatus} (callSid=${votpResult.callSid})`);
    }

    if (!votpResult.success && votpResult.errorMessage) {
      // Failed call — release the dedupe marker so a retry can proceed.
      releaseSmsSubmission(dedupeInput);
      return NextResponse.json({
        error: votpResult.errorMessage,
        concurrentCalls: votpResult.errorMessage?.includes("Concurrent") ? maxConcurrent : undefined,
      }, { status: 429 });
    }
  }

  let deliveryResult: { success: boolean; supplierMessageId?: string; routeUsed?: RouteInfo; fallbackUsed: boolean; failedRoutes: number; errorMessage?: string; queued?: boolean } | null = null;

  // ── Real outbound SMS delivery for non-Voice OTP routes ──
  const isVoiceOtp = selectedRoute.connection_type === "VOICE_OTP" || selectedRoute.connection_type === "Voice OTP";
  const isOttRoute = selectedRoute.connection_type === "WhatsApp OTT" || selectedRoute.connection_type === "Telegram OTT";
  const isCustomApi = selectedRoute.connection_type === "CUSTOM_API";
  const isBusinessApi = isBusinessApiRoute(selectedRoute.connection_type);

  // ── Voice OTP: store only OTP digits in content field (no SMS text) ──
  if (isVoiceOtp && otpCode) {
    content = otpCode;
  }

  if (!isVoiceOtp && !isOttRoute && !isCustomApi && !isBusinessApi && allRoutes.length > 0) {
    deliveryResult = await deliverSmsWithFallback(
      tenant.tenantId,
      tenant.schemaName,
      clientId,
      sender,
      destination,
      content,
      messageId,
      allRoutes,
      dlrCallbackUrl || undefined,
      undefined,
      tonNpiOverrides
    );

    status = deliveryResult.queued ? "QUEUED" : (deliveryResult.success ? "SENT" : "FAILED");
    dlrStatus = deliveryResult.queued ? "QUEUED" : (deliveryResult.success ? "SENT" : "FAILED");

    // Register DLR callback for HTTP push when real DLR arrives. Queued sends
    // are handled by the SMPP server's flush (which registers its own callback
    // and pushes the webhook), so don't double-register here.
    if (deliveryResult.success && !deliveryResult.queued && dlrCallbackUrl) {
      registerDlrCallback(messageId, (dlr: DlrPayload) => {
        const payload = {
          message_id: dlr.messageId,
          destination: dlr.dest,
          source: dlr.src,
          status: dlr.status,
          cost: ratePerSms,
          timestamp: new Date().toISOString(),
          route_name: deliveryResult?.routeUsed?.routeName,
          supplier_name: deliveryResult?.routeUsed?.supplierName,
          supplier_message_id: dlr.supplierMessageId,
        };
        pushDlrToClient(dlrCallbackUrl, payload, tenant.schemaName).catch(() => {});
      });
    }
  }

  let ottDeviceId: number | null = null;
  if (isOttRoute) {
    // ── Number validity: invalid destinations are REJECTED (never sent/charged) ──
    // Validate the ORIGINAL E.164 number — translation profiles may have already
    // rewritten the destination to a local format (e.g. BD strip +880), which
    // would otherwise fail the country-dial-code check on valid numbers.
    if (!isValidDestinationNumber(origDestination)) {
      status = "REJECTED";
      dlrStatus = "FAILED";
      if (dlrCallbackUrl) {
        pushDlrToClient(dlrCallbackUrl, {
          message_id: messageId,
          destination: origDestination,
          source: origSender,
          status: "FAILED",
          cost: 0,
          timestamp: new Date().toISOString(),
          route_name: (selectedRoute.route_name as string) || (selectedRoute.name as string) || "",
          supplier_name: (selectedRoute.supplier_name as string) || "",
          error: "Invalid destination number — rejected",
        }, tenant.schemaName).catch(() => {});
      }
      console.log(`[OTT] Rejected invalid destination ${destination} for ${messageId} (REJECTED / FAILED DLR)`);
    } else {
      const ottDeviceType: OttDeviceType = selectedRoute.connection_type === "WhatsApp OTT" ? "whatsapp" : "telegram";
      const onlineDevices = await getOnlineOttDevices(tenant.schemaName, ottDeviceType);

      if (onlineDevices.length === 0) {
        status = "FAILED";
        dlrStatus = "FAILED";
      } else {
        // Round-robin: use first available (sorted by last_seen ASC for load balancing)
        const ottDevice = onlineDevices[0];
        ottDeviceId = ottDevice.id;

        const ottResult = await sendOttMessage(
          tenant.schemaName,
          ottDevice.id,
          destination,
          content,
          messageId,
          clientId,
          routePlanId,
          (selectedRoute.route_id as number) || (selectedRoute.id as number),
          (selectedRoute.trunk_id as number) || null,
          (selectedRoute.supplier_id as number) || supplierId,
          ratePerSms
        );

        status = ottResult.success ? "SENT" : "FAILED";
        dlrStatus = ottResult.success ? "SENT" : "FAILED";
      }
    }
  }

  // --- Custom API Connector delivery ---
  let customApiSuccess = false;
  let customApiMessageId: string | null = null;
  if (isCustomApi && supplierId) {
    try {
      const suppResult = await tenantQuery(
        tenant.schemaName,
        "SELECT config FROM suppliers WHERE id = $1",
        [supplierId]
      );
      const rawConfig = suppResult.rows[0]?.config;
      const config = (typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig || {}) as Record<string, unknown>;
      const connectorId = config.custom_connector_id as number;

      if (connectorId) {
        const connResult = await tenantQuery(
          tenant.schemaName,
          "SELECT * FROM custom_api_connectors WHERE id = $1 AND is_active = true",
          [connectorId]
        );
        if (connResult.rows.length > 0) {
          const conn = connResult.rows[0];
          const vars: Record<string, string> = {
            dst: destination, message: content, sender: sender,
            message_id: messageId, apiKey: "",
          };

          const url = buildUrl(conn.send_url_template as string, vars);
          const fetchOptions: RequestInit = {
            method: (conn.send_method as string) || "GET",
            headers: parseHeaders(conn.send_headers as string || ""),
          };

          if (conn.send_body_template && conn.send_method === "POST") {
            fetchOptions.body = (conn.send_body_template as string)
              .replace(/\{\{dst\}\}/g, destination)
              .replace(/\{\{message\}\}/g, content)
              .replace(/\{\{sender\}\}/g, sender);
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);
          const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
          clearTimeout(timeout);

          const responseBody = await res.text();
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(responseBody); parsed.raw = responseBody; } catch { parsed = { raw: responseBody }; }

          customApiSuccess = conn.send_success_condition
            ? evaluateCondition(conn.send_success_condition as string, parsed)
            : res.status === 200;

          if (conn.send_message_id_path) {
            customApiMessageId = String(extractFromResponse(parsed, conn.send_message_id_path as string) || "");
          }
          // Fallback: extract transaction_id directly from raw response
          if (!customApiMessageId) {
            const txMatch = responseBody.match(/"transaction_id"\s*:\s*"([^"]+)"/);
            if (txMatch) customApiMessageId = txMatch[1];
          }
          // Last resort: try any id field in response
          if (!customApiMessageId && parsed.transaction_id) {
            customApiMessageId = String(parsed.transaction_id);
          }

      status = customApiSuccess ? "SENT" : "FAILED";
      dlrStatus = customApiSuccess ? "SENT" : "FAILED";

    }
      }
    } catch (err) {
      console.error("Custom API delivery error:", err);
      status = "FAILED";
      dlrStatus = "FAILED";
    }
  }

  // --- Business API Connector delivery (Telegram/WhatsApp via business_api_connect) ---
  let businessApiSuccess = false;
  let businessApiRejected = false;
  let businessApiMessageId: string | null = null;
  if (isBusinessApi && supplierId) {
    try {
      const suppResult = await tenantQuery(
        tenant.schemaName,
        "SELECT config FROM suppliers WHERE id = $1",
        [supplierId]
      );
      const rawConfig = suppResult.rows[0]?.config;
      const config = (typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig || {}) as Record<string, unknown>;
      const connectionId = config.business_api_connect_id as number;

      if (connectionId) {
        // ── Number-validity gate — validate the ORIGINAL E.164 (same convention
        //    as the OTT branch: translation profiles may have rewritten the
        //    destination to a local format by this point). Invalid → REJECTED,
        //    never sent and never charged (billing matrix rule 5). ──
        if (!isValidDestinationNumber(origDestination)) {
          businessApiRejected = true;
          status = "REJECTED";
          dlrStatus = "FAILED";
          if (dlrCallbackUrl) {
            pushDlrToClient(dlrCallbackUrl, {
              message_id: messageId,
              destination: origDestination,
              source: origSender,
              status: "FAILED",
              cost: 0,
              timestamp: new Date().toISOString(),
              route_name: (selectedRoute.route_name as string) || (selectedRoute.name as string) || "",
              supplier_name: (selectedRoute.supplier_name as string) || "",
              error: "Invalid destination number — rejected",
            }, tenant.schemaName).catch(() => {});
          }
          console.log(`[BUSINESS-API] Rejected invalid destination ${destination} for ${messageId} (REJECTED / FAILED DLR)`);
        } else {
          const baResult = await deliverBusinessApiRoute({
            schemaName: tenant.schemaName,
            connectionId,
            destination,
            message: content,
            sender,
            messageId,
            skipNumberGate: true, // origDestination already validated above
          });
          businessApiSuccess = baResult.success;
          // Provider HTTP 200 = delivery accepted and there is NO real DLR path
          // for Business API — so a success is stored as DELIVERED (like Voice
          // OTP). Storing SENT would let the dlr-timeout-sweeper flip the row
          // to FAILED after the window even though the client was charged at
          // submit (billing matrix: on_dlr pending → fail, but this was never
          // pending — the provider confirmed). DELIVERED also keeps the force
          // block from overwriting a real confirmation with dlr_source='FORCE'.
          status = baResult.success ? "DELIVERED" : "FAILED";
          dlrStatus = baResult.success ? "DELIVERED" : "FAILED";
          if (baResult.httpStatus && baResult.httpStatus >= 200 && baResult.httpStatus < 300) {
            businessApiMessageId = messageId;
          }
          console.log(`[BUSINESS-API] ${messageId} → ${baResult.status} (${baResult.apiName || baResult.provider || "Business API"}) http=${baResult.httpStatus ?? "—"}${baResult.error ? " · " + baResult.error : ""}`);
        }
      } else {
        console.warn(`[BUSINESS-API] No business_api_connect_id configured for supplier #${supplierId}`);
        status = "FAILED";
        dlrStatus = "FAILED";
      }
    } catch (err) {
      console.error("Business API delivery error:", err);
      status = "FAILED";
      dlrStatus = "FAILED";
    }
  }

  // ── Billing: use charging_mode to decide submit vs DLR billing ──
  const resolvedSupplierId = deliveryResult?.routeUsed?.supplierId || supplierId;
  const finalSuccess = status === "SENT" || status === "DELIVERED" || (isCustomApi && customApiSuccess) || (isVoiceOtp && callSuccess) || (isBusinessApi && businessApiSuccess);
  let supplierChargingMode: ChargingMode = "on_submit";
  let supplierDlrTimeout = 60;
  if (resolvedSupplierId) {
    try {
      const suppResult = await tenantQuery(
        tenant.schemaName,
        "SELECT charging_mode, force_dlr, dlr_timeout FROM suppliers WHERE id = $1",
        [resolvedSupplierId]
      );
      if (suppResult.rows.length > 0) {
        supplierChargingMode = resolveChargingMode(suppResult.rows[0]);
        supplierDlrTimeout = parseInt(suppResult.rows[0].dlr_timeout as string || "300");
      }
    } catch { /* use defaults */ }
  }

  // ── Client cost: charge now if not on_dlr ──
  // Business API has no real-time DLR path, so a valid send is charged at
  // submit even for on_dlr clients (mirrors /business-api/send) — otherwise the
  // charge would be deferred-and-lost when no DLR ever arrives.
  const businessApiChargedAtSubmit = isBusinessApi && businessApiSuccess;
  if (!finalSuccess) {
    // FAILED — don't charge client, don't pay supplier
    supplierCost = 0;
    profit = 0;
  } else if (isSubmitCharged(clientChargingMode) || businessApiChargedAtSubmit) {
    // Charge client immediately
    if (resolvedSupplierId) {
      try {
        supplierCost = await lookupSupplierCost(origDestination, resolvedSupplierId as number, tenant.schemaName);
        profit = ratePerSms - supplierCost;
      } catch { /* use defaults */ }
    }
  } else {
    // Client is on_dlr — defer cost to DLR arrival
    supplierCost = 0;
    profit = 0;
  }

  // Client cost: 0 for on_dlr, ratePerSms otherwise (Business API always
  // charges at submit on success)
  const finalCost = (!finalSuccess || (isDlrCharged(clientChargingMode) && !businessApiChargedAtSubmit)) ? 0 : ratePerSms;

  // Insert message (store original + translated values, always SENT — real DLR will update later)
  const msgResult = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO messages (client_id, sender, destination, content, status,
      route_plan_id, route_id, trunk_id, supplier_id, connection_type,
      cost, supplier_cost, profit, dlr_status, dlr_timestamp, otp_code, language, message_id,
      original_sender, original_destination, original_content, translation_notes,
      dlr_callback_url, supplier_message_id, dlr_source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING *`,
    [
      clientId, sender, destination, content, status,
      routePlanId,
      deliveryResult?.routeUsed?.routeId || (selectedRoute.route_id as number) || (selectedRoute.id as number),
      deliveryResult?.routeUsed?.trunkId || (selectedRoute.trunk_id as number) || null,
      resolvedSupplierId,
      deliveryResult?.routeUsed?.connectionType || (selectedRoute.connection_type as string),
      finalCost, supplierCost, profit,
      dlrStatus,
      !isVoiceOtp && dlrStatus !== "SENT" && dlrStatus !== "QUEUED" ? new Date() : null,
      otpCode, language, messageId,
      origSender, origDestination, origContent,
      appliedTranslations.length > 0 ? JSON.stringify(appliedTranslations) : null,
      dlrCallbackUrl,
      deliveryResult?.supplierMessageId || customApiMessageId || businessApiMessageId || null,
      status === "REJECTED" ? "REJECTED" : null,
    ]
  );

  // ── Release dedupe marker when the send FAILED so a retry can proceed ──
  if (!finalSuccess) {
    releaseSmsSubmission(dedupeInput);
  }

  // ── Deduct SMS counter — atomic increment to avoid race conditions ──
  // Skip for on_dlr clients (counter is charged at DLR time). Business API has
  // no real-time DLR path, so a successful send is charged at submit even for
  // on_dlr clients (mirrors the standalone /business-api/send endpoint).
  if (tenantData && (isSubmitCharged(clientChargingMode) || (isBusinessApi && businessApiSuccess))) {
    await db
      .update(tenants)
      .set({ smsCounter: sql`sms_counter + 1` })
      .where(eq(tenants.id, tenant.tenantId));
  }

  // ── Force DLR / Force DLR Timeout logic ──
  // force_dlr: push immediate success DLR to client NOW
  // force_dlr_timeout: charge now + schedule timeout to auto-deliver if no real DLR
  if ((isForceDlr(clientChargingMode) || isForceDlrTimeout(clientChargingMode) ||
       isForceDlr(supplierChargingMode) || isForceDlrTimeout(supplierChargingMode)) &&
      status === "SENT" && dlrStatus === "SENT") {
    const actualSupplierId = deliveryResult?.routeUsed?.supplierId || (selectedRoute.supplier_id as number) || supplierId;
    const fSchemaName = tenant.schemaName;
    const fDestination = origDestination;
    const fSource = origSender;
    const fRatePerSms = ratePerSms;
    const fRouteName = deliveryResult?.routeUsed?.routeName || (selectedRoute.route_name as string) || (selectedRoute.name as string) || "";
    const fSupplierName = deliveryResult?.routeUsed?.supplierName || (selectedRoute.supplier_name as string) || "";
    const fSupplierMsgId = deliveryResult?.supplierMessageId || null;

    // Determine timeout: use the smaller of client and supplier dlr_timeout
    const effectiveTimeout = Math.min(clientDlrTimeout, supplierDlrTimeout);

    // force_dlr (no timeout): push DLR immediately
    if (isForceDlr(clientChargingMode) || isForceDlr(supplierChargingMode)) {
      console.log(`[FORCE-DLR] Pushing immediate DLR for ${messageId}`);
      await tenantQuery(
        fSchemaName,
        `UPDATE messages SET dlr_status = 'DELIVERED', status = 'DELIVERED', dlr_timestamp = NOW(), dlr_source = 'FORCE' WHERE message_id = $1`,
        [messageId]
      );

      // Charge on_dlr side now (since we're forcing delivery)
      if (isDlrCharged(clientChargingMode)) {
        await db
          .update(tenants)
          .set({ smsCounter: sql`sms_counter + 1` })
          .where(eq(tenants.id, tenant.tenantId));
      }

      // Margin isolation (matrix rule 2): a CLIENT force-DLR event must NOT pay
      // the supplier — only a force-mode supplier records cost on the outcome.
      const actualSupplierId2 = deliveryResult?.routeUsed?.supplierId || (selectedRoute.supplier_id as number) || supplierId;
      if (isForceDlrOrTimeout(supplierChargingMode) && actualSupplierId2) {
        try {
          const supCost = await lookupSupplierCost(origDestination, actualSupplierId2 as number, tenant.schemaName);
          await tenantQuery(
            fSchemaName,
            `UPDATE messages SET supplier_cost = $1, profit = cost - $1 WHERE message_id = $2`,
            [supCost, messageId]
          );
        } catch { /* best-effort */ }
      }

      if (dlrCallbackUrl) {
        const forcePayload = buildForceDlrPayload({
          messageId, supplierMessageId: fSupplierMsgId,
          destination: fDestination, source: fSource,
          cost: fRatePerSms, routeName: fRouteName,
          supplierName: fSupplierName, forceDlr: true,
        });
        pushDlrToClient(dlrCallbackUrl, forcePayload, tenant.schemaName).catch(() => {});
        console.log(`[FORCE-DLR] Immediate DLR pushed to client webhook: ${messageId} → DELIVERED`);
      }
    } else {
      // force_dlr_timeout: schedule fallback
      console.log(`[FORCE-DLR] Timeout scheduled for ${messageId}: will auto-deliver in ${effectiveTimeout}s if no real DLR`);
      setTimeout(async () => {
        try {
          const checkResult = await tenantQuery(
            fSchemaName,
            `SELECT dlr_status, cost, supplier_cost FROM messages WHERE message_id = $1`,
            [messageId]
          );
          if (checkResult.rows.length > 0 && checkResult.rows[0].dlr_status === 'SENT') {
            const existingCost = parseFloat(checkResult.rows[0].cost || "0");
            const existingSuppCost = parseFloat(checkResult.rows[0].supplier_cost || "0");

            // If either side was on_dlr with zero cost, charge them now
            let updateCost = existingCost;
            let updateSuppCost = existingSuppCost;
            let updateProfit = existingCost - existingSuppCost;

            if (isDlrCharged(clientChargingMode) && existingCost === 0) {
              updateCost = fRatePerSms;
              updateProfit = updateCost - updateSuppCost;
              await db
                .update(tenants)
                .set({ smsCounter: sql`sms_counter + 1` })
                .where(eq(tenants.id, tenant.tenantId));
            }
            // Margin isolation (matrix rule 2): a CLIENT force-DLR timeout must
            // NOT pay the supplier — only a supplier running force_dlr /
            // force_dlr_timeout itself records cost on vendor timeout.
            if (isForceDlrOrTimeout(supplierChargingMode) && existingSuppCost === 0) {
              try {
                const actualSupplierId3 = deliveryResult?.routeUsed?.supplierId || (selectedRoute.supplier_id as number) || supplierId;
                updateSuppCost = actualSupplierId3 ? await lookupSupplierCost(origDestination, actualSupplierId3 as number, tenant.schemaName) : existingSuppCost;
                updateProfit = updateCost - updateSuppCost;
              } catch { /* keep existing */ }
            }

            await tenantQuery(
              fSchemaName,
              `UPDATE messages SET dlr_status = 'DELIVERED', status = 'DELIVERED', dlr_timestamp = NOW(), dlr_source = 'FORCE_TIMEOUT',
               cost = $2, supplier_cost = $3, profit = $4 WHERE message_id = $1`,
              [messageId, updateCost, updateSuppCost, updateProfit]
            );
            console.log(`[FORCE-DLR] Timeout: no real DLR in ${effectiveTimeout}s → ${messageId} marked DELIVERED`);

            if (dlrCallbackUrl) {
              const forcePayload = buildForceDlrPayload({
                messageId, supplierMessageId: fSupplierMsgId,
                destination: fDestination, source: fSource,
                cost: fRatePerSms, routeName: fRouteName,
                supplierName: fSupplierName, forceDlr: true,
              });
              pushDlrToClient(dlrCallbackUrl, forcePayload, tenant.schemaName).catch(() => {});
              console.log(`[FORCE-DLR] Timeout DLR pushed to client webhook: ${messageId} → DELIVERED`);
            }
          } else {
            console.log(`[FORCE-DLR] Timeout skipped for ${messageId}: real DLR already received (status=${checkResult.rows[0]?.dlr_status})`);
          }
        } catch (err) {
          console.error(`[FORCE-DLR] Timeout error for ${messageId}:`, err);
        }
      }, effectiveTimeout * 1000);
    }
  }

  return NextResponse.json({
    success: isVoiceOtp ? (callSuccess || dlrStatus === "DELIVERED") : (isOttRoute || isCustomApi || isBusinessApi ? status === "SENT" || status === "DELIVERED" : (deliveryResult?.success ?? false)),
    message: msgResult.rows[0],
    messageId,
    routing: {
      routePlan: routePlanName || routePlanId,
      route: deliveryResult?.routeUsed?.routeName || selectedRoute.route_name || selectedRoute.name,
      trunk: deliveryResult?.routeUsed?.trunkName || selectedRoute.trunk_name,
      supplier: deliveryResult?.routeUsed?.supplierName || selectedRoute.supplier_name,
      connectionType: deliveryResult?.routeUsed?.connectionType || selectedRoute.connection_type,
      fallbackUsed: deliveryResult?.fallbackUsed || false,
      failedRoutes: deliveryResult?.failedRoutes || 0,
    },
    cost: isDlrCharged(clientChargingMode) ? 0 : (finalSuccess ? ratePerSms : 0),
    supplierCost,
    profit,
    supplierMessageId: deliveryResult?.supplierMessageId || customApiMessageId || businessApiMessageId || null,
    queued: deliveryResult?.queued ?? false,
    dlr: { status: dlrStatus, pushed_to: client.dlr_callback_url || client.webhook_url || null },
    ott: ottDeviceId ? {
      deviceId: ottDeviceId,
      deviceType: selectedRoute.connection_type,
      status,
    } : null,
    voiceOtp: otpCode ? {
      otpCode,
      language,
      status: dlrStatus,
      callSid,
      attemptCount: callAttempts.length,
      country: langResolution!.country,
      attempts: callAttempts.map(a => ({
        attempt: a.attempt,
        language: a.language,
        status: a.status,
        duration: a.duration,
        sipCallId: a.sipCallId,
        errorMessage: a.errorMessage,
      })),
    } : null,
  });
}
