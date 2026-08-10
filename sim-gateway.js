#!/usr/bin/env node
/**
 * Net2APP SMS gateway simulator — mirrors exactly what the Android APK does:
 *  - bind_transceiver with system_type=ANDROID_SMS
 *  - MT: receives DELIVER_SM (0x05) → logs "send via SIM" → ACKs with deliver_sm_resp
 *  - MO: sends SUBMIT_SM (0x04) with source=incoming SMS sender, dest=gateway phone
 *
 * Modes:
 *   node sim-gateway.js bind [--stay]         — bind and stay connected (logs MT)
 *   node sim-gateway.js mo <sender> <dest> <msg>  — bind, send MO submit_sm, print resp, exit
 *   node sim-gateway.js dlr <msgId> <src> <dest>  — bind, send DLR deliver_sm (esm_class=4), exit
 *   node sim-gateway.js rest                    — REST/HTTP mode: register with the
 *                                                 platform, poll for MT every 3s,
 *                                                 report results, heartbeat every 15s
 *
 * Env: SIM_HOST (127.0.0.1), SIM_PORT (2775), SIM_USER, SIM_PASS
 *      REST mode: SIM_BASE_URL (http://127.0.0.1:5556), SIM_USER, SIM_PASS
 */
const smpp = require("smpp");

const HOST = process.env.SIM_HOST || "127.0.0.1";
const PORT = parseInt(process.env.SIM_PORT || "2775", 10);
const USER = process.env.SIM_USER || "gwtest";
const PASS = process.env.SIM_PASS || "gwtest123";
const SYSTEM_TYPE = process.env.SIM_ST || "ANDROID_SMS";

function bind(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const sess = smpp.connect({ host: HOST, port: PORT });
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; try { sess.close(); } catch {} reject(new Error("bind timeout")); }
    }, timeoutMs);

    sess.on("connect", () => {
      console.log(`[SIM] TCP connected to ${HOST}:${PORT}`);
      sess.bind_transceiver(
        { system_id: USER, password: PASS, system_type: SYSTEM_TYPE, interface_version: 0x34 },
        (pdu) => {
          if (pdu.command_status === 0) {
            if (done) return; done = true; clearTimeout(timer);
            console.log(`[SIM] ✅ BOUND transceiver (system_id=${USER}, system_type=${SYSTEM_TYPE}, smsc=${pdu.system_id})`);
            resolve(sess);
          } else {
            done = true; clearTimeout(timer);
            console.log(`[SIM] ❌ BIND REJECTED status=0x${pdu.command_status.toString(16)} (${pdu.command_status})`);
            reject(new Error(`bind rejected status=${pdu.command_status}`));
          }
        }
      );
    });

    sess.on("error", (e) => { if (!done) { done = true; clearTimeout(timer); } console.log(`[SIM] socket error: ${e.message}`); reject(e); });
    sess.on("close", () => console.log("[SIM] connection closed"));
  });
}

function wireMtHandlers(sess) {
  sess.on("deliver_sm", (pdu) => {
    const esmClass = pdu.esm_class || 0;
    const isDlr = (esmClass & 0x04) !== 0;
    const text = typeof pdu.short_message === "string"
      ? pdu.short_message
      : (pdu.short_message && pdu.short_message.message) || "";
    if (isDlr) {
      console.log(`[SIM] ⬆ DLR from SMSC: ${text}`);
      try { sess.send(pdu.response({ message_id: "" })); } catch {}
      return;
    }
    const src = pdu.source_addr || "";
    const dst = pdu.destination_addr || "";
    console.log(`[SIM] 📥 MT DELIVER_SM from ${src} → ${dst}: "${text}"`);
    // APK behavior: phone sends via SmsManager, then ACKs the deliver_sm.
    console.log(`[SIM] 📱 (SmsManager.sendSms to ${dst} — simulated send OK)`);
    try { sess.send(pdu.response({ message_id: `SIM_${Date.now()}` })); console.log("[SIM] deliver_sm_resp sent"); } catch (e) { console.log("[SIM] resp error", e.message); }
  });

  sess.on("submit_sm", (pdu) => {
    const text = typeof pdu.short_message === "string" ? pdu.short_message : (pdu.short_message && pdu.short_message.message) || "";
    console.log(`[SIM] ⚠ Unexpected SUBMIT_SM from SMSC (APK would ignore): "${text}"`);
    // Reply with an error so the server doesn't hang (status 0x0B = RINVMSGID)
    try { sess.send(pdu.response({ command_status: 0x0b, message_id: "" })); } catch {}
  });

  sess.on("enquire_link", (pdu) => { try { sess.send(pdu.response()); } catch {} });
  sess.on("submit_sm_resp", (pdu) => {
    console.log(`[SIM] submit_sm_resp status=0x${pdu.command_status.toString(16)} message_id=${pdu.message_id}`);
  });
}

// ── REST/HTTP gateway mode — mirrors the APK's REST transport ──
// register → poll (MT) every 3s → result → heartbeat every 15s.
const REST_BASE = process.env.SIM_BASE_URL || "http://127.0.0.1:5556";

async function restPost(path, body) {
  const res = await fetch(`${REST_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runRestMode() {
  const creds = { username: USER, password: PASS };

  const reg = await restPost("/api/public/gateway/register", {
    ...creds,
    deviceInfo: "sim-gateway.js (REST mode)",
  });
  if (reg.status !== 200 || !reg.data.ok) {
    console.error(`[SIM] ❌ REST register failed status=${reg.status}: ${JSON.stringify(reg.data)}`);
    process.exit(1);
  }
  console.log(`[SIM] ✅ REST registered supplier #${reg.data.supplierId} (tenant ${reg.data.tenantId})`);
  console.log(`[SIM] poll=${reg.data.pollIntervalMs}ms heartbeat=${reg.data.heartbeatIntervalMs}ms`);

  let lastHb = 0;
  const HB_MS = (reg.data.heartbeatIntervalMs || 15000) - 1000; // slightly under to avoid expiry
  const POLL_MS = reg.data.pollIntervalMs || 3000;

  while (true) {
    // Poll for MT
    const poll = await restPost("/api/public/gateway/poll", { ...creds, max: 20 });
    const msgs = (poll.data && poll.data.messages) || [];
    for (const m of msgs) {
      console.log(`[SIM] 📥 REST MT ${m.messageId}: ${m.source} → ${m.destination}: "${m.content}"`);
      console.log(`[SIM] 📱 (SmsManager.sendSms to ${m.destination} — simulated send OK)`);
      const res = await restPost("/api/public/gateway/result", {
        ...creds, messageId: m.messageId, success: true,
      });
      console.log(`[SIM] ✅ REST result ${m.messageId} → ${res.data && res.data.outcome} (http ${res.status})`);
    }

    // Heartbeat (keeps the supplier online)
    const now = Date.now();
    if (now - lastHb >= HB_MS) {
      const hb = await restPost("/api/public/gateway/heartbeat", creds);
      console.log(`[SIM] 💓 REST heartbeat → http ${hb.status} ${hb.data && hb.data.ok ? "ok" : JSON.stringify(hb.data)}`);
      lastHb = now;
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === "rest") {
    await runRestMode();
    return;
  }
  if (mode === "mo") {
    const sender = process.argv[3], dest = process.argv[4], msg = process.argv[5];
    if (!sender || !dest || !msg) { console.error("usage: sim-gateway.js mo <sender> <dest> <msg>"); process.exit(1); }
    const sess = await bind();
    wireMtHandlers(sess);
    sess.submit_sm({
      source_addr_ton: 1, source_addr_npi: 1, source_addr: sender,
      dest_addr_ton: 1, dest_addr_npi: 1, destination_addr: dest,
      short_message: { message: msg },
      registered_delivery: 0, data_coding: 0,
    }, (pdu) => {
      console.log(`[SIM] MO submit_sm_resp status=0x${pdu.command_status.toString(16)} message_id=${pdu.message_id}`);
      try { sess.close(); } catch {}
      setTimeout(() => process.exit(pdu.command_status === 0 ? 0 : 1), 200);
    });
    return;
  }

  if (mode === "dlr") {
    const msgId = process.argv[3], src = process.argv[4], dest = process.argv[5];
    if (!msgId || !src || !dest) { console.error("usage: sim-gateway.js dlr <msgId> <src> <dest>"); process.exit(1); }
    const sess = await bind();
    wireMtHandlers(sess);
    const now = new Date();
    const d = String(now.getTime()).slice(0, 10);
    sess.deliver_sm({
      source_addr: dest, destination_addr: src,
      short_message: { message: `id:${msgId} sub:001 dlvrd:001 submit date:${d} done date:${d} stat:DELIVRD err:000 text:DELIVRD` },
      esm_class: 4, registered_delivery: 0, data_coding: 0,
    }, (pdu) => {
      console.log(`[SIM] DLR deliver_sm_resp status=0x${pdu.command_status.toString(16)}`);
      try { sess.close(); } catch {}
      setTimeout(() => process.exit(pdu.command_status === 0 ? 0 : 1), 200);
    });
    return;
  }

  // Default: bind and stay (mode "bind" or none)
  const sess = await bind();
  wireMtHandlers(sess);
  console.log("[SIM] staying connected — send MT via the platform or Ctrl-C to exit");
}

main().catch((e) => { console.error(`[SIM] FATAL: ${e.message}`); process.exit(1); });
