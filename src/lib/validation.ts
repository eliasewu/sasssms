/**
 * Input validation helpers to prevent PostgreSQL overflow errors.
 * Clamp integers to int4 range, coerce decimals to strings, truncate text.
 */

export const PG_INT4_MAX = 2147483647;
export const PG_INT4_MIN = -2147483648;

/** Clamp a value to safe PostgreSQL int4 range, default 0 */
export function safeInt(value: unknown, fallback = 0): number {
  const n = Number(value ?? fallback);
  if (isNaN(n)) return fallback;
  return Math.min(Math.max(Math.round(n), PG_INT4_MIN), PG_INT4_MAX);
}

/** Clamp a value to safe PostgreSQL int2 (smallint) range, default 0 */
export function safeSmallInt(value: unknown, fallback = 0): number {
  const n = Number(value ?? fallback);
  if (isNaN(n)) return fallback;
  return Math.min(Math.max(Math.round(n), -32768), 32767);
}

/** Coerce a value to a safe decimal string for PostgreSQL numeric/decimal columns */
export function safeDecimal(value: unknown, fallback = "0"): string {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  if (isNaN(n) || !isFinite(n)) return fallback;
  return n.toString();
}

/** Truncate a string to maxLength, return trimmed */
export function safeText(value: unknown, maxLength: number, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s.slice(0, maxLength);
}

/** Boolean with default false */
export function safeBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}
