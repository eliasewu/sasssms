/**
 * Business API Send Engine
 *
 * Sends messages through a configured `business_api_connect` row (Telegram Bot
 * API and WhatsApp Business API today, generic HTTP fallback otherwise).
 *
 * Number-validity gate (Custom Server Billing Matrix rule 5 — Immediate
 * Rejection Handling):
 *   - Invalid destination → status REJECTED, DLR result FAIL/undelivered,
 *     dlr_source='REJECTED', client is NOT charged, nothing is sent.
 *   - Valid destination → sent via the provider; client charged at submit
 *     (deferred only when the client is on_dlr).
 *
 * Every send is recorded in the tenant `messages` table so it appears in the
 * SMS Logs UI with the DLR source badge.
 */
import { pool } from "@/db";
import { tenantQuery } from "@/lib/tenant-schema";
import { lookupClientRate } from "@/lib/rates";
import { isValidDestinationNumber } from "@/lib/number-validation";
import { isBusinessApiRoute } from "@/lib/connection-types";
import { buildProxyDispatcher, buildProxyUrl } from "@/lib/proxy-connect";

export interface BusinessApiSendInput {
  schemaName: string;
  tenantId: number;
  clientId: number;
  connectionId: number; // business_api_connect.id
  destination: string;
  message: string;
  sender?: string | null;
}

/**
 * Enrich message rows that used a Business API supplier with the connector's
 * display name (e.g. "Telegram Main Bot · telegram"), resolved through the
 * supplier's config.business_api_connect_id → business_api_connect row.
 *
 * Non-Business-API rows are returned unchanged. Used by the SMS Logs list and
 * CSV export so admins see which connector delivered each message instead of
 * the generic "Business API" label.
 */
export async function enrichBusinessApiNames(
  schemaName: string,
  rows: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  // Collect supplier ids for Business API messages only
  const supplierIds = [
    ...new Set(
      rows
        .filter((m) => isBusinessApiRoute(m.connection_type) && m.supplier_id)
        .map((m) => Number(m.supplier_id))
    ),
  ];
  if (supplierIds.length === 0) return rows;

  // supplier_id → business_api_connect_id (from suppliers.config JSON)
  const connIdBySupplier = new Map<number, number>();
  try {
    const suppResult = await tenantQuery(
      schemaName,
      "SELECT id, config FROM suppliers WHERE id = ANY($1)",
      [supplierIds]
    );
    for (const s of suppResult.rows as Record<string, unknown>[]) {
      try {
        const cfg = (typeof s.config === "string" ? JSON.parse(s.config) : s.config || {}) as Record<string, unknown>;
        const cid = Number(cfg.business_api_connect_id);
        if (cid) connIdBySupplier.set(Number(s.id), cid);
      } catch { /* unparseable config — skip */ }
    }
  } catch (err) {
    console.error("[BUSINESS-API] Supplier config lookup failed:", err);
    return rows;
  }

  if (connIdBySupplier.size === 0) return rows;

  // business_api_connect_id → display name
  const connIds = [...new Set(connIdBySupplier.values())];
  const nameById = new Map<number, string>();
  try {
    const connResult = await tenantQuery(
      schemaName,
      "SELECT id, name, provider FROM business_api_connect WHERE id = ANY($1)",
      [connIds]
    );
    for (const c of connResult.rows as Record<string, unknown>[]) {
      const provider = c.provider ? ` · ${c.provider}` : "";
      nameById.set(Number(c.id), `${c.name || `Connection #${c.id}`}${provider}`);
    }
  } catch (err) {
    console.error("[BUSINESS-API] business_api_connect lookup failed:", err);
    return rows;
  }

  return rows.map((m) => {
    if (!isBusinessApiRoute(m.connection_type) || !m.supplier_id) return m;
    const cid = connIdBySupplier.get(Number(m.supplier_id));
    const name = cid ? nameById.get(cid) : undefined;
    return name ? { ...m, business_api_name: name } : m;
  });
}

export interface BusinessApiSendResult {
  success: boolean;
  rejected?: boolean; // invalid destination — not sent, not charged
  messageId?: string;
  status: "REJECTED" | "SENT" | "DELIVERED" | "FAILED";
  dlrStatus: "FAILED" | "SENT" | "DELIVERED";
  cost: number;
  supplierCost: number;
  profit: number;
  provider?: string;
  apiName?: string;
  httpStatus?: number | null;
  responseText?: string;
  error?: string;
}

/**
 * Input for the routing-engine delivery helper (send-sms / smpp-server /
 * campaigns). Caller owns billing + the `messages` row — this only loads the
 * connection, applies the number-validity gate, and calls the provider.
 */
export interface BusinessApiRouteInput {
  schemaName: string;
  connectionId: number;
  destination: string;
  message: string;
  sender?: string | null;
  messageId: string;
  /**
   * Set when the caller already validated the ORIGINAL E.164 number before
   * translation rewrote it (same convention as the OTT branch). When set, the
   * internal gate is skipped so translated local-format numbers are not
   * falsely rejected.
   */
  skipNumberGate?: boolean;
}

export interface BusinessApiRouteResult {
  success: boolean;
  rejected: boolean; // invalid destination — not sent, not charged
  status: "REJECTED" | "SENT" | "FAILED";
  httpStatus: number | null;
  responseText?: string;
  error?: string;
  provider?: string;
  apiName?: string;
}

/**
 * Send via the provider API for one business_api_connect row.
 * Returns the raw HTTP outcome; all parsing/status mapping happens in
 * sendBusinessApiMessage.
 */
async function callProvider(
  conn: { provider: string; api_url: string | null; credentials: string | null },
  args: { destination: string; message: string; sender?: string | null },
  proxyUrl: string | null
): Promise<{ ok: boolean; httpStatus: number | null; body: string; error?: string }> {
  const provider = (conn.provider || "").toLowerCase();
  const apiUrl = (conn.api_url || "").trim();
  let credentials: Record<string, unknown> = {};
  try {
    credentials = JSON.parse(conn.credentials || "{}") as Record<string, unknown>;
  } catch { /* unparseable credentials → empty */ }

  // Route through the proxy (proxy_config row → socks/http dispatcher).
  // The dashboard may also store a raw proxy URL in credentials.proxy.
  const rawProxyUrl =
    proxyUrl ||
    (typeof credentials.proxy === "string" && credentials.proxy.trim() ? credentials.proxy.trim() : null);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    // Built inside the try so an invalid/unsupported proxy URL degrades to a
    // clean provider error instead of an uncaught 500.
    let dispatcher: { dispatcher?: unknown } = {};
    if (rawProxyUrl) {
      try {
        dispatcher = buildProxyDispatcher(rawProxyUrl);
      } catch (err) {
        console.warn(`[BUSINESS-API] Proxy "${rawProxyUrl}" unusable (${(err as Error).message}) — sending directly`);
        dispatcher = {};
      }
    }
    // ── Telegram Bot API: POST {apiUrl}/sendMessage ──
    if (provider === "telegram") {
      // apiUrl is saved as https://api.telegram.org/bot<TOKEN> (see dashboard);
      // fall back to building it from credentials.botToken when it isn't.
      let url = /\/bot[\w:-]+$/.test(apiUrl)
        ? `${apiUrl}/sendMessage`
        : credentials.botToken
          ? `https://api.telegram.org/bot${credentials.botToken}/sendMessage`
          : `${apiUrl}/sendMessage`;
      // Telegram chat_id is a numeric id or @username — never a phone number.
      // Best effort: strip E.164 "+" (and any non-digits) so numeric ids pass
      // through; @usernames are sent as-is.
      const chatId = args.destination.startsWith("@")
        ? args.destination
        : args.destination.replace(/\D/g, "");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: args.message,
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
        ...dispatcher,
      });
      return { ok: res.ok, httpStatus: res.status, body: (await res.text()).slice(0, 2000) };
    }

    // ── WhatsApp Business API: POST graph.facebook.com/v18.0/{id}/messages ──
    if (provider === "whatsapp") {
      const accessToken = String(credentials.accessToken || "");
      // Meta expects the recipient in E.164 WITHOUT the leading "+".
      const to = args.destination.replace(/^\+/, "");
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: args.message },
        }),
        signal: controller.signal,
        ...dispatcher,
      });
      return { ok: res.ok, httpStatus: res.status, body: (await res.text()).slice(0, 2000) };
    }

    // ── Generic fallback: POST apiUrl with credentials + payload as JSON ──
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...credentials,
        to: args.destination,
        destination: args.destination,
        message: args.message,
        text: args.message,
        sender: args.sender || undefined,
      }),
      signal: controller.signal,
      ...dispatcher,
    });
    return { ok: res.ok, httpStatus: res.status, body: (await res.text()).slice(0, 2000) };
  } catch (err) {
    return { ok: false, httpStatus: null, body: "", error: (err as Error).message };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Load a business_api_connect row together with its resolved proxy URL
 * (proxy_config row; credentials.proxy used as legacy fallback). Shared by the
 * standalone send endpoint and the routing-engine delivery helper.
 */
async function loadBusinessApiConnection(
  schemaName: string,
  connectionId: number
): Promise<{ conn: Record<string, unknown>; proxyUrl: string | null } | null> {
  const connResult = await tenantQuery(
    schemaName,
    `SELECT b.*, p.host AS proxy_host, p.port AS proxy_port,
            p.protocol AS proxy_protocol, p.username AS proxy_username,
            p.password AS proxy_password
     FROM business_api_connect b
     LEFT JOIN proxy_config p ON b.proxy_id = p.id AND p.is_active = true
     WHERE b.id = $1 AND b.is_active = true`,
    [connectionId]
  );
  if (connResult.rows.length === 0) return null;
  const conn = connResult.rows[0];

  const proxyUrl = buildProxyUrl({
    host: conn.proxy_host ?? null,
    port: conn.proxy_port != null ? parseInt(String(conn.proxy_port), 10) : null,
    protocol: conn.proxy_protocol ?? null,
    username: conn.proxy_username ?? null,
    password: conn.proxy_password ?? null,
  });
  if (conn.proxy_id != null && parseInt(String(conn.proxy_id), 10) > 0 && !proxyUrl) {
    console.warn(
      `[BUSINESS-API] ${schemaName}: connection #${connectionId} has proxy_id=${conn.proxy_id} ` +
      `but no active proxy resolved — sending DIRECT (check proxy_config is active)`
    );
  }
  return { conn, proxyUrl };
}

/**
 * Routing-engine delivery helper: loads the connection, applies the
 * number-validity gate (unless the caller pre-validated the original E.164),
 * and calls the provider. NO billing and NO `messages` row — the caller owns
 * those so the message is recorded once with full route/trunk/supplier info.
 */
export async function deliverBusinessApiRoute(
  input: BusinessApiRouteInput
): Promise<BusinessApiRouteResult> {
  const loaded = await loadBusinessApiConnection(input.schemaName, input.connectionId);
  if (!loaded) {
    return {
      success: false, rejected: false, status: "FAILED", httpStatus: null,
      error: "Business API connection not found or inactive",
    };
  }
  const { conn, proxyUrl } = loaded;

  // Number-validity gate (billing matrix rule 5) — invalid destinations are
  // REJECTED, never sent and never charged. Callers that validated the ORIGINAL
  // E.164 (e.g. send-sms after translation) pass skipNumberGate: true.
  if (!input.skipNumberGate && !isValidDestinationNumber(input.destination)) {
    return {
      success: false, rejected: true, status: "REJECTED", httpStatus: null,
      provider: String(conn.provider || ""),
      apiName: String(conn.name || ""),
      error: "Invalid destination number — rejected",
    };
  }

  const outcome = await callProvider(
    conn as { provider: string; api_url: string | null; credentials: string | null },
    {
      destination: input.destination,
      message: input.message,
      sender: input.sender || input.destination,
    },
    proxyUrl
  );

  return {
    success: outcome.ok,
    rejected: false,
    status: outcome.ok ? "SENT" : "FAILED",
    httpStatus: outcome.httpStatus,
    responseText: outcome.body,
    error: outcome.error,
    provider: String(conn.provider || ""),
    apiName: String(conn.name || ""),
  };
}

/**
 * Full send flow: number-validity gate → provider call → billing → message row.
 */
export async function sendBusinessApiMessage(
  input: BusinessApiSendInput
): Promise<BusinessApiSendResult> {
  const messageId = "BA_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  const sender = input.sender || input.destination;

  // ── 1. Client must exist and be active ──
  const clientResult = await tenantQuery(
    input.schemaName,
    "SELECT id FROM clients WHERE id = $1 AND is_active = true",
    [input.clientId]
  );
  if (clientResult.rows.length === 0) {
    return {
      success: false, status: "FAILED", dlrStatus: "FAILED",
      cost: 0, supplierCost: 0, profit: 0,
      error: "Client not found or inactive",
    };
  }
  const ratePerSms = await lookupClientRate(input.destination, input.clientId, input.schemaName);

  // ── 2. Connection config + proxy (shared loader) ──
  const loaded = await loadBusinessApiConnection(input.schemaName, input.connectionId);
  if (!loaded) {
    return {
      success: false, status: "FAILED", dlrStatus: "FAILED",
      cost: 0, supplierCost: 0, profit: 0,
      error: "Business API connection not found or inactive",
    };
  }
  const { conn, proxyUrl } = loaded;

  // ── 3. Number-validity gate — invalid destinations are REJECTED, never
  //    sent and never charged (billing matrix rule 5). ──
  if (!isValidDestinationNumber(input.destination)) {
    const rejectResult: BusinessApiSendResult = {
      success: false,
      rejected: true,
      messageId,
      status: "REJECTED",
      dlrStatus: "FAILED",
      cost: 0, supplierCost: 0, profit: 0,
      provider: String(conn.provider || ""),
      apiName: String(conn.name || ""),
      error: "Invalid destination number — rejected",
    };
    await recordBusinessApiMessage(input, rejectResult);
    console.log(`[BUSINESS-API] ${input.schemaName}: ${messageId} REJECTED (invalid number ${input.destination}) — no charge`);
    return rejectResult;
  }

  // ── 4. Send via provider (routed through the proxy when configured) ──
  const outcome = await callProvider(
    conn as { provider: string; api_url: string | null; credentials: string | null },
    {
      destination: input.destination,
      message: input.message,
      sender,
    },
    proxyUrl
  );

  const success = outcome.ok;
  // Provider HTTP 200 = delivery accepted and there is no real DLR path — so
  // success is stored as DELIVERED (like Voice OTP). Storing SENT would let
  // the dlr-timeout-sweeper flip the row to FAILED after the window even
  // though the client was charged at submit.
  const result: BusinessApiSendResult = {
    success,
    messageId,
    status: success ? "DELIVERED" : "FAILED",
    dlrStatus: success ? "DELIVERED" : "FAILED",
    cost: 0, supplierCost: 0, profit: 0,
    provider: String(conn.provider || ""),
    apiName: String(conn.name || ""),
    httpStatus: outcome.httpStatus,
    responseText: outcome.body,
    error: outcome.error,
  };

  // ── 5. Billing — charge at submit on a valid send (the "valid number →
  //    charge" rule). Business API has no real-time DLR path yet, so on_dlr
  //    clients are charged here too rather than deferred-and-lost. ──
  if (success) {
    result.cost = ratePerSms;
    result.profit = ratePerSms;
    try {
      const dbc = await pool.connect();
      try {
        await dbc.query("SET search_path TO public");
        await dbc.query(
          "UPDATE tenants SET sms_counter = COALESCE(sms_counter, 0) + 1 WHERE id = $1",
          [input.tenantId]
        );
      } finally {
        await dbc.query("SET search_path TO public");
        dbc.release();
      }
    } catch (err) {
      console.error(`[BUSINESS-API] Counter charge failed for ${messageId}:`, err);
    }
  }

  await recordBusinessApiMessage(input, result);
  console.log(
    `[BUSINESS-API] ${input.schemaName}: ${messageId} → ${result.status} (${conn.provider} · ${conn.name}) http=${outcome.httpStatus ?? "—"}`
  );
  return result;
}

/** Persist the outcome into the tenant messages table (visible in SMS Logs). */
async function recordBusinessApiMessage(
  input: BusinessApiSendInput,
  result: BusinessApiSendResult
): Promise<void> {
  const dlrTimestamp = new Date();
  try {
    await tenantQuery(
      input.schemaName,
      `INSERT INTO messages (client_id, sender, destination, content, status,
         connection_type, cost, supplier_cost, profit, dlr_status, dlr_source,
         message_id, dlr_timestamp)
       VALUES ($1,$2,$3,$4,$5,'Business API',$6,0,$7,$8,$9,$10,$11)`,
      [
        input.clientId,
        input.sender || input.destination,
        input.destination,
        input.message,
        result.status,
        result.cost,
        result.profit,
        result.dlrStatus,
        result.status === "REJECTED" ? "REJECTED" : null,
        result.messageId,
        dlrTimestamp,
      ]
    );
  } catch (err) {
    // Logging must never break the send response
    console.error(`[BUSINESS-API] Failed to record message ${result.messageId}:`, err);
  }
}
