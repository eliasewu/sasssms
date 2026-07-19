/**
 * SMPP Client Manager — connects OUT to supplier SMPP gateways
 * Used when supplier.connection_mode = 'CLIENT' (we initiate the bind)
 *
 * Features:
 *  - Supplier connection management (connect, disconnect, auto-reconnect)
 *  - Real outbound SMS delivery with route-priority fallback
 *  - Real DLR (delivery receipt) processing from suppliers
 *  - DLR push to clients via registered callbacks (SMPP or HTTP)
 */
import smpp from "smpp";
import { pool } from "@/db";
import { lookupSupplierCost } from "@/lib/rates";

const smppLib: any = smpp;
type SmppSession = any;

interface SupplierConnection {
  supplierId: number;
  tenantId: number;
  schemaName: string;
  session: SmppSession;
  host: string;
  port: number;
  systemId: string;
  smppVersion: string;
  interfaceVersion: number;
  connectedAt: Date;
  status: "BOUND" | "UNBOUND" | "RECONNECTING";
}

export interface RouteInfo {
  routeId: number;
  routeName: string;
  trunkId: number;
  trunkName: string;
  trunkMccAllowList: string | null;
  trunkMccDenyList: string | null;
  supplierId: number;
  supplierName: string;
  connectionType: string;
  priority: number;
}

export interface DlrPayload {
  messageId: string;           // our internal message_id
  supplierMessageId: string;   // supplier-assigned message_id
  status: string;              // DELIVERED / FAILED / UNDELIVERABLE / etc.
  submitDate: string;
  doneDate: string;
  errorCode: string;
  dest: string;
  src: string;
}

export interface DeliveryResult {
  success: boolean;
  messageId: string;
  supplierMessageId?: string;
  routeUsed?: RouteInfo;
  fallbackUsed: boolean;
  failedRoutes: number;
  errorMessage?: string;
}

interface PendingDelivery {
  ourMessageId: string;
  supplierId: number;
  tenantId: number;
  schemaName: string;
  clientId: number;
  dlrCallbackUrl?: string;
  source: string;
  destination: string;
  createdAt: Date;
}

// Use globalThis to share state across Next.js instrumentation and API route entry points
const _global = globalThis as typeof globalThis & {
  __supplierConnections?: Map<string, SupplierConnection>;
  __pendingDeliveries?: Map<string, PendingDelivery>;
  __dlrCallbacks?: Map<string, DlrCallback>;
};

// ── Active outbound connections ──
const supplierConnections: Map<string, SupplierConnection> = _global.__supplierConnections ??= new Map();

// ── Pending deliveries: supplier_message_id → our tracking info ──
const pendingDeliveries: Map<string, PendingDelivery> = _global.__pendingDeliveries ??= new Map();

// ── DLR callbacks: our_message_id → callback to push DLR to client ──
type DlrCallback = (dlr: DlrPayload) => void;
const dlrCallbacks: Map<string, DlrCallback> = _global.__dlrCallbacks ??= new Map();

// ── Cleanup stale pending deliveries every 5 minutes ──
setInterval(() => {
  const now = Date.now();
  for (const [key, delivery] of pendingDeliveries) {
    if (now - delivery.createdAt.getTime() > 600_000) { // 10 min timeout
      pendingDeliveries.delete(key);
      dlrCallbacks.delete(delivery.ourMessageId);
    }
  }
}, 300_000);

const RECONNECT_INTERVAL = 30000;
const BIND_TIMEOUT = 10000;
const MAX_RECONNECT_BACKOFF = 300000; // 5 minutes max backoff
const ENQUIRE_LINK_PERIOD = 30000; // 30s keepalive

// Track reconnect backoff per supplier to avoid tight loops
const reconnectBackoffs: Map<string, number> = new Map();
const reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

/**
 * Convert smpp_version string to interface_version hex value.
 * v3.3 → 0x33, v3.4 → 0x34, v5.0/v5 → 0x50
 */
function smppVersionToHex(version: string): number {
  const v = version.trim();
  if (v === "3.3") return 0x33;
  if (v === "3.4") return 0x34;
  if (v === "5.0" || v === "5") return 0x50;
  // Unknown version — warn and default to v3.4
  if (v) console.warn(`[SMPP-CLIENT] Unknown smpp_version "${version}", defaulting to 3.4`);
  return 0x34;
}

/** Human-readable SMPP command_status description */
function statusDescription(status: number): string {
  const desc: Record<number, string> = {
    0x00: "OK", 0x01: "RINVMSGLEN", 0x02: "RINVCMDLEN", 0x03: "RINVCMDID",
    0x04: "RINVBNDSTS", 0x05: "RALYBND", 0x08: "RSYSERR", 0x0A: "RINVDSTADR",
    0x0B: "RINVMSGID", 0x0C: "RBINDFAIL", 0x0D: "RINVPASWD", 0x0E: "RINVSYSID",
    0x0F: "RCANCELFAIL", 0x14: "RMSGQFUL",
  };
  return desc[status] || `0x${status.toString(16)}`;
}

/** Determine TON (Type of Number) from an address. 1=International, 5=Alphanumeric, 0=Unknown */
function determineTon(address: string): number {
  if (!address) return 0;
  // Alphanumeric sender IDs (non-numeric)
  if (!/^[\d+]+$/.test(address)) return 5;
  // International numbers (start with +)
  if (address.startsWith("+")) return 1;
  // Numeric-only: assume international if long enough, otherwise unknown
  return address.length >= 10 ? 1 : 0;
}

/** Determine NPI (Numbering Plan Indicator). 1=ISDN/E.164, 0=Unknown */
function determineNpi(address: string): number {
  if (!address) return 0;
  // Alphanumeric → unknown NPI
  if (!/^[\d+]+$/.test(address)) return 0;
  // Numeric/international → ISDN
  return 1;
}

/**
 * Parse DLR from deliver_sm short_message
 * Format: "id:{msgId} sub:001 dlvrd:001 submit date:{date} done date:{date} stat:{status} err:{err} text:{text}"
 */
export function parseDlrMessage(text: string): {
  messageId: string;
  status: string;
  errorCode: string;
  submitDate: string;
  doneDate: string;
} | null {
  try {
    const idMatch = text.match(/id:(\S+)/);
    const statMatch = text.match(/stat:(\S+)/);
    const errMatch = text.match(/err:(\S+)/);
    const subDateMatch = text.match(/submit date:(\d+)/);
    const doneDateMatch = text.match(/done date:(\d+)/);

    if (!idMatch || !statMatch) return null;

    return {
      messageId: idMatch[1],
      status: statMatch[1],
      errorCode: errMatch?.[1] || "000",
      submitDate: subDateMatch?.[1] || "",
      doneDate: doneDateMatch?.[1] || "",
    };
  } catch {
    return null;
  }
}

/**
 * Handle incoming DLR from a supplier (deliver_sm with esm_class=4)
 */
async function processSupplierDlr(
  tenantId: number,
  schemaName: string,
  supplierId: number,
  pdu: any
) {
  const esmClass = pdu.esm_class || 0;
  // esm_class bit 2 (value 4) = Delivery Receipt
  const isDlr = (esmClass & 0x04) !== 0;
  if (!isDlr) {
    // Not a DLR — could be an inbound SMS (MO), handle separately
    console.log(`[SMPP-CLIENT] Non-DLR deliver_sm from supplier ${supplierId} (esm_class=${esmClass})`);
    return;
  }

  const text = typeof pdu.short_message === "string"
    ? pdu.short_message
    : pdu.short_message?.message || "";

  const parsed = parseDlrMessage(text);
  if (!parsed) {
    console.warn(`[SMPP-CLIENT] Could not parse DLR from supplier ${supplierId}:`, text.substring(0, 100));
    return;
  }

  const supplierMessageId = parsed.messageId;
  const delivery = pendingDeliveries.get(supplierMessageId);

  if (!delivery) {
    // Might be for a different tenant or already cleaned up
    console.log(`[SMPP-CLIENT] DLR for unknown message ${supplierMessageId} from supplier ${supplierId}`);
    return;
  }

  console.log(`[SMPP-CLIENT] DLR received: ${supplierMessageId} → ${parsed.status} (our: ${delivery.ourMessageId})`);

  // Update message DLR status in tenant DB
  const client = await pool.connect();
  try {
    const statusMap: Record<string, string> = {
      DELIVRD: "DELIVERED",
      DELIVERED: "DELIVERED",
      EXPIRED: "FAILED",
      UNDELIV: "FAILED",
      REJECTD: "FAILED",
      DELETED: "FAILED",
      UNKNOWN: "FAILED",
      FAILED: "FAILED",
    };
    const dlrStatus = statusMap[parsed.status.toUpperCase()] || parsed.status;

    await client.query(`SET search_path TO "${delivery.schemaName}"`);

    // Update message DLR status
    await client.query(
      `UPDATE messages SET dlr_status = $1, dlr_timestamp = NOW(), status = $2 WHERE message_id = $3`,
      [dlrStatus, dlrStatus, delivery.ourMessageId]
    );

    // ── On DLR success: stamp supplier cost, record profit (client_rate - supplier_rate) ──
    if (dlrStatus === "DELIVERED") {
      const { rows: msgRows } = await client.query(
        `SELECT m.client_id, m.cost as client_rate, m.supplier_id, m.destination
         FROM messages m WHERE m.message_id = $1`,
        [delivery.ourMessageId]
      );
      if (msgRows.length > 0) {
        const clientRate = parseFloat(msgRows[0].client_rate || "0");
        const dest = msgRows[0].destination || "";
        const supplierId = msgRows[0].supplier_id;
        // Look up supplier cost from supplier_rates (uses destination prefix matching)
        let supplierCost = 0;
        if (supplierId && dest) {
          supplierCost = await lookupSupplierCost(dest, supplierId, delivery.schemaName);
        }
        // Update message with actual supplier cost and profit
        await client.query(
          `UPDATE messages SET supplier_cost = $1, profit = $2 WHERE message_id = $3`,
          [supplierCost, clientRate - supplierCost, delivery.ourMessageId]
        );
      }
    }

    await client.query(`SET search_path TO public`);
  } catch (err) {
    console.error(`[SMPP-CLIENT] Failed to update DLR in DB:`, err);
  } finally {
    client.release();
  }

  // Trigger DLR callback (pushes to client via SMPP or HTTP)
  const dlrPayload: DlrPayload = {
    messageId: delivery.ourMessageId,
    supplierMessageId,
    status: parsed.status,
    submitDate: parsed.submitDate,
    doneDate: parsed.doneDate,
    errorCode: parsed.errorCode,
    dest: delivery.destination,
    src: delivery.source,
  };

  const callback = dlrCallbacks.get(delivery.ourMessageId);
  if (callback) {
    try {
      callback(dlrPayload);
    } catch (err) {
      console.error(`[SMPP-CLIENT] DLR callback error:`, err);
    }
    dlrCallbacks.delete(delivery.ourMessageId);
  }

  // Also push HTTP DLR if client has callback URL
  if (delivery.dlrCallbackUrl) {
    pushHttpDlr(delivery.dlrCallbackUrl, dlrPayload);
  }

  // Clean up
  pendingDeliveries.delete(supplierMessageId);
}

/**
 * Push DLR to client via HTTP callback (fire-and-forget)
 */
async function pushHttpDlr(url: string, dlr: DlrPayload) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_id: dlr.messageId,
        supplier_message_id: dlr.supplierMessageId,
        status: dlr.status,
        destination: dlr.dest,
        source: dlr.src,
        submit_date: dlr.submitDate,
        done_date: dlr.doneDate,
        error_code: dlr.errorCode,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (err) {
    console.error(`[SMPP-CLIENT] HTTP DLR push failed:`, err);
  }
}

/**
 * Low-level: attempt a single bind with a specific interface_version.
 * Returns the bind response command_status (0 = success).
 * On TCP/socket error, the promise is rejected.
 */
function attemptBind(
  key: string,
  host: string,
  port: number,
  systemId: string,
  password: string,
  bindType: string,
  systemType: string,
  interfaceVersion: number,
  supplierId: number,
  tenantId: number,
  schemaName: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    const sess = smppLib.connect({ host, port, auto_enquire_link_period: ENQUIRE_LINK_PERIOD });

    const bindEvent = bindType === "transmitter"
      ? "bind_transmitter"
      : bindType === "receiver"
        ? "bind_receiver"
        : "bind_transceiver";

    let settled = false;

    sess.on("connect", () => {
      sess.send(new smppLib.PDU(bindEvent, {
        system_id: systemId,
        password: password,
        system_type: systemType,
        interface_version: interfaceVersion,
      }), (resp: any) => {
        if (settled) return;
        if (resp.command_status === 0) {
          settled = true;
          const respVersion = resp.interface_version || interfaceVersion;
          const vLabel = hexToVersionLabel(respVersion);
          const conn: SupplierConnection = {
            supplierId, tenantId, schemaName, session: sess,
            host, port, systemId,
            smppVersion: vLabel,
            interfaceVersion: respVersion,
            connectedAt: new Date(),
            status: "BOUND",
          };
          supplierConnections.set(key, conn);

          sess.on("deliver_sm", (pdu: any) => {
            // ACK the deliver_sm immediately so the SMSC doesn't stall its window
            try { sess.send(pdu.response({ message_id: "" })); } catch {}
            processSupplierDlr(tenantId, schemaName, supplierId, pdu).catch((err) => {
              console.error(`[SMPP-CLIENT] DLR processing error:`, err);
            });
          });

          console.log(`[SMPP-CLIENT] ✅ BOUND to supplier ${supplierId} @ ${host}:${port} (SMPP ${vLabel})`);
          updateSupplierBindStatus(schemaName, supplierId, "BOUND");
          resolve(0);
        } else {
          settled = true;
          const status = resp.command_status;
          const statusLabel = statusDescription(status);
          const smscSystemId = resp.system_id || "(none)";
          console.error(`[SMPP-CLIENT] ❌ Bind REJECTED by ${host}:${port} — status=${status} (${statusLabel}), smsc_id="${smscSystemId}", our_id="${systemId}", version=0x${interfaceVersion.toString(16)}`);
          sess.close();
          resolve(status);
        }
      });
    });

    sess.on("error", (err: Error) => {
      if (settled) return;
      settled = true;
      sess.close();
      console.error(`[SMPP-CLIENT] ❌ TCP error connecting to ${host}:${port}: ${err.message}`);
      reject(new Error(`TCP error connecting to ${host}:${port}: ${err.message}`));
    });

    sess.on("close", () => {
      if (settled) return;
      settled = true;
      console.error(`[SMPP-CLIENT] ❌ Connection closed during bind to ${host}:${port} (no response from SMSC)`);
      reject(new Error(`Connection closed during bind to ${host}:${port} (no response from SMSC)`));
    });

    setTimeout(() => {
      if (!settled) {
        settled = true;
        sess.close();
        reject(new Error(`Bind timeout to ${host}:${port}`));
      }
    }, BIND_TIMEOUT);
  });
}

/** Convert interface_version hex back to version string for logging */
function hexToVersionLabel(hex: number): string {
  if (hex === 0x33) return "3.3";
  if (hex === 0x34) return "3.4";
  if (hex === 0x50) return "5.0";
  return `0x${hex.toString(16)}`;
}

/**
 * Connect to a supplier's SMPP server in client mode.
 * Auto-detects the SMPP version: tries configured version → 3.4 → 3.3.
 */
export async function connectToSupplier(
  tenantId: number,
  schemaName: string,
  supplierId: number,
  host: string,
  port: number,
  systemId: string,
  password: string,
  bindType: string = "transceiver",
  systemType: string = "ESME",
  smppVersion: string = "3.4"
): Promise<boolean> {
  const key = `${tenantId}:${supplierId}`;

  // ── TX_RX mode: bind transmitter + receiver separately ──
  if (bindType === "TX_RX") {
    // Close any existing connections for this supplier (all suffix variants)
    for (const suffix of ["", ":tx", ":rx"]) {
      const existingKey = `${tenantId}:${supplierId}${suffix}`;
      const existing = supplierConnections.get(existingKey);
      if (existing) {
        try { existing.session.close(); } catch {}
        supplierConnections.delete(existingKey);
      }
    }

    const txKey = `${tenantId}:${supplierId}:tx`;
    const rxKey = `${tenantId}:${supplierId}:rx`;

    // Bind transmitter first
    console.log(`[SMPP-CLIENT] TX_RX mode: binding transmitter to supplier ${supplierId}`);
    const txOk = await doVersionFallback(txKey, host, port, systemId, password, "transmitter", systemType, smppVersion, supplierId, tenantId, schemaName);
    if (!txOk) {
      updateSupplierBindStatus(schemaName, supplierId, "BIND_FAILED", "TX_RX: transmitter bind failed");
      return false;
    }

    // Bind receiver second
    console.log(`[SMPP-CLIENT] TX_RX mode: binding receiver to supplier ${supplierId}`);
    const rxOk = await doVersionFallback(rxKey, host, port, systemId, password, "receiver", systemType, smppVersion, supplierId, tenantId, schemaName);
    if (!rxOk) {
      // Clean up the transmitter connection that succeeded
      disconnectSupplier(tenantId, supplierId);
      updateSupplierBindStatus(schemaName, supplierId, "BIND_FAILED", "TX_RX: receiver bind failed");
      return false;
    }

    // Register session handlers on both connections
    const txConn = supplierConnections.get(txKey);
    const rxConn = supplierConnections.get(rxKey);
    if (txConn) registerSessionHandlers(txConn.session, txKey);
    if (rxConn) registerSessionHandlers(rxConn.session, rxKey);

    updateSupplierBindStatus(schemaName, supplierId, "BOUND");
    console.log(`[SMPP-CLIENT] TX_RX BOUND to supplier ${supplierId} @ ${host}:${port}`);
    return true;
  }

  // Close any existing connection for this supplier
  const existing = supplierConnections.get(key);
  if (existing) {
    try { existing.session.close(); } catch {}
    supplierConnections.delete(key);
  }

  // Single-bind: use the version fallback helper
  const ok = await doVersionFallback(key, host, port, systemId, password, bindType, systemType, smppVersion, supplierId, tenantId, schemaName);
  if (ok) {
    const conn = supplierConnections.get(key);
    if (conn) registerSessionHandlers(conn.session, key);
    return true;
  }
  return false;
}

/**
 * Version fallback helper: tries configured version → 3.4 → 3.3.
 * Returns true if any version binds successfully, false otherwise.
 * On failure, updates bind_error with per-version status codes.
 */
async function doVersionFallback(
  key: string,
  host: string,
  port: number,
  systemId: string,
  password: string,
  bindType: string,
  systemType: string,
  smppVersion: string,
  supplierId: number,
  tenantId: number,
  schemaName: string
): Promise<boolean> {
  const configuredHex = smppVersionToHex(smppVersion);
  const candidateVersions: { hex: number; label: string }[] = [];
  const seen = new Set<number>();
  // Try configured → 3.4 → 3.3 → 5.0 (full spectrum)
  for (const h of [configuredHex, 0x34, 0x33, 0x50]) {
    if (!seen.has(h)) {
      seen.add(h);
      candidateVersions.push({ hex: h, label: hexToVersionLabel(h) });
    }
  }

  const failedStatuses: { label: string; status: number }[] = [];

  for (const { hex, label } of candidateVersions) {
    console.log(`[SMPP-CLIENT] Attempting SMPP ${label} (0x${hex.toString(16)}) for supplier ${supplierId}`);
    try {
      const status = await attemptBind(key, host, port, systemId, password, bindType, systemType, hex, supplierId, tenantId, schemaName);
      if (status === 0) {
        return true;
      }
      failedStatuses.push({ label, status });
      console.warn(`[SMPP-CLIENT] SMPP ${label} bind failed for supplier ${supplierId} with status=${status}`);
    } catch (err) {
      console.warn(`[SMPP-CLIENT] SMPP ${label} bind error for supplier ${supplierId}: ${(err as Error).message}`);
      failedStatuses.push({ label, status: -1 });
    }
  }

  const statusList = failedStatuses.length > 0
    ? failedStatuses.map((f) => `v${f.label}=${statusDescription(f.status)}`).join(", ")
    : "unknown error";
  console.error(`[SMPP-CLIENT] All SMPP versions failed for supplier ${supplierId} @ ${host}:${port} (${statusList})`);
  updateSupplierBindStatus(schemaName, supplierId, "BIND_FAILED", `Rejected by SMSC [${statusList}]`);
  // Schedule persistent reconnect unless it's a permanent auth failure (wrong password or system_id)
  const isAuthFailure = failedStatuses.some(f => f.status === 0x0D || f.status === 0x0E);
  if (!isAuthFailure) {
    scheduleReconnect(tenantId, schemaName, supplierId);
  } else {
    console.error(`[SMPP-CLIENT] Auth failure for supplier ${supplierId} — will NOT auto-retry (check credentials)`);
  }
  return false;
}

/**
 * Register session-level error/close handlers for a supplier connection.
 * For TX_RX mode (dual sessions), only marks the supplier UNBOUND and
 * triggers reconnect when BOTH transmitter and receiver sessions are down.
 */
function registerSessionHandlers(sess: any, sessKey: string) {
  const parts = sessKey.split(":");
  const tenantId = parseInt(parts[0]);
  const supplierId = parseInt(parts[1]);
  const isDualMode = parts.length >= 3; // key like "123:45:tx" or "123:45:rx"

  // Resolve schema name from connections map
  const conn = supplierConnections.get(sessKey);
  const schemaName = conn?.schemaName || "public";

  /** Check if any sibling session is still alive in TX_RX mode */
  function hasSiblingSession(): boolean {
    if (!isDualMode) return false;
    const baseKey = `${tenantId}:${supplierId}`;
    const txKey = `${baseKey}:tx`;
    const rxKey = `${baseKey}:rx`;
    const otherKey = sessKey === txKey ? rxKey : txKey;
    const other = supplierConnections.get(otherKey);
    return other?.status === "BOUND";
  }

  sess.on("error", (err: Error) => {
    console.error(`[SMPP-CLIENT] Error on supplier ${supplierId} (${sessKey}): ${err.message}`);
    const c = supplierConnections.get(sessKey);
    if (c) c.status = "UNBOUND";
    supplierConnections.delete(sessKey);

    if (!hasSiblingSession()) {
      updateSupplierBindStatus(schemaName, supplierId, "UNBOUND", err.message);
    }
  });

  sess.on("close", () => {
    const c = supplierConnections.get(sessKey);
    if (c) c.status = "UNBOUND";
    supplierConnections.delete(sessKey);

    if (!hasSiblingSession()) {
      updateSupplierBindStatus(schemaName, supplierId, "UNBOUND", "Connection closed");
      // Reset backoff on clean disconnect — the SMSC may just be restarting
      reconnectBackoffs.delete(`${tenantId}:${supplierId}`);
      scheduleReconnect(tenantId, schemaName, supplierId);
    } else {
      console.log(`[SMPP-CLIENT] TX_RX partial disconnect for supplier ${supplierId} (${sessKey}), sibling still active`);
      // If the TX (transmitter) dropped, reconnect just the TX so outbound SMS works
      if (sessKey.endsWith(":tx")) {
        console.log(`[SMPP-CLIENT] TX_RX: transmitter dropped — reconnecting TX for supplier ${supplierId}`);
        scheduleReconnectTxOnly(tenantId, schemaName, supplierId);
      }
      // If the RX (receiver) dropped, reconnect just the RX so DLRs keep flowing
      if (sessKey.endsWith(":rx")) {
        console.log(`[SMPP-CLIENT] TX_RX: receiver dropped — reconnecting RX for supplier ${supplierId}`);
        scheduleReconnectRxOnly(tenantId, schemaName, supplierId);
      }
    }
  });
}

async function reconnectToSupplier(tenantId: number, schemaName: string, supplierId: number) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    const { rows } = await client.query(
      `SELECT host, port, username, password, system_id, bind_type, system_type, connection_mode, smpp_version
       FROM suppliers WHERE id = $1 AND is_active = true AND deleted_at IS NULL`,
      [supplierId]
    );
    if (rows.length === 0 || rows[0].connection_mode !== "CLIENT") return;
    const s = rows[0];
    console.log(`[SMPP-CLIENT] Reconnecting to supplier ${supplierId} @ ${s.host}:${s.port}`);
    const ok = await connectToSupplier(
      tenantId, schemaName, supplierId,
      s.host, s.port, s.username || s.system_id, s.password,
      s.bind_type || "transceiver", s.system_type || "ESME",
      s.smpp_version || "3.4"
    );
    // On success, reset backoff; on failure, scheduleReconnect was already called by doVersionFallback
    if (ok) {
      reconnectBackoffs.delete(`${tenantId}:${supplierId}`);
    }
  } catch (err) {
    console.error(`[SMPP-CLIENT] Reconnect error:`, err);
    scheduleReconnect(tenantId, schemaName, supplierId);
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Reconnect only the TX (transmitter) leg in TX_RX mode.
 * Called when TX drops but RX is still alive — avoids a full reconnect cycle.
 */
async function reconnectTxOnly(tenantId: number, schemaName: string, supplierId: number) {
  // Guard: if RX also dropped by the time this timer fires, do a full reconnect instead
  const rxKey = `${tenantId}:${supplierId}:rx`;
  const rxConn = supplierConnections.get(rxKey);
  if (!rxConn || rxConn.status !== "BOUND") {
    console.log(`[SMPP-CLIENT] TX_RX: RX also down for supplier ${supplierId}, doing full reconnect`);
    reconnectToSupplier(tenantId, schemaName, supplierId);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    const { rows } = await client.query(
      `SELECT host, port, username, password, system_id, bind_type, system_type, connection_mode, smpp_version
       FROM suppliers WHERE id = $1 AND is_active = true AND deleted_at IS NULL`,
      [supplierId]
    );
    if (rows.length === 0 || rows[0].connection_mode !== "CLIENT") return;
    const s = rows[0];

    // Only reconnect TX — RX is still alive
    const txKey = `${tenantId}:${supplierId}:tx`;
    console.log(`[SMPP-CLIENT] Reconnecting TX only for supplier ${supplierId} @ ${s.host}:${s.port}`);
    const txOk = await doVersionFallback(
      txKey, s.host, s.port, s.username || s.system_id, s.password,
      "transmitter", s.system_type || "SMSC", s.smpp_version || "3.4",
      supplierId, tenantId, schemaName
    );
    if (txOk) {
      const txConn = supplierConnections.get(txKey);
      if (txConn) registerSessionHandlers(txConn.session, txKey);
      updateSupplierBindStatus(schemaName, supplierId, "BOUND");
      reconnectBackoffs.delete(`${tenantId}:${supplierId}`);
      console.log(`[SMPP-CLIENT] TX_RX TX leg recovered for supplier ${supplierId}`);
    } else {
      console.error(`[SMPP-CLIENT] Failed to recover TX leg for supplier ${supplierId}`);
      scheduleReconnectTxOnly(tenantId, schemaName, supplierId);
    }
  } catch (err) {
    console.error(`[SMPP-CLIENT] TX-only reconnect error:`, err);
    scheduleReconnectTxOnly(tenantId, schemaName, supplierId);
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Reconnect only the RX (receiver) leg in TX_RX mode.
 * Called when RX drops but TX is still alive — keeps DLRs flowing.
 */
async function reconnectRxOnly(tenantId: number, schemaName: string, supplierId: number) {
  const txKey = `${tenantId}:${supplierId}:tx`;
  const txConn = supplierConnections.get(txKey);
  if (!txConn || txConn.status !== "BOUND") {
    console.log(`[SMPP-CLIENT] TX_RX: TX also down for supplier ${supplierId}, doing full reconnect`);
    reconnectToSupplier(tenantId, schemaName, supplierId);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    const { rows } = await client.query(
      `SELECT host, port, username, password, system_id, bind_type, system_type, connection_mode, smpp_version
       FROM suppliers WHERE id = $1 AND is_active = true AND deleted_at IS NULL`,
      [supplierId]
    );
    if (rows.length === 0 || rows[0].connection_mode !== "CLIENT") return;
    const s = rows[0];

    const rxKey = `${tenantId}:${supplierId}:rx`;
    console.log(`[SMPP-CLIENT] Reconnecting RX only for supplier ${supplierId} @ ${s.host}:${s.port}`);
    const rxOk = await doVersionFallback(
      rxKey, s.host, s.port, s.username || s.system_id, s.password,
      "receiver", s.system_type || "SMSC", s.smpp_version || "3.4",
      supplierId, tenantId, schemaName
    );
    if (rxOk) {
      const rxConn = supplierConnections.get(rxKey);
      if (rxConn) registerSessionHandlers(rxConn.session, rxKey);
      updateSupplierBindStatus(schemaName, supplierId, "BOUND");
      reconnectBackoffs.delete(`${tenantId}:${supplierId}`);
      console.log(`[SMPP-CLIENT] TX_RX RX leg recovered for supplier ${supplierId}`);
    } else {
      console.error(`[SMPP-CLIENT] Failed to recover RX leg for supplier ${supplierId}`);
      scheduleReconnectRxOnly(tenantId, schemaName, supplierId);
    }
  } catch (err) {
    console.error(`[SMPP-CLIENT] RX-only reconnect error:`, err);
    scheduleReconnectRxOnly(tenantId, schemaName, supplierId);
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Schedule a full reconnect with exponential backoff.
 * Backoff: 30s → 60s → 120s → 240s → max 300s.
 * Resets to 30s on successful reconnect.
 */
function scheduleReconnect(tenantId: number, schemaName: string, supplierId: number) {
  const backoffKey = `${tenantId}:${supplierId}`;
  const timerKey = `full:${backoffKey}`;

  // Clear any existing reconnect timer for this supplier
  const existing = reconnectTimers.get(timerKey);
  if (existing) clearTimeout(existing);

  const currentBackoff = reconnectBackoffs.get(backoffKey) || RECONNECT_INTERVAL;
  const nextBackoff = Math.min(currentBackoff * 2, MAX_RECONNECT_BACKOFF);
  reconnectBackoffs.set(backoffKey, nextBackoff);

  console.log(`[SMPP-CLIENT] Scheduling reconnect for supplier ${supplierId} in ${currentBackoff / 1000}s`);
  const timer = setTimeout(() => {
    reconnectTimers.delete(timerKey);
    reconnectToSupplier(tenantId, schemaName, supplierId);
  }, currentBackoff);
  reconnectTimers.set(timerKey, timer);
}

function scheduleReconnectTxOnly(tenantId: number, schemaName: string, supplierId: number) {
  const timerKey = `tx:${tenantId}:${supplierId}`;
  const existing = reconnectTimers.get(timerKey);
  if (existing) clearTimeout(existing);

  console.log(`[SMPP-CLIENT] Scheduling TX reconnect for supplier ${supplierId} in ${RECONNECT_INTERVAL / 1000}s`);
  const timer = setTimeout(() => {
    reconnectTimers.delete(timerKey);
    reconnectTxOnly(tenantId, schemaName, supplierId);
  }, RECONNECT_INTERVAL);
  reconnectTimers.set(timerKey, timer);
}

function scheduleReconnectRxOnly(tenantId: number, schemaName: string, supplierId: number) {
  const timerKey = `rx:${tenantId}:${supplierId}`;
  const existing = reconnectTimers.get(timerKey);
  if (existing) clearTimeout(existing);

  console.log(`[SMPP-CLIENT] Scheduling RX reconnect for supplier ${supplierId} in ${RECONNECT_INTERVAL / 1000}s`);
  const timer = setTimeout(() => {
    reconnectTimers.delete(timerKey);
    reconnectRxOnly(tenantId, schemaName, supplierId);
  }, RECONNECT_INTERVAL);
  reconnectTimers.set(timerKey, timer);
}

/**
 * Send submit_sm through an active outbound supplier connection.
 * Returns the supplier-assigned message_id on success.
 */
export function sendViaSupplierConnection(
  tenantId: number,
  supplierId: number,
  source: string,
  destination: string,
  content: string,
  messageId: string
): Promise<{ success: boolean; supplierMessageId: string; errorCode?: number }> {
  // Try TX key first (TX_RX mode), then TRX key (transceiver mode)
  const txKey = `${tenantId}:${supplierId}:tx`;
  const trxKey = `${tenantId}:${supplierId}`;
  const conn = supplierConnections.get(txKey) || supplierConnections.get(trxKey);

  if (!conn || conn.status !== "BOUND") {
    return Promise.resolve({ success: false, supplierMessageId: "", errorCode: 14 });
  }

  return new Promise((resolve) => {
    conn.session.send(
      new smppLib.PDU("submit_sm", {
        source_addr_ton: determineTon(source),
        source_addr_npi: determineNpi(source),
        source_addr: source,
        dest_addr_ton: determineTon(destination),
        dest_addr_npi: determineNpi(destination),
        destination_addr: destination,
        short_message: { message: content },
        registered_delivery: 1,
        data_coding: 0,
      }),
      (resp: any) => {
        resolve({
          success: resp.command_status === 0,
          supplierMessageId: resp.message_id || "",
          errorCode: resp.command_status || undefined,
        });
      }
    );
  });
}

/**
 * Send MT through an active SERVER-mode supplier session.
 * Tries SUBMIT_SM first (standard MT, triggers proper DLR tracking),
 * falls back to DELIVER_SM if the modem rejects SUBMIT_SM.
 */
export function sendViaSupplierServerSession(
  tenantId: number,
  supplierId: number,
  source: string,
  destination: string,
  content: string,
  messageId: string,
  /** Optional explicit map from the caller to bypass Next.js module-isolation issues */
  serverSessions?: Map<string, any>
): Promise<{ success: boolean; supplierMessageId: string; errorCode?: number }> {
  // Prefer the explicitly-passed map (caller's closure); fall back to globalThis
  const sessions: Map<string, any> | undefined = serverSessions
    || (globalThis as any).__activeSupplierSessions;

  if (!sessions) {
    return Promise.resolve({ success: false, supplierMessageId: "", errorCode: 14 });
  }

  const key = `supplier:${tenantId}:${supplierId}`;
  const sess = sessions.get(key);
  if (!sess) {
    return Promise.resolve({ success: false, supplierMessageId: "", errorCode: 14 });
  }

  // ── Try SUBMIT_SM first (standard MT — triggers proper DLR tracking) ──
  return new Promise((resolve) => {
    try {
      sess.session.send(
        new smppLib.PDU("submit_sm", {
          source_addr_ton: determineTon(source),
          source_addr_npi: determineNpi(source),
          source_addr: source,
          dest_addr_ton: determineTon(destination),
          dest_addr_npi: determineNpi(destination),
          destination_addr: destination,
          short_message: { message: content },
          registered_delivery: 1,  // request DLR
          data_coding: 0,
        }),
        (submitResp: { command_status: number; message_id?: string }) => {
          if (submitResp.command_status === 0) {
            const modemMsgId = submitResp.message_id || messageId;
            console.log(`[SMPP-SRV] MT SUBMIT_SM accepted by supplier #${supplierId}: our=${messageId}, modem=${modemMsgId}`);
            resolve({
              success: true,
              supplierMessageId: modemMsgId, // modem's message_id for DLR matching
              errorCode: undefined,
            });
          } else {
            // SUBMIT_SM rejected — fall back to DELIVER_SM
            console.log(`[SMPP-SRV] SUBMIT_SM rejected by supplier #${supplierId} (status=${submitResp.command_status}), falling back to DELIVER_SM...`);
            try {
              sess.session.send(
                new smppLib.PDU("deliver_sm", {
                  source_addr_ton: determineTon(source),
                  source_addr_npi: determineNpi(source),
                  source_addr: source,
                  dest_addr_ton: determineTon(destination),
                  dest_addr_npi: determineNpi(destination),
                  destination_addr: destination,
                  short_message: { message: content },
                  esm_class: 0,
                  registered_delivery: 0,
                  data_coding: 0,
                }),
                (deliverResp: { command_status: number; message_id?: string }) => {
                  if (deliverResp.command_status === 0) {
                    console.log(`[SMPP-SRV] MT DELIVER_SM accepted by supplier #${supplierId}: ${messageId}`);
                    resolve({
                      success: true,
                      supplierMessageId: messageId,
                      errorCode: undefined,
                    });
                  } else {
                    console.warn(`[SMPP-SRV] MT DELIVER_SM also rejected by supplier #${supplierId}: status=${deliverResp.command_status}`);
                    resolve({ success: false, supplierMessageId: "", errorCode: deliverResp.command_status || 1 });
                  }
                }
              );
            } catch (err) {
              console.error(`[SMPP-SRV] Error sending fallback DELIVER_SM via supplier #${supplierId}:`, err);
              resolve({ success: false, supplierMessageId: "", errorCode: 1 });
            }
          }
        }
      );
    } catch (err) {
      console.error(`[SMPP-SRV] Error sending MT via supplier #${supplierId}:`, err);
      resolve({ success: false, supplierMessageId: "", errorCode: 1 });
    }
  });
}

/**
 * Core delivery function: Resolves route plan, tries routes by priority with fallback.
 * On success, stores the supplier_message_id → our_message_id mapping for DLR tracking.
 * Callers should register a DLR callback via `registerDlrCallback` after calling this.
 *
 * @param serverSessions - Optional map of active SERVER-mode supplier sessions.
 *   Passed explicitly to avoid Next.js module-isolation issues with globalThis.
 */
export function deliverSmsWithFallback(
  tenantId: number,
  schemaName: string,
  clientId: number,
  source: string,
  destination: string,
  content: string,
  messageId: string,
  routes: RouteInfo[],
  dlrCallbackUrl?: string,
  serverSessions?: Map<string, unknown>
): Promise<DeliveryResult> {
  // Sort routes by priority (ascending — lower number = higher priority)
  const sortedRoutes = [...routes].sort((a, b) => a.priority - b.priority);

  let failedCount = 0;
  let fallbackUsed = false;

  async function tryNextRoute(index: number): Promise<DeliveryResult> {
    if (index >= sortedRoutes.length) {
      return {
        success: false,
        messageId,
        fallbackUsed: fallbackUsed && failedCount > 0,
        failedRoutes: failedCount,
        errorMessage: `All ${sortedRoutes.length} routes failed`,
      };
    }

    const route = sortedRoutes[index];
    if (index > 0) fallbackUsed = true;

    // Check if supplier has ANY active connection (CLIENT or passed-in SERVER sessions)
    const hasServerSession = serverSessions?.has(`supplier:${tenantId}:${route.supplierId}`);
    if (!isSupplierConnected(tenantId, route.supplierId) && !hasServerSession) {
      console.log(`[SMPP-CLIENT] Route "${route.routeName}" supplier ${route.supplierId} not connected — falling back`);
      failedCount++;
      return tryNextRoute(index + 1);
    }

    // Attempt delivery: try CLIENT-mode connection first, then SERVER-mode
    let result = await sendViaSupplierConnection(
      tenantId,
      route.supplierId,
      source,
      destination,
      content,
      messageId
    );

    // If CLIENT-mode failed and we have a server session, try SERVER-mode
    if (!result.success && hasServerSession) {
      console.log(`[SMPP-CLIENT] CLIENT-mode delivery failed for supplier ${route.supplierId}, trying SERVER-mode...`);
      result = await sendViaSupplierServerSession(
        tenantId,
        route.supplierId,
        source,
        destination,
        content,
        messageId,
        serverSessions
      );
    }

    if (!result.success) {
      console.log(`[SMPP-CLIENT] Delivery failed via route "${route.routeName}" supplier ${route.supplierId} — falling back`);
      failedCount++;
      return tryNextRoute(index + 1);
    }

    // Success — store DLR tracking
    if (result.supplierMessageId) {
      pendingDeliveries.set(result.supplierMessageId, {
        ourMessageId: messageId,
        supplierId: route.supplierId,
        tenantId,
        schemaName,
        clientId,
        dlrCallbackUrl,
        source,
        destination,
        createdAt: new Date(),
      });
    }

    return {
      success: true,
      messageId,
      supplierMessageId: result.supplierMessageId,
      routeUsed: route,
      fallbackUsed,
      failedRoutes: failedCount,
    };
  }

  return tryNextRoute(0);
}

/**
 * Register a DLR callback for a specific message.
 * Called by smpp-server to push DLRs back to connected ESME clients.
 */
export function registerDlrCallback(messageId: string, callback: DlrCallback): void {
  dlrCallbacks.set(messageId, callback);
}

/**
 * Get all active supplier connections for a tenant
 */
export function getSupplierConnections(tenantId: number) {
  const connections: SupplierConnection[] = [];
  supplierConnections.forEach((conn) => {
    if (conn.tenantId === tenantId) connections.push(conn);
  });
  return connections;
}

/**
 * Filter routes by trunk-level MCC allow/deny lists against the destination number.
 *
 * Extracts the first 3 digits (MCC) from the destination and checks each route's
 * trunk mcc_allow_list and mcc_deny_list. A route is excluded if:
 *   - mcc_deny_list contains the destination MCC (deny takes precedence)
 *   - mcc_allow_list is non-empty and does NOT contain the destination MCC
 *
 * If the destination MCC cannot be determined (< 3 digits), all routes pass.
 */
export function filterRoutesByTrunkMcc(routes: RouteInfo[], destination: string): RouteInfo[] {
  const destMcc = destination.replace(/^\+/, "").replace(/[^0-9]/g, "").slice(0, 3);
  if (!destMcc || destMcc.length < 3) return routes;

  return routes.filter((route) => {
    const allowList = route.trunkMccAllowList
      ? route.trunkMccAllowList.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const denyList = route.trunkMccDenyList
      ? route.trunkMccDenyList.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // Deny takes precedence over allow
    if (denyList.length > 0 && denyList.includes(destMcc)) return false;
    // If allow list is specified, only allow listed MCCs
    if (allowList.length > 0 && !allowList.includes(destMcc)) return false;
    return true;
  });
}

/**
 * Check if a supplier has an active outbound connection (CLIENT or SERVER mode)
 */
export function isSupplierConnected(tenantId: number, supplierId: number): boolean {
  // Check TX key first (TX_RX mode), then TRX key (transceiver mode) for CLIENT connections
  const txKey = `${tenantId}:${supplierId}:tx`;
  const trxKey = `${tenantId}:${supplierId}`;
  if (supplierConnections.get(txKey)?.status === "BOUND" ||
      supplierConnections.get(trxKey)?.status === "BOUND") {
    return true;
  }

  // Also check SERVER-mode supplier sessions (modems/gateways that registered to us)
  const _g = globalThis as typeof globalThis & { __activeSupplierSessions?: Map<string, { type: string; supplierId: number; tenantId: number }> };
  const serverSessions = _g.__activeSupplierSessions;
  if (serverSessions) {
    const key = `supplier:${tenantId}:${supplierId}`;
    if (serverSessions.has(key)) return true;
  }

  return false;
}

async function updateSupplierBindStatus(schemaName: string, supplierId: number, status: string, errorMessage?: string) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query(
      `UPDATE suppliers SET bind_status = $1, bind_error = $2, last_bind_time = NOW(), updated_at = NOW() WHERE id = $3`,
      [status, errorMessage || null, supplierId]
    );
  } catch (err) {
    console.error(`[SMPP-CLIENT] Failed to update bind status:`, err);
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Close and remove an active supplier connection
 */
export function disconnectSupplier(tenantId: number, supplierId: number): boolean {
  // Clear any pending reconnect timers for this supplier
  for (const prefix of ["full:", "tx:", "rx:"]) {
    const timerKey = `${prefix}${tenantId}:${supplierId}`;
    const timer = reconnectTimers.get(timerKey);
    if (timer) { clearTimeout(timer); reconnectTimers.delete(timerKey); }
  }
  reconnectBackoffs.delete(`${tenantId}:${supplierId}`);

  let closed = false;
  for (const suffix of ["", ":tx", ":rx"]) {
    const key = `${tenantId}:${supplierId}${suffix}`;
    const conn = supplierConnections.get(key);
    if (conn) {
      try { conn.session.close(); } catch {}
      supplierConnections.delete(key);
      closed = true;
    }
  }
  return closed;
}

/**
 * Auto-connect to all CLIENT-mode suppliers on startup
 */
export async function initSupplierConnections() {
  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query(
      "SELECT id, schema_name FROM tenants WHERE is_active = true"
    );

    for (const t of tenants) {
      try {
        await client.query(`SET search_path TO "${t.schema_name}"`);
        const { rows: suppliers } = await client.query(
          `SELECT id, host, port, username, system_id, password, bind_type, system_type, connection_mode, smpp_version
           FROM suppliers WHERE is_active = true AND deleted_at IS NULL AND connection_mode = 'CLIENT'`
        );

        for (const s of suppliers) {
          console.log(`[SMPP-CLIENT] Initializing connection to supplier ${s.id} (${s.host}:${s.port} v${s.smpp_version || "3.4"})`);
          connectToSupplier(
            t.id, t.schema_name, s.id,
            s.host, s.port, s.username || s.system_id, s.password,
            s.bind_type || "transceiver", s.system_type || "ESME",
            s.smpp_version || "3.4"
          ).catch(() => {});
        }
      } catch (err) {
        console.error(`[SMPP-CLIENT] Skipping tenant ${t.id} (${t.schema_name}):`, (err as Error).message);
      }
    }
  } catch (err) {
    console.error(`[SMPP-CLIENT] Init error:`, err);
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}
