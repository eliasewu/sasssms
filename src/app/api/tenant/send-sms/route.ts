import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { applyTranslations, applyEntityTranslations } from "@/lib/translation-engine";
import { executeVoiceOtpCall } from "@/lib/voice-otp-engine";
import {
  deliverSmsWithFallback,
  registerDlrCallback,
  filterRoutesByTrunkMcc,
} from "@/lib/smpp-client";
import type { CallAttempt, VoiceOtpCallResult } from "@/lib/voice-otp-engine";
import type { RouteInfo, DlrPayload } from "@/lib/smpp-client";
import { getOnlineOttDevices, sendOttMessage } from "@/lib/ott-pairing-engine";
import type { OttDeviceType } from "@/lib/ott-pairing-engine";
import { lookupClientRate, lookupSupplierCost } from "@/lib/rates";
import { buildUrl, evaluateCondition, extractFromResponse, parseHeaders } from "@/lib/api-connector-parser";

export const dynamic = "force-dynamic";

function extractOtp(content: string): string | null {
  const match = content.match(/\b(\d{4,8})\b/);
  return match ? match[1] : null;
}

/**
 * Push DLR to external client via HTTP callback
 */
async function pushDlrToClient(dlrUrl: string, payload: Record<string, unknown>) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    await fetch(dlrUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
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
  const clientBillingMode = (client.billing_mode as string) || "prepaid";
  const isDlrBilling = clientBillingMode === "dlr";
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
  try {
    const clientTransResult = await applyTranslations(
      tenant.schemaName, clientId, null,
      sender, destination, content
    );
    sender = clientTransResult.sender;
    destination = clientTransResult.destination;
    content = clientTransResult.content;
    appliedTranslations.push(...clientTransResult.appliedProfiles);
  } catch (err) {
    console.error("Client translation error:", err);
    // Continue with original values on error
  }

  let status = "SENT";
  let dlrStatus = "PENDING";
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
       LEFT JOIN suppliers s ON t.supplier_id = s.id AND s.is_active = true
       WHERE r.id = $1 AND r.is_active = true`,
      [testRouteId]
    );
    if (routeResult.rows.length === 0) {
      return NextResponse.json({ error: "Route not found or inactive" }, { status: 404 });
    }
    const r = routeResult.rows[0];
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
       JOIN suppliers s ON t.supplier_id = s.id AND s.is_active = true
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
        sender, destination, content
      );
      sender = suppTransResult.sender;
      destination = suppTransResult.destination;
      content = suppTransResult.content;
      appliedTranslations.push(...suppTransResult.appliedNames.map((n: string) => `[Supplier] ${n}`));
    } catch (err) {
      console.error("Supplier translation error:", err);
    }
  }

  // ── Voice OTP handling (shared engine-based flow with retry) ──
  if (
    selectedRoute.connection_type === "VOICE_OTP" ||
    selectedRoute.connection_type === "Voice OTP"
  ) {
    otpCode = extractOtp(content);
    if (!otpCode) {
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

    if (!votpResult.success && votpResult.errorMessage) {
      return NextResponse.json({
        error: votpResult.errorMessage,
        concurrentCalls: votpResult.errorMessage?.includes("Concurrent") ? maxConcurrent : undefined,
      }, { status: 429 });
    }
  }

  let deliveryResult: { success: boolean; supplierMessageId?: string; routeUsed?: RouteInfo; fallbackUsed: boolean; failedRoutes: number; errorMessage?: string } | null = null;

  // ── Real outbound SMS delivery for non-Voice OTP routes ──
  const isVoiceOtp = selectedRoute.connection_type === "VOICE_OTP" || selectedRoute.connection_type === "Voice OTP";
  const isOttRoute = selectedRoute.connection_type === "WhatsApp OTT" || selectedRoute.connection_type === "Telegram OTT";
  const isCustomApi = selectedRoute.connection_type === "CUSTOM_API";

  if (!isVoiceOtp && !isOttRoute && !isCustomApi && allRoutes.length > 0) {
    deliveryResult = await deliverSmsWithFallback(
      tenant.tenantId,
      tenant.schemaName,
      clientId,
      sender,
      destination,
      content,
      messageId,
      allRoutes,
      dlrCallbackUrl || undefined
    );

    status = deliveryResult.success ? "SENT" : "FAILED";
    dlrStatus = deliveryResult.success ? "PENDING" : "FAILED";

    // Register DLR callback for HTTP push when real DLR arrives
    if (deliveryResult.success && dlrCallbackUrl) {
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
        pushDlrToClient(dlrCallbackUrl, payload).catch(() => {});
      });
    }
  }

  let ottDeviceId: number | null = null;
  if (isOttRoute) {
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
      dlrStatus = ottResult.success ? "PENDING" : "FAILED";
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
          dlrStatus = customApiSuccess ? "PENDING" : "FAILED";
        }
      }
    } catch (err) {
      console.error("Custom API delivery error:", err);
      status = "FAILED";
      dlrStatus = "FAILED";
    }
  }

  // ── Billing: use client billing_mode to decide submit vs DLR billing ──
  const resolvedSupplierId = deliveryResult?.routeUsed?.supplierId || supplierId;
  const finalSuccess = status === "SENT" || status === "DELIVERED" || (isCustomApi && customApiSuccess) || (isVoiceOtp && callSuccess);
  if (isDlrBilling) {
    // DLR-based billing — cost charged in dlr-poller.ts on DELIVERED
    supplierCost = 0;
    profit = 0;
  } else if (resolvedSupplierId && finalSuccess) {
    try {
      supplierCost = await lookupSupplierCost(origDestination, resolvedSupplierId as number, tenant.schemaName);
      profit = ratePerSms - supplierCost;
    } catch { /* use defaults */ }
  } else if (!finalSuccess) {
    // FAILED deliveries — don't charge client, don't pay supplier
    supplierCost = 0;
    profit = 0;
  }

  // ── Force DLR check BEFORE message INSERT — so correct status is stored immediately ──
  let forceDlrApplied = false;
  const clientForceDlr = !!(client.force_dlr);
  let supplierForceDlr = false;

  const actualSupplierId = deliveryResult?.routeUsed?.supplierId || (selectedRoute.supplier_id as number) || supplierId;
  if (!clientForceDlr && actualSupplierId) {
    try {
      const suppCheck = await tenantQuery(
        tenant.schemaName,
        "SELECT force_dlr FROM suppliers WHERE id = $1",
        [actualSupplierId]
      );
      supplierForceDlr = !!(suppCheck.rows[0]?.force_dlr);
    } catch { /* proceed without */ }
  }


  if ((clientForceDlr || supplierForceDlr) && status === "SENT" && dlrStatus === "PENDING") {
    forceDlrApplied = true;
    dlrStatus = "DELIVERED";
    status = "DELIVERED";
  }

  // Insert message (store original + translated values, with force DLR status already applied)
  const msgResult = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO messages (client_id, sender, destination, content, status,
      route_plan_id, route_id, trunk_id, supplier_id, connection_type,
      cost, supplier_cost, profit, dlr_status, dlr_timestamp, otp_code, language, message_id,
      original_sender, original_destination, original_content, translation_notes,
      dlr_callback_url, supplier_message_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *`,
    [
      clientId, sender, destination, content, status,
      routePlanId,
      deliveryResult?.routeUsed?.routeId || (selectedRoute.route_id as number) || (selectedRoute.id as number),
      deliveryResult?.routeUsed?.trunkId || (selectedRoute.trunk_id as number) || null,
      resolvedSupplierId,
      deliveryResult?.routeUsed?.connectionType || (selectedRoute.connection_type as string),
      (isDlrBilling ? 0 : finalSuccess ? ratePerSms : 0), supplierCost, profit,
      dlrStatus,
      !isVoiceOtp && dlrStatus !== "PENDING" ? new Date() : null,
      otpCode, language, messageId,
      origSender, origDestination, origContent,
      appliedTranslations.length > 0 ? JSON.stringify(appliedTranslations) : null,
      dlrCallbackUrl,
      deliveryResult?.supplierMessageId || customApiMessageId || null,
    ]
  );

  // ── Deduct SMS counter — atomic increment to avoid race conditions ──
  // Skip for DLR-billed clients (their counter is charged in dlr-poller on DELIVERED)
  if (tenantData && tenantData.smsLimit && tenantData.smsLimit > 0 && !isDlrBilling) {
    await db
      .update(tenants)
      .set({ smsCounter: sql`sms_counter + 1` })
      .where(eq(tenants.id, tenant.tenantId));
  }

  // ── Force DLR: push immediate DELIVERED callback to external client ──
  if (forceDlrApplied && dlrCallbackUrl) {
    const forcePayload = {
      message_id: messageId,
      destination: origDestination,
      source: origSender,
      status: "DELIVERED",
      cost: ratePerSms,
      timestamp: new Date().toISOString(),
      route_name: deliveryResult?.routeUsed?.routeName || (selectedRoute.route_name as string) || (selectedRoute.name as string),
      supplier_name: deliveryResult?.routeUsed?.supplierName || (selectedRoute.supplier_name as string),
      supplier_message_id: deliveryResult?.supplierMessageId || null,
      force_dlr: true,
    };
    pushDlrToClient(dlrCallbackUrl, forcePayload).catch(() => {});
    console.log(`[FORCE-DLR] Immediate DELIVERED pushed for ${messageId} (${clientForceDlr ? 'client' : 'supplier'} force_dlr)`);
  }

  return NextResponse.json({
    success: isVoiceOtp ? (callSuccess || dlrStatus === "DELIVERED") : (isOttRoute || isCustomApi ? status === "SENT" : (deliveryResult?.success ?? false)),
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
    cost: isDlrBilling ? 0 : (finalSuccess ? ratePerSms : 0),
    supplierCost,
    profit,
    supplierMessageId: deliveryResult?.supplierMessageId || customApiMessageId || null,
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
