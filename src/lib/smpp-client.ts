/**
 * SMPP Client Manager — connects OUT to supplier SMPP gateways
 * Used when supplier.connection_mode = 'CLIENT' (we initiate the bind)
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
  connectedAt: Date;
  status: "BOUND" | "UNBOUND" | "RECONNECTING";
}

// Active outbound connections: key = "tenantId:supplierId"
const supplierConnections: Map<string, SupplierConnection> = new Map();

const RECONNECT_INTERVAL = 30000; // 30 seconds
const BIND_TIMEOUT = 10000; // 10 seconds

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
  systemType: string = "SMSC"
): Promise<boolean> {
  const key = `${tenantId}:${supplierId}`;

  // Close existing connection if any
  const existing = supplierConnections.get(key);
  if (existing) {
    try { existing.session.close(); } catch {}
    supplierConnections.delete(key);
  }

  return new Promise((resolve) => {
    const session = smppLib.connect(
      `esms://${host}:${port}`,
      () => {
        // Connection established, now bind
        const bindPdu: Record<string, unknown> = {
          system_id: systemId,
          password: password,
          system_type: systemType,
        };

        const bindEvent = bindType === "transmitter"
          ? "bind_transmitter"
          : bindType === "receiver"
            ? "bind_receiver"
            : "bind_transceiver";

        session.send(new smppLib.PDU(bindEvent, bindPdu), (resp: any) => {
          if (resp.command_status === 0) {
            const conn: SupplierConnection = {
              supplierId, tenantId, schemaName, session,
              host, port, systemId,
              connectedAt: new Date(),
              status: "BOUND",
            };
            supplierConnections.set(key, conn);
            console.log(`[SMPP-CLIENT] BOUND to supplier ${supplierId} @ ${host}:${port}`);
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
      // Auto-reconnect after delay
      setTimeout(() => {
        reconnectToSupplier(tenantId, schemaName, supplierId);
      }, RECONNECT_INTERVAL);
    });

    // Timeout for bind
    setTimeout(() => {
      if (!supplierConnections.has(key)) {
        session.close();
        resolve(false);
      }
    }, BIND_TIMEOUT);
  });
}

/**
 * Reconnect to a supplier automatically
 */
async function reconnectToSupplier(tenantId: number, schemaName: string, supplierId: number) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    const { rows } = await client.query(
      `SELECT host, port, username, password, system_id, bind_type, system_type, connection_mode
       FROM suppliers WHERE id = $1 AND is_active = true AND deleted_at IS NULL`,
      [supplierId]
    );
    if (rows.length === 0 || rows[0].connection_mode !== "CLIENT") return;
    const s = rows[0];
    console.log(`[SMPP-CLIENT] Reconnecting to supplier ${supplierId} @ ${s.host}:${s.port}`);
    await connectToSupplier(
      tenantId, schemaName, supplierId,
      s.host, s.port, s.username, s.password,
      s.bind_type || "transceiver", s.system_type || "SMSC"
    );
  } catch (err) {
    console.error(`[SMPP-CLIENT] Reconnect error:`, err);
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Send submit_sm through an active outbound supplier connection
 */
export function sendViaSupplierConnection(
  tenantId: number,
  supplierId: number,
  source: string,
  destination: string,
  content: string,
  messageId: string
): Promise<{ success: boolean; messageId: string; errorCode?: number }> {
  const key = `${tenantId}:${supplierId}`;
  const conn = supplierConnections.get(key);

  if (!conn || conn.status !== "BOUND") {
    return Promise.resolve({ success: false, messageId, errorCode: 14 });
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
          messageId: resp.message_id || messageId,
          errorCode: resp.command_status || undefined,
        });
      }
    );
  });
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
        `SELECT id, host, port, username, password, bind_type, system_type, connection_mode
         FROM suppliers WHERE is_active = true AND deleted_at IS NULL AND connection_mode = 'CLIENT'`
      );

      for (const s of suppliers) {
        console.log(`[SMPP-CLIENT] Initializing connection to supplier ${s.id} (${s.host}:${s.port})`);
        connectToSupplier(
          t.id, t.schema_name, s.id,
          s.host, s.port, s.username, s.password,
          s.bind_type || "transceiver", s.system_type || "SMSC"
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
