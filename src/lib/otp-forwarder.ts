/**
 * OTP Forwarding Runtime Engine
 *
 * Background worker that checks new inbox SMS (sms_inbox), applies active
 * OTP extract rules, extracts OTP codes via regex, and forwards them to the
 * configured supplier via the Custom API connector.
 *
 * Runs every 10 seconds, processes messages across all active tenants.
 */
import { pool } from "@/db";
import {
  buildUrl,
  evaluateCondition,
  extractFromResponse,
  parseHeaders,
} from "@/lib/api-connector-parser";

const POLL_INTERVAL_MS = 10_000; // 10 seconds

interface InboxMessage {
  id: number;
  sender: string;
  destination: string;
  content: string;
  supplier_id: number | null;
}

interface OtpRule {
  id: number;
  name: string;
  mcc: string | null;
  mnc: string | null;
  regex_pattern: string;
  otp_group_index: number;
  forward_supplier_id: number | null;
  forward_sender: string | null;
  forward_template: string | null;
}

/**
 * Process inbox SMS for a single tenant.
 * Finds unprocessed messages, applies OTP rules, extracts codes, and forwards.
 */
async function processTenantInbox(
  tenantId: number,
  schemaName: string,
  pgClient: any
): Promise<number> {
  let forwarded = 0;

  try {
    await pgClient.query(`SET search_path TO "${schemaName}"`);

    // 1. Find unprocessed inbox messages (not yet logged to otp_forward_logs)
    const { rows: inboxMessages } = await pgClient.query(
      `SELECT si.id, si.sender, si.destination, si.content, si.supplier_id
       FROM sms_inbox si
       WHERE NOT EXISTS (
         SELECT 1 FROM otp_forward_logs ofl WHERE ofl.inbox_message_id = si.id
       )
       ORDER BY si.id ASC
       LIMIT 50`
    );

    if (inboxMessages.length === 0) return 0;

    // 2. Load all active OTP extract rules
    const { rows: rules } = await pgClient.query(
      `SELECT * FROM otp_extract_rules WHERE is_active = true ORDER BY sort_order ASC`
    );

    if (rules.length === 0) {
      // No rules configured — mark all as skipped
      for (const msg of inboxMessages) {
        await pgClient.query(
          `INSERT INTO otp_forward_logs (inbox_message_id, original_sender, original_content, forward_status)
           VALUES ($1, $2, $3, 'SKIPPED')`,
          [msg.id, msg.sender, msg.content]
        );
      }
      return 0;
    }

    // 3. Process each inbox message against rules
    for (const msg of inboxMessages as InboxMessage[]) {
      let matched = false;

      for (const rule of rules as OtpRule[]) {
        if (!rule.forward_supplier_id) continue; // skip rules without forwarding

        // Try to match the regex pattern
        let regex: RegExp;
        try {
          regex = new RegExp(rule.regex_pattern, "gm");
        } catch {
          // Invalid regex — skip this rule
          continue;
        }

        const match = regex.exec(msg.content);
        if (!match || !match[rule.otp_group_index]) continue;

        const extractedOtp = match[rule.otp_group_index];
        matched = true;

        // 4. Forward the extracted OTP to the configured supplier
        const forwardResult = await forwardOtp(
          pgClient,
          schemaName,
          rule,
          extractedOtp,
          msg
        );

        // 5. Log the result
        await pgClient.query(
          `INSERT INTO otp_forward_logs
           (rule_id, inbox_message_id, original_sender, original_content,
            extracted_otp, destination, forward_status, forward_message_id, error_message)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            rule.id,
            msg.id,
            msg.sender,
            msg.content,
            extractedOtp,
            msg.sender, // forward OTP back to the original sender
            forwardResult.success ? "SENT" : "FAILED",
            forwardResult.messageId || null,
            forwardResult.error || null,
          ]
        );

        forwarded++;
        break; // stop after first matching rule
      }

      // If no rule matched, log as skipped
      if (!matched) {
        await pgClient.query(
          `INSERT INTO otp_forward_logs (inbox_message_id, original_sender, original_content, forward_status)
           VALUES ($1, $2, $3, 'NO_MATCH')`,
          [msg.id, msg.sender, msg.content]
        );
      }
    }
  } catch (err) {
    console.error(`[OTP-FWD] Error processing tenant ${schemaName}:`, err);
  }

  return forwarded;
}

/**
 * Forward an extracted OTP to the configured supplier via their Custom API connector.
 */
async function forwardOtp(
  pgClient: any,
  schemaName: string,
  rule: OtpRule,
  otpCode: string,
  inboxMsg: InboxMessage
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // 1. Get supplier config → connector_id
    const suppResult = await pgClient.query(
      "SELECT config FROM suppliers WHERE id = $1 AND is_active = true",
      [rule.forward_supplier_id]
    );
    if (suppResult.rows.length === 0) {
      return { success: false, error: "Supplier not found or inactive" };
    }

    const rawConfig = suppResult.rows[0]?.config;
    const config =
      (typeof rawConfig === "string" ? JSON.parse(rawConfig) : rawConfig || {}) as Record<
        string,
        unknown
      >;
    const connectorId = config.custom_connector_id as number;
    if (!connectorId) {
      return { success: false, error: "No custom_connector_id in supplier config" };
    }

    // 2. Get connector details
    const connResult = await pgClient.query(
      "SELECT * FROM custom_api_connectors WHERE id = $1 AND is_active = true",
      [connectorId]
    );
    if (connResult.rows.length === 0) {
      return { success: false, error: "Connector not found or inactive" };
    }

    const conn = connResult.rows[0];

    // 3. Build content from forward template
    const forwardContent = (rule.forward_template || "{otp}").replace(
      "{otp}",
      otpCode
    );
    const sender = rule.forward_sender || inboxMsg.destination;
    const destination = inboxMsg.sender; // send OTP back to who sent the inbound SMS

    // 4. Build and call the send URL
    const messageId =
      "FWD_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
    const vars: Record<string, string> = {
      dst: destination,
      message: forwardContent,
      sender: sender,
      message_id: messageId,
      apiKey: "",
    };

    const url = buildUrl(conn.send_url_template as string, vars);
    const fetchOptions: RequestInit = {
      method: (conn.send_method as string) || "GET",
      headers: parseHeaders((conn.send_headers as string) || ""),
    };

    if (conn.send_body_template && conn.send_method === "POST") {
      fetchOptions.body = (conn.send_body_template as string)
        .replace(/\{\{dst\}\}/g, destination)
        .replace(/\{\{message\}\}/g, forwardContent)
        .replace(/\{\{sender\}\}/g, sender);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
    clearTimeout(timeout);

    const responseBody = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(responseBody);
    } catch {
      parsed = { raw: responseBody };
    }

    // 5. Check success
    const success = conn.send_success_condition
      ? evaluateCondition(conn.send_success_condition as string, parsed)
      : res.status === 200;

    // 6. Extract supplier message ID
    let supplierMsgId: string | null = null;
    if (conn.send_message_id_path) {
      supplierMsgId = String(
        extractFromResponse(parsed, conn.send_message_id_path as string) || ""
      );
    }
    if (!supplierMsgId) {
      const txMatch = responseBody.match(/"transaction_id"\s*:\s*"([^"]+)"/);
      if (txMatch) supplierMsgId = txMatch[1];
    }

    // 7. Insert forwarded message into messages table for DLR tracking
    if (success) {
      // Find any active client to associate with the forwarded message
      let systemClientId = 0;
      try {
        const clientResult = await pgClient.query(
          "SELECT id FROM clients WHERE is_active = true LIMIT 1"
        );
        if (clientResult.rows.length > 0) {
          systemClientId = clientResult.rows[0].id;
        }
      } catch { /* fallback to 0 */ }

      await pgClient.query(
        `INSERT INTO messages (client_id, sender, destination, content,
         status, supplier_id, connection_type, cost, supplier_cost, profit,
         dlr_status, message_id, supplier_message_id, dlr_callback_url)
         VALUES ($1,$2,$3,$4,'SENT',$5,'CUSTOM_API',0,0,0,'PENDING',$6,$7,NULL)`,
        [
          systemClientId,
          sender,
          destination,
          forwardContent,
          rule.forward_supplier_id,
          messageId,
          supplierMsgId || null,
        ]
      );

      return { success: true, messageId };
    }

    return {
      success: false,
      messageId,
      error: `Send failed (HTTP ${res.status}): ${responseBody.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Forward error: ${(err as Error).message}`,
    };
  }
}

/**
 * Main polling loop: processes inbox SMS across all active tenants.
 */
export async function processAllInboxOtp() {
  const pgClient = await pool.connect();
  try {
    const { rows: tenants } = await pgClient.query(
      "SELECT id, schema_name FROM tenants WHERE is_active = true"
    );

    let totalForwarded = 0;

    for (const tenant of tenants) {
      try {
        const count = await processTenantInbox(
          tenant.id,
          tenant.schema_name,
          pgClient
        );
        totalForwarded += count;
      } catch {
        // Skip tenants with errors
      }
    }

    await pgClient.query("SET search_path TO public");

    if (totalForwarded > 0) {
      console.log(
        `[OTP-FWD] Forwarded ${totalForwarded} OTP(s) across all tenants`
      );
    }
  } catch (err) {
    console.error("[OTP-FWD] Main loop error:", err);
  } finally {
    pgClient.release();
  }
}

let forwardingInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the OTP forwarding worker.
 * Safe to call multiple times — only starts if not already running.
 */
export function startOtpForwarder() {
  if (forwardingInterval) return;
  console.log("[OTP-FWD] Starting OTP forwarding worker (every 10s)");
  forwardingInterval = setInterval(processAllInboxOtp, POLL_INTERVAL_MS);
  // Run first check immediately
  processAllInboxOtp().catch(() => {});
}

/**
 * Stop the OTP forwarding worker.
 */
export function stopOtpForwarder() {
  if (forwardingInterval) {
    clearInterval(forwardingInterval);
    forwardingInterval = null;
  }
}
