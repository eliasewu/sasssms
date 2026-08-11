#!/usr/bin/env node
/**
 * smpp-loop-loadgen.js — SMPP interconnect load generator (test-only).
 *
 * Binds as an ESME to a target SMSC and submits `total` messages at a paced
 * rate of `tps` messages/second. Destination numbers are fake (000000000000)
 * and the client has no route plan, so the target SMSC answers every SUBMIT_SM
 * with a fast response and nothing is ever delivered to a real endpoint.
 *
 * Usage:
 *   node smpp-loop-loadgen.js <host> <port> <systemId> <password> <total> <tps> <tag>
 *
 * Output: one progress line every 5s + final JSON summary.
 */
const smpp = require("smpp");

const [host, port, systemId, password, totalStr, tpsStr, tag] = process.argv.slice(2);
const total = parseInt(totalStr, 10);
const tps = parseInt(tpsStr, 10);
const PACE_MS = 1000;

let sent = 0;
let ok = 0;
let failed = 0;
let errors = {};
let bound = false;
let startTime = 0;

function now() { return Date.now(); }

function submitOne(session) {
  const seq = ++sent;
  session.send(
    new smpp.PDU("submit_sm", {
      source_addr: "SMSPTEST",
      destination_addr: "000000000000",
      short_message: { message: `LOOPTEST ${seq} ${tag}` },
      registered_delivery: 1,
    }),
    (resp) => {
      if (resp.command_status === 0) ok++;
      else {
        failed++;
        const c = resp.command_status;
        errors[c] = (errors[c] || 0) + 1;
      }
    }
  );
}

function paceLoop(session) {
  // Fire `tps` messages per 1s window (simple token bucket)
  const bucket = { tokens: tps, last: now() };
  const tick = () => {
    const t = now();
    bucket.tokens = Math.min(tps, bucket.tokens + ((t - bucket.last) / PACE_MS) * tps);
    bucket.last = t;
    let fired = 0;
    while (bucket.tokens >= 1 && sent < total) {
      bucket.tokens -= 1;
      submitOne(session);
      fired++;
      if (sent >= total) break;
    }
    if (sent >= total && ok + failed >= total) {
      finish(session);
      return;
    }
    setTimeout(tick, 20);
  };
  tick();
}

function finish(session) {
  const elapsed = (now() - startTime) / 1000;
  const achieved = Math.round(total / elapsed);
  console.log(JSON.stringify({
    tag, target: `${host}:${port}`, systemId,
    sent, ok, failed, errors,
    elapsedSec: Math.round(elapsed),
    achievedTps: achieved,
    targetTps: tps,
    successRate: total ? Math.round((ok / total) * 10000) / 100 : 0,
  }));
  try { session.close(); } catch {}
  process.exit(0);
}

setInterval(() => {
  if (sent > 0 && sent < total) {
    const elapsed = (now() - startTime) / 1000;
    console.log(`[${tag}] sent=${sent}/${total} ok=${ok} failed=${failed} @ ${Math.round(sent / elapsed)} tps`);
  }
}, 5000);

const session = smpp.connect({ host, port, debug: false });
session.on("connect", () => {
  session.send(
    new smpp.PDU("bind_transceiver", { system_id: systemId, password, interface_version: 0x34 }),
    (resp) => {
      if (resp.command_status === 0) {
        bound = true;
        startTime = now();
        console.log(`[${tag}] BOUND to ${host}:${port} as ${systemId} — sending ${total} msgs @ ${tps} tps`);
        paceLoop(session);
      } else {
        console.log(JSON.stringify({ tag, bindFailed: true, commandStatus: resp.command_status, target: `${host}:${port}` }));
        try { session.close(); } catch {}
        process.exit(2);
      }
    }
  );
});
session.on("error", (e) => {
  console.log(JSON.stringify({ tag, connectionError: e.message, target: `${host}:${port}` }));
  try { session.close(); } catch {}
  process.exit(3);
});
session.on("close", () => {
  if (sent < total) {
    console.log(JSON.stringify({ tag, prematureClose: true, sent, ok, failed, target: `${host}:${port}` }));
    process.exit(4);
  }
});
