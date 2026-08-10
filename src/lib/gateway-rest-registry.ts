/**
 * Gateway REST Registry — HTTP registration for Android/REST SMS gateways.
 *
 * A phone that cannot (or chooses not to) use SMPP registers with the
 * platform over HTTPS (POST /api/public/gateway/*), heartbeats, and POLLS for
 * mobile-terminated (MT) messages — because a phone behind a mobile network
 * can never accept inbound connections.
 *
 * This module holds the per-supplier registry + MT queue in process memory
 * (globalThis so Next.js route handlers and the delivery engine share it):
 *   - register   → entry created, supplier marked online (bind_status=BOUND)
 *   - heartbeat  → lastSeen refreshed (supplier stays online)
 *   - poll       → MT items dequeued into "inflight" (claimed for delivery)
 *   - result     → success: done; failure: requeued (bounded attempts)
 *
 * The delivery engine (deliverSmsWithFallback) treats a registered gateway as
 * a connected "server session" and enqueues MT instead of pushing SMPP PDUs.
 *
 * NOTE: the registry, MT queues and inflight set live in process memory. This
 * is fine for the current single-instance pm2 deployment, but a multi-instance
 * deployment (pm2 cluster / horizontal scaling) would split registrations and
 * queues across processes — move the registry to Postgres/Redis before scaling.
 */
export interface RestMtItem {
  messageId: string;
  source: string;
  destination: string;
  content: string;
  queuedAt: number;
  attempts: number;
  lastAttempt?: number;
}

export interface RestGatewayEntry {
  tenantId: number;
  schemaName: string;
  supplierId: number;
  username: string;
  deviceInfo?: string;
  serverIp?: string;
  lastSeen: number;
  registeredAt: number;
  mtQueue: RestMtItem[];
  /** Polled but not yet reported — claimed for delivery */
  inflight: Map<string, RestMtItem>;
}

const OFFLINE_AFTER_MS = 90_000; // no heartbeat for 90s → offline
const INFLIGHT_TTL_MS = 120_000; // polled but never reported → requeue
const MAX_QUEUE = 5000;          // per-supplier MT queue cap (drops oldest)
const MAX_ATTEMPTS = 6;          // result failures before the message is dropped

const _g = globalThis as typeof globalThis & {
  __restGatewayRegistry?: Map<string, RestGatewayEntry>;
};
const registry: Map<string, RestGatewayEntry> =
  _g.__restGatewayRegistry ??= new Map();

const key = (tenantId: number, supplierId: number) => `rest:${tenantId}:${supplierId}`;

function isFresh(e: RestGatewayEntry): boolean {
  return Date.now() - e.lastSeen < OFFLINE_AFTER_MS;
}

export function getRestGateway(
  tenantId: number,
  supplierId: number
): RestGatewayEntry | undefined {
  return registry.get(key(tenantId, supplierId));
}

/** Is this supplier currently registered via REST AND heartbeating? */
export function isRestGatewayOnline(tenantId: number, supplierId: number): boolean {
  const e = registry.get(key(tenantId, supplierId));
  return !!e && isFresh(e);
}

export function registerRestGateway(entry: {
  tenantId: number;
  schemaName: string;
  supplierId: number;
  username: string;
  deviceInfo?: string;
  serverIp?: string;
}): RestGatewayEntry {
  const k = key(entry.tenantId, entry.supplierId);
  const existing = registry.get(k);
  const e: RestGatewayEntry = {
    tenantId: entry.tenantId,
    schemaName: entry.schemaName,
    supplierId: entry.supplierId,
    username: entry.username,
    deviceInfo: entry.deviceInfo,
    serverIp: entry.serverIp,
    lastSeen: Date.now(),
    registeredAt: Date.now(),
    mtQueue: existing?.mtQueue ?? [],
    inflight: existing?.inflight ?? new Map(),
  };
  registry.set(k, e);
  return e;
}

/** Refresh lastSeen. Returns false if the supplier is not registered. */
export function touchRestGateway(tenantId: number, supplierId: number): boolean {
  const e = registry.get(key(tenantId, supplierId));
  if (!e) return false;
  e.lastSeen = Date.now();
  return true;
}

export function unregisterRestGateway(tenantId: number, supplierId: number): void {
  registry.delete(key(tenantId, supplierId));
}

/** Enqueue MT for a REST gateway. Returns false if offline or queue full. */
export function enqueueRestMt(
  tenantId: number,
  supplierId: number,
  messageId: string,
  source: string,
  destination: string,
  content: string
): boolean {
  const e = registry.get(key(tenantId, supplierId));
  if (!e || !isFresh(e)) return false;
  // Reject when the queue is at capacity so the delivery engine falls back to
  // the next route (or fails visibly via retries) instead of silently dropping
  // the oldest message — the queue is a backpressure buffer, not a loss buffer.
  if (e.mtQueue.length >= MAX_QUEUE) return false;
  e.mtQueue.push({ messageId, source, destination, content, queuedAt: Date.now(), attempts: 0 });
  return true;
}

/** Dequeue up to `max` MT items, claiming them as in-flight. */
export function dequeueRestMt(
  tenantId: number,
  supplierId: number,
  max: number
): RestMtItem[] {
  const e = registry.get(key(tenantId, supplierId));
  if (!e) return [];
  const items: RestMtItem[] = [];
  while (items.length < max && e.mtQueue.length > 0) {
    const item = e.mtQueue.shift()!;
    e.inflight.set(item.messageId, item);
    items.push(item);
  }
  return items;
}

/**
 * Report the outcome of a polled MT message.
 * Returns "ok" (success — finished), "requeued" (failure, retry queued), or
 * "dropped" (failure, attempts exhausted — no more retries).
 */
export function reportRestMtResult(
  tenantId: number,
  supplierId: number,
  messageId: string,
  success: boolean
): "ok" | "requeued" | "dropped" | "unknown" {
  const e = registry.get(key(tenantId, supplierId));
  if (!e) return "unknown";
  const item = e.inflight.get(messageId);
  if (!item) return "unknown";
  e.inflight.delete(messageId);
  if (success) return "ok";
  item.attempts += 1;
  item.lastAttempt = Date.now();
  if (item.attempts >= MAX_ATTEMPTS) return "dropped";
  e.mtQueue.unshift(item); // retry at the front so it doesn't starve
  return "requeued";
}

export function getRestGatewayStats(): {
  online: number;
  queued: number;
  inflight: number;
} {
  let online = 0;
  let queued = 0;
  let inflight = 0;
  for (const e of registry.values()) {
    if (isFresh(e)) online++;
    queued += e.mtQueue.length;
    inflight += e.inflight.size;
  }
  return { online, queued, inflight };
}

/**
 * Periodic maintenance: drop offline entries, requeue stale in-flight items
 * (claimed but never reported), and prune oversized queues.
 */
function cleanup(): void {
  const now = Date.now();
  for (const [k, e] of registry) {
    if (!isFresh(e)) {
      registry.delete(k);
      continue;
    }
    // Requeue in-flight items that were never reported (phone vanished mid-batch)
    for (const [msgId, item] of e.inflight) {
      if (now - (item.lastAttempt || item.queuedAt) > INFLIGHT_TTL_MS) {
        e.inflight.delete(msgId);
        item.attempts += 1;
        if (item.attempts < MAX_ATTEMPTS) e.mtQueue.unshift(item);
      }
    }
    while (e.mtQueue.length > MAX_QUEUE) e.mtQueue.shift();
  }
}

setInterval(cleanup, 30_000).unref?.();
