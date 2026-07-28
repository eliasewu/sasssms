/**
 * Shared ID generation utilities for client/supplier codes, SMPP usernames, and passwords.
 * Used across the wizard, client management, and supplier management pages.
 */

/**
 * Generates a client or supplier code: `QS_` prefix + 6 uppercase alphanumeric characters.
 *
 * Format: `QS_XXXXXX` (9 chars total)
 * Example: `QS_A3F9K2`
 *
 * Uses `Math.random().toString(36)` for the random suffix, then `.toUpperCase()`.
 */
export function genCode(): string {
  return "QS_" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Generates a short ID for SMPP usernames or system IDs: `gsm_` prefix + 6 lowercase alphanumeric characters.
 *
 * Format: `gsm_xxxxxx` (10 chars total)
 * Example: `gsm_k3f9a2`
 *
 * Uses `Math.random().toString(36)` for the random suffix.
 */
export function genId(): string {
  return "gsm_" + Math.random().toString(36).slice(2, 8);
}

/**
 * Generates a 12-character random password.
 *
 * Uses a 56-character URL-safe alphabet with no ambiguous characters:
 *   - Lowercase: 24 chars (a-z, excluding `l` and `o`)
 *   - Uppercase: 24 chars (A-Z, excluding `I` and `O`)
 *   - Digits:    8 chars  (2-9, excluding `0` and `1`)
 *
 * This avoids visual confusion: l/1/I, O/0, etc.
 */
export function genPwd(): string {
  const CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 12 },
    () => CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("");
}
