/**
 * Connection-Type Helpers
 *
 * Single source of truth for matching message/route/supplier connection types.
 * Used by the send paths (send-sms, smpp-server, campaigns), the DLR timeout
 * sweeper, and the SMS Logs enrichment so the Business API type is defined in
 * exactly one place.
 */

/**
 * Business API short-circuit / detection gate.
 *
 * Business API rows are billed at submit and their outcome is resolved by the
 * send paths (DELIVERED on success, FAILED/REJECTED otherwise). The DLR
 * sweeper must NEVER auto-resolve such a row — marking it FAILED would
 * "uncharge" a billed send, and force-delivering it would fabricate a DELIVRD
 * we can't confirm. The send paths use the same predicate to detect Business
 * API routes so all callers agree on the canonical type string.
 *
 * Returns true when the value is the Business API type (case-insensitive).
 */
export function isBusinessApiRoute(connectionType: unknown): boolean {
  return String(connectionType || "").toUpperCase() === "BUSINESS API";
}
