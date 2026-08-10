/**
 * Voice OTP DLR Utilities
 *
 * Shared builder functions and HTTP push for Voice OTP Delivery Report (DLR) payloads,
 * used by both the HTTP API (send-sms/route.ts) and the SMPP server (smpp-server.ts).
 * Extracted here so the DLR format and push flow can be tested without hitting real routes.
 */

import type { CallAttempt } from "@/lib/voice-otp-engine";
import { pushDlrWebhook } from "@/lib/dlr-webhook-log";

// ── HTTP DLR Push ──

/**
 * Push a DLR payload to an external client's webhook URL via HTTP POST.
 * Fire-and-forget — returns true if the client responded 2xx.
 * Has a 10-second timeout to prevent hanging on slow endpoints.
 *
 * When `schemaName` is provided, the delivery attempt (message_id, status,
 * pushed_to URL, HTTP status, response body) is recorded in the tenant's
 * dlr_webhook_logs table for verification.
 */
export async function pushDlrToClient(
  dlrUrl: string,
  payload: Record<string, unknown>,
  schemaName?: string
): Promise<boolean> {
  const messageId = String(payload.message_id || payload.messageId || "");
  const status = String(payload.status || payload.dlr_status || "UNKNOWN");

  if (!schemaName) {
    // No tenant schema context — plain fire-and-forget push without logging
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(dlrUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  return pushDlrWebhook(dlrUrl, payload, schemaName, messageId, status);
}

// ── Types ──

export interface VoiceOtpDlrParams {
  messageId: string;
  destination: string;
  source: string;
  status: "DELIVERED" | "FAILED";
  cost: number;
  routeName: string;
  supplierName: string;
  otpCode: string;
  language: string;
  callSid: string;
  callAttempts: CallAttempt[];
}

export interface VoiceOtpHttpDlrPayload {
  [key: string]: unknown;
  message_id: string;
  destination: string;
  source: string;
  status: "DELIVERED" | "FAILED";
  cost: number;
  timestamp: string;
  route_name: string;
  supplier_name: string;
  otp_code: string;
  language: string;
  call_sid: string;
  attempt_count: number;
  call_attempts: Array<{
    attempt: number;
    language: string;
    status: string;
    duration: number | null;
    sipCallId: string | null;
    errorMessage: string | null;
  }>;
}

/**
 * Build an HTTP DLR payload for Voice OTP call results.
 * Returned payload is suitable for POSTing to a client's webhook URL.
 */
export function buildVoiceOtpHttpDlrPayload(params: VoiceOtpDlrParams): VoiceOtpHttpDlrPayload {
  return {
    message_id: params.messageId,
    destination: params.destination,
    source: params.source,
    status: params.status,
    cost: params.cost,
    timestamp: new Date().toISOString(),
    route_name: params.routeName,
    supplier_name: params.supplierName,
    otp_code: params.otpCode,
    language: params.language,
    call_sid: params.callSid,
    attempt_count: params.callAttempts.length,
    call_attempts: params.callAttempts.map((a) => ({
      attempt: a.attempt,
      language: a.language,
      status: a.status,
      duration: a.duration,
      sipCallId: a.sipCallId,
      errorMessage: a.errorMessage,
    })),
  };
}

// ── SMPP DLR Message Format ──

/**
 * Build an SMPP DLR message string for Voice OTP call results.
 *
 * SMPP DLR format:
 *   id:<messageId> sub:001 dlvrd:<N> submit date:<YYYYMMDD> done date:<YYYYMMDD>
 *   stat:<DELIVRD|UNDELIV> err:<code> text:<description>
 *
 * On success:  stat=DELIVRD, dlvrd=001
 * On failure:  stat=UNDELIV, dlvrd=000
 */
export function buildVoiceOtpSmppDlrMessage(params: {
  messageId: string;
  success: boolean;
  errorMessage?: string;
}): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const dlvrd = params.success ? "001" : "000";
  const stat = params.success ? "DELIVRD" : "UNDELIV";
  const text = params.success
    ? "Voice OTP call delivered"
    : params.errorMessage || "Voice OTP call failed";

  return (
    `id:${params.messageId} ` +
    `sub:001 dlvrd:${dlvrd} ` +
    `submit date:${dateStr} ` +
    `done date:${dateStr} ` +
    `stat:${stat} ` +
    `err:000 ` +
    `text:${text}`
  );
}
