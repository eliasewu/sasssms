// ── Input Sanitization Helpers (PostgreSQL-safe) ──

const PG_INT4_MAX = 2147483647;
const PG_INT4_MIN = -2147483648;

/** Clamp to safe int4 range */
export function safeInt(value: unknown, fallback: number = 0): number {
  const n = Number(value);
  if (isNaN(n)) return fallback;
  if (n > PG_INT4_MAX) return PG_INT4_MAX;
  if (n < PG_INT4_MIN) return PG_INT4_MIN;
  return Math.trunc(n);
}

/** Clamp to safe int2 range */
export function safeSmallInt(value: unknown, fallback: number = 0): number {
  const n = Number(value);
  if (isNaN(n)) return fallback;
  if (n > 32767) return 32767;
  if (n < -32768) return -32768;
  return Math.trunc(n);
}

/** Coerce a numeric value to a string for DECIMAL/NUMERIC columns */
export function safeDecimal(value: unknown, fallback: string = "0"): string {
  const n = parseFloat(String(value));
  if (isNaN(n)) return fallback;
  return n.toFixed(6);
}

/** Truncate a text value to maxLength, trim whitespace */
export function safeText(value: unknown, maxLength: number, fallback: string = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

/** Normalize a boolean input */
export function safeBool(value: unknown, fallback: boolean = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") return true;
    if (lower === "false" || lower === "0" || lower === "no") return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

// ── Shared validation constants ──

export const VALID_BIND_TYPES = ["TRX", "TX", "RX", "TX_RX"] as const;
export type BindType = (typeof VALID_BIND_TYPES)[number];
