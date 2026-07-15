/**
 * DLR Queue — in-memory queue for delivery receipts that arrive while
 * an ESME client is disconnected. DLRs are flushed when the client reconnects.
 *
 * Pure data-structure module with no SMPP dependency — testable in isolation.
 * The SMPP-specific PDU construction and session.send() logic lives in smpp-server.ts.
 */
import type { DlrPayload } from "@/lib/smpp-client";

// ── Queue state ──
// Key: `${tenantId}:${clientId}`, Value: array of DLRs pending push
const pendingDlrQueue: Map<string, DlrPayload[]> = new Map();

export const MAX_DLR_QUEUE_PER_CLIENT = 1000;
export const DLR_QUEUE_TTL_MS = 600_000; // 10 minutes

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Enqueue a DLR for a disconnected client.
 * Returns the new queue depth and whether an old entry was dropped (max size exceeded).
 */
export function enqueueDlr(
  tenantId: number,
  clientId: number,
  dlr: DlrPayload
): { depth: number; dropped: boolean } {
  const key = `${tenantId}:${clientId}`;
  if (!pendingDlrQueue.has(key)) {
    pendingDlrQueue.set(key, []);
  }
  const queue = pendingDlrQueue.get(key)!;

  let dropped = false;
  if (queue.length >= MAX_DLR_QUEUE_PER_CLIENT) {
    queue.shift(); // drop oldest
    dropped = true;
  }
  queue.push(dlr);
  return { depth: queue.length, dropped };
}

/**
 * Atomically dequeue ALL pending DLRs for a client.
 * Returns an empty array if no DLRs are queued.
 * The queue entry is removed from the map (claimed) to prevent races with new arrivals.
 */
export function dequeueAllDlrs(tenantId: number, clientId: number): DlrPayload[] {
  const key = `${tenantId}:${clientId}`;
  const dlrs = pendingDlrQueue.get(key);
  if (!dlrs || dlrs.length === 0) return [];
  pendingDlrQueue.delete(key); // atomically claim
  return dlrs;
}

/**
 * Re-queue DLRs that failed to send during a flush attempt.
 * Prepends them to any new DLRs that arrived in the meantime.
 */
export function requeueDlrs(tenantId: number, clientId: number, dlrs: DlrPayload[]): void {
  if (dlrs.length === 0) return;
  const key = `${tenantId}:${clientId}`;
  const existing = pendingDlrQueue.get(key) || [];
  pendingDlrQueue.set(key, [...existing, ...dlrs]);
}

/**
 * Get the current queue depth for a client (useful for testing and monitoring).
 */
export function getQueueDepth(tenantId: number, clientId: number): number {
  const key = `${tenantId}:${clientId}`;
  return pendingDlrQueue.get(key)?.length ?? 0;
}

/**
 * Get all queued DLRs for a client WITHOUT removing them (for inspection/testing).
 */
export function peekQueue(tenantId: number, clientId: number): DlrPayload[] {
  const key = `${tenantId}:${clientId}`;
  const queue = pendingDlrQueue.get(key);
  return queue ? [...queue] : [];
}

/**
 * Get all active queue keys (for diagnostics/testing).
 */
export function getQueueKeys(): string[] {
  return [...pendingDlrQueue.keys()];
}

/**
 * Get the total number of DLRs across all queues.
 */
export function getTotalQueued(): number {
  let count = 0;
  for (const dlrs of pendingDlrQueue.values()) {
    count += dlrs.length;
  }
  return count;
}

/**
 * Remove stale DLRs from all queues based on TTL.
 * Uses submitDate (epoch seconds from SMPP) as the arrival time approximation.
 * Returns the number of queue entries cleaned (not individual DLRs).
 */
export function cleanupStaleDlrs(ttlMs: number = DLR_QUEUE_TTL_MS): number {
  const now = Date.now();
  const cutoff = now - ttlMs;
  let cleaned = 0;

  for (const [key, dlrs] of pendingDlrQueue) {
    const filtered = dlrs.filter((dlr) => {
      const dlrTime = parseInt(dlr.submitDate, 10) * 1000;
      return isNaN(dlrTime) ? false : dlrTime > cutoff; // treat unparseable dates as stale
    });

    if (filtered.length === 0) {
      pendingDlrQueue.delete(key);
      cleaned++;
    } else if (filtered.length < dlrs.length) {
      pendingDlrQueue.set(key, filtered);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Start periodic TTL cleanup. Only one interval runs at a time.
 * Returns the interval handle for testing (to clear after tests).
 */
export function startDlrCleanup(intervalMs: number = 120_000): ReturnType<typeof setInterval> {
  if (cleanupInterval) clearInterval(cleanupInterval);
  cleanupInterval = setInterval(() => {
    const cleaned = cleanupStaleDlrs();
    if (cleaned > 0) console.log(`[DLR-QUEUE] Cleanup: removed ${cleaned} stale entries`);
  }, intervalMs);
  return cleanupInterval;
}

/**
 * Stop the periodic TTL cleanup interval (for testing).
 */
export function stopDlrCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Clear ALL queue data AND stop the cleanup interval (for testing).
 */
export function clearAllQueues(): void {
  pendingDlrQueue.clear();
  stopDlrCleanup();
}
