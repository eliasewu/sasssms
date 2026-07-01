import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { applyTranslations, applyEntityTranslations } from "@/lib/translation-engine";
import {
  resolveLanguage, buildAttemptPlaylists, generateCallSid,
  SimulatedSipCallExecutor, determineAttemptLanguages,
} from "@/lib/voice-otp-engine";
import type { AudioFile, SipConfig, CallAttempt } from "@/lib/voice-otp-engine";

const sipExecutor = new SimulatedSipCallExecutor(0.7, 3, 25);

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
        const clientResult = await tenantQuery(
          t.schemaName,
          "SELECT id FROM clients WHERE http_api_key = $1 AND is_active = true AND enable_http_api = true",
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
  const ratePerSms = parseFloat(client.rate_per_sms || "0.00030");
  const clientBalance = parseFloat(client.balance);
  const clientMaxTps = parseInt(client.max_tps || "0");

  // ── Per-Client TPS Rate Limit Check ──
  if (!checkTpsLimit(`client:${tenant.tenantId}:${clientId}`, clientMaxTps)) {
    return NextResponse.json({ error: `Client TPS limit exceeded (max ${clientMaxTps}/s)` }, { status: 429 });
  }

  if (clientBalance < ratePerSms) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 402 });
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
  let dlrStatus = "DELIVERED";
  let otpCode: string | null = null;
  let language: string | null = null;
  let callSid: string | null = null;
  let langResolution: { mcc: string; country: string; primaryLanguage: string; fallbackLanguage: string; isEnglishPrimary: boolean } | null = null;
  let callAttempts: CallAttempt[] = [];
  let callSuccess = false;

  // If specific test route provided, use it directly
  if (testRouteId) {
    const routeResult = await tenantQuery(
      tenant.schemaName,
      `SELECT r.*, t.name as trunk_name, t.supplier_id,
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
    selectedRoute = routeResult.rows[0];
  } else if (routePlanId) {
    // Use route plan chain
    const routeResult = await tenantQuery(
      tenant.schemaName,
      `SELECT rpr.route_id, rpr.priority, r.name as route_name, r.trunk_id,
              t.name as trunk_name, t.supplier_id, t.is_active as trunk_active,
              s.name as supplier_name, s.connection_type, s.is_active as supplier_active
       FROM route_plan_routes rpr
       JOIN routes r ON rpr.route_id = r.id AND r.is_active = true
       JOIN trunks t ON r.trunk_id = t.id AND t.is_active = true
       JOIN suppliers s ON t.supplier_id = s.id AND s.is_active = true
       WHERE rpr.route_plan_id = $1 ORDER BY rpr.priority ASC`,
      [routePlanId]
    );
    if (routeResult.rows.length === 0) {
      return NextResponse.json({ error: "No active routes in plan" }, { status: 400 });
    }
    selectedRoute = routeResult.rows[0];
  } else {
    return NextResponse.json({ error: "No route plan or route specified" }, { status: 400 });
  }

  // Extract supplier ID from selected route
  supplierId = (selectedRoute.supplier_id as number) || null;

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

    // ── 3. Fetch audio files & SIP configs ──
    const audioResult = await tenantQuery(
      tenant.schemaName, "SELECT * FROM voice_otp_audio ORDER BY id"
    ).catch(() => ({ rows: [] as AudioFile[] }));
    const audioFiles: AudioFile[] = audioResult.rows;

    const sipResult = await tenantQuery(
      tenant.schemaName, "SELECT * FROM voice_otp_sip_config WHERE is_active = true ORDER BY id"
    ).catch(() => ({ rows: [] as SipConfig[] }));
    const sipConfigs: SipConfig[] = sipResult.rows;
    const activeSip = sipConfigs[0] || null;
    const maxRetries = activeSip?.maxRetries || 3;

    // ── 4. Build audio playlists for all attempts ──
    const attemptLanguages = determineAttemptLanguages(langResolution, maxRetries);
    let attemptPlaylists: Array<Array<{order:number;fileName:string;fileUrl:string;language:string;digit:string;type:string}>> = [];
    try {
      attemptPlaylists = await buildAttemptPlaylists(audioFiles, langResolution, otpCode, maxRetries);
    } catch {
      // Build empty playlists on error (will use built-in audio)
      attemptPlaylists = attemptLanguages.map(() => []);
    }

    // ── 5. Call execution with retry loop ──
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

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const attLanguage = attemptLanguages[attempt - 1];
      const attPlaylist = attemptPlaylists[attempt - 1] || [];
      const startTime = new Date().toISOString();

      // Execute SIP call
      let sipResult: { success: boolean; callSid: string; duration: number; status: "ANSWERED"|"NO_ANSWER"|"BUSY"|"FAILED"; errorMessage?: string };
      if (activeSip) {
        sipResult = await sipExecutor.originateCall({
          destination,
          callerId: activeSip.callerId || "Net2APP",
          sipHost: activeSip.sipHost || "",
          sipPort: activeSip.sipPort || 5060,
          sipUsername: activeSip.sipUsername || "",
          sipPassword: activeSip.sipPassword || "",
          timeout: activeSip.timeout || 30,
          audioPlaylist: attPlaylist,
        });
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

  // Generate message ID
  const messageId = "MSG_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);

  // Insert message (store original + translated values)
  const msgResult = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO messages (client_id, sender, destination, content, status,
      route_plan_id, route_id, trunk_id, supplier_id, connection_type,
      cost, dlr_status, dlr_timestamp, otp_code, language, message_id,
      original_sender, original_destination, original_content, translation_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [
      clientId, sender, destination, content, status,
      routePlanId, selectedRoute.route_id || selectedRoute.id, selectedRoute.trunk_id,
      supplierId, selectedRoute.connection_type,
      ratePerSms, dlrStatus, otpCode, language, messageId,
      origSender, origDestination, origContent,
      appliedTranslations.length > 0 ? JSON.stringify(appliedTranslations) : null,
    ]
  );

  // Deduct balance
  await tenantQuery(
    tenant.schemaName,
    "UPDATE clients SET balance = balance - $1, updated_at = NOW() WHERE id = $2",
    [ratePerSms, clientId]
  );

  // Update tenant SMS counter
  if (tenantData) {
    await db
      .update(tenants)
      .set({ smsCounter: (tenantData.smsCounter || 0) + 1 })
      .where(eq(tenants.id, tenant.tenantId));
  }

  // ── DLR Push to external client ──
  // If client has DLR callback URL, push DLR asynchronously
  const dlrCallbackUrl = client.dlr_callback_url || client.webhook_url;
  if (dlrCallbackUrl) {
    const dlrPayload = {
      message_id: messageId,
      destination,
      source: sender,
      status: dlrStatus,
      cost: ratePerSms,
      content: content.substring(0, 160),
      timestamp: new Date().toISOString(),
      route_name: selectedRoute.route_name || selectedRoute.name,
      supplier_name: selectedRoute.supplier_name,
      connection_type: selectedRoute.connection_type,
    };

    // Fire-and-forget DLR push (non-blocking)
    pushDlrToClient(dlrCallbackUrl, dlrPayload).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    message: msgResult.rows[0],
    messageId,
    routing: {
      routePlan: routePlanId,
      route: selectedRoute.route_name || selectedRoute.name,
      trunk: selectedRoute.trunk_name,
      supplier: selectedRoute.supplier_name,
      connectionType: selectedRoute.connection_type,
    },
    cost: ratePerSms,
    dlr: { status: dlrStatus, pushed_to: dlrCallbackUrl || null },
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
