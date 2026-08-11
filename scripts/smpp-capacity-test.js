#!/usr/bin/env node
/**
 * smpp-capacity-test.js — UNTHROTTLED SMPP capacity probe (test-only).
 *
 * Opens `conns` concurrent SMPP sessions to a target SMSC and fires
 * SUBMIT_SM as fast as the responses allow (in-flight window per connection),
 * for `durationSec` seconds. Measures:
 *   - achieved TPS (total / elapsed)
 *   - response latency (avg / p95 / p99 / max)
 *   - response status distribution
 *
 * Destinations are fake (000000000000) and the test client has no route plan,
 * so the target SMSC answers instantly and NOTHING reaches a real endpoint.
 *
 * Usage:
 *   node smpp-capacity-test.js <host> <port> <systemId> <password> <durationSec> <conns> <tag>
 *
 * Output: progress every 10s + final JSON summary.
 */
const smpp = require("smpp");

const [host, port, systemId, password, durStr, connsStr, tag] = process.argv.slice(2);
const durationSec = parseInt(durStr, 10) || 60;
const conns = parseInt(connsStr, 10) || 5;
const WINDOW = 30; // in-flight submits per connection

const startTime = Date.now();
const endTime = startTime + durationSec * 1000;
let sent = 0;
let ok = 0;
let failed = 0;
const errors = {};
const latencies = [];
let bound = 0;

function record() {
  const elapsed = (Date.now() - startTime) / 1000;
  const tps = elapsed > 0 ? Math.round(sent / elapsed) : 0;
  // Iterative max (Math.max spread blows the stack at 100k+ entries)
  let maxLat = 0;
  let sum = 0;
  for (const l of latencies) { if (l > maxLat) maxLat = l; sum += l; }
  const sorted = [...latencies].sort((a, b) => a - b);
  const pct = (p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
  return {
    tag, target: `${host}:${port}`, systemId, conns,
    sent, ok, failed, errors,
    elapsedSec: Math.round(elapsed),
    tps, avgLatencyMs: latencies.length ? Math.round((sum / latencies.length) * 10) / 10 : 0,
    p95LatencyMs: Math.round(pct(0.95) * 10) / 10,
    p99LatencyMs: Math.round(pct(0.99) * 10) / 10,
    maxLatencyMs: Math.round(maxLat * 10) / 10,
  };
}

setInterval(() => {
  if (Date.now() < endTime) console.log(`[${tag}] ${JSON.stringify(record())}`);
}, 10000);

function runConn() {
  const session = smpp.connect({ host, port, debug: false });
  session.on("connect", () => {
    session.send(
      new smpp.PDU("bind_transceiver", { system_id: systemId, password, interface_version: 0x34 }),
      (resp) => {
        if (resp.command_status !== 0) {
          console.log(JSON.stringify({ tag, bindFailed: resp.command_status, conn: "one of " + conns }));
          try { session.close(); } catch {}
          return;
        }
        bound++;

        let inFlight = 0;
        let seq = 0;

        const fire = () => {
          while (inFlight < WINDOW && Date.now() < endTime) {
            inFlight++;
            const t0 = Date.now();
            session.send(
              new smpp.PDU("submit_sm", {
                source_addr: "SMSPTEST",
                destination_addr: "000000000000",
                short_message: { message: `CAP ${tag} ${++seq}` },
                registered_delivery: 1,
              }),
              (r) => {
                inFlight--;
                latencies.push(Date.now() - t0);
                sent++;
                if (r.command_status === 0) ok++;
                else { failed++; errors[r.command_status] = (errors[r.command_status] || 0) + 1; }
                if (Date.now() < endTime) fire();
              }
            );
          }
        };
        fire();
      }
    );
  });
  session.on("error", (e) => console.log(JSON.stringify({ tag, connError: e.message })));
  session.on("close", () => {});
}

for (let i = 0; i < conns; i++) runConn();

const doneTimer = setInterval(() => {
  if (Date.now() >= endTime || bound === 0 && Date.now() > startTime + 10000) {
    clearInterval(doneTimer);
    // give in-flight responses a moment to land
    setTimeout(() => {
      console.log(`[${tag}] FINAL ${JSON.stringify(record())}`);
      process.exit(0);
    }, 2000);
  }
}, 500);
