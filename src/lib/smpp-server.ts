/**
 * Net2APP SMPP SMSC Server — Java 21 / Node.js compatible
 * Port 2775, supports SMPP v3.3, v3.4, v5.0
 *
 * Dual-mode operation:
 *  - ESME Client mode: Clients (ESMEs) connect to us to send MT messages.
 *    Authenticated via the clients table.
 *  - Supplier SERVER mode: GSM gateways / upstream SMSCs register to us.
 *    Authenticated via the suppliers table (connection_mode = 'SERVER').
 *    Their SUBMIT_SM is treated as inbound MO; DLRs are pushed back via DELIVER_SM.
 *
 * Handles: BIND_TRANSCEIVER, BIND_TRANSMITTER, BIND_RECEIVER, SUBMIT_SM,
 *          DELIVER_SM (DLR push), DELIVER_SM (MO from suppliers), ENQUIRE_LINK
 *
 * SMS Delivery: Uses real outbound delivery via smpp-client with route fallback.
 * DLR: Delayed until real supplier DLR arrives, then pushed to client via SMPP + HTTP.
 */
import smpp from "smpp";
import { pool } from "@/db";
import { bindEventBus } from "@/lib/bind-event-bus";
import {
  deliverSmsWithFallback,
  registerDlrCallback,
  filterRoutesByTrunkMcc,
  parseDlrMessage,
} from "@/lib/smpp-client";
import type { RouteInfo, DlrPayload } from "@/lib/smpp-client";
import {
  enqueueDlrPersist,
  dequeueAllDlrsPersist,
  requeueDlrsPersist,
  loadAllDlrsFromDb,
  startDlrCleanupPersist,
} from "@/lib/dlr-queue-persist";
import {
  validateBind,
  extractRemoteAddress,
} from "@/lib/smpp-bind-validator";
import { lookupClientRate } from "@/lib/rates";
import { executeVoiceOtpCall } from "@/lib/voice-otp-engine";

/** SMPP interface_version hex constants */
const SMPP_V33 = 0x33; // 51 — SMPP v3.3
const SMPP_V34 = 0x34; // 52 — SMPP v3.4
const SMPP_V50 = 0x50; // 80 — SMPP v5.0
const SUPPORTED_VERSIONS = [SMPP_V50, SMPP_V34, SMPP_V33];

function versionLabel(v: number): string {
  if (v === SMPP_V33) return "3.3";
  if (v === SMPP_V34) return "3.4";
  if (v === SMPP_V50) return "5.0";
  return `unknown(0x${v.toString(16)})`;
}

/**
 * Negotiate SMPP version: pick the version if we support it, otherwise fall back to v3.4.
 * If ESME sends an unsupported version, default to v3.4.
 */
function negotiateVersion(esmeVersion: number): number {
  // If ESME didn't send interface_version, default to v3.4
  if (!esmeVersion || esmeVersion === 0) return SMPP_V34;
  
  // If ESME requested a version we support, use it
  if (SUPPORTED_VERSIONS.includes(esmeVersion)) return esmeVersion;
  
  // Unrecognized version — fall back to v3.4
  console.warn(`[SMPP] Unrecognized interface_version 0x${esmeVersion.toString(16)}, falling back to v3.4`);
  return SMPP_V34;
}

interface EsmeSession {
  type: "esme";
  session: smpp.ServerSession;
  systemId: string;
  systemType: string;
  tenantId: number;
  schemaName: string;
  clientId: number;
  interfaceVersion: number;
  boundAt: Date;
}

interface SupplierServerSession {
  type: "supplier_server";
  session: smpp.ServerSession;
  systemId: string;
  systemType: string;
  tenantId: number;
  schemaName: string;
  supplierId: number;
  interfaceVersion: number;
  boundAt: Date;
}

type ActiveSession = EsmeSession | SupplierServerSession;

// Use globalThis to share state across Next.js instrumentation and API route entry points
const _global = globalThis as typeof globalThis & {
  __activeSessions?: Map<string, EsmeSession>;
  __activeSupplierSessions?: Map<string, SupplierServerSession>;
  __dlrCleanupStarted?: boolean;
};
const activeSessions: Map<string, EsmeSession> = _global.__activeSessions ??= new Map();
const activeSupplierSessions: Map<string, SupplierServerSession> = _global.__activeSupplierSessions ??= new Map();

// ── Start DLR queue TTL cleanup (memory + DB, every 2 minutes) ──
// Guarded by globalThis to prevent duplicate intervals across Next.js entry points
if (!_global.__dlrCleanupStarted) {
  _global.__dlrCleanupStarted = true;
  startDlrCleanupPersist();

  // ── Load persisted DLRs from DB into memory on startup ──
  loadAllDlrsFromDb().catch((err) => {
    console.error("[SMPP] Failed to load persisted DLRs on startup:", err);
  });
}

/**
 * Start SMPP server on given port
 */
export function startSmppServer(port: number = 2775): { listen: (port: number, cb?: () => void) => void; close: (cb?: (err?: Error) => void) => void } {
  const server = smpp.createServer(
    (session: smpp.ServerSession) => {
      let currentSession: ActiveSession | null = null;
      let cleanedUp = false;
      let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

      /**
       * Send enquire_link every 45 seconds to prevent TCP idle timeout
       * from firewalls, NAT gateways, and load balancers silently killing
       * the connection when there's no SMS traffic.
       */
      const startKeepAlive = () => {
        keepAliveTimer = setInterval(() => {
          try { session.send(new smpp.PDU("enquire_link", {})); } catch {}
        }, 45000);
      };

      /**
       * Safe cleanup: only removes the session from tracking and updates
       * bind_status to UNBOUND if THIS session object is still the active
       * one. Prevents race where a stale close/error event from an old
       * connection overwrites the BOUND status of a newly reconnected client.
       */
      const handleCleanup = () => {
        if (!currentSession || cleanedUp) return;
        cleanedUp = true;
        if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }

        const wasActive = removeSession(currentSession);

        if (wasActive) {
          if (currentSession.type === "esme") {
            const sess = currentSession;
            updateClientBindStatus(sess.clientId, sess.schemaName, "UNBOUND", sess.boundAt)
              .catch((err) => console.error("[SMPP] Failed to update client bind status:", err))
              .finally(() => bindEventBus.emitBindEvent({
                type: "client", entityId: sess.clientId,
                tenantId: sess.tenantId, schemaName: sess.schemaName,
                status: "UNBOUND", systemId: sess.systemId,
                timestamp: new Date().toISOString(),
              }));
          } else {
            const sess = currentSession;
            updateSupplierBindStatus(sess.supplierId, sess.schemaName, "UNBOUND", sess.boundAt)
              .catch((err) => console.error("[SMPP-SRV] Failed to update supplier bind status:", err))
              .finally(() => bindEventBus.emitBindEvent({
                type: "supplier", entityId: sess.supplierId,
                tenantId: sess.tenantId, schemaName: sess.schemaName,
                status: "UNBOUND", systemId: sess.systemId,
                timestamp: new Date().toISOString(),
              }));
          }
        }
      };

      session.on("bind_transceiver", (pdu: smpp.PDU) => {
        handleBind(session, pdu, "transceiver")
          .then((sess) => {
            if (sess) {
              currentSession = sess;
              session.send(pdu.response({
                system_id: "Net2APP_SMSC",
                interface_version: sess.interfaceVersion,
              }));
              const label = sess.type === "esme"
                ? `[SMPP] BOUND transceiver: ${sess.systemId} @ tenant ${sess.tenantId} (SMPP v${versionLabel(sess.interfaceVersion)})`
                : `[SMPP-SRV] BOUND transceiver (supplier): ${sess.systemId} @ tenant ${sess.tenantId} (SMPP v${versionLabel(sess.interfaceVersion)})`;
              console.log(label);
              if (sess.type === "esme") flushPendingDlrs(sess);
              startKeepAlive();
            } else {
              session.send(pdu.response({ command_status: 14 }));
            }
          })
          .catch(() => {
            session.send(pdu.response({ command_status: 14 }));
          });
      });

      session.on("bind_transmitter", (pdu: smpp.PDU) => {
        handleBind(session, pdu, "transmitter")
          .then((sess) => {
            if (sess) {
              currentSession = sess;
              session.send(pdu.response({
                system_id: "Net2APP_SMSC",
                interface_version: sess.interfaceVersion,
              }));
              const label = sess.type === "esme"
                ? `[SMPP] BOUND transmitter: ${sess.systemId} @ tenant ${sess.tenantId} (SMPP v${versionLabel(sess.interfaceVersion)})`
                : `[SMPP-SRV] BOUND transmitter (supplier): ${sess.systemId} @ tenant ${sess.tenantId} (SMPP v${versionLabel(sess.interfaceVersion)})`;
              console.log(label);
              startKeepAlive();
            } else {
              session.send(pdu.response({ command_status: 14 }));
            }
          })
          .catch(() => session.send(pdu.response({ command_status: 14 })));
      });

      session.on("bind_receiver", (pdu: smpp.PDU) => {
        handleBind(session, pdu, "receiver")
          .then((sess) => {
            if (sess) {
              currentSession = sess;
              session.send(pdu.response({
                system_id: "Net2APP_SMSC",
                interface_version: sess.interfaceVersion,
              }));
              if (sess.type === "esme") flushPendingDlrs(sess);
              const label = sess.type === "esme"
                ? `[SMPP] BOUND receiver: ${sess.systemId} @ tenant ${sess.tenantId} (SMPP v${versionLabel(sess.interfaceVersion)})`
                : `[SMPP-SRV] BOUND receiver (supplier): ${sess.systemId} @ tenant ${sess.tenantId} (SMPP v${versionLabel(sess.interfaceVersion)})`;
              console.log(label);
              startKeepAlive();
            } else {
              session.send(pdu.response({ command_status: 14 }));
            }
          })
          .catch(() => session.send(pdu.response({ command_status: 14 })));
      });

      session.on("submit_sm", async (pdu: smpp.PDU) => {
        if (!currentSession) {
          session.send(pdu.response({ command_status: 1, message_id: "" }));
          return;
        }

        try {
          let result: { success: boolean; messageId: string; errorCode?: number };
          if (currentSession.type === "esme") {
            result = await processSubmitSm(currentSession, pdu);
          } else {
            result = await processSupplierSubmitSm(currentSession, pdu);
          }

          if (result.success) {
            session.send(pdu.response({ message_id: result.messageId }));
          } else {
            session.send(
              pdu.response({
                command_status: result.errorCode || 1,
                message_id: result.messageId || "",
              })
            );
          }
        } catch (err) {
          console.error("[SMPP] submit_sm error:", err);
          session.send(
            pdu.response({ command_status: 1, message_id: "" })
          );
        }
      });

      session.on("enquire_link", (pdu: smpp.PDU) => {
        session.send(pdu.response());
      });

      // ── Handle DELIVER_SM from SERVER-mode suppliers (DLR receipts from modems/gateways) ──
      session.on("deliver_sm", (pdu: smpp.PDU) => {
        if (!currentSession || currentSession.type !== "supplier_server") {
          // ESME clients shouldn't send deliver_sm to us; silently ack
          try { session.send(pdu.response({ message_id: "" })); } catch {}
          return;
        }

        const ss = currentSession;
        const esmClass = (pdu as unknown as Record<string,unknown>).esm_class as number || 0;
        const isDlr = (esmClass & 0x04) !== 0;

        if (!isDlr) {
          // Non-DLR deliver_sm from a server supplier — treat as inbound MO
          const src = (pdu.source_addr as string) || "";
          const dest = (pdu.destination_addr as string) || "";
          const text = typeof pdu.short_message === "string"
            ? pdu.short_message
            : (pdu.short_message as { message?: string })?.message || "";

          console.log(`[SMPP-SRV] MO DELIVER_SM from ${ss.systemId}: ${src} → ${dest}: ${text.substring(0, 40)}`);

          // Store in sms_inbox
          pool.connect().then(async (dbClient) => {
            try {
              await dbClient.query(`SET search_path TO "${ss.schemaName}"`);
              await dbClient.query(
                `INSERT INTO sms_inbox (sender, destination, content, supplier_id) VALUES ($1, $2, $3, $4)`,
                [src, dest, text, ss.supplierId]
              );
            } catch (err) {
              console.error("[SMPP-SRV] Failed to store MO from deliver_sm:", err);
            } finally {
              await dbClient.query("SET search_path TO public");
              dbClient.release();
            }
          }).catch(() => {});

          try { session.send(pdu.response({ message_id: "" })); } catch {}
          return;
        }

        // ── DLR receipt from the modem ──
        const text = typeof pdu.short_message === "string"
          ? pdu.short_message
          : (pdu.short_message as { message?: string })?.message || "";

        const parsed = parseDlrMessage(text);
        if (!parsed) {
          console.warn(`[SMPP-SRV] Could not parse DLR from ${ss.systemId}:`, text.substring(0, 100));
          try { session.send(pdu.response({ message_id: "" })); } catch {}
          return;
        }

        console.log(`[SMPP-SRV] DLR from ${ss.systemId}: ${parsed.messageId} → ${parsed.status}`);

        // Try direct callback lookup by the modem's message ID
        const _g = globalThis as typeof globalThis & {
          __dlrCallbacks?: Map<string, (dlr: DlrPayload) => void>;
          __pendingDeliveries?: Map<string, { ourMessageId: string; supplierId: number; tenantId: number; schemaName: string; clientId: number; destination: string; source: string; dlrCallbackUrl?: string }>;
        };
        const callbacks = _g.__dlrCallbacks;
        const deliveries = _g.__pendingDeliveries;

        // First: try direct match by the modem's DLR message ID
        let ourMessageId: string | null = null;
        let callback = callbacks?.get(parsed.messageId);

        if (callback) {
          ourMessageId = parsed.messageId;
        } else if (deliveries) {
          // Second: the modem likely uses its own internal ID (not ours).
          // Search pendingDeliveries for this supplier to find our message.
          // Also match by destination to avoid wrong delivery when multiple SMS are in-flight.
          const dlrDest = (pdu.source_addr as string) || "";
          for (const [key, delivery] of deliveries) {
            if (delivery.supplierId === ss.supplierId && delivery.tenantId === ss.tenantId
                && (delivery.destination === dlrDest || !dlrDest)) {
              ourMessageId = delivery.ourMessageId;
              callback = callbacks?.get(ourMessageId);
              if (callback) break;
            }
          }
        }

        if (callback && ourMessageId) {
          try {
            callback({
              messageId: ourMessageId,
              supplierMessageId: parsed.messageId,
              status: parsed.status,
              submitDate: parsed.submitDate,
              doneDate: parsed.doneDate,
              errorCode: parsed.errorCode,
              dest: (pdu.source_addr as string) || "",
              src: (pdu.destination_addr as string) || "",
            });
            console.log(`[SMPP-SRV] DLR callback triggered: modem=${parsed.messageId} → our=${ourMessageId} status=${parsed.status}`);

            // Update message DLR status in DB
            pool.connect().then(async (dbClient) => {
              try {
                const statusMap: Record<string, string> = {
                  DELIVRD: "DELIVERED", DELIVERED: "DELIVERED",
                  EXPIRED: "FAILED", UNDELIV: "FAILED",
                  REJECTD: "FAILED", DELETED: "FAILED",
                  UNKNOWN: "FAILED", FAILED: "FAILED",
                };
                const dlrStatus = statusMap[parsed.status.toUpperCase()] || parsed.status;
                await dbClient.query(`SET search_path TO "${ss.schemaName}"`);
                await dbClient.query(
                  `UPDATE messages SET dlr_status = $1, dlr_timestamp = NOW(), status = $2 WHERE message_id = $3`,
                  [dlrStatus, dlrStatus, ourMessageId]
                );
                await dbClient.query("SET search_path TO public");
              } catch (err) {
                console.error("[SMPP-SRV] Failed to update DLR in DB:", err);
              } finally {
                dbClient.release();
              }
            }).catch(() => {});

            // Clean up pending deliveries and DLR callbacks
            if (deliveries) {
              for (const [key, delivery] of deliveries) {
                if (delivery.ourMessageId === ourMessageId) {
                  deliveries.delete(key);
                  break;
                }
              }
            }
            callbacks?.delete(ourMessageId);
          } catch (err) {
            console.error(`[SMPP-SRV] DLR callback error:`, err);
          }
        } else {
          console.log(`[SMPP-SRV] No DLR match found — modem=${parsed.messageId}, supplier=${ss.supplierId}, tenant=${ss.tenantId}`);
        }

        try { session.send(pdu.response({ message_id: "" })); } catch {}
      });

      session.on("unbind", (pdu: smpp.PDU) => {
        console.log(`[SMPP] UNBOUND: ${currentSession?.systemId}`);
        handleCleanup();
        session.send(pdu.response());
        session.close();
      });

      session.on("error", (err: Error) => {
        console.error("[SMPP] Session error:", err.message);
        handleCleanup();
      });

      session.on("close", () => {
        handleCleanup();
      });
    }
  );

  server.listen(port, () => {
    console.log(`[SMPP] SMSC Server listening on port ${port}`);
  });

  return server as unknown as { listen: (port: number, cb?: () => void) => void; close: (cb?: (err?: Error) => void) => void };
}

/**
 * Authenticate bind request — tries clients (ESMEs) first, then
 * suppliers with connection_mode = 'SERVER' (GSM gateways / upstream SMSCs).
 */
async function handleBind(
  session: smpp.ServerSession,
  pdu: smpp.PDU,
  bindType: string
): Promise<ActiveSession | null> {
  const systemId = pdu.system_id as string;
  const password = pdu.password as string;
  const esmeVersion = ((pdu as unknown as Record<string,unknown>).interface_version as number) || 0;
  const negotiatedVersion = negotiateVersion(esmeVersion);

  console.log(`[SMPP] Bind request from ${systemId}: requested v${versionLabel(esmeVersion)}, negotiated v${versionLabel(negotiatedVersion)}`);

  // v3.3 does NOT support transceiver mode — reject if ESME tries it
  if (negotiatedVersion === SMPP_V33 && bindType === "transceiver") {
    console.warn(`[SMPP] Rejected: ${systemId} tried transceiver with SMPP v3.3 (not supported)`);
    return null;
  }

  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query(
      "SELECT id, schema_name FROM tenants WHERE is_active = true"
    );

    for (const t of tenants) {
      try {
        await client.query(`SET search_path TO "${t.schema_name}"`);
        const { rows: matched } = await client.query(
          `SELECT id, smpp_username, smpp_password, http_api_key, smpp_allowed_ip, is_active, name, connection_type
           FROM clients
           WHERE (smpp_username = $1 OR http_api_key = $1 OR (smpp_username IS NULL AND $1 = ''))
             AND is_active = true AND deleted_at IS NULL
             AND connection_type = 'SMPP'`,
          [systemId]
        );

        if (matched.length > 0) {
          const c = matched[0];

          // Validate bind credentials (password + IP whitelist combined)
          const remoteAddr = extractRemoteAddress(session as unknown as { socket?: { remoteAddress?: string }; remoteAddress?: string });
          const validation = validateBind(c.smpp_allowed_ip, remoteAddr, c.smpp_password, password ?? null);
          if (!validation.valid) {
            console.log(`[SMPP] Auth failed for ${systemId} (client #${c.id}): ${validation.errorMessage}`);
            continue;
          }

        const boundAt = new Date();
        await client.query(
          `UPDATE clients SET bind_status = 'BOUND', last_bind_time = $2, updated_at = $2 WHERE id = $1`,
          [c.id, boundAt]
        );

        const es: EsmeSession = {
          type: "esme",
          session,
          systemId,
          systemType: (pdu.system_type as string) || "ESME",
          tenantId: t.id,
          schemaName: t.schema_name,
          clientId: c.id,
          interfaceVersion: negotiatedVersion,
          boundAt,
        };

        activeSessions.set(`${t.id}:${systemId}`, es);

        bindEventBus.emitBindEvent({
          type: "client", entityId: c.id, tenantId: t.id,
          schemaName: t.schema_name, status: "BOUND",
          systemId, timestamp: new Date().toISOString(),
        });

        await client.query(`SET search_path TO public`);
        await client.query(
          `INSERT INTO audit_log (entity_type, entity_id, action, changed_by, tenant_id)
           VALUES ('clients', $1, 'BIND', $2, $3)`,
          [c.id, systemId, t.id]
        );

        return es;
      }
      } catch (err) {
        // Gracefully skip tenants with schema incompatibilities (e.g. missing deleted_at column)
        console.warn(`[SMPP] Skipping tenant ${t.schema_name} during bind: ${(err as Error).message}`);
      }
    }

    // ── Step 2: Try suppliers with connection_mode = 'SERVER' ──
    // GSM gateways / upstream SMSCs register to us (we are the server)
    for (const t of tenants) {
      try {
        await client.query(`SET search_path TO "${t.schema_name}"`);
        const { rows: matched } = await client.query(
          `SELECT id, name, username, password, system_id
           FROM suppliers
           WHERE connection_mode = 'SERVER'
             AND connection_type = 'SMPP'
             AND (username = $1 OR system_id = $1)
             AND is_active = true AND deleted_at IS NULL`,
          [systemId]
        );

        if (matched.length > 0) {
          const s = matched[0];
          // Validate password (same strict logic as ESME clients)
          const validation = validateBind(null, undefined, s.password, password ?? null);
          if (!validation.valid) {
            console.log(`[SMPP-SRV] Auth failed for supplier ${systemId}: ${validation.errorMessage}`);
            continue;
          }

          const boundAt = new Date();
          await client.query(
            `UPDATE suppliers SET bind_status = 'BOUND', last_bind_time = $2, updated_at = $2 WHERE id = $1`,
            [s.id, boundAt]
          );

          const ss: SupplierServerSession = {
            type: "supplier_server",
            session,
            systemId,
            systemType: (pdu.system_type as string) || "SMSC",
            tenantId: t.id,
            schemaName: t.schema_name,
            supplierId: s.id,
            interfaceVersion: negotiatedVersion,
            boundAt,
          };

          activeSupplierSessions.set(`supplier:${t.id}:${s.id}`, ss);

          bindEventBus.emitBindEvent({
            type: "supplier", entityId: s.id, tenantId: t.id,
            schemaName: t.schema_name, status: "BOUND",
            systemId, timestamp: new Date().toISOString(),
          });

          await client.query(`SET search_path TO public`);
          await client.query(
            `INSERT INTO audit_log (entity_type, entity_id, action, changed_by, tenant_id)
             VALUES ('suppliers', $1, 'BIND_SERVER', $2, $3)`,
            [s.id, systemId, t.id]
          );

          console.log(`[SMPP-SRV] Supplier server session registered: ${systemId} (supplier #${s.id}, tenant ${t.id})`);
          return ss;
        }
      } catch (err) {
        // Gracefully skip tenants with schema incompatibilities
        console.warn(`[SMPP-SRV] Skipping tenant ${t.schema_name} during bind: ${(err as Error).message}`);
      }
    }

    return null;
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Process incoming SUBMIT_SM with real delivery + route fallback
 */
async function processSubmitSm(
  es: EsmeSession,
  pdu: smpp.PDU
): Promise<{ success: boolean; messageId: string; errorCode?: number }> {
  const messageId = "SMPP_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  const dest = (pdu.destination_addr as string) || "";
  const src = (pdu.source_addr as string) || "";
  const content = (pdu.short_message as { message: string })?.message || "";

  try {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${es.schemaName}"`);
      const { rows: clients } = await client.query(
        "SELECT * FROM clients WHERE id = $1 AND is_active = true",
        [es.clientId]
      );
      const c = clients[0];
      if (!c) return { success: false, messageId, errorCode: 14 };

      if (!c.route_plan_id) return { success: false, messageId, errorCode: 8 };

      // Get ALL routes from route plan (sorted by priority) for fallback
      const { rows: allRoutes } = await client.query(
        `SELECT rpr.route_id, rpr.priority, r.name as route_name, r.trunk_id,
                t.name as trunk_name, t.supplier_id,
                t.mcc_allow_list, t.mcc_deny_list,
                s.name as supplier_name, s.connection_type
         FROM route_plan_routes rpr
         JOIN routes r ON rpr.route_id = r.id AND r.is_active = true
         JOIN trunks t ON r.trunk_id = t.id AND t.is_active = true
         JOIN suppliers s ON t.supplier_id = s.id AND s.is_active = true
         WHERE rpr.route_plan_id = $1
         ORDER BY rpr.priority ASC`,
        [c.route_plan_id]
      );

      if (allRoutes.length === 0) {
        const ratePerSms = await lookupClientRate(dest, es.clientId, es.schemaName);
        await client.query(
          `INSERT INTO messages (client_id, sender, destination, content, status, route_plan_id, cost, dlr_status, message_id, dlr_timestamp)
           VALUES ($1,$2,$3,$4,'FAILED',$5,$6,'FAILED',$7,NOW())`,
          [es.clientId, src, dest, content, c.route_plan_id, ratePerSms.toString(), messageId]
        );
        return { success: false, messageId, errorCode: 8 };
      }

      const ratePerSms = await lookupClientRate(dest, es.clientId, es.schemaName);

      // Build RouteInfo list for smpp-client
      const routeInfos: RouteInfo[] = allRoutes.map((r) => ({
        routeId: r.route_id,
        routeName: r.route_name,
        trunkId: r.trunk_id,
        trunkName: r.trunk_name,
        trunkMccAllowList: (r.mcc_allow_list as string) || null,
        trunkMccDenyList: (r.mcc_deny_list as string) || null,
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        connectionType: r.connection_type,
        priority: r.priority,
      }));

      // ── Trunk-level MCC/MNC filtering ──
      const filteredRoutes = filterRoutesByTrunkMcc(routeInfos, dest);
      if (filteredRoutes.length === 0) {
        await client.query(
          `INSERT INTO messages (client_id, sender, destination, content, status, route_plan_id, cost, dlr_status, message_id, dlr_timestamp)
           VALUES ($1,$2,$3,$4,'FAILED',$5,$6,'FAILED',$7,NOW())`,
          [es.clientId, src, dest, content, c.route_plan_id, ratePerSms.toString(), messageId]
        );
        return { success: false, messageId, errorCode: 8 };
      }

      // ── Check connection type: handle Voice OTP / OTT / CUSTOM_API routes specially ──
      const firstRoute = filteredRoutes[0];
      const connType = firstRoute.connectionType;

      // ── Voice OTP: use shared engine (same as HTTP API) ──
      if (connType === "VOICE_OTP" || connType === "Voice OTP") {
        const otpCode = content.match(/\b(\d{4,8})\b/)?.[1] || null;
        if (!otpCode) {
          return { success: false, messageId, errorCode: 10 }; // RINVDSTADR = invalid content
        }

        // tenants table is in public schema, switch temporarily
        await client.query(`SET search_path TO public`);
        const tenantData = await client.query(
          `SELECT max_concurrent_calls FROM tenants WHERE id = $1`,
          [es.tenantId]
        );
        await client.query(`SET search_path TO "${es.schemaName}"`);
        const maxConcurrent = parseInt(tenantData.rows[0]?.max_concurrent_calls || "10");

        const votpResult = await executeVoiceOtpCall({
          schemaName: es.schemaName,
          tenantId: es.tenantId,
          destination: dest,
          sender: src,
          otpCode,
          messageId,
          supplierId: firstRoute.supplierId,
          maxConcurrentCalls: maxConcurrent,
        });

        if (votpResult.success) {
          await client.query(
            `INSERT INTO messages (client_id, sender, destination, content, status, route_plan_id, route_id, trunk_id, supplier_id, connection_type, cost, dlr_status, message_id, otp_code, language)
             VALUES ($1,$2,$3,$4,'DELIVERED',$5,$6,$7,$8,$9,$10,'DELIVERED',$11,$12,$13)`,
            [es.clientId, src, dest, content,
             c.route_plan_id, firstRoute.routeId, firstRoute.trunkId,
             firstRoute.supplierId, connType, ratePerSms, messageId, otpCode, votpResult.language]
          );
          await client.query(`SET search_path TO "${es.schemaName}"`);
          console.log(`[SMPP] Voice OTP delivered via SMPP: ${dest} (${otpCode}), lang=${votpResult.language}, callSid=${votpResult.callSid}`);
          return { success: true, messageId };
        } else {
          await client.query(
            `INSERT INTO messages (client_id, sender, destination, content, status, route_plan_id, route_id, trunk_id, supplier_id, connection_type, cost, dlr_status, message_id, otp_code, language, dlr_timestamp)
             VALUES ($1,$2,$3,$4,'FAILED',$5,$6,$7,$8,$9,$10,'FAILED',$11,$12,$13,NOW())`,
            [es.clientId, src, dest, content,
             c.route_plan_id, firstRoute.routeId, firstRoute.trunkId,
             firstRoute.supplierId, connType, ratePerSms, messageId, otpCode, votpResult.language]
          );
          console.log(`[SMPP] Voice OTP FAILED: ${dest} — ${votpResult.errorMessage || 'call failed'}`);
          return { success: false, messageId, errorCode: 1 };
        }
      }

      // ── OTT routes: not supported via SMPP ──
      if (connType === "WhatsApp OTT" || connType === "Telegram OTT") {
        await client.query(
          `INSERT INTO messages (client_id, sender, destination, content, status, route_plan_id, route_id, trunk_id, supplier_id, connection_type, cost, dlr_status, message_id, dlr_timestamp)
           VALUES ($1,$2,$3,$4,'FAILED',$5,$6,$7,$8,$9,$10,'FAILED',$11,NOW())`,
          [es.clientId, src, dest, content,
           c.route_plan_id, firstRoute.routeId, firstRoute.trunkId,
           firstRoute.supplierId, connType, ratePerSms, messageId]
        );
        console.log(`[SMPP] OTT delivery not available via SMPP for route "${firstRoute.routeName}"`);
        return { success: false, messageId, errorCode: 8 };
      }

      // ── CUSTOM_API routes: not supported via SMPP ──
      if (connType === "CUSTOM_API") {
        await client.query(
          `INSERT INTO messages (client_id, sender, destination, content, status, route_plan_id, route_id, trunk_id, supplier_id, connection_type, cost, dlr_status, message_id, dlr_timestamp)
           VALUES ($1,$2,$3,$4,'FAILED',$5,$6,$7,$8,$9,$10,'FAILED',$11,NOW())`,
          [es.clientId, src, dest, content,
           c.route_plan_id, firstRoute.routeId, firstRoute.trunkId,
           firstRoute.supplierId, connType, ratePerSms, messageId]
        );
        console.log(`[SMPP] CUSTOM_API delivery not available via SMPP for route "${firstRoute.routeName}"`);
        return { success: false, messageId, errorCode: 8 };
      }

      const dlrCallbackUrl = c.dlr_callback_url || c.webhook_url || undefined;

      // ── Real delivery with route fallback (pass active SERVER-mode sessions explicitly) ──
      const deliveryResult = await deliverSmsWithFallback(
        es.tenantId,
        es.schemaName,
        es.clientId,
        src,
        dest,
        content,
        messageId,
        filteredRoutes,
        dlrCallbackUrl,
        activeSupplierSessions as unknown as Map<string, unknown>
      );

      if (deliveryResult.success) {
        // Insert message as SENT (DLR will update it later when real DLR arrives)
        await client.query(
          `INSERT INTO messages (client_id, sender, destination, content, status, route_plan_id, route_id, trunk_id, supplier_id, connection_type, cost, dlr_status, message_id)
           VALUES ($1,$2,$3,$4,'SENT',$5,$6,$7,$8,$9,$10,'PENDING',$11)`,
          [
            es.clientId, src, dest, content,
            c.route_plan_id,
            deliveryResult.routeUsed?.routeId || null,
            deliveryResult.routeUsed?.trunkId || null,
            deliveryResult.routeUsed?.supplierId || null,
            deliveryResult.routeUsed?.connectionType || "SMPP",
            ratePerSms,
            messageId,
          ]
        );

        // Deduct tenant SMS counter (balance tracking removed)
        await client.query(`SET search_path TO public`);
        await client.query(
          `UPDATE tenants SET sms_counter = COALESCE(sms_counter, 0) + 1 WHERE id = $1`,
          [es.tenantId]
        );
        await client.query(`SET search_path TO "${es.schemaName}"`);

        // ── Register DLR callback to push DLR back to this ESME client ──
        registerDlrCallback(messageId, (dlr: DlrPayload) => {
          // Find the live ESME session (may have reconnected with a new session object)
          let liveSession: EsmeSession | null = null;
          for (const [, s] of activeSessions) {
            if (s.clientId === es.clientId && s.schemaName === es.schemaName) {
              liveSession = s;
              break;
            }
          }
          if (!liveSession) {
            // Client disconnected — queue DLR in memory + persist to DB
            const { depth, dropped } = enqueueDlrPersist(es.tenantId, es.clientId, es.schemaName, dlr);
            if (dropped) console.log(`[SMPP] DLR queue full for client ${es.clientId}, dropped oldest entry`);
            console.log(`[SMPP] DLR for ${dlr.messageId} queued: client ${es.clientId} disconnected (queue depth: ${depth})`);
            return;
          }
          const dlrStatus = mapDlrStatus(dlr.status);
          liveSession.session.send(
            new smpp.PDU("deliver_sm", {
              source_addr: dlr.dest,
              destination_addr: dlr.src,
              short_message: {
                message: `id:${dlr.supplierMessageId} sub:001 dlvrd:001 submit date:${dlr.submitDate} done date:${dlr.doneDate} stat:${dlrStatus} err:${dlr.errorCode} text:${dlrStatus}`,
              },
              esm_class: 4,
              registered_delivery: 0,
              data_coding: 0,
            })
          );
          console.log(`[SMPP] Real DLR pushed to ESME client: ${dlr.messageId} → ${dlr.status}`);
        });

        console.log(
          `[SMPP] SMS delivered via ${deliveryResult.routeUsed?.routeName} (supplier: ${deliveryResult.routeUsed?.supplierName})${deliveryResult.fallbackUsed ? ` (fallback after ${deliveryResult.failedRoutes} failed routes)` : ""}`
        );

        return { success: true, messageId };
      } else {
        // All routes failed — insert as FAILED
        const firstRoute = allRoutes[0];
        await client.query(
          `INSERT INTO messages (client_id, sender, destination, content, status, route_plan_id, route_id, trunk_id, supplier_id, connection_type, cost, dlr_status, message_id, dlr_timestamp)
           VALUES ($1,$2,$3,$4,'FAILED',$5,$6,$7,$8,$9,$10,'FAILED',$11,NOW())`,
          [
            es.clientId, src, dest, content,
            c.route_plan_id,
            firstRoute.route_id || null,
            firstRoute.trunk_id || null,
            firstRoute.supplier_id || null,
            firstRoute.connection_type || "SMPP",
            ratePerSms,
            messageId,
          ]
        );

        console.log(`[SMPP] SMS delivery FAILED after ${deliveryResult.failedRoutes} route(s): ${deliveryResult.errorMessage}`);
        return { success: false, messageId, errorCode: 1 };
      }
    } finally {
      await client.query(`SET search_path TO public`);
      client.release();
    }
  } catch (err) {
    console.error("[SMPP] processSubmitSm error:", err);
    return { success: false, messageId, errorCode: 1 };
  }
}

/** Map supplier DLR status to SMPP DLR stat field */
function mapDlrStatus(status: string): string {
  const m: Record<string, string> = {
    DELIVRD: "DELIVRD",
    DELIVERED: "DELIVRD",
    EXPIRED: "EXPIRED",
    UNDELIV: "UNDELIV",
    REJECTD: "REJECTD",
    FAILED: "UNDELIV",
  };
  return m[status.toUpperCase()] || status.toUpperCase();
}

/**
 * Flush queued DLRs to a newly bound transceiver/receiver.
 * Atomically claims the queue to prevent races with new DLRs arriving during flush.
 * Re-queues any DLRs that failed to send for the next reconnect attempt.
 */
function flushPendingDlrs(es: EsmeSession) {
  const dlrs = dequeueAllDlrsPersist(es.tenantId, es.clientId, es.schemaName);
  if (dlrs.length === 0) {
    console.log(`[SMPP] Bound for tenant ${es.tenantId}, client ${es.clientId} — no pending DLRs`);
    return;
  }

  console.log(`[SMPP] Flushing ${dlrs.length} pending DLRs to client ${es.clientId}`);
  const unsent: DlrPayload[] = [];
  for (const dlr of dlrs) {
    try {
      const dlrStatus = mapDlrStatus(dlr.status);
      es.session.send(
        new smpp.PDU("deliver_sm", {
          source_addr: dlr.dest,
          destination_addr: dlr.src,
          short_message: {
            message: `id:${dlr.supplierMessageId} sub:001 dlvrd:001 submit date:${dlr.submitDate} done date:${dlr.doneDate} stat:${dlrStatus} err:${dlr.errorCode} text:${dlrStatus}`,
          },
          esm_class: 4,
          registered_delivery: 0,
          data_coding: 0,
        })
      );
      console.log(`[SMPP] Queued DLR pushed: ${dlr.messageId} → ${dlr.status}`);
    } catch (err) {
      console.error(`[SMPP] Failed to push queued DLR ${dlr.messageId}:`, err);
      unsent.push(dlr);
    }
  }

  if (unsent.length > 0) {
    requeueDlrsPersist(es.tenantId, es.clientId, es.schemaName, unsent);
    console.log(`[SMPP] Re-queued ${unsent.length} failed DLRs for client ${es.clientId}`);
  }

  console.log(`[SMPP] DLR flush complete for client ${es.clientId} (${dlrs.length - unsent.length} sent, ${unsent.length} failed)`);
}

/**
 * Check if a client has an active real SMPP session
 */
export function isClientSessionActive(clientId: number, schemaName: string): boolean {
  for (const [, session] of activeSessions) {
    if (session.clientId === clientId && session.schemaName === schemaName) {
      return true;
    }
  }
  return false;
}

/**
 * Close an active client SMPP session
 */
export function closeClientSession(clientId: number, schemaName: string): boolean {
  let closed = false;
  for (const [, session] of activeSessions) {
    if (session.clientId === clientId && session.schemaName === schemaName) {
      try { session.session.close(); } catch {}
      closed = true;
    }
  }
  return closed;
}

async function updateClientBindStatus(clientId: number, schemaName: string, status: string, boundAt?: Date) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    if (boundAt) {
      // Guard: only update if last_bind_time matches this session's boundAt.
      // Prevents a stale UNBOUND from overwriting a newer session's BOUND.
      await client.query(
        `UPDATE clients SET bind_status = $1, updated_at = NOW() WHERE id = $2 AND last_bind_time = $3`,
        [status, clientId, boundAt]
      );
    } else {
      await client.query(
        `UPDATE clients SET bind_status = $1, updated_at = NOW() WHERE id = $2`,
        [status, clientId]
      );
    }
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

async function updateSupplierBindStatus(supplierId: number, schemaName: string, status: string, boundAt?: Date) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    if (boundAt) {
      await client.query(
        `UPDATE suppliers SET bind_status = $1, updated_at = NOW() WHERE id = $2 AND last_bind_time = $3`,
        [status, supplierId, boundAt]
      );
    } else {
      await client.query(
        `UPDATE suppliers SET bind_status = $1, updated_at = NOW() WHERE id = $2`,
        [status, supplierId]
      );
    }
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Remove a session from its tracking map.
 * Uses object identity (===) so only the EXACT session is removed —
 * prevents a stale close event from deleting a newly reconnected session.
 * Returns true if THIS session was the currently active one; false if a
 * newer session has already replaced it (race on reconnect).
 */
function removeSession(sess: ActiveSession): boolean {
  if (sess.type === "esme") {
    const key = `${sess.tenantId}:${sess.systemId}`;
    if (activeSessions.get(key) === sess) {
      activeSessions.delete(key);
      return true;
    }
    return false;
  } else {
    const key = `supplier:${sess.tenantId}:${sess.supplierId}`;
    if (activeSupplierSessions.get(key) === sess) {
      activeSupplierSessions.delete(key);
      return true;
    }
    return false;
  }
}

/**
 * Process SUBMIT_SM from a supplier in SERVER mode (GSM gateway / upstream SMSC).
 * This is an inbound MO (mobile-originated) message from the supplier's network.
 * We store it in sms_inbox and optionally forward to a designated client.
 */
async function processSupplierSubmitSm(
  ss: SupplierServerSession,
  pdu: smpp.PDU
): Promise<{ success: boolean; messageId: string; errorCode?: number }> {
  const messageId = "MO_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  const dest = (pdu.destination_addr as string) || "";
  const src = (pdu.source_addr as string) || "";
  const content = (pdu.short_message as { message: string })?.message || "";

  try {
    const dbClient = await pool.connect();
    try {
      await dbClient.query(`SET search_path TO "${ss.schemaName}"`);

      // Store inbound MO message
      await dbClient.query(
        `INSERT INTO sms_inbox (sender, destination, content, supplier_id)
         VALUES ($1, $2, $3, $4)`,
        [src, dest, content, ss.supplierId]
      );

      console.log(`[SMPP-SRV] Inbound MO from ${src} → ${dest} via supplier #${ss.supplierId}: ${content.substring(0, 40)}`);
    } finally {
      await dbClient.query(`SET search_path TO public`);
      dbClient.release();
    }

    return { success: true, messageId };
  } catch (err) {
    console.error("[SMPP-SRV] processSupplierSubmitSm error:", err);
    return { success: false, messageId, errorCode: 1 };
  }
}

/**
 * Push DLR to a supplier server session via DELIVER_SM.
 * Called when we need to notify a SERVER-mode supplier about delivery status.
 */
export function pushDlrToSupplierServer(
  tenantId: number,
  supplierId: number,
  dlrPayload: DlrPayload
): boolean {
  const key = `supplier:${tenantId}:${supplierId}`;
  const sess = activeSupplierSessions.get(key);
  if (!sess) {
    console.log(`[SMPP-SRV] No active server session for supplier ${supplierId} — DLR not pushed`);
    return false;
  }

  try {
    const dlrStatus = mapDlrStatus(dlrPayload.status);
    sess.session.send(
      new smpp.PDU("deliver_sm", {
        source_addr: dlrPayload.dest,
        destination_addr: dlrPayload.src,
        short_message: {
          message: `id:${dlrPayload.supplierMessageId} sub:001 dlvrd:001 submit date:${dlrPayload.submitDate} done date:${dlrPayload.doneDate} stat:${dlrStatus} err:${dlrPayload.errorCode} text:${dlrStatus}`,
        },
        esm_class: 4,
        registered_delivery: 0,
        data_coding: 0,
      })
    );
    console.log(`[SMPP-SRV] DLR pushed to supplier server #${supplierId}: ${dlrPayload.messageId} → ${dlrPayload.status}`);
    return true;
  } catch (err) {
    console.error(`[SMPP-SRV] Failed to push DLR to supplier ${supplierId}:`, err);
    return false;
  }
}

/**
 * Check if a supplier in SERVER mode has an active session.
 */
export function isSupplierServerSessionActive(tenantId: number, supplierId: number): boolean {
  const key = `supplier:${tenantId}:${supplierId}`;
  return activeSupplierSessions.has(key);
}

/**
 * Close a supplier server session.
 */
export function closeSupplierServerSession(tenantId: number, supplierId: number): boolean {
  const key = `supplier:${tenantId}:${supplierId}`;
  const sess = activeSupplierSessions.get(key);
  if (sess) {
    try { sess.session.close(); } catch {}
    return true;
  }
  return false;
}
