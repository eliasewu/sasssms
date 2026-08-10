/**
 * SMS Submission Dedupe
 *
 * Guards against the same SMS request being processed twice. When a client
 * retries after a timeout (or a flaky connection double-submits), the exact
 * same submission — same tenant schema, client, sender, destination and
 * content — would otherwise be sent twice and billed twice. This helper
 * marks each unique submission and skips an identical repeat within a short
 * window.
 *
 * Implementation: in-memory keyed map (djb2 hash of the submission parts) with
 * a periodic sweep. Mirrors the single-process pm2 deployment assumption used
 * by the REST gateway registry (see gateway-rest-registry.ts). A multi-process
 * deployment would need to move this to Postgres/Redis.
 */

const DEDUPE_WINDOW_MS = 30_000; // 30s — covers client retries & double-submits
const MAX_ENTRIES = 20_000;

const _g = globalThis as typeof globalThis & {
  __smsSubmitDedupe?: Map<string, number>;
};
const seen: Map<string, number> = (_g.__smsSubmitDedupe ??= new Map());

/** djb2 hash of the joined submission fields — stable and cheap. */
function hashKey(parts: (string | number | null | undefined)[]): string {
  const raw = parts.map((p) => String(p ?? "")).join("\u0000");
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
  }
  return h.toString(36) + "_" + raw.length;
}

/**
 * Returns true when this exact submission was already seen within the window.
 * The first occurrence marks the key; a repeat inside the window returns true.
 * Callers SKIP processing when true (never send twice, never bill twice).
 */
export function isDuplicateSmsSubmission(input: {
  schemaName: string;
  clientId: number;
  sender: string;
  destination: string;
  content: string;
}): boolean {
  const key = hashKey([
    input.schemaName,
    input.clientId,
    input.sender,
    input.destination,
    input.content,
  ]);
  const now = Date.now();
  const prev = seen.get(key);
  if (prev !== undefined && now - prev < DEDUPE_WINDOW_MS) {
    return true;
  }
  seen.set(key, now);
  if (seen.size > MAX_ENTRIES) {
    for (const [k, t] of seen) {
      if (now - t > DEDUPE_WINDOW_MS) seen.delete(k);
    }
  }
  return false;
}

/**
 * Remove the dedupe marker for a submission. Call this when a send ultimately
 * FAILED — so a legitimate retry of the same request is not blocked by the
 * stale marker from the failed attempt.
 */
export function releaseSmsSubmission(input: {
  schemaName: string;
  clientId: number;
  sender: string;
  destination: string;
  content: string;
}): void {
  const key = hashKey([
    input.schemaName,
    input.clientId,
    input.sender,
    input.destination,
    input.content,
  ]);
  seen.delete(key);
}

/** Test helper — clears all dedupe state. */
export function clearSmsDedupe(): void {
  seen.clear();
}

// Periodic sweep so the map never grows unbounded even with no traffic.
setInterval(
  () => {
    const now = Date.now();
    for (const [k, t] of seen) {
      if (now - t > DEDUPE_WINDOW_MS) seen.delete(k);
    }
  },
  60_000
).unref?.();
