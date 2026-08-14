#!/usr/bin/env node
/**
 * smpp-interconnect-gateway.js — simulated GSM gateway for the cross-server
 * interconnect test. Binds to a Net2APP server as its SERVER-mode supplier
 * (`itest_gw_<tag>`), receives the MT (SUBMIT_SM — standard SMPP path) and
 * answers with a DELIVRD DLR (deliver_sm, esm_class=4).
 *
 * Mirrors exactly what a real GSM modem / Android gateway does, but returns
 * DLRs automatically so the full submit_sm + DLR chain can be verified.
 *
 * Usage:
 *   node scripts/smpp-interconnect-gateway.js <host> <port> <user> <pass> <tag>
 *
 * Env:
 *   DLR_DELAY_MS  — delay before sending each DLR (default 100ms). Raise it
 *                   to simulate a slow/restarting network and to exercise the
 *                   platform's restart-survival DLR recovery.
 *   RECONNECT_MS  — reconnect delay after a dropped connection (default 5000ms).
 *                   Real gateways re-bind after the SMSC restarts; this sim does
 *                   the same so in-flight DLRs can still be delivered post-restart.
 */
const smpp = require("smpp");

const [host, port, user, pass, tag] = process.argv.slice(2);
if (!host || !port || !user || !pass || !tag) {
  console.error("usage: smpp-interconnect-gateway.js <host> <port> <user> <pass> <tag>");
  process.exit(1);
}

const DLR_DELAY_MS = parseInt(process.env.DLR_DELAY_MS || "100", 10);
const RECONNECT_MS = parseInt(process.env.RECONNECT_MS || "5000", 10);
let seq = 0;

function buildDlrText(id) {
  const now = new Date();
  const d = String(now.getTime()).slice(0, 10); // 10-digit epoch (platform format)
  return `id:${id} sub:001 dlvrd:001 submit date:${d} done date:${d} stat:DELIVRD err:000 text:DELIVRD`;
}

function connect() {
  const sess = smpp.connect({ host, port: parseInt(port, 10) });

  sess.on("connect", () => {
    sess.bind_transceiver(
      { system_id: user, password: pass, system_type: "SMSC", interface_version: 0x34 },
      (pdu) => {
        if (pdu.command_status === 0) {
          console.log(`[GW-${tag}] ✅ BOUND to ${host}:${port} as ${user}`);
        } else {
          console.log(`[GW-${tag}] ❌ BIND REJECTED status=0x${pdu.command_status.toString(16)} (${pdu.command_status})`);
          // Retry rather than exit — the SMSC may still be starting up
          setTimeout(connect, RECONNECT_MS);
        }
      }
    );
  });

  // ── MT via SUBMIT_SM (standard SMPP — what sendViaSupplierServerSession sends) ──
  sess.on("submit_sm", (pdu) => {
    const src = pdu.source_addr || "";
    const dst = pdu.destination_addr || "";
    const text = typeof pdu.short_message === "string"
      ? pdu.short_message
      : (pdu.short_message && pdu.short_message.message) || "";
    const gwId = `GW_${tag}_${++seq}`;
    console.log(`[GW-${tag}] 📥 MT SUBMIT_SM ${src} → ${dst}: "${text}" → resp id=${gwId}`);
    // Ack the MT with our own message_id (this id travels back as the DLR id)
    sess.send(pdu.response({ message_id: gwId }));
    // Return the DLR receipt after the configured delay
    setTimeout(() => {
      sess.send(new smpp.PDU("deliver_sm", {
        source_addr: dst,               // DLR source = original MT destination
        destination_addr: src,          // DLR dest = original sender
        short_message: { message: buildDlrText(gwId) },
        esm_class: 4,                   // delivery receipt
        registered_delivery: 0,
        data_coding: 0,
      }), () => {});
      console.log(`[GW-${tag}] ⬆ DLR deliver_sm (${gwId} → DELIVRD)`);
    }, DLR_DELAY_MS);
  });

  // ── MT via DELIVER_SM fallback (defensive; some routes push this) ──
  sess.on("deliver_sm", (pdu) => {
    const esm = pdu.esm_class || 0;
    const isDlr = (esm & 0x04) !== 0;
    if (isDlr) {
      // A DLR from the SMSC — not expected for us, just ack
      try { sess.send(pdu.response({ message_id: "" })); } catch {}
      return;
    }
    const src = pdu.source_addr || "";
    const dst = pdu.destination_addr || "";
    const text = typeof pdu.short_message === "string"
      ? pdu.short_message
      : (pdu.short_message && pdu.short_message.message) || "";
    const gwId = `GW_${tag}_${++seq}`;
    console.log(`[GW-${tag}] 📥 MT DELIVER_SM ${src} → ${dst}: "${text}"`);
    try { sess.send(pdu.response({ message_id: "" })); } catch {}
    setTimeout(() => {
      sess.send(new smpp.PDU("deliver_sm", {
        source_addr: dst,
        destination_addr: src,
        short_message: { message: buildDlrText(gwId) },
        esm_class: 4,
        registered_delivery: 0,
        data_coding: 0,
      }), () => {});
      console.log(`[GW-${tag}] ⬆ DLR deliver_sm (${gwId} → DELIVRD)`);
    }, DLR_DELAY_MS);
  });

  sess.on("enquire_link", (pdu) => {
    try { sess.send(pdu.response()); } catch {}
  });

  sess.on("error", (e) => console.error(`[GW-${tag}] socket error: ${e.message}`));
  sess.on("close", () => {
    console.log(`[GW-${tag}] connection closed — reconnecting in ${RECONNECT_MS / 1000}s`);
    setTimeout(connect, RECONNECT_MS);
  });
}

connect();
