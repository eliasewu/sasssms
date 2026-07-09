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

// ── Active outbound connections ──
const supplierConnections: Map<string, SupplierConnection> = new Map();

// ── Pending deliveries: supplier_message_id → our tracking info ──
const pendingDeliveries: Map<string, PendingDelivery> = new Map();

// ── DLR callbacks: our_message_id → callback to push DLR to client ──
type DlrCallback = (dlr: DlrPayload) => void;
const dlrCallbacks: Map<string, DlrCallback> = new Map();

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

/**
 * Parse DLR from deliver_sm short_message
 * Format: "id:{msgId} sub:001 dlvrd:001 submit date:{date} done date:{date} stat:{status} err:{err} text:{text}"
 */
function parseDlrMessage(text: string): {
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

    // ── On DLR success: charge supplier cost, record profit (client_rate - supplier_rate) ──
    if (dlrStatus === "DELIVERED") {
      // Get client rate from the message (already stored) and supplier cost
      const { rows: msgRows } = await client.query(
        `SELECT m.client_id, m.cost as client_rate, m.supplier_id,
                COALESCE(s.cost_per_sms, '0') as supplier_cost
         FROM messages m
         LEFT JOIN suppliers s ON m.supplier_id = s.id
         WHERE m.message_id = $1`,
        [delivery.ourMessageId]
      );
      if (msgRows.length > 0) {
        const clientRate = parseFloat(msgRows[0].client_rate || "0");
        const supplierCost = parseFloat(msgRows[0].supplier_cost || "0");
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
 * Connect to a supplier's SMPP server in client mode
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
  systemType: string = "SMSC",
  smppVersion: string = "3.4"
): Promise<boolean> {
  const key = `${tenantId}:${supplierId}`;

  const existing = supplierConnections.get(key);
  if (existing) {
    try { existing.session.close(); } catch {}
    supplierConnections.delete(key);
  }

  return new Promise((resolve) => {
    const interfaceVersion = smppVersionToHex(smppVersion);
    const session = smppLib.connect(
      `esms://${host}:${port}`,
      () => {
        const bindPdu: Record<string, unknown> = {
          system_id: systemId,
          password: password,
          system_type: systemType,
          interface_version: interfaceVersion,
        };

        const bindEvent = bindType === "transmitter"
          ? "bind_transmitter"
          : bindType === "receiver"
            ? "bind_receiver"
            : "bind_transceiver";

        session.send(new smppLib.PDU(bindEvent, bindPdu), (resp: any) => {
          if (resp.command_status === 0) {
            const respVersion = resp.interface_version || interfaceVersion;
            const conn: SupplierConnection = {
              supplierId, tenantId, schemaName, session,
              host, port, systemId,
              smppVersion,
              interfaceVersion: respVersion,
              connectedAt: new Date(),
              status: "BOUND",
            };
            supplierConnections.set(key, conn);

            // ── Register DLR listener on this supplier connection ──
            session.on("deliver_sm", (pdu: any) => {
              processSupplierDlr(tenantId, schemaName, supplierId, pdu).catch((err) => {
                console.error(`[SMPP-CLIENT] DLR processing error:`, err);
              });
            });

            console.log(`[SMPP-CLIENT] BOUND to supplier ${supplierId} @ ${host}:${port} (SMPP v${smppVersion})`);
            updateSupplierBindStatus(schemaName, supplierId, "BOUND");
            resolve(true);
          } else {
            console.error(`[SMPP-CLIENT] BIND FAILED to ${host}:${port} status=${resp.command_status}`);
            updateSupplierBindStatus(schemaName, supplierId, "BIND_FAILED");
            session.close();
            resolve(false);
          }
        });
      }
    );

    session.on("error", (err: Error) => {
      console.error(`[SMPP-CLIENT] Error on supplier ${supplierId}: ${err.message}`);
      const conn = supplierConnections.get(key);
      if (conn) {
        conn.status = "UNBOUND";
        updateSupplierBindStatus(schemaName, supplierId, "UNBOUND");
      }
      supplierConnections.delete(key);
    });

    session.on("close", () => {
      const conn = supplierConnections.get(key);
      if (conn) {
        conn.status = "UNBOUND";
        updateSupplierBindStatus(schemaName, supplierId, "UNBOUND");
      }
      supplierConnections.delete(key);
      setTimeout(() => {
        reconnectToSupplier(tenantId, schemaName, supplierId);
      }, RECONNECT_INTERVAL);
    });

    setTimeout(() => {
      if (!supplierConnections.has(key)) {
        session.close();
        resolve(false);
      }
    }, BIND_TIMEOUT);
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
    await connectToSupplier(
      tenantId, schemaName, supplierId,
      s.host, s.port, s.username, s.password,
      s.bind_type || "transceiver", s.system_type || "SMSC",
      s.smpp_version || "3.4"
    );
  } catch (err) {
    console.error(`[SMPP-CLIENT] Reconnect error:`, err);
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
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
  const key = `${tenantId}:${supplierId}`;
  const conn = supplierConnections.get(key);

  if (!conn || conn.status !== "BOUND") {
    return Promise.resolve({ success: false, supplierMessageId: "", errorCode: 14 });
  }

  return new Promise((resolve) => {
    conn.session.send(
      new smppLib.PDU("submit_sm", {
        source_addr: source,
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
 * Core delivery function: Resolves route plan, tries routes by priority with fallback.
 * On success, stores the supplier_message_id → our_message_id mapping for DLR tracking.
 * Callers should register a DLR callback via `registerDlrCallback` after calling this.
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
  dlrCallbackUrl?: string
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

    // Check if supplier is connected; if not, skip to next route
    if (!isSupplierConnected(tenantId, route.supplierId)) {
      console.log(`[SMPP-CLIENT] Route "${route.routeName}" supplier ${route.supplierId} not connected — falling back`);
      failedCount++;
      return tryNextRoute(index + 1);
    }

    // Attempt delivery through this route's supplier
    const result = await sendViaSupplierConnection(
      tenantId,
      route.supplierId,
      source,
      destination,
      content,
      messageId
    );

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
 * Check if a supplier has an active outbound connection
 */
export function isSupplierConnected(tenantId: number, supplierId: number): boolean {
  const key = `${tenantId}:${supplierId}`;
  const conn = supplierConnections.get(key);
  return conn?.status === "BOUND";
}

async function updateSupplierBindStatus(schemaName: string, supplierId: number, status: string) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query(
      `UPDATE suppliers SET bind_status = $1, last_bind_time = NOW(), updated_at = NOW() WHERE id = $2`,
      [status, supplierId]
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
  const key = `${tenantId}:${supplierId}`;
  const conn = supplierConnections.get(key);
  if (conn) {
    try { conn.session.close(); } catch {}
    supplierConnections.delete(key);
    return true;
  }
  return false;
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
      await client.query(`SET search_path TO "${t.schema_name}"`);
      const { rows: suppliers } = await client.query(
        `SELECT id, host, port, username, password, bind_type, system_type, connection_mode, smpp_version
         FROM suppliers WHERE is_active = true AND deleted_at IS NULL AND connection_mode = 'CLIENT'`
      );

      for (const s of suppliers) {
        console.log(`[SMPP-CLIENT] Initializing connection to supplier ${s.id} (${s.host}:${s.port} v${s.smpp_version || "3.4"})`);
        connectToSupplier(
          t.id, t.schema_name, s.id,
          s.host, s.port, s.username, s.password,
          s.bind_type || "transceiver", s.system_type || "SMSC",
          s.smpp_version || "3.4"
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error(`[SMPP-CLIENT] Init error:`, err);
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}
