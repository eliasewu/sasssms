/**
 * Net2APP SMPP SMSC Server — Java 21 / Node.js compatible
 * Port 2775, supports SMPP v3.4 ESME binds
 * Handles: BIND_TRANSCEIVER, SUBMIT_SM, DELIVER_SM (DLR), ENQUIRE_LINK
 */
import smpp from "smpp";
import { pool } from "@/db";

interface EsmeSession {
  session: smpp.ServerSession;
  systemId: string;
  systemType: string;
  tenantId: number;
  schemaName: string;
  clientId: number;
  boundAt: Date;
}

const activeSessions: Map<string, EsmeSession> = new Map();

// DLR cache: message_id → DLR info
const dlrQueue: Map<string, {
  messageId: string;
  status: string;
  dlrStatus: string;
  errorCode: string;
  submitDate: Date;
  doneDate: Date;
  dest: string;
  src: string;
  tenantId: number;
  schemaName: string;
  clientId: number;
  smppUsername: string;
}> = new Map();

// Pending DLR queue for external HTTP push
const dlrHttpQueue: Array<{
  url: string;
  payload: Record<string, unknown>;
  retries: number;
  maxRetries: number;
}> = [];

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
              session.send(pdu.response({ system_id: "Net2APP_SMSC" }));
              console.log(`[SMPP] BOUND: ${es.systemId} @ tenant ${es.tenantId}`);
            } else {
              session.send(pdu.response({ command_status: 14 })); // invalid system_id
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
              session.send(pdu.response({ system_id: "Net2APP_SMSC" }));
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
              session.send(pdu.response({ system_id: "Net2APP_SMSC" }));
              // Start pushing any pending DLRs to this receiver
              flushPendingDlrs(es);
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
          const result = await processSubmitSm(
            currentSession, pdu
          );

          if (result.success) {
            session.send(
              pdu.response({
                message_id: result.messageId,
              })
            );

            // Schedule DLR via deliver_sm after 3-8 seconds
            setTimeout(() => {
              sendDlrViaSmpp(currentSession!, result);
            }, 3000 + Math.random() * 5000);
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
          // Update DB bind status
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
  _bindType: string
): Promise<EsmeSession | null> {
  const systemId = pdu.system_id as string;
  const password = pdu.password as string;

  // Search all tenant schemas for matching SMPP credentials
  const client = await pool.connect();
  try {
    // Get all active tenants
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
        // Verify password
        if (c.smpp_password && c.smpp_password !== password) {
          continue;
        }

        // Update bind status
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
          boundAt: new Date(),
        };

        activeSessions.set(`${t.id}:${systemId}`, es);

        // Audit log
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
 * Process incoming SUBMIT_SM
 */
async function processSubmitSm(
  es: EsmeSession,
  pdu: smpp.PDU
): Promise<{ success: boolean; messageId: string; errorCode?: number; dest?: string; src?: string; content?: string }> {
  const messageId = "SMPP_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  const dest = (pdu.destination_addr as string) || "";
  const src = (pdu.source_addr as string) || "";
  const content = (pdu.short_message as { message: string })?.message || "";

  try {
    const client = await pool.connect();
    try {
      // Get client's route plan
      await client.query(`SET search_path TO "${es.schemaName}"`);
      const { rows: clients } = await client.query(
        "SELECT * FROM clients WHERE id = $1 AND is_active = true",
        [es.clientId]
      );
      const c = clients[0];
      if (!c) return { success: false, messageId, errorCode: 14 };

      // Get route plan
      if (!c.route_plan_id) return { success: false, messageId, errorCode: 8 };

      // Get routing chain
      const { rows: routes } = await client.query(
        `SELECT rpr.priority, r.name as route_name, r.trunk_id, r.country_code,
                t.name as trunk_name, t.supplier_id,
                s.name as supplier_name, s.connection_type, s.cost_per_sms
         FROM route_plan_routes rpr
         JOIN routes r ON rpr.route_id = r.id AND r.is_active = true
         JOIN trunks t ON r.trunk_id = t.id AND t.is_active = true
         JOIN suppliers s ON t.supplier_id = s.id AND s.is_active = true
         WHERE rpr.route_plan_id = $1
         ORDER BY rpr.priority ASC LIMIT 1`,
        [c.route_plan_id]
      );

      if (routes.length === 0) {
        // Insert as failed
        await client.query(
          `INSERT INTO messages (client_id, sender, destination, content, status, route_plan_id, cost, dlr_status, message_id, dlr_timestamp)
           VALUES ($1,$2,$3,$4,'FAILED',$5,$6,'FAILED',$7,NOW())`,
          [es.clientId, src, dest, content, c.route_plan_id, c.rate_per_sms || "0.00030", messageId]
        );
        return { success: false, messageId, errorCode: 8 };
      }

      const route = routes[0];
      const costPerSms = parseFloat(c.rate_per_sms || "0.00030");

      // Check balance
      if (parseFloat(c.balance) < costPerSms) {
        return { success: false, messageId, errorCode: 20 };
      }

      // Insert message as SENT
      await client.query(
        `INSERT INTO messages (client_id, sender, destination, content, status, route_plan_id, route_id, trunk_id, supplier_id, connection_type, cost, dlr_status, message_id, dlr_timestamp)
         VALUES ($1,$2,$3,$4,'SENT',$5,$6,$7,$8,$9,$10,'DELIVERED',$11,NOW())`,
        [es.clientId, src, dest, content, c.route_plan_id, route.route_id || null, route.trunk_id || null, route.supplier_id || null, route.connection_type || "SMPP", costPerSms, messageId]
      );

      // Deduct balance
      await client.query(
        `UPDATE clients SET balance = balance - $1, updated_at = NOW() WHERE id = $2`,
        [costPerSms, es.clientId]
      );

      // Check for DLR callback URL
      if (c.dlr_callback_url || c.webhook_url) {
        const dlrUrl = c.dlr_callback_url || c.webhook_url;
        if (dlrUrl) {
          dlrHttpQueue.push({
            url: dlrUrl,
            payload: {
              message_id: messageId,
              destination: dest,
              source: src,
              status: "DELIVERED",
              dlr_status: "DELIVERED",
              cost: costPerSms,
              timestamp: new Date().toISOString(),
              client_id: es.clientId,
            },
            retries: 0,
            maxRetries: 5,
          });
        }
      }

      // Store DLR for SMPP push
      dlrQueue.set(messageId, {
        messageId, status: "DELIVERED", dlrStatus: "DELIVERED",
        errorCode: "0", submitDate: new Date(), doneDate: new Date(),
        dest, src, tenantId: es.tenantId, schemaName: es.schemaName,
        clientId: es.clientId, smppUsername: es.systemId,
      });

      return { success: true, messageId, dest, src, content };
    } finally {
      await client.query(`SET search_path TO public`);
      client.release();
    }
  } catch (err) {
    console.error("[SMPP] processSubmitSm error:", err);
    return { success: false, messageId, errorCode: 1 };
  }
}

/**
 * Send DLR back via SMPP deliver_sm
 */
function sendDlrViaSmpp(es: EsmeSession, result: { messageId: string; dest?: string; src?: string }) {
  try {
    const dlr = dlrQueue.get(result.messageId);
    if (!dlr) return;

    es.session.send(
      new smpp.PDU("deliver_sm", {
        source_addr: dlr.dest,
        destination_addr: dlr.src,
        short_message: {
          message: `id:${dlr.messageId} sub:001 dlvrd:001 submit date:${formatSmppDate(dlr.submitDate)} done date:${formatSmppDate(dlr.doneDate)} stat:${dlr.dlrStatus} err:${dlr.errorCode} text:${dlr.dlrStatus}`,
        },
        esm_class: 4,
        registered_delivery: 0,
        data_coding: 0,
      })
    );

    // Update DB
    updateDlrStatus(dlr.messageId, dlr.schemaName, dlr.dlrStatus);

    console.log(`[SMPP] DLR sent via deliver_sm: ${dlr.messageId} → ${dlr.dlrStatus}`);

    // Clean up
    dlrQueue.delete(result.messageId);
  } catch (err) {
    console.error("[SMPP] DLR send error:", err);
  }
}

/**
 * Push pending DLRs when a receiver binds
 */
function flushPendingDlrs(es: EsmeSession) {
  dlrQueue.forEach((dlr) => {
    if (dlr.tenantId === es.tenantId && dlr.clientId === es.clientId) {
      sendDlrViaSmpp(es, {
        messageId: dlr.messageId,
        dest: dlr.dest,
        src: dlr.src,
      });
    }
  });
}

/**
 * Update DLR status in database
 */
async function updateDlrStatus(messageId: string, schemaName: string, dlrStatus: string) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query(
      `UPDATE messages SET dlr_status = $1, dlr_timestamp = NOW() WHERE message_id = $2`,
      [dlrStatus, messageId]
    );
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Update bind status in DB
 */
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

/**
 * Format date for SMPP DLR message
 */
function formatSmppDate(d: Date): string {
  const yy = d.getFullYear().toString().slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yy}${mm}${dd}${hh}${min}`;
}

/**
 * Background DLR HTTP pusher (runs every 5 seconds)
 */
export function startDlrHttpPusher() {
  setInterval(async () => {
    while (dlrHttpQueue.length > 0) {
      const item = dlrHttpQueue.shift();
      if (!item) break;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(item.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok && item.retries < item.maxRetries) {
          item.retries++;
          dlrHttpQueue.push(item); // Re-queue
        }
      } catch {
        if (item.retries < item.maxRetries) {
          item.retries++;
          dlrHttpQueue.push(item); // Re-queue on network error
        }
      }
    }
  }, 5000);
}
