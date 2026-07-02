/**
 * Net2APP SMPP SMSC Server — Java 21 / Node.js compatible
 * Port 2775, supports SMPP v3.3, v3.4, v5.0 ESME binds with version negotiation
 *
 * Version detection: Reads interface_version from bind PDU and negotiates
 * the best mutually-supported version. v3.3 does NOT support bind_transceiver.
 *
 * Handles: BIND_TRANSCEIVER, BIND_TRANSMITTER, BIND_RECEIVER, SUBMIT_SM, DELIVER_SM (DLR), ENQUIRE_LINK
 *
 * SMS Delivery: Uses real outbound delivery via smpp-client with route fallback.
 * DLR: Delayed until real supplier DLR arrives, then pushed to client via SMPP + HTTP.
 */
import smpp from "smpp";
import { pool } from "@/db";
import {
  deliverSmsWithFallback,
  registerDlrCallback,
} from "@/lib/smpp-client";
import type { RouteInfo, DlrPayload } from "@/lib/smpp-client";

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
  session: smpp.ServerSession;
  systemId: string;
  systemType: string;
  tenantId: number;
  schemaName: string;
  clientId: number;
  interfaceVersion: number;
  boundAt: Date;
}

const activeSessions: Map<string, EsmeSession> = new Map();

/**
 * Start SMPP server on given port
 */
export function startSmppServer(port: number = 2775) {
  const server = smpp.createServer(
    (session: smpp.ServerSession) => {
      let currentSession: EsmeSession | null = null;

      session.on("bind_transceiver", (pdu: smpp.PDU) => {
        handleBind(session, pdu, "transceiver")
          .then((es) => {
            if (es) {
              currentSession = es;
              session.send(pdu.response({
                system_id: "Net2APP_SMSC",
                interface_version: es.interfaceVersion,
              }));
              console.log(`[SMPP] BOUND transceiver: ${es.systemId} @ tenant ${es.tenantId} (SMPP v${versionLabel(es.interfaceVersion)})`);
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
          .then((es) => {
            if (es) {
              currentSession = es;
              session.send(pdu.response({
                system_id: "Net2APP_SMSC",
                interface_version: es.interfaceVersion,
              }));
              console.log(`[SMPP] BOUND transmitter: ${es.systemId} @ tenant ${es.tenantId} (SMPP v${versionLabel(es.interfaceVersion)})`);
            } else {
              session.send(pdu.response({ command_status: 14 }));
            }
          })
          .catch(() => session.send(pdu.response({ command_status: 14 })));
      });

      session.on("bind_receiver", (pdu: smpp.PDU) => {
        handleBind(session, pdu, "receiver")
          .then((es) => {
            if (es) {
              currentSession = es;
              session.send(pdu.response({
                system_id: "Net2APP_SMSC",
                interface_version: es.interfaceVersion,
              }));
              flushPendingDlrs(es);
              console.log(`[SMPP] BOUND receiver: ${es.systemId} @ tenant ${es.tenantId} (SMPP v${versionLabel(es.interfaceVersion)})`);
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
          const result = await processSubmitSm(currentSession, pdu);

          if (result.success) {
            session.send(pdu.response({ message_id: result.messageId }));
            // DLR is now sent only when real supplier DLR arrives (via registerDlrCallback)
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

      session.on("unbind", (pdu: smpp.PDU) => {
        if (currentSession) {
          activeSessions.delete(currentSession.systemId);
          console.log(`[SMPP] UNBOUND: ${currentSession.systemId}`);
        }
        session.send(pdu.response());
        session.close();
      });

      session.on("error", (err: Error) => {
        console.error("[SMPP] Session error:", err.message);
        if (currentSession) {
          activeSessions.delete(currentSession.systemId);
        }
      });

      session.on("close", () => {
        if (currentSession) {
          activeSessions.delete(currentSession.systemId);
          updateBindStatus(currentSession.clientId, currentSession.schemaName, "UNBOUND");
        }
      });
    }
  );

  server.listen(port, () => {
    console.log(`[SMPP] SMSC Server listening on port ${port}`);
  });

  return server;
}

/**
 * Authenticate ESME bind request
 */
async function handleBind(
  session: smpp.ServerSession,
  pdu: smpp.PDU,
  bindType: string
): Promise<EsmeSession | null> {
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
      await client.query(`SET search_path TO "${t.schema_name}"`);
      const { rows: matched } = await client.query(
        `SELECT id, smpp_username, smpp_password, smpp_allowed_ip, is_active, name, connection_type
         FROM clients
         WHERE (smpp_username = $1 OR smpp_username IS NULL AND $1 = '')
           AND is_active = true AND deleted_at IS NULL
           AND connection_type = 'SMPP'`,
        [systemId]
      );

      if (matched.length > 0) {
        const c = matched[0];
        if (c.smpp_password && c.smpp_password !== password) {
          continue;
        }

        await client.query(
          `UPDATE clients SET bind_status = 'BOUND', last_bind_time = NOW(), updated_at = NOW() WHERE id = $1`,
          [c.id]
        );

        const es: EsmeSession = {
          session,
          systemId,
          systemType: (pdu.system_type as string) || "ESME",
          tenantId: t.id,
          schemaName: t.schema_name,
          clientId: c.id,
          interfaceVersion: negotiatedVersion,
          boundAt: new Date(),
        };

        activeSessions.set(`${t.id}:${systemId}`, es);

        await client.query(`SET search_path TO public`);
        await client.query(
          `INSERT INTO audit_log (entity_type, entity_id, action, changed_by, tenant_id)
           VALUES ('clients', $1, 'BIND', $2, $3)`,
          [c.id, systemId, t.id]
        );

        return es;
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
        await client.query(
          `INSERT INTO messages (client_id, sender, destination, content, status, route_plan_id, cost, dlr_status, message_id, dlr_timestamp)
           VALUES ($1,$2,$3,$4,'FAILED',$5,$6,'FAILED',$7,NOW())`,
          [es.clientId, src, dest, content, c.route_plan_id, c.rate_per_sms || "0.00030", messageId]
        );
        return { success: false, messageId, errorCode: 8 };
      }

      const ratePerSms = parseFloat(c.rate_per_sms || "0.00030");

      // Check balance
      if (parseFloat(c.balance) < ratePerSms) {
        return { success: false, messageId, errorCode: 20 };
      }

      // Build RouteInfo list for smpp-client
      const routeInfos: RouteInfo[] = allRoutes.map((r) => ({
        routeId: r.route_id,
        routeName: r.route_name,
        trunkId: r.trunk_id,
        trunkName: r.trunk_name,
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        connectionType: r.connection_type,
        priority: r.priority,
      }));

      const dlrCallbackUrl = c.dlr_callback_url || c.webhook_url || undefined;

      // ── Real delivery with route fallback ──
      const deliveryResult = await deliverSmsWithFallback(
        es.tenantId,
        es.schemaName,
        es.clientId,
        src,
        dest,
        content,
        messageId,
        routeInfos,
        dlrCallbackUrl
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

        // Deduct balance
        await client.query(
          `UPDATE clients SET balance = balance - $1, updated_at = NOW() WHERE id = $2`,
          [ratePerSms, es.clientId]
        );

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
            // Client disconnected — no SMPP push possible
            console.log(`[SMPP] DLR for ${dlr.messageId} skipped: client disconnected`);
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
 * Notify a bound receiver that DLRs are ready.
 * DLRs are now pushed in real-time via registerDlrCallback — no pending queue needed.
 */
function flushPendingDlrs(es: EsmeSession) {
  console.log(`[SMPP] Receiver bound for tenant ${es.tenantId}, client ${es.clientId} — DLRs will push in real-time`);
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
  const keyToDelete: string[] = [];
  for (const [key, session] of activeSessions) {
    if (session.clientId === clientId && session.schemaName === schemaName) {
      try { session.session.close(); } catch {}
      keyToDelete.push(key);
    }
  }
  for (const key of keyToDelete) {
    activeSessions.delete(key);
  }
  return keyToDelete.length > 0;
}

async function updateBindStatus(clientId: number, schemaName: string, status: string) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query(
      `UPDATE clients SET bind_status = $1, updated_at = NOW() WHERE id = $2`,
      [status, clientId]
    );
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}
