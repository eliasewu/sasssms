import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { applyTranslations, applyEntityTranslations } from "@/lib/translation-engine";
import {
  resolveLanguage, buildAttemptPlaylists, generateCallSid,
  determineAttemptLanguages,
} from "@/lib/voice-otp-engine";
import { AsteriskAmiExecutor } from "@/lib/asterisk-ami";
import {
  deliverSmsWithFallback,
  registerDlrCallback,
  filterRoutesByTrunkMcc,
} from "@/lib/smpp-client";
import type { AudioFile, SipConfig, CallAttempt, AudioPlaylistItem } from "@/lib/voice-otp-engine";
import type { RouteInfo, DlrPayload } from "@/lib/smpp-client";
import { getOnlineOttDevices, sendOttMessage } from "@/lib/ott-pairing-engine";
import type { OttDeviceType } from "@/lib/ott-pairing-engine";
import { lookupClientRate, lookupSupplierCost } from "@/lib/rates";
import { buildUrl, evaluateCondition, extractFromResponse, parseHeaders } from "@/lib/api-connector-parser";

export const dynamic = "force-dynamic";

// Use real Asterisk AMI executor, fall back to simulation if AMI is unavailable
const amiExecutor = new AsteriskAmiExecutor();

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

  // Extract supplier ID from selected route
  supplierId = (selectedRoute.supplier_id as number) || null;

  // ── Trunk-level MCC/MNC filtering ──
  allRoutes = filterRoutesByTrunkMcc(allRoutes, destination);
  if (allRoutes.length === 0) {
    return NextResponse.json({ error: "No routes available for this destination (MCC filtering)" }, { status: 400 });
  }

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

  // ── Voice OTP handling (full engine-based flow with retry) ──
  if (
    selectedRoute.connection_type === "VOICE_OTP" ||
    selectedRoute.connection_type === "Voice OTP"
  ) {
    otpCode = extractOtp(content);
    if (!otpCode) {
      return NextResponse.json({ error: "No 4-8 digit OTP in content" }, { status: 400 });
    }

    // ── 1. Country & Language Detection ──
    langResolution = resolveLanguage(destination);
    language = langResolution.primaryLanguage;
    const mcc = langResolution.mcc;

    // ── 2. Check concurrent call limit ──
    const maxConcurrent = tenantData?.maxConcurrentCalls ?? 10;
    const activeCalls = await tenantQuery(
      tenant.schemaName,
      "SELECT COUNT(*) as count FROM voice_otp_call_logs WHERE status = 'IN_PROGRESS'"
    );
    const activeCount = parseInt(activeCalls.rows[0]?.count || "0");
    if (activeCount >= maxConcurrent) {
      return NextResponse.json({ 
        error: `Concurrent call limit reached (max ${maxConcurrent}). Try again shortly.`,
        concurrentCalls: activeCount,
      }, { status: 429 });
    }

    // ── 3. Fetch audio files, SIP configs & voice OTP language config ──
    const [audioResult, sipResult, votpConfigResult] = await Promise.all([
      tenantQuery(tenant.schemaName, "SELECT * FROM voice_otp_audio ORDER BY id").catch(() => ({ rows: [] as AudioFile[] })),
      tenantQuery(tenant.schemaName, "SELECT * FROM voice_otp_sip_config WHERE is_active = true ORDER BY id").catch(() => ({ rows: [] as SipConfig[] })),
      // Match language config by MCC prefix: each config's prefixes is a comma-separated list.
      // Use string_to_array to split, then check if the destination MCC starts with any prefix.
      tenantQuery(tenant.schemaName,
        `SELECT * FROM voice_otp_config
         WHERE is_active = true AND EXISTS (
           SELECT 1 FROM unnest(string_to_array(COALESCE(prefixes,''), ',')) AS pfx
           WHERE $1 LIKE pfx || '%'
         ) ORDER BY id LIMIT 1`,
        [langResolution.mcc]
      ).catch(() => ({ rows: [] as Record<string,unknown>[] })),
    ]);
    const audioFiles: AudioFile[] = audioResult.rows;
    const sipConfigs: SipConfig[] = sipResult.rows;
    const activeSip = sipConfigs[0] || null;

    // ── Get retry/play config from voice_otp_config (language tab settings) ──
    const votpConfig = votpConfigResult.rows[0] as Record<string,unknown> | undefined;
    const retryCount = (votpConfig?.retry_count as number) || (activeSip?.maxRetries as number) || 3;
    const playCount = (votpConfig?.play_count as number) || 3;
    const bilingual = (votpConfig?.bilingual as boolean) || false;
    const primaryLang = (votpConfig?.primary_language as string) || langResolution.primaryLanguage;
    const secondaryLang = (votpConfig?.secondary_language as string) || langResolution.fallbackLanguage;

    // ── Reconnect schedule: delay between retry attempts (minutes → seconds) ──
    // schedule 0 = immediate, 1 = 60s delay, 2 = 120s delay
    const reconnectSchedule = [0, 60, 120];

    // ── 4. Build audio playlists for all attempts ──
    const attemptLanguages = determineAttemptLanguages(langResolution, retryCount);
    let attemptPlaylists: Array<Array<AudioPlaylistItem>> = [];
    try {
      attemptPlaylists = await buildAttemptPlaylists(audioFiles, langResolution, otpCode, {
        primaryLanguage: primaryLang,
        secondaryLanguage: secondaryLang,
        bilingual,
        playCount,
        retryCount,
      });
    } catch {
      // Build empty playlists on error (will use built-in audio)
      attemptPlaylists = attemptLanguages.map(() => []);
    }

    // ── Fetch supplier's API config (for external HTTP API mode) ──
    let supplierApiUrl: string | null = null;
    let supplierApiKey: string | null = null;
    if (supplierId) {
      try {
        const suppResult = await tenantQuery(
          tenant.schemaName,
          "SELECT api_url, api_key, config FROM suppliers WHERE id = $1",
          [supplierId]
        );
        if (suppResult.rows.length > 0) {
          supplierApiUrl = (suppResult.rows[0].api_url as string) || null;
          supplierApiKey = (suppResult.rows[0].api_key as string) || null;
        }
      } catch { /* proceed without */ }
    }

    // ── 5. Call execution: external HTTP API mode (preferred) or built-in Asterisk AMI ──
    // NOTE: reconnect_schedule [0, 60, 120] means retry 1 is immediate,
    // retry 2 after 1 minute, retry 3 after 2 minutes. Total window ~3 min.
    // The initial IN_PROGRESS response is returned immediately; the full
    // result can be checked via the voice_otp_call_logs table or call logs API.
    callAttempts = [];
    let totalDuration = 0;
    callSid = generateCallSid();

    // Log initial IN_PROGRESS
    await tenantQuery(
      tenant.schemaName,
      `INSERT INTO voice_otp_call_logs (destination, otp_code, language, status, attempt_count,
        sip_config_id, sip_config_name, call_sid, country, mcc)
       VALUES ($1, $2, $3, 'IN_PROGRESS', 0, $4, $5, $6, $7, $8)`,
      [destination, otpCode, language, activeSip?.id || null,
       activeSip?.name || null, callSid, langResolution.country, mcc]
    );

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      const attLanguage = attemptLanguages[attempt - 1];
      const attPlaylist = attemptPlaylists[attempt - 1] || [];
      const startTime = new Date().toISOString();

      // ── Apply reconnect delay between attempts (skip first attempt) ──
      if (attempt > 1) {
        const delaySec = reconnectSchedule[Math.min(attempt - 1, reconnectSchedule.length - 1)];
        if (delaySec > 0) {
          console.log(`[VOICE-OTP] Retry attempt ${attempt}/${retryCount} — waiting ${delaySec}s before next call...`);
          await new Promise(resolve => setTimeout(resolve, delaySec * 1000));
        }
      }

      // Execute SIP call: try external HTTP API first, fall back to Asterisk AMI
      let sipResult: { success: boolean; callSid: string; duration: number; status: "ANSWERED"|"NO_ANSWER"|"BUSY"|"FAILED"; errorMessage?: string };

      // ── Mode A: External Voice OTP HTTP API ──
      if (supplierApiUrl) {
        try {
          const audioDir = attPlaylist.length > 0 && attPlaylist[0].fileUrl
            ? attPlaylist[0].fileUrl.replace(/\/[^/]+$/, "") : "/audio/builtin";
          const greetingFile = attPlaylist.find(p => p.type === "greeting");

          const apiPayload: Record<string, unknown> = {
            src_num: sender,
            dst_num: destination,
            message: otpCode,
            internal_message_id: messageId || callSid,
            src_sip_address: activeSip ? `${activeSip.sipHost || "127.0.0.1"}:${activeSip.sipPort || 5060}` : "127.0.0.1:5060",
            dst_sip_address: activeSip ? `${activeSip.sipHost || "127.0.0.1"}:${activeSip.sipPort || 5060}` : "127.0.0.1:5060",
            play_count: playCount,
            play_sleep_ms: 0,
            reconnect_schedule: "0,1,2",
            dlr_send: true,
            dlr_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://net2app.com"}/api/tenant/voice-otp-dlr-callback?message_id=${messageId || callSid}&supplier_id=${supplierId}&tenant_id=${tenant.tenantId}&schema=${encodeURIComponent(tenant.schemaName)}&status={{status}}`,
            audio_files_dir: audioDir,
            greeting_file: greetingFile?.fileName || "codeismen.mp3",
            audio_codec: "G729",
          };

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (supplierApiKey) headers["Authorization"] = `Bearer ${supplierApiKey}`;

          const apiRes = await fetch(supplierApiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(apiPayload),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          sipResult = {
            success: apiRes.ok,
            callSid: callSid || generateCallSid(),
            duration: 0,
            status: apiRes.ok ? "ANSWERED" : "FAILED",
            errorMessage: apiRes.ok ? undefined : `API returned ${apiRes.status}`,
          };
        } catch (err) {
          sipResult = {
            success: false,
            callSid: callSid || generateCallSid(),
            duration: 0,
            status: "FAILED",
            errorMessage: `External API error: ${(err as Error).message}`,
          };
        }
      }
      // ── Mode B: Built-in Asterisk AMI or simulation fallback ──
      else if (activeSip) {
        try {
          // Try real Asterisk AMI first
          sipResult = await amiExecutor.originateCall({
            destination,
            callerId: activeSip.callerId || "Net2APP",
            sipHost: activeSip.sipHost || "",
            sipPort: activeSip.sipPort || 5060,
            sipUsername: activeSip.sipUsername || "",
            sipPassword: activeSip.sipPassword || "",
            timeout: activeSip.timeout || 30,
            audioPlaylist: attPlaylist,
          });
        } catch {
          // AMI failed — fall back to simulation
          const roll = Math.random();
          sipResult = {
            success: roll > 0.3,
            callSid: generateCallSid(),
            duration: roll > 0.3 ? Math.floor(3 + Math.random() * 22) : 0,
            status: roll > 0.3 ? "ANSWERED" : (roll > 0.15 ? "NO_ANSWER" : "FAILED"),
            errorMessage: "AMI unavailable — using simulation fallback",
          };
        }
      } else {
        // No SIP config — use fallback simulation
        const roll = Math.random();
        sipResult = {
          success: roll > 0.3,
          callSid: generateCallSid(),
          duration: roll > 0.3 ? Math.floor(3 + Math.random() * 22) : 0,
          status: roll > 0.3 ? "ANSWERED" : (roll > 0.15 ? "NO_ANSWER" : "FAILED"),
          errorMessage: roll > 0.3 ? undefined : "No SIP config — fallback simulation",
        };
      }

      const endTime = new Date().toISOString();
      const attRecord: CallAttempt = {
        attempt,
        language: attLanguage,
        startTime,
        endTime,
        duration: sipResult.duration,
        status: sipResult.status,
        audioPlaylist: attPlaylist,
        sipCallId: sipResult.callSid,
        errorMessage: sipResult.errorMessage || null,
      };
      callAttempts.push(attRecord);
      totalDuration += sipResult.duration || 0;

      if (sipResult.success) {
        callSuccess = true;
        break;
      }
    }

    // ── 6. Final status update (single UPDATE, no duplicates) ──
    const finalStatus = callSuccess ? "COMPLETED" : "FAILED";
    const finalPlaylist = callAttempts[callAttempts.length - 1]?.audioPlaylist || [];
    dlrStatus = callSuccess ? "DELIVERED" : "FAILED";
    status = callSuccess ? "DELIVERED" : "FAILED";

    await tenantQuery(
      tenant.schemaName,
      `UPDATE voice_otp_call_logs SET status = $1, duration = $2, attempt_count = $3,
        attempt_log = $4, audio_playlist = $5
       WHERE call_sid = $6`,
      [finalStatus, totalDuration, callAttempts.length,
       JSON.stringify(callAttempts),
       JSON.stringify(finalPlaylist),
       callSid]
    );
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
      const config = (suppResult.rows[0]?.config as Record<string, unknown>) || {};
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
          try { parsed = JSON.parse(responseBody); } catch { parsed = { raw: responseBody }; }

          customApiSuccess = conn.send_success_condition
            ? evaluateCondition(conn.send_success_condition as string, parsed)
            : res.status === 200;

          if (conn.send_message_id_path) {
            customApiMessageId = String(extractFromResponse(parsed, conn.send_message_id_path as string) || "");
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

  // Look up supplier cost and calculate profit
  const resolvedSupplierId = deliveryResult?.routeUsed?.supplierId || supplierId;
  if (resolvedSupplierId && status === "SENT") {
    try {
      supplierCost = await lookupSupplierCost(destination, resolvedSupplierId as number, tenant.schemaName);
      profit = ratePerSms - supplierCost;
    } catch { /* use defaults */ }
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

  console.log(`[FORCE-DLR-DEBUG] clientForceDlr=${clientForceDlr} supplierForceDlr=${supplierForceDlr} status=${status} dlrStatus=${dlrStatus} clientRaw=${client.force_dlr}`);

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
      ratePerSms, supplierCost, profit,
      dlrStatus,
      !isVoiceOtp && dlrStatus !== "PENDING" ? new Date() : null,
      otpCode, language, messageId,
      origSender, origDestination, origContent,
      appliedTranslations.length > 0 ? JSON.stringify(appliedTranslations) : null,
      dlrCallbackUrl,
      deliveryResult?.supplierMessageId || customApiMessageId || null,
    ]
  );

  // Increment tenant SMS counter on success (tenant-level billing)
  // ── Charge on submit: deduct SMS credit immediately ──
  if (deliveryResult?.success || isVoiceOtp || (isOttRoute && status === "SENT") || customApiSuccess) {
    if (tenantData) {
      await db
        .update(tenants)
        .set({ smsCounter: (tenantData.smsCounter || 0) + 1 })
        .where(eq(tenants.id, tenant.tenantId));
    }
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
    success: isVoiceOtp ? (callSuccess || dlrStatus === "DELIVERED") : (isOttRoute ? status === "SENT" : (isCustomApi ? customApiSuccess : (deliveryResult?.success ?? false))),
    message: msgResult.rows[0],
    messageId,
    routing: {
      routePlan: routePlanId,
      route: deliveryResult?.routeUsed?.routeName || selectedRoute.route_name || selectedRoute.name,
      trunk: deliveryResult?.routeUsed?.trunkName || selectedRoute.trunk_name,
      supplier: deliveryResult?.routeUsed?.supplierName || selectedRoute.supplier_name,
      connectionType: deliveryResult?.routeUsed?.connectionType || selectedRoute.connection_type,
      fallbackUsed: deliveryResult?.fallbackUsed || false,
      failedRoutes: deliveryResult?.failedRoutes || 0,
    },
    cost: ratePerSms,
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
