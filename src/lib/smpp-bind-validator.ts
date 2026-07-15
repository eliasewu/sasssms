/**
 * SMPP Bind Validator — pure validation logic extracted from smpp-server.ts.
 *
 * Validates:
 *  - IP whitelist (smpp_allowed_ip)
 *  - Password matching (strict, both sides normalized)
 *  - Combined bind credential validation
 *
 * Pure functions with no DB or SMPP dependencies — fully testable in isolation.
 */

/** SMPP command_status codes used for bind rejection */
export const SMPP_ESME_RBINDFAIL = 14; // generic bind failure

export interface BindValidationResult {
  valid: boolean;
  /** SMPP command_status to return on failure */
  errorCode: number;
  /** Human-readable reason */
  errorMessage: string;
}

/**
 * Validate connecting IP against the client's smpp_allowed_ip whitelist.
 *
 * smpp_allowed_ip can be:
 *  - null/empty: all IPs allowed
 *  - A single IP: "192.168.1.1"
 *  - Comma-separated: "192.168.1.1,10.0.0.5,::1"
 *
 * remoteAddress is normalized: IPv4-mapped IPv6 prefixes (::ffff:) are stripped.
 */
export function validateIpWhitelist(
  allowedIp: string | null,
  remoteAddress: string | undefined
): boolean {
  if (!allowedIp || allowedIp.trim() === "") return true; // no restriction
  if (!remoteAddress) {
    console.warn("[SMPP] Cannot validate IP: remote address unavailable");
    return false;
  }

  const allowed = allowedIp
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const clientIp = remoteAddress.replace(/^::ffff:/, ""); // normalize IPv4-mapped IPv6
  return allowed.some((ip) => ip === clientIp);
}

/**
 * Validate password match (strict comparison, both sides normalized to empty string).
 *
 * If DB has a password, it must match exactly.
 * If DB has no password, the client must send an empty password.
 */
export function validatePassword(
  dbPassword: string | null,
  clientPassword: string | null
): boolean {
  const db = dbPassword || "";
  const client = clientPassword || "";
  return db === client;
}

/**
 * Combined bind validation — IP whitelist + password.
 * Returns a result object indicating success or the specific failure reason.
 *
 * @param smppAllowedIp - From the clients table
 * @param remoteAddress - From the SMPP session socket
 * @param smppPassword  - From the clients table
 * @param clientPassword - From the BIND PDU
 */
export function validateBind(
  smppAllowedIp: string | null,
  remoteAddress: string | undefined,
  smppPassword: string | null,
  clientPassword: string | null
): BindValidationResult {
  // 1. Password check (runs first — more informative error)
  if (!validatePassword(smppPassword, clientPassword)) {
    return {
      valid: false,
      errorCode: SMPP_ESME_RBINDFAIL,
      errorMessage: "Password mismatch",
    };
  }

  // 2. IP whitelist check
  if (!validateIpWhitelist(smppAllowedIp, remoteAddress)) {
    return {
      valid: false,
      errorCode: SMPP_ESME_RBINDFAIL,
      errorMessage: `IP ${remoteAddress || "unknown"} not in whitelist`,
    };
  }

  return {
    valid: true,
    errorCode: 0,
    errorMessage: "",
  };
}

/**
 * Extract the remote address from an SMPP session object.
 * The smpp library sets `this.remoteAddress` directly and also exposes `socket.remoteAddress`.
 */
export function extractRemoteAddress(session: {
  socket?: { remoteAddress?: string };
  remoteAddress?: string;
}): string | undefined {
  return session.socket?.remoteAddress || session.remoteAddress;
}
