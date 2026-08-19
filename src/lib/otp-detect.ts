/**
 * Smart OTP auto-detection.
 *
 * Extracts OTP codes from any message content without requiring a regex
 * pattern. Used by the OTP forwarding runtime as the fallback when a custom
 * extraction regex does not match, and by auto-detect OTP rules.
 *
 * Priority: keyword-contextual codes → standalone 4-8 digit sequences → any digits.
 *
 * Pure module — no DB or server dependencies, safe to import from client or server.
 */
export function autoDetectOtp(content: string): string | null {
  const trimmed = content.trim();
  // 1. Exact 4-8 digit number (e.g., content IS the OTP)
  if (/^\d{4,8}$/.test(trimmed)) return trimmed;
  // 2. Numbers near OTP keywords (most reliable)
  const keywordPatterns = [
    /(?:otp|password|pin|code|token|one[.\s]?time|verify|login|auth|confirmation)[^0-9]*?(\d{4,8})/i,
    /(\d{4,8})[^0-9]*?(?:otp|code|pin|is|valid|expires?)/i,
    /(?:your|the)[^0-9]*(?:otp|code|pin|password)[^0-9]*?(\d{4,8})/i,
  ];
  for (const p of keywordPatterns) {
    const m = content.match(p);
    if (m && m[1]) return m[1];
  }
  // 3. First standalone 4-8 digit number (bounded by non-digits or word boundaries)
  const simple = content.match(/\b(\d{4,8})\b/);
  if (simple) return simple[1];
  // 4. Any 4-8 digit sequence as last resort
  const anyMatch = content.match(/\d{4,8}/);
  if (anyMatch) return anyMatch[0];
  return null;
}
