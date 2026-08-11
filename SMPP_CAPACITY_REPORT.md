# SMPP Server Capacity Report

**Date:** August 2026
**Test:** Unthrottled SMPP submit_sm throughput (10 concurrent connections, fire-as-fast-as-possible, fixed duration). Fake destinations (`000000000000`) with **no route plan** → every PDU returned error 8 (no route) = **pure transport test, zero real endpoints touched**.

---

## 1. Hardware

| Server | IP | vCPU | CPU | RAM |
|---|---|---|---|---|
| Dev box | 15.235.35.125 | 16 | QEMU Virtual 2.5+ (shared) | 62 GB |
| France | 54.37.252.5 | 8 | Xeon E5-1620 v2 @ 3.70 GHz | 32 GB |
| Germany | 145.239.1.7 | 8 | Xeon D-1521 @ 2.40 GHz | 32 GB |
| Sydney | 139.99.148.65 | 8 | Xeon E3-1245 v5 @ 3.50 GHz | 32 GB |
| Origin | 149.56.22.232 | — | — | — |

> ⚠️ **Origin (149.56.22.232)** is unreachable from every other server on port 2775 (`No route to host` — OVH edge firewall). It cannot participate in the cross-server ring and was excluded from remote tests.

---

## 2. Loopback Results — pure server processing power
*(each server submits to its OWN SMSC on 127.0.0.1:2775 — isolates CPU from network)*

| Server | Max TPS | Avg latency | p95 | p99 | Verdict |
|---|---|---|---|---|---|
| **Sydney** | **4,859** | 59 ms | 70 ms | 86 ms | 🏆 Fastest |
| **France** | **3,301** | 87 ms | 101 ms | 115 ms | Excellent |
| **Germany** | **2,750** | 104 ms | 122 ms | 137 ms | Excellent |
| **Dev box** | **2,147** | 134 ms | 153 ms | 659 ms | Good (shared/virtual CPU) |

---

## 3. Cross-Server Results — ring, WAN-constrained
*(each server submits to its neighbor's SMSC — shows network+server combined)*

| Leg | Target | TPS | Avg latency | Note |
|---|---|---|---|---|
| dev → france | 54.37.252.5 | 1,243 | 233 ms | healthy |
| france → germany | 145.239.1.7 | 3,133 | 92 ms | healthy (near-zero WAN loss) |
| germany → sydney | 139.99.148.65 | **330** | **878 ms** | ⚠️ WAN distance, NOT server |
| sydney → dev | 15.235.35.125 | **531** | **544 ms** | ⚠️ WAN distance, NOT server |

**Key insight:** the "weak" Sydney legs are a **geography artifact**, not a server defect. Germany→Sydney is an ~880 ms round-trip WAN path; throughput is capped by latency × in-flight window. Sydney's own loopback is the **highest in the fleet (4,859 TPS)**.

---

## 4. Paced-load floor (from the 500k ring test)

Every server sustained **125 TPS per leg = 500 TPS aggregate for 17 minutes** with 0 errors and stable latency — this is the guaranteed floor for production routing, not a ceiling.

---

## 5. Aggregate capacity

| Scenario | Total TPS |
|---|---|
| 4 servers × loopback max (theoretical) | ~13,000 TPS |
| Ring cross-server (WAN-constrained) | ~5,200 TPS |
| Paced guaranteed floor (any mix) | 500+ TPS sustained |

---

## 6. Verdict

**No server needs replacement.** All four tested servers handle 2,100–4,900 TPS locally with clean latency, and CPU stayed at 1–13% with load < 1.1 during the test. The perceived weakness on the Sydney legs was intercontinental network latency, not hardware.

**One real gap to consider:** Origin's edge firewall blocks inbound SMPP from peer servers — if Origin should participate in the interconnect ring, that firewall rule needs opening.

---

## 7. Test artifacts

- `scripts/smpp-loop-setup.ts` — creates per-server test tenant + SMPP client
- `scripts/smpp-loop-loadgen.js` — paced load generator (token bucket)
- `scripts/smpp-capacity-test.js` — unthrottled max-TPS probe with latency stats
- Test tenants: `tenant_smpptest_{dev,france,germany,sydney}` (credential `smpptest_* / test1234`)
- Logs kept at `/tmp/loadgen-*.log`, `/tmp/cap-*.log`, `/tmp/loopback-*.log`
