# Net2APP Telecom Platform: High-Throughput Voice & Messaging Architecture

> **Document Version:** 2.0 — Telecom Operations Edition  
> **Last Updated:** July 2026  
> **Target Audience:** Network Engineers, Systems Administrators, Integration Developers  

---

## Table of Contents

1. [A2P Messaging Architecture](#1-a2p-messaging-architecture)
2. [SMPP v3.4 Session Configuration](#2-smpp-v34-session-configuration)
3. [Real-Time DLR Tracking](#3-real-time-dlr-tracking)
4. [Single-Server RTP Media Relay Optimization](#4-single-server-rtp-media-relay-optimization)
5. [RTP Engine Installation & Tuning](#5-rtp-engine-installation--tuning)
6. [SIP/TLS Security Integration](#6-siptls-security-integration)
7. [VOS3000 Softswitch Backend Integration](#7-vos3000-softswitch-backend-integration)
8. [Preventing RTP Cloning & Injection Attacks](#8-preventing-rtp-cloning--injection-attacks)
9. [Firewall & Network Configuration](#9-firewall--network-configuration)
10. [Systemd Service Configuration](#10-systemd-service-configuration)
11. [Monitoring & Performance Tuning](#11-monitoring--performance-tuning)
12. [Troubleshooting & FAQ](#12-troubleshooting--faq)

---

## 1. A2P Messaging Architecture

### Overview

Net2APP's A2P (Application-to-Person) messaging engine routes SMS traffic through a **4-layer topology** with real-time delivery receipt tracking. The platform supports SMPP v3.4, HTTP REST API, and OTT (WhatsApp/Telegram) as transport protocols.

### Message Flow (SMPP)

```text
Client ESME                  Net2APP SMPP Gateway              Supplier SMSC
     │                                │                              │
     │── bind_transceiver ──────────►│                              │
     │   system_id: client_smpp_user │                              │
     │   password:  client_smpp_pass │── bind_transmitter ─────────►│
     │                                │   system_id: supplier_user   │
     │◄── bind_resp (0x00) ────────│◄── bind_resp (0x00) ────────│
     │                                │                              │
     │── submit_sm ─────────────────►│                              │
     │   source_addr: "YourBrand"    │── submit_sm ────────────────►│
     │   dest_addr:   "88016xxxxxx"  │   source_addr: "YourBrand"   │
     │   short_message: "OTP 246801" │   dest_addr:   "88016xxxxxx" │
     │   registered_delivery: 1      │   short_message: "OTP 246801"│
     │                                │   registered_delivery: 1     │
     │◄── submit_sm_resp ──────────│◄── submit_sm_resp ──────────│
     │   message_id: "abc123"        │   message_id: "xyz789"        │
     │                                │                              │
     │                                │◄── deliver_sm (DLR) ────────│
     │◄── deliver_sm (DLR) ────────│   message_id: "xyz789"        │
     │   esm_class: 0x04             │   stat: DELIVRD              │
     │   message_state: 2            │   err: 000                   │
     │   receipted_message_id: abc123│   text: "delivered"           │
```

### Routing Resolution

```text
Client HTTP/SMPP Request
          │
          ▼
    ┌─────────────┐
    │  Auth Layer  │  JWT cookie or x-api-key → client identity
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ TPS Limiter  │  Sliding window: per-tenant + per-client (1s buckets)
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ Translation  │  Client-level number/content/SID rewriting
    └──────┬──────┘
           │
           ▼
    ┌─────────────────────────────────────────────────┐
    │             4-Layer Routing Engine               │
    │                                                  │
    │  Route Plan ──► Routes (priority) ──► Trunks ──► Suppliers
    │       │               │                  │           │
    │       │               │                  │      SMPP bind
    │       │          MCC/MNC filter     capacity     HTTP POST
    │       │          failover order     limit        VOICE_OTP
    │       │               │                  │           │
    │       └───────────────┴──────────────────┘           │
    └─────────────────────────────────────────────────────┘
           │
           ▼
    ┌─────────────┐
    │   Delivery   │  connectToSupplier() → deliverSmsWithFallback()
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  DLR Hook    │  registerDlrCallback() → pushDlrToClient()
    └─────────────┘
```

---

## 2. SMPP v3.4 Session Configuration

### SMPP Bind Parameters

| Parameter | Default | Description |
|---|---|---|
| `host` | (required) | Supplier SMSC IP or hostname |
| `port` | `2775` | Standard SMPP port |
| `system_id` | (required) | ESME account username |
| `password` | (required) | ESME account password |
| `system_type` | `"SMPP"` | Protocol identifier |
| `bind_mode` | `"TRX"` | TX (transmitter), RX (receiver), TRX (transceiver) |
| `addr_ton` | `0` | Type of Number: 0=unknown, 1=intl, 2=national, 5=alphanumeric |
| `addr_npi` | `0` | Numbering Plan: 0=unknown, 1=ISDN/E.164 |
| `source_ton` | `5` | Source TON: 5=alphanumeric for branded sender IDs |
| `source_npi` | `0` | Source NPI |
| `dest_ton` | `1` | Destination TON: 1=international |
| `dest_npi` | `1` | Destination NPI: 1=ISDN/E.164 |
| `enquire_link_interval` | `30` | Seconds between keep-alive enquire_link packets |
| `response_timeout` | `10` | Seconds before bind/submit_sm times out |
| `reconnect_interval` | `5` | Seconds before reconnection attempt after disconnect |
| `max_retries` | `3` | Max reconnection attempts before marking UNBOUND |
| `tps` | `100` | Throttle: max messages per second to this supplier |
| `window_size` | `10` | Max unacknowledged submit_sm before throttling |
| `force_dlr` | `false` | Require DLR; messages without DLR won't be billed (DLR-mode) |
| `dlr_poll_enabled` | `false` | Enable polling for suppliers that don't push DLRs |
| `dlr_poll_url` | `""` | Endpoint to query for DLR status |
| `dlr_poll_interval` | `30` | Seconds between DLR poll requests |
| `dlr_poll_method` | `"GET"` | HTTP method for DLR polling |

### SMPP Bind Validation Script

```bash
#!/bin/bash
# smpp-bind-test.sh — Validate SMPP connectivity to a supplier SMSC

HOST="${1:-127.0.0.1}"
PORT="${2:-2775}"
SYSTEM_ID="${3:-testuser}"
PASSWORD="${4:-testpass}"

echo "Testing SMPP bind to $HOST:$PORT as $SYSTEM_ID"

# Using netcat for raw SMPP socket test
timeout 5 bash -c "echo -n '' | nc -w 3 $HOST $PORT" && \
  echo "✓ TCP connection successful" || \
  echo "✗ TCP connection FAILED"

# Use the platform's test script for full bind validation
npx tsx test-smpp-raw-bind.ts
```

### SMPP Connection Monitoring

```typescript
// src/lib/smpp-client.ts — Bind event lifecycle
session.on("connect", () => {
  console.log(`[SMPP] Connected to ${host}:${port}`);
  updateBindStatus(supplierId, "CONNECTING");
});

session.on("error", (err: Error) => {
  console.error(`[SMPP] ${host}:${port} error: ${err.message}`);
  updateBindStatus(supplierId, "UNBOUND");
  scheduleReconnect(supplierId, host, port, config);
});

session.on("close", () => {
  console.warn(`[SMPP] ${host}:${port} closed`);
  updateBindStatus(supplierId, "UNBOUND");
  scheduleReconnect(supplierId, host, port, config);
});
```

---

## 3. Real-Time DLR Tracking

### DLR Status Lifecycle

```text
     ┌─────────┐
     │ QUEUED  │  Message accepted, awaiting delivery attempt
     └────┬────┘
          │
          ▼
     ┌─────────┐
     │  SENT   │  Message transmitted to supplier SMSC
     └────┬────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌─────────┐ ┌─────────┐
│ PENDING │ │ FAILED  │  Supplier accepted but DLR not yet received
└────┬────┘ └─────────┘
     │
     ▼
┌───────────┐
│ DELIVERED │  DLR received with stat:DELIVRD
└───────────┘
```

### SMPP DLR Message Format

```text
id:{message_id} sub:001 dlvrd:{delivered_count}
submit date:{YYYYMMDD} done date:{YYYYMMDD}
stat:{DELIVRD|UNDELIV|EXPIRED|REJECTD}
err:{error_code} text:{description}
```

### DLR Status Codes (SMPP v3.4)

| `stat` Value | Meaning | Billing Impact |
|---|---|---|
| `DELIVRD` | Delivered to handset | Chargeable |
| `UNDELIV` | Undeliverable | Not chargeable (DLR-mode) |
| `EXPIRED` | Message validity expired | Not chargeable |
| `REJECTD` | Rejected by SMSC | Not chargeable |
| `DELETED` | Deleted by SMSC | Not chargeable |
| `UNKNOWN` | Status unknown | Not chargeable |
| `ACCEPTD` | Accepted by SMSC (intermediate) | Pending |

### HTTP DLR Payload (JSON Webhook)

```json
{
  "message_id": "MSG_1751234567890_a1b2c3d4",
  "destination": "+8801615069178",
  "source": "YourBrand",
  "status": "DELIVERED",
  "cost": 0.00010,
  "timestamp": "2026-07-25T12:34:56.789Z",
  "route_name": "Primary Bangladesh Route",
  "supplier_name": "GP Direct SMSC",
  "operator_mcc": "470",
  "operator_mnc": "01",
  "connection_type": "SMPP",
  "dlr_latency_ms": 1234
}
```

### DLR Webhook Delivery

```text
Net2APP Server                         Client Webhook Endpoint
     │                                         │
     │── POST {dlr_callback_url} ────────────►│
     │   Content-Type: application/json        │
     │   Body: { message_id, status, ... }     │
     │   Timeout: 10s                          │
     │                                         │
     │◄── 200 OK ─────────────────────────────│  ✓ DLR acknowledged
     │                                         │
     │── POST {dlr_callback_url} ────────────►│
     │                                         │
     │◄── 500 / timeout ──────────────────────│  ✗ Retry: up to 3 attempts
     │                                         │     with exponential backoff
```

### DLR Polling (Suppliers Without Push)

```text
┌─────────────────────────────────────────┐
│         DLR Poller (cron: 30s)          │
│                                          │
│  For each supplier with dlr_poll_url:   │
│    │                                      │
│    ▼                                      │
│  HTTP GET → {dlr_poll_url}?ids=msg1,msg2  │
│    │                                      │
│    ▼                                      │
│  Parse response → update message DLR      │
│    │                                      │
│    ▼                                      │
│  Push DLR to client webhook              │
└─────────────────────────────────────────┘
```

---

## 4. Single-Server RTP Media Relay Optimization

### Capacity Planning

A single server can handle RTP media relay at different scales depending on configuration:

| Mode | Concurrent Calls | Required Bandwidth | CPU | Notes |
|---|---|---|---|---|
| **SIP Signaling Only** (bypass media) | 20,000–50,000+ | <1 Mbps (SIP only) | Low | Kamailio/OpenSIPS in stateless mode |
| **RTP Proxy** (no transcoding) | 1,500–3,000 | ~252 Mbps (1 Gbps NIC) | Low–Medium | rtpengine kernel forwarding |
| **RTP Proxy** (10 Gbps) | 10,000–15,000+ | ~1.26 Gbps (10 Gbps NIC) | Low–Medium | rtpengine + multi-queue NIC |
| **RTP Transcoding** (G.729 ↔ G.711) | 500–2,000 | ~168 Mbps | High | CPU-bound DSP operations |

### RTP Bandwidth Formula

```text
Bandwidth per G.711 call = 64 kbps (payload) + 20 kbps (IP/UDP/RTP headers)
                         ≈ 84 kbps per direction
                         ≈ 168 kbps bidirectional

Total Bandwidth = Concurrent Calls × 168 kbps

Examples:
  500 calls  →   84 Mbps   (1 Gbps NIC sufficient)
  1,000 calls →  168 Mbps   (1 Gbps NIC sufficient)
  5,000 calls →  840 Mbps   (10 Gbps NIC recommended)
  10,000 calls → 1.68 Gbps  (10 Gbps NIC + multi-queue)
```

### RTP Port Range Planning

```text
Each call requires 2 RTP ports (one per direction).
Recommended port range: 10000–60000 (50,000 ports → 25,000 max concurrent calls)

rtpengine configuration:
  port-min = 10000
  port-max = 60000

Firewall rules:
  udp/10000-60000  (RTP media)
  udp/5060         (SIP signaling)
  tcp/5061         (SIPS/TLS signaling)
```

---

## 5. RTP Engine Installation & Tuning

### Installation (Ubuntu 24.04)

```bash
# Install rtpengine from NGCP repository
apt-get update
apt-get install -y ngcp-rtpengine-daemon ngcp-rtpengine-iptables \
                   ngcp-rtpengine-kernel-dkms ngcp-rtpengine-recording-daemon

# Verify kernel module loaded
lsmod | grep xt_RTPENGINE

# If not loaded:
modprobe xt_RTPENGINE

# Check version
rtpengine --version
```

### rtpengine Configuration

```text
# /etc/rtpengine/rtpengine.conf

[rtpengine]
# Listening addresses
listen-ng = 127.0.0.1:22222          # Control interface (ng protocol)
listen-udp = 0.0.0.0:10000-60000     # RTP media port range
listen-cli = 127.0.0.1:9900          # CLI management

# Kernel forwarding
table = 0                             # Kernel forwarding table ID

# Performance tuning
num-threads = 4                       # Match CPU core count
tos = 184                             # DSCP EF (Expedited Forwarding)
delete-delay = 30                     # Seconds before cleaning up expired sessions
max-sessions = 25000                  # Max concurrent RTP sessions

# Logging
log-level = 6                         # 6=notice, 7=info (debug)
log-facility = daemon
log-facility-cdr = local0

# Security
dtls-passive = true
dtls-cert = /etc/rtpengine/cert.pem
dtls-key = /etc/rtpengine/key.pem

# Recording (optional)
recording-dir = /var/recordings/rtp
recording-method = proc
recording-format = raw
```

### Kernel-Level RTP Forwarding (xt_RTPENGINE)

```bash
# Verify kernel module
lsmod | grep xt_RTPENGINE

# If module is loaded, rtpengine bypasses userspace for media forwarding.
# Packets are handled directly in kernel space → near line-rate throughput.

# Check forwarding table
rtpengine-ctl list tables

# Monitor kernel statistics
cat /proc/rtpengine/0/stats

# Expected output:
#   total_packets: 184729347
#   kernel_packets: 184729347    ← 100% kernel-forwarded = optimal
#   userspace_packets: 0
```

### sysctl Network Tuning

```bash
# /etc/sysctl.d/99-rtpengine.conf

# Increase UDP buffer sizes (critical for RTP performance)
net.core.rmem_max = 134217728        # 128 MB max receive buffer
net.core.wmem_max = 134217728        # 128 MB max send buffer
net.core.rmem_default = 16777216     # 16 MB default receive
net.core.wmem_default = 16777216     # 16 MB default send

# Increase network backlog
net.core.netdev_max_backlog = 50000
net.core.somaxconn = 65535

# Optimize for high PPS (packets per second)
net.core.busy_read = 50
net.core.busy_poll = 50

# UDP-specific tuning
net.ipv4.udp_mem = 16777216 16777216 33554432
net.ipv4.udp_rmem_min = 16384
net.ipv4.udp_wmem_min = 16384

# Disable TCP timestamps (reduce CPU on non-RTP interfaces)
net.ipv4.tcp_timestamps = 0

# Apply
sysctl --system
```

### NIC Tuning (Multi-Queue)

```bash
# Check current queue configuration
ethtool -l eth0

# Set combined queues to match CPU cores
ethtool -L eth0 combined 4

# Set IRQ affinity (pin queues to specific CPU cores)
# Queue 0 → CPU 0, Queue 1 → CPU 1, etc.
echo 1 > /proc/irq/$(grep "eth0-tx-0" /proc/interrupts | awk -F: '{print $1}')/smp_affinity
echo 2 > /proc/irq/$(grep "eth0-tx-1" /proc/interrupts | awk -F: '{print $1}')/smp_affinity
echo 4 > /proc/irq/$(grep "eth0-tx-2" /proc/interrupts | awk -F: '{print $1}')/smp_affinity
echo 8 > /proc/irq/$(grep "eth0-tx-3" /proc/interrupts | awk -F: '{print $1}')/smp_affinity

# Verify
cat /proc/interrupts | grep eth0
```

---

## 6. SIP/TLS Security Integration

### SIP Call Flow: Signaling vs. Media

```text
  Caller (Party A)                 SIP Proxy / Net2APP              Callee (Party B)
       │                                  │                              │
       │── 1. SIP INVITE (SDP) ────────►│                              │
       │   From: +88016xxxxxx            │── 2. SIP INVITE (SDP) ─────►│
       │   To: +88017xxxxxx              │   (Media IP:Port in SDP)    │
       │   Media: 192.168.1.10:10000     │                              │
       │                                  │◄── 3. 180 Ringing ─────────│
       │◄── 4. 180 Ringing ────────────│                              │
       │                                  │◄── 5. 200 OK (SDP) ───────│
       │◄── 6. 200 OK (SDP) ──────────│   Media: 10.0.0.5:20000      │
       │   Callee media: 10.0.0.5:20000  │                              │
       │── 7. ACK ─────────────────────►│── 8. ACK ──────────────────►│
       │                                  │                              │
       │════════════ 9. RTP Audio (UDP) ═══════════════════════════════│
       │   [Direct media or via rtpengine relay]                       │
       │                                  │                              │
       │── 10. BYE ─────────────────────►│── 11. BYE ─────────────────►│
       │◄── 12. 200 OK ────────────────│◄── 13. 200 OK ─────────────│
```

### SIPS (SIP over TLS) Configuration

```text
# VOS3000 / Softswitch SIP TLS settings

[sip_tls]
enabled = true
port = 5061
cert_file = /etc/ssl/certs/sip-server.crt
key_file = /etc/ssl/private/sip-server.key
ca_file = /etc/ssl/certs/ca-bundle.crt

# Cipher suite (strong only)
ciphers = ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256

# TLS version
tls_min_version = 1.2
tls_max_version = 1.3

# Mutual TLS (optional — client certificate verification)
verify_client = false
```

### SRTP (Secure RTP) Configuration

```text
# rtpengine SRTP settings

# Offer SRTP with fallback to RTP
srtp-interface = internal
srtp-interface = external

# SDES key exchange (keys in SDP body — requires SIPS/TLS)
sdes-offered = AES_CM_128_HMAC_SHA1_80 AES_CM_128_HMAC_SHA1_32
sdes-accepted = AES_CM_128_HMAC_SHA1_80

# DTLS-SRTP (preferred — keys exchanged via DTLS handshake)
dtls-passive = true
dtls-cert = /etc/rtpengine/cert.pem
dtls-key = /etc/rtpengine/key.pem
```

### SRTP Key Exchange Methods

```text
Method 1: SDES (Session Description Protocol Security Descriptions)
  └── Keys transmitted inside SDP body
  └── REQUIRES SIPS (SIP over TLS) — otherwise keys are plaintext
  └── Supported by most legacy endpoints

Method 2: DTLS-SRTP (Datagram TLS for SRTP)
  └── Keys exchanged via DTLS handshake over media path
  └── Independently secure from SIP signaling
  └── Preferred for modern deployments
  └── Supported by WebRTC, modern softphones, rtpengine

Method 3: ZRTP (Zimmermann RTP)
  └── Diffie-Hellman key exchange over media channel
  └── No reliance on SIP server for key management
  └── End-to-end encrypted without trusting intermediate proxies
```

### Encrypted Call Flow (SIPS + SRTP + DTLS)

```text
  Caller (Party A)              Net2APP / VOS3000              Callee (Party B)
       │                              │                              │
       │═══ SIPS INVITE (TLS) ═══════►═══════ SIPS INVITE (TLS) ═══►│
       │   [Encrypted SDP body]       │   [Encrypted SDP body]       │
       │   a=crypto: AES_CM_128       │   a=crypto: AES_CM_128       │
       │   a=fingerprint: SHA-256     │   a=fingerprint: SHA-256     │
       │                              │                              │
       │◄══════ 200 OK (TLS) ════════◄═══════ 200 OK (TLS) ════════│
       │   [Encrypted SDP answer]     │   [Encrypted SDP answer]     │
       │                              │                              │
       │════ DTLS Handshake ════════════════════════════════════════│
       │   [ClientHello, ServerHello, Certificate, Finished]        │
       │   [SRTP master key derived from DTLS-SRTP keying material]  │
       │                              │                              │
       │══════ SRTP Audio ══════════════════════════════════════════│
       │   [Encrypted payload + HMAC-SHA1 authentication tag]       │
       │   [Every packet: ciphertext || auth_tag]                   │
       │                              │                              │
       │                              │                              │
       │    ═══ Forged SRTP Packet ═════════════════════════════════►│
       │    [Sent by on-path attacker]│                              │
       │    [Lacks valid HMAC tag]    │                              │
       │                              │                         ✗ DROPPED
       │                              │    HMAC validation fails      │
```

---

## 7. VOS3000 Softswitch Backend Integration

### VOS3000 ↔ Net2APP Integration Architecture

```text
                    ┌─────────────────────┐
                    │      Net2APP         │
                    │  (SMS/Voice Platform)│
                    └──────────┬──────────┘
                               │ SMPP v3.4
                               │ HTTP API
                               │
                    ┌──────────▼──────────┐
                    │     VOS3000          │
                    │   Softswitch         │
                    │                      │
                    │  ┌────────────────┐  │
                    │  │  SIP Registrar  │  │
                    │  │  Call Routing   │  │
                    │  │  Billing (CDR)  │  │
                    │  │  Rate Management│  │
                    │  └────────────────┘  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │     RTP Engine       │
                    │  (Media Relay)       │
                    │                      │
                    │  ┌────────────────┐  │
                    │  │ Kernel Forward  │  │
                    │  │ SRTP Encrypt    │  │
                    │  │ NAT Traversal   │  │
                    │  └────────────────┘  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   SIP Trunks /       │
                    │   Carrier Gateways   │
                    │   (PSTN/Mobile)      │
                    └─────────────────────┘
```

### VOS3000 API Integration Points

```bash
# 1. SMPP Bind — Net2APP as ESME connecting to VOS3000's built-in SMPP server
# VOS3000 side: configure ESME account in VOS3000 admin panel
# Net2APP side: add VOS3000 as a supplier with connection_type=SMPP

# 2. CDR Import — Pull VOS3000 call records into Net2APP billing
curl -X POST https://vos3000.example.com/api/cdr/query \
  -H "Authorization: Bearer {api_token}" \
  -d '{"start_time": "2026-07-25T00:00:00Z", "end_time": "2026-07-25T23:59:59Z"}'

# 3. Rate Sync — Push per-client rates to VOS3000
curl -X POST https://vos3000.example.com/api/rate/update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {api_token}" \
  -d '{"prefix": "88016", "rate": 0.00010, "currency": "USD"}'
```

### VOS3000 SIP Configuration (for Net2APP Voice OTP)

```text
# vos3000.conf — SIP endpoint for Net2APP Asterisk AMI

[sip_net2app]
type = peer
host = 127.0.0.1
port = 5060
context = voice-otp
disallow = all
allow = alaw
allow = ulaw
allow = g729
dtmfmode = rfc2833
canreinvite = no
nat = force_rport,comedia
qualify = yes
qualifyfreq = 30
encryption = yes
srtp_crypto = AES_CM_128_HMAC_SHA1_80
transport = tls
```

---

## 8. Preventing RTP Cloning & Injection Attacks

### Threat Model

```text
                            ┌──────────────┐
                            │  Attacker     │
                            │  (on-path)    │
                            └──────┬───────┘
                                   │
                    Sniffs unencrypted SIP SDP
                    extracts: IP, port, SSRC, codec
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
    │ Audio Inject  │    │ Media Hijack  │    │ Eavesdrop     │
    │ Forged RTP    │    │ Redirect RTP  │    │ Sniff plain   │
    │ packets with  │    │ via SIP       │    │ RTP payloads  │
    │ matching SSRC │    │ re-INVITE     │    │ → reconstruct │
    │ + seq numbers │    │               │    │   audio       │
    └──────────────┘    └──────────────┘    └──────────────┘
```

### Attack: Unencrypted RTP Injection

```text
  Caller (Party A)              On-Path Attacker              Callee (Party B)
       │                              │                              │
       │═══ Unencrypted SIP SDP ═══════════════════════════════════►│
       │   c=IN IP4 192.168.1.10     │  Attacker observes:          │
       │   m=audio 10000 RTP/AVP 0   │  - Target IP: 10.0.0.5       │
       │   a=ssrc:0x12345678         │  - UDP port: 20000            │
       │                              │  - SSRC: 0x12345678           │
       │                              │  - Codec: G.711 (PCMU)       │
       │                              │                              │
       │═══ RTP Packets ══════════════╪══════════════════════════════►│
       │   Seq: 100, TS: 160          │                              │
       │   Seq: 101, TS: 320          │                              │
       │                              │                              │
       │                              │═══ Forged RTP ═════════════►│
       │                              │   SSRC: 0x12345678  ← match  │
       │                              │   Seq: 102          ← next   │
       │                              │   TS: 480           ← valid  │
       │                              │   Payload: [INJECTED AUDIO]  │
       │                              │                              │
       │                              │   ✓ Callee accepts forged    │
       │                              │   audio: crystal clear G.711 │
       │                              │   No distortion, no static   │
```

### Defense: SRTP Authentication

```text
  Caller (Party A)              On-Path Attacker              Callee (Party B)
       │                              │                              │
       │═══ SRTP Packets ═════════════╪══════════════════════════════►│
       │   [Encrypted payload]        │                              │
       │   [HMAC-SHA1 auth tag]       │                              │
       │                              │                              │
       │                              │═══ Forged SRTP ════════════►│
       │                              │   SSRC: 0x12345678           │
       │                              │   Seq: 102                   │
       │                              │   [Fake encrypted payload]   │
       │                              │   [WRONG HMAC tag]           │
       │                              │                              │
       │                              │         ✗ PACKET DROPPED    │
       │                              │    HMAC-SHA1 verification    │
       │                              │    fails at Callee B.        │
       │                              │    No audio played.          │
       │                              │    Call continues normally.  │
```

### Why Injected Audio Is Crystal Clear (Without SRTP)

```text
The audio quality of injected RTP depends ONLY on the codec, not the source:

1. G.711 (PCMU/PCMA): 64 kbps, 8 kHz sample rate
   → Injected audio: Landline-quality, indistinguishable from real caller

2. G.722 (HD Voice): 64 kbps, 16 kHz sample rate
   → Injected audio: HD voice quality

3. Opus: Variable bitrate, 8-48 kHz
   → Injected audio: Full-bandwidth audio

The receiving phone processes the PCM samples identically regardless
of whether they came from Party A or an injector. Without
cryptographic authentication (SRTP), there is NO way for the
endpoint to distinguish legitimate from injected packets.
```

### Complete Security Checklist

```text
┌──────────────────────────────────────────────────────────────────┐
│  VoIP Security Hardening Checklist                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  □ Enable SIPS (SIP over TLS) on port 5061                       │
│    └── Prevents SDP sniffing and SRTP key theft                   │
│                                                                   │
│  □ Enable SRTP with AES_CM_128_HMAC_SHA1_80                      │
│    └── Authenticates every RTP packet                             │
│    └── Rejects forged/injected packets silently                   │
│                                                                   │
│  □ Prefer DTLS-SRTP over SDES                                    │
│    └── Keys never appear in SDP body                              │
│    └── Survives compromised SIP proxies                           │
│                                                                   │
│  □ Isolate Voice VLAN from data network                          │
│    └── Prevents ARP spoofing and L2 attacks                       │
│                                                                   │
│  □ Enable port security on switches                              │
│    └── Prevents unauthorized device connections                   │
│                                                                   │
│  □ Enable Dynamic ARP Inspection (DAI)                           │
│    └── Prevents ARP cache poisoning on voice VLAN                 │
│                                                                   │
│  □ Disable unnecessary codecs (only allow G.711 + G.729)         │
│    └── Reduces attack surface                                     │
│                                                                   │
│  □ Rate-limit SIP REGISTER and INVITE per IP                     │
│    └── Prevents SIP brute-force and flood attacks                 │
│                                                                   │
│  □ Enable SIP authentication (digest) for all endpoints          │
│    └── Prevents unauthorized call origination                     │
│                                                                   │
│  □ Monitor RTP stream SSRC changes (anomaly detection)           │
│    └── Unexpected SSRC change = potential hijack attempt          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9. Firewall & Network Configuration

### UFW Rules (Ubuntu)

```bash
#!/bin/bash
# firewall-setup.sh — Net2APP + VoIP firewall rules

# Default policies
ufw default deny incoming
ufw default allow outgoing

# SSH (management)
ufw allow 22/tcp

# Web (Nginx)
ufw allow 80/tcp
ufw allow 443/tcp

# SMPP (SMS gateway)
ufw allow from 10.0.0.0/8 to any port 2775      # Internal SMPP clients
ufw allow from {supplier_ip_1} to any port 2775  # Supplier SMSC 1
ufw allow from {supplier_ip_2} to any port 2775  # Supplier SMSC 2

# SIP
ufw allow 5060/udp                                # SIP signaling
ufw allow 5061/tcp                                # SIPS/TLS signaling

# RTP media (rtpengine)
ufw allow 10000:60000/udp                         # RTP port range

# Asterisk AMI (Voice OTP)
ufw allow from 127.0.0.1 to any port 5038         # AMI (local only)

# PostgreSQL
ufw allow from 127.0.0.1 to any port 5432         # DB (local only)

# Enable firewall
ufw --force enable
ufw status verbose
```

### iptables Rate Limiting (SIP Flood Prevention)

```bash
#!/bin/bash
# sip-rate-limit.sh — Protect against SIP brute-force

# Limit SIP REGISTER to 10/minute per IP
iptables -A INPUT -p udp --dport 5060 -m string --string "REGISTER" --algo bm \
  -m recent --set --name sip_register
iptables -A INPUT -p udp --dport 5060 -m string --string "REGISTER" --algo bm \
  -m recent --update --seconds 60 --hitcount 10 --name sip_register \
  -j DROP

# Limit SIP INVITE to 30/minute per IP
iptables -A INPUT -p udp --dport 5060 -m string --string "INVITE" --algo bm \
  -m recent --set --name sip_invite
iptables -A INPUT -p udp --dport 5060 -m string --string "INVITE" --algo bm \
  -m recent --update --seconds 60 --hitcount 30 --name sip_invite \
  -j DROP

# Save rules
iptables-save > /etc/iptables/rules.v4
```

---

## 10. Systemd Service Configuration

### rtpengine Service

```ini
# /etc/systemd/system/rtpengine.service

[Unit]
Description=RTP Engine — High-performance media relay
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
ExecStart=/usr/sbin/rtpengine --config-file /etc/rtpengine/rtpengine.conf
ExecReload=/bin/kill -HUP $MAINPID
ExecStop=/bin/kill -TERM $MAINPID
PIDFile=/run/rtpengine/rtpengine.pid

# Performance tuning
LimitNOFILE=65536
LimitNPROC=32768
CPUSchedulingPolicy=fifo
CPUSchedulingPriority=90
Nice=-20

# Restart policy
Restart=always
RestartSec=5

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/run/rtpengine /var/recordings/rtp
PrivateTmp=yes
PrivateDevices=no
CapabilityBoundingSet=CAP_NET_RAW CAP_NET_ADMIN CAP_SYS_NICE

[Install]
WantedBy=multi-user.target
```

### Net2APP Next.js Service

```ini
# /etc/systemd/system/net2app.service
# (Alternative to PM2 for system-level management)

[Unit]
Description=Net2APP SMS Gateway Platform
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=net2app
Group=net2app
WorkingDirectory=/opt/net2app
ExecStart=/usr/bin/node /opt/net2app/node_modules/.bin/next start -p 5555
Restart=always
RestartSec=10

# Environment
Environment=NODE_ENV=production
EnvironmentFile=/opt/net2app/.env

# Performance
LimitNOFILE=65536
LimitNPROC=32768

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=net2app

[Install]
WantedBy=multi-user.target
```

### VOS3000 Softswitch Service

```ini
# /etc/systemd/system/vos3000.service

[Unit]
Description=VOS3000 Softswitch
After=network.target rtpengine.service
Requires=rtpengine.service

[Service]
Type=forking
ExecStart=/usr/local/vos3000/bin/vos3000d start
ExecStop=/usr/local/vos3000/bin/vos3000d stop
ExecReload=/usr/local/vos3000/bin/vos3000d restart
PIDFile=/var/run/vos3000.pid

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Enable All Services

```bash
systemctl daemon-reload

systemctl enable postgresql
systemctl enable rtpengine
systemctl enable net2app
systemctl enable vos3000

systemctl start rtpengine
systemctl start net2app
systemctl start vos3000

# Verify
systemctl status rtpengine net2app vos3000
```

---

## 11. Monitoring & Performance Tuning

### RTP Stream Health Monitoring

```bash
#!/bin/bash
# rtp-monitor.sh — Monitor RTP engine metrics

echo "=== RTP Engine Status ==="
rtpengine-ctl list totals 2>/dev/null || echo "rtpengine-ctl not available"

echo ""
echo "=== Active Sessions ==="
rtpengine-ctl list sessions 2>/dev/null | grep -c "^Session"

echo ""
echo "=== Kernel Forwarding Stats ==="
cat /proc/rtpengine/0/stats 2>/dev/null | head -10

echo ""
echo "=== UDP Socket Buffer Usage ==="
ss -u -a state established | wc -l
echo "active UDP connections"

echo ""
echo "=== Packet Drops ==="
netstat -su | grep -i "packet receive errors\|receive buffer errors"
```

### SMPP Session Monitoring

```bash
#!/bin/bash
# smpp-monitor.sh — Monitor SMPP bind health

echo "=== SMPP Bind Status ==="
# Query all tenant schemas for supplier bind status
psql $DATABASE_URL << 'SQL'
SELECT t.company_name, t.schema_name,
       s.name AS supplier, s.connection_type,
       s.bind_status, s.host, s.port
FROM tenants t
JOIN LATERAL (
  SELECT * FROM dblink('dbname=' || current_database(),
    format('SELECT name, connection_type, bind_status, config->>''host'' AS host, config->>''port'' AS port FROM %I.suppliers WHERE is_active = true', t.schema_name)
  ) AS s(name text, connection_type text, bind_status text, host text, port text)
) ON true
WHERE t.is_active = true AND s.connection_type = 'SMPP';
SQL
```

### Performance Metrics Reference

| Metric | Tool | Healthy Range | Action if Exceeded |
|---|---|---|---|
| **RTP packet loss** | `rtpengine-ctl` | <0.1% | Check NIC, increase buffers |
| **RTP jitter** | `rtpengine-ctl` | <30ms | Check QoS, isolate voice VLAN |
| **RTP latency** | `rtpengine-ctl` | <150ms | Check network path, enable kernel forwarding |
| **SMPP bind uptime** | PM2 logs | >99.9% | Check network, SMSC health |
| **SMPP submit_sm latency** | App logs | <100ms | Check TPS limit, supplier capacity |
| **DLR delivery latency** | DB query | <5s | Check webhook endpoint, DLR poll interval |
| **PostgreSQL connections** | `pg_stat_activity` | <100 | Increase pool size, add pgbouncer |
| **CPU usage (RTP)** | `htop` | <50% per core | Add cores, enable kernel forwarding |
| **Network throughput** | `iftop` | <80% NIC capacity | Upgrade NIC, add second interface |

---

## 12. Troubleshooting & FAQ

### RTP: One-Way Audio

**Symptom:** One party can hear the other, but not vice versa.

**Diagnosis:**
```bash
# Check if rtpengine is running
systemctl status rtpengine

# Check RTP port range is open
ss -uln | grep "10000\|60000"

# Check NAT/ALG is disabled on firewall
iptables -L -n | grep -i sip  # Should be empty (no SIP ALG)

# Verify SDP in SIP messages
ngrep -d any -W byline port 5060 | grep "c=IN\|m=audio"
```

**Fix:** Ensure rtpengine is running, port range matches firewall rules, and SIP ALG is disabled on the firewall.

### RTP: No Audio at All

**Symptom:** Call connects (SIP OK) but no audio in either direction.

**Diagnosis:**
```bash
# Check kernel module
lsmod | grep xt_RTPENGINE
# If missing:
modprobe xt_RTPENGINE

# Check rtpengine logs
journalctl -u rtpengine -f

# Verify media ports aren't blocked
tcpdump -i any port 10000 -c 10
```

### SMPP: Bind Timeout

**Symptom:** Supplier shows UNBOUND, logs show "Bind timeout."

**Fix:**
```bash
# Verify TCP connectivity
nc -zv {supplier_host} 2775

# If blocked, check firewall
ufw status | grep 2775

# Test raw bind
npx tsx test-smpp-raw-bind.ts
```

### SRTP: Calls Fail When Encryption Enabled

**Symptom:** Calls fail after enabling SRTP.

**Diagnosis:**
```bash
# Check rtpengine SRTP support
rtpengine --codecs  # Should list crypto suites

# Verify DTLS certificates exist
ls -la /etc/rtpengine/cert.pem /etc/rtpengine/key.pem

# Generate if missing:
openssl req -new -x509 -days 3650 -nodes \
  -out /etc/rtpengine/cert.pem \
  -keyout /etc/rtpengine/key.pem \
  -subj "/CN=rtpengine.net2app.com"
```

### FAQ

**Q: Can a single server handle both SMPP messaging AND RTP media relay?**
A: Yes, with proper resource allocation. SMPP is lightweight (CPU-bound by message rate, not bandwidth). RTP media relay is network I/O bound. A 4-core server with a 1 Gbps NIC can handle 50,000+ SMPP messages/sec AND 1,500 concurrent RTP calls simultaneously — as long as RTP uses kernel forwarding (xt_RTPENGINE) to avoid userspace CPU overhead.

**Q: Does enabling SRTP increase latency?**
A: No measurable impact. AES-128 encryption adds <1ms per packet on any CPU with AES-NI instruction support (all modern x86_64 CPUs). The HMAC-SHA1 authentication tag adds negligible CPU overhead. AES-NI is enabled by default on Ubuntu 24.04.

**Q: How do I verify SRTP is actually encrypting my calls?**
A:
```bash
# Capture RTP packets on the media interface
tcpdump -i eth0 -n port 10000 -c 5 -X

# Without SRTP: You'll see G.711 PCM samples (recognizable audio patterns)
# With SRTP: You'll see random-looking encrypted data + auth tag suffix
```

**Q: Can RTP injection attacks work through NAT?**
A: Yes. NAT does not authenticate or encrypt RTP packets. If an attacker is on the same network segment as either endpoint (or compromises a router on the path), they can inject packets with the correct destination IP:port. Only SRTP prevents this — NAT alone does not.

**Q: What's the recommended codec for Voice OTP calls?**
A: G.711 (PCMU) at 64 kbps. Voice OTP calls are short (<30 seconds), so bandwidth is not a concern. G.711 provides the best intelligibility for TTS-spoken digits, which is critical for OTP comprehension. Avoid G.729 for Voice OTP — its compression can make digits sound unclear, especially to non-native speakers.

---

> **Net2APP Telecom Platform** — Enterprise SMS Gateway & Voice OTP  
> SMPP v3.4 • Voice OTP • RTP Media Relay • SIP/TLS • VOS3000 Integration  
> [net2app.com](https://net2app.com)
