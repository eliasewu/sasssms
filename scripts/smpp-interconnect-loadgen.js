#!/usr/bin/env node
/**
 * smpp-interconnect-loadgen.js — cross-server interconnect load generator.
 *
 * Binds to a Net2APP server as its outbound test client (`itest_<tag>`),
 * submits `count` dummy SMS with registered_delivery=1, and waits for the
 * DELIVRD DLRs (deliver_sm esm_class=4) to come back — proving the full
 * chain: submit_sm forwarded to the NEXT server, and the DLR returned.
 *
 * Usage:
 *   node scripts/smpp-interconnect-loadgen.js <host> <port> <user> <pass> <tag> <count> <destBase>
 *
 * Exit codes: 0 = all submits accepted AND all DLRs received; 1 = partial/missing.
 */
const smpp = require("smpp");

const [host, port, user, pass, tag, countStr, destBase] = process.argv.slice(2);
const count = parseInt(countStr || "3", 10);
const base = destBase || "1555123456"; // fake E.164 base

if (!host || !port || !user || !pass || !tag) {
  console.error("usage: smpp-interconnect-loadgen.js <host> <port> <user> <pass> <tag> [count] [destBase]");
  process.exit(1);
}

let sent = 0;
let ok = 0;
let failed = 0;
const failures = [];
let dlrReceived = 0;
const dlrDetails = [];
let bound = false;
let startTime = 0;
let finished = false;

function now() { return Date.now(); }

function finish(code) {
  if (finished) return;
  finished = true;
  const elapsed = (now() - startTime) / 1000;
  console.log(JSON.stringify({
    tag, target: `${host}:${port}`, systemId: user,
    sent, ok, failed, dlrReceived,
    failures: failures.slice(0, 5),
    dlrDetails,
    elapsedSec: Math.round(elapsed * 10) / 10,
    result: (ok === count && dlrReceived === count) ? "PASS" : "FAIL",
  }));
  try { sess.close(); } catch {}
  process.exit(code);
}

const timeoutTimer = setTimeout(() => {
  console.log(`[${tag}] TIMEOUT waiting for DLRs (sent=${sent} ok=${ok} dlr=${dlrReceived}/${count})`);
  finish(ok === count && dlrReceived === count ? 0 : 1);
}, 25000);

const sess = smpp.connect({ host, port: parseInt(port, 10) });

sess.on("connect", () => {
  sess.send(
    new smpp.PDU("bind_transceiver", { system_id: user, password: pass, interface_version: 0x34 }),
    (resp) => {
      if (resp.command_status === 0) {
        bound = true;
        startTime = now();
        console.log(`[${tag}] ✅ BOUND to ${host}:${port} as ${user} — sending ${count} dummy SMS`);
        for (let i = 1; i <= count; i++) {
          const dest = base + String(i).padStart(3, "0");
          const content = `XCONN ${tag} ${i} ${now()}`;
          sess.send(new smpp.PDU("submit_sm", {
            source_addr: "XCONNTEST",
            destination_addr: dest,
            short_message: { message: content },
            registered_delivery: 1,
          }), (r) => {
            sent++;
            if (r.command_status === 0) {
              ok++;
              console.log(`[${tag}] ✅ submit_sm #${i} accepted → ${dest} (msgid=${r.message_id})`);
            } else {
              failed++;
              failures.push({ i, dest, status: r.command_status });
              console.log(`[${tag}] ❌ submit_sm #${i} rejected (status=${r.command_status}, ${dest})`);
            }
            if (sent === count) console.log(`[${tag}] All ${count} submitted (ok=${ok} failed=${failed}) — waiting for DLRs...`);
          });
        }
      } else {
        console.log(JSON.stringify({ tag, bindFailed: true, commandStatus: resp.command_status, target: `${host}:${port}` }));
        process.exit(2);
      }
    }
  );
});

// ── DLR reception (deliver_sm esm_class=4 from our SMSC) ──
sess.on("deliver_sm", (pdu) => {
  const esm = pdu.esm_class || 0;
  const isDlr = (esm & 0x04) !== 0;
  const text = typeof pdu.short_message === "string"
    ? pdu.short_message
    : (pdu.short_message && pdu.short_message.message) || "";
  if (!isDlr) {
    console.log(`[${tag}] (MO deliver_sm ignored: ${text.substring(0, 40)})`);
    return;
  }
  dlrReceived++;
  const stat = (text.match(/stat:(\S+)/) || [])[1] || "?";
  const id = (text.match(/id:(\S+)/) || [])[1] || "?";
  dlrDetails.push({ id, stat });
  console.log(`[${tag}] ✅ DLR #${dlrReceived}: ${text.substring(0, 90)}`);
  try { sess.send(pdu.response({ message_id: "" })); } catch {}
  if (dlrReceived >= count && ok === count) {
    clearTimeout(timeoutTimer);
    setTimeout(() => finish(0), 300); // brief settle
  }
});

sess.on("error", (e) => {
  console.error(`[${tag}] socket error: ${e.message}`);
  finish(3);
});
sess.on("close", () => {
  if (!finished) {
    console.log(`[${tag}] connection closed prematurely (sent=${sent} ok=${ok} dlr=${dlrReceived})`);
    finish(ok === count && dlrReceived === count ? 0 : 4);
  }
});
