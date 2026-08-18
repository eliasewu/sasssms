/**
 * In-memory MT queue for offline SERVER-mode (Android) gateway suppliers.
 *
 * An Android gateway phone binds to us in SERVER mode (connection_type =
 * 'ANDROID_SMS'), but phones drop/reconnect constantly (NAT, 4G, app restarts).
 * Previously, an MT submitted while the device was offline was dropped as
 * FAILED. This queue holds such messages in memory and re-delivers them when
 * the device re-binds (see flushServerMtQueue in smpp-server.ts).
 *
 * NOTE: this is intentionally in-memory — messages queued here are lost on a
 * process restart. That matches the existing DLR-callback / REST-registry
 * in-memory model. The message row is already persisted in the tenant's
 * `messages` table as QUEUED, so a lost in-memory entry only means the send
 * is retried when the device re-binds (or marked FAILED after TTL).
 */
import { pool } from "@/db";

export interface QueuedServerMt {
  messageId: string;
  tenantId: number;
  schemaName: string;
  clientId: number;
  supplierId: number;
  source: string;
  destination: string;
  content: string;
  dlrCallbackUrl?: string;
  routeId: number | null;
  trunkId: number | null;
  routeName: string | null;
  connectionType: string;
  enqueuedAt: number;
}

const _global = globalThis as typeof globalThis & {
  __serverMtQueue?: Map<string, QueuedServerMt[]>;
  __serverMtQueueStarted?: boolean;
};

const queue: Map<string, QueuedServerMt[]> = (_global.__serverMtQueue ??= new Map());

const MAX_QUEUE_PER_SUPPLIER = 500;
const QUEUE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function key(tenantId: number, supplierId: number): string {
  return `${tenantId}:${supplierId}`;
}

/** Queue an MT for a supplier. Returns false if it was a duplicate or the queue is full. */
export function enqueueServerMt(item: QueuedServerMt): boolean {
  const k = key(item.tenantId, item.supplierId);
  const arr = queue.get(k) ?? [];
  if (arr.some((q) => q.messageId === item.messageId)) return false;
  if (arr.length >= MAX_QUEUE_PER_SUPPLIER) {
    console.warn(`[SERVER-MT-QUEUE] Queue full for supplier ${item.supplierId} (${arr.length}) — dropping ${item.messageId}`);
    return false;
  }
  arr.push({ ...item, enqueuedAt: Date.now() });
  queue.set(k, arr);
  console.log(`[SERVER-MT-QUEUE] Queued MT ${item.messageId} for supplier ${item.supplierId} (depth ${arr.length})`);
  return true;
}

/** Drain (and clear) the queue for a supplier, preserving FIFO order. */
export function drainServerMtQueue(tenantId: number, supplierId: number): QueuedServerMt[] {
  const k = key(tenantId, supplierId);
  const arr = queue.get(k) ?? [];
  queue.delete(k);
  return arr;
}

/** Re-queue an item that failed to deliver during a flush (front of the line). */
export function requeueServerMt(item: QueuedServerMt): void {
  const k = key(item.tenantId, item.supplierId);
  const arr = queue.get(k) ?? [];
  arr.unshift({ ...item, enqueuedAt: Date.now() });
  queue.set(k, arr);
}

export function getServerMtQueueDepth(tenantId: number, supplierId: number): number {
  return queue.get(key(tenantId, supplierId))?.length ?? 0;
}

// ── TTL sweep: drop entries whose device never reconnected, and mark the row
//    FAILED so it doesn't sit QUEUED forever in the SMS logs. ──
if (!_global.__serverMtQueueStarted) {
  _global.__serverMtQueueStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [k, arr] of queue) {
      const remaining: QueuedServerMt[] = [];
      for (const q of arr) {
        if (now - q.enqueuedAt < QUEUE_TTL_MS) {
          remaining.push(q);
          continue;
        }
        console.warn(`[SERVER-MT-QUEUE] Expiring queued MT ${q.messageId} — device never reconnected in ${QUEUE_TTL_MS / 60000}m`);
        // Best-effort: mark FAILED. Ignore errors (row may already be gone).
        (async () => {
          const c = await pool.connect();
          try {
            await c.query(`SET search_path TO "${q.schemaName}"`);
            await c.query(
              `UPDATE messages SET status = 'FAILED', dlr_status = 'FAILED', dlr_timestamp = NOW() WHERE message_id = $1 AND dlr_status = 'QUEUED'`,
              [q.messageId]
            );
            await c.query(`SET search_path TO public`);
          } catch (e) {
            console.error(`[SERVER-MT-QUEUE] Expiry DB update failed for ${q.messageId}:`, (e as Error).message);
          } finally {
            await c.query(`SET search_path TO public`).catch(() => {});
            c.release();
          }
        })();
      }
      if (remaining.length > 0) queue.set(k, remaining);
      else queue.delete(k);
    }
  }, 60_000).unref?.();
}
