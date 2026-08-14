# Net2APP Telecom Platform: Multi-Tenant SMS & Voice Architecture Guide

> **Document Version:** 1.0  
> **Last Updated:** July 2026  
> **Target Audience:** Network Engineers, Telecom Administrators, DevOps Engineers, Integration Developers  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Multi-Tenant Architecture](#3-multi-tenant-architecture)
4. [SMS Routing Engine](#4-sms-routing-engine)
5. [SMPP v3.4 Gateway](#5-smpp-v34-gateway)
6. [HTTP SMS API](#6-http-sms-api)
7. [Voice OTP Engine](#7-voice-otp-engine)
8. [OTT Messaging (WhatsApp & Telegram)](#8-ott-messaging)
9. [Translation Engine](#9-translation-engine)
10. [DLR & Delivery Tracking](#10-dlr--delivery-tracking)
11. [Billing & Invoicing](#11-billing--invoicing)
12. [Security Architecture](#12-security-architecture)
13. [Deployment & Infrastructure](#13-deployment--infrastructure)
14. [Nginx Configuration](#14-nginx-configuration)
15. [API Reference](#15-api-reference)
16. [Troubleshooting & FAQ](#16-troubleshooting--faq)

---

## 1. System Overview

Net2APP is a **white-label, multi-tenant CPaaS (Communications Platform as a Service)** that enables organizations to deploy their own SMS gateway platform in under 60 seconds. It supports **8+ connection types** including SMPP v3.4, HTTP REST API, Voice OTP, RCS, Flash SMS, WhatsApp Business API, Telegram MTProto, and Email-to-SMS.

### Core Capabilities

| Feature | Description |
|---|---|
| **Multi-Tenant Isolation** | PostgreSQL schema-per-tenant with complete data separation |
| **SMPP v3.4 Gateway** | Transmitter, receiver, and transceiver bind support with real-time status monitoring |
| **HTTP SMS API** | RESTful API with API key + IP whitelist authentication |
| **Voice OTP** | Asterisk AMI integration, 220+ country MCC language detection, alphanumeric OTP |
| **4-Layer Routing** | Route Plans → Routes → Trunks → Suppliers with priority-based failover |
| **OTT Messaging** | WhatsApp Business API via Baileys + Telegram MTProto device pairing |
| **RCS & Flash SMS** | Rich Communication Services and priority screen messages |
| **Real-Time DLR** | Delivery report tracking with webhook callbacks (HTTP + SMPP) |
| **Billing System** | Automated invoicing, payment tracking, per-client rate management |
| **White-Label** | Full rebranding — custom domain, logo, colors, email templates, pricing |

### System Architecture Diagram

```
                          ┌─────────────────────────────────────┐
                          │         Cloudflare CDN/WAF          │
                          │   (Bot Fight Mode + DDoS Protection) │
                          └──────────────┬──────────────────────┘
                                         │ HTTPS :443
                          ┌──────────────▼──────────────────────┐
                          │         Nginx Reverse Proxy          │
                          │  TLS Termination + Security Headers  │
                          │     Bot Blocking + Rate Limiting     │
                          └──────────────┬──────────────────────┘
                                         │ HTTP :5555
                          ┌──────────────▼──────────────────────┐
                          │       Next.js 16 (PM2 Cluster)       │
                          │                                       │
                          │  ┌───────────────────────────────┐  │
                          │  │   Landing Page & Public Site   │  │
                          │  │   Dashboard, Pricing, Blog      │  │
                          │  └───────────────────────────────┘  │
                          │  ┌───────────────────────────────┐  │
                          │  │   API Routes (REST + SMPP)     │  │
                          │  │   /api/tenant/send-sms         │  │
                          │  │   /api/tenant/*                │  │
                          │  └───────────────────────────────┘  │
                          │  ┌───────────────────────────────┐  │
                          │  │   Worker Processes              │  │
                          │  │   OTT Worker (WhatsApp/TG)      │  │
                          │  │   DLR Poller + SMS Forwarder    │  │
                          │  └───────────────────────────────┘  │
                          └──────────────┬──────────────────────┘
                                         │
                          ┌──────────────▼──────────────────────┐
                          │       PostgreSQL 16                  │
                          │                                       │
                          │  ┌─────────────────────────────────┐│
                          │  │  public schema (platform data)   ││
                          │  │  tenants, packages, settings     ││
                          │  ├─────────────────────────────────┤│
                          │  │  tenant_* schema (isolated)      ││
                          │  │  clients, suppliers, routes,     ││
                          │  │  trunks, messages, invoices      ││
                          │  ├─────────────────────────────────┤│
                          │  │  tenant_* schema (isolated)      ││
                          │  │  ...per-tenant data isolation    ││
                          │  └─────────────────────────────────┘│
                          └─────────────────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| **Runtime** | Node.js | 22.x LTS |
| **Framework** | Next.js (App Router) | 16.2 |
| **UI Library** | React | 19.2 |
| **Language** | TypeScript | 5.9 |
| **Database** | PostgreSQL | 16 |
| **ORM** | Drizzle ORM | 0.45 |
| **CSS Framework** | Tailwind CSS | 3.4 |
| **Process Manager** | PM2 | 7.0 |
| **Reverse Proxy** | Nginx | 1.24+ |
| **CDN/WAF** | Cloudflare | — |
| **Voice Engine** | Asterisk AMI | — |
| **SMPP Library** | node-smpp | 0.6 |
| **WhatsApp** | Baileys (whiskeysockets) | 7.0 |
| **Telegram** | Telegram MTProto (gramjs) | — |

---

## 3. Multi-Tenant Architecture

Net2APP implements **PostgreSQL schema-based isolation** — each tenant receives a dedicated database schema, ensuring complete data separation without shared tables.

### Tenant Schema Structure

```sql
-- Platform-level (public schema)
tenants
  id, company_name, email, schema_name, is_active,
  sms_counter, sms_limit, cost_per_sms, max_tps,
  voice_otp_enabled, max_concurrent_calls, package_type

-- Per-tenant schema (tenant_*)
clients          -- Sub-clients with individual API keys, rates, routing
suppliers        -- SMS/Voice providers (SMPP, HTTP, VOICE_OTP)
trunks           -- Capacity-controlled connections to suppliers
routes           -- Named routes linking trunks to plans
route_plans      -- Grouped routes with priority ordering
route_plan_routes -- M:N linking table
route_trunks     -- M:N linking table
messages         -- All outbound SMS/Voice messages with DLR status
client_rates     -- Per-client, per-operator pricing
invoices         -- Automated billing records
ip_whitelist     -- API security
voice_otp_call_logs -- Voice OTP call records
otp_extract_rules   -- OTP code extraction patterns
otp_forward_logs    -- OTP forwarding audit trail
```

### Tenant Lifecycle

```
Register → Create Schema → Seed Default Data → Assign Package → Active
                │                                              │
                ▼                                              ▼
    CREATE SCHEMA tenant_{id}                     SMS Counter Tracking
    CREATE TABLE clients, suppliers,              Real-time DLR Monitoring
    routes, trunks, messages...                   Automated Billing
```

---

## 4. SMS Routing Engine

Net2APP implements a **4-layer intelligent routing engine** with priority-based failover:

```
Client → Route Plan → Routes → Trunks → Suppliers → Mobile Operator
  │          │          │        │          │
  │          │          │        │          └── ESME/SMPP binds or HTTP endpoints
  │          │          │        └── Capacity limits, supplier linkage
  │          │          └── Priority ordering, MCC/MNC filtering
  │          └── Grouped routing policies
  └── API key auth, IP whitelist, TPS limits
```

### Routing Resolution Flow

```text
1. Client Lookup
   ├── HTTP API: x-api-key → client record → route_plan_id
   ├── SMPP Bind: system_id → client record → route_plan_id
   └── Test Route: testRouteId → bypass plan → direct route

2. Route Plan Resolution
   └── SELECT routes FROM route_plan_routes
       JOIN routes ON route_plan_routes.route_id = routes.id
       WHERE route_plan_id = ? AND is_active = true
       ORDER BY priority ASC

3. Route → Trunk Resolution
   └── For each route (priority order):
       SELECT trunks FROM route_trunks
       JOIN trunks ON route_trunks.trunk_id = trunks.id
       WHERE route_id = ? AND is_active = true

4. Trunk → Supplier Resolution
   └── For each trunk:
       SELECT supplier FROM trunks
       JOIN suppliers ON trunks.supplier_id = suppliers.id
       WHERE supplier.is_active = true AND capacity > 0

5. Delivery
   └── SMPP: connectToSupplier() → bind → submit_sm → DLR
   └── HTTP: fetch() → POST → response parsing → DLR
   └── VOICE_OTP: executeVoiceOtpCall() → Asterisk AMI → DLR

6. Fallback
   └── On failure: try next route in plan (priority order)
```

### MCC/MNC Filtering

Routes can be filtered by destination operator using MCC/MNC codes:

```typescript
// Route with specific operator targeting
filterRoutesByTrunkMcc(routes, destination, schemaName)
// Returns only routes whose trunks accept the destination MCC/MNC
```

---

## 5. SMPP v3.4 Gateway

### SMPP Connection Modes

| Mode | Description | Use Case |
|---|---|---|
| **Transmitter (TX)** | Outbound SMS only (submit_sm) | Bulk SMS sending |
| **Receiver (RX)** | Inbound SMS + DLR (deliver_sm) | DLR reception, MO messages |
| **Transceiver (TRX)** | Bidirectional (TX + RX) | Full duplex, recommended |

### SMPP Bind Lifecycle

```text
Client ESME                    Net2APP SMPP Server               Supplier SMSC
     │                                │                              │
     │── bind_transceiver ──────────►│                              │
     │   (system_id, password)       │                              │
     │                                │── bind_transmitter ─────────►│
     │                                │   (system_id, password)      │
     │◄── bind_resp (status=0) ──────│◄── bind_resp (status=0) ────│
     │                                │                              │
     │── submit_sm ─────────────────►│                              │
     │   (src, dst, message)          │── submit_sm ────────────────►│
     │                                │                              │
     │                                │◄── submit_sm_resp ──────────│
     │◄── submit_sm_resp ───────────│   (message_id)                │
     │   (message_id)                │                              │
     │                                │◄── deliver_sm (DLR) ────────│
     │◄── deliver_sm (DLR) ────────│   (stat: DELIVRD)             │
     │   (stat: DELIVRD)             │                              │
```

### Android SMS Gateway (Phone-as-Supplier)

Android phones running the Net2APP Gateway app act as **SMS suppliers**. A phone has **no public IP**, so it
registers **inbound (SERVER mode)** to the platform's SMPP listener:

- When a supplier is created with `connection_type = 'ANDROID_SMS'`, the platform **auto-fills**:
  - `host` = the **server's own public IPv4** (detected via `getSelfIp()` — prefers `api.ipify.org`, IPv4 only)
  - `port` = `2775`
  - `connection_mode` = `SERVER` (phone binds outbound to us)
- The Android app is configured with the supplier's **username + password** and connects to
  `host:2775` over SMPP v3.4 (transceiver).
- **MT flow:** platform routes a message to the supplier → sends `deliver_sm` to the bound phone →
  the app sends it through the phone's SIM.
- **MO flow:** SMS received on the phone are picked up by the app → forwarded to the platform
  (`submit_sm`) → stored in the tenant's **SMS inbox** (tagged with the supplier).
- If a phone's session goes stale (UI shows Bound but the server connection is dead), toggle the
  gateway switch **off → on** in the app to re-register the session server-side.

### Kubernetes Migration

A full **K3s migration plan** (container image, manifests, single-node POC on
Canada Dev, 4-node join, database consolidation, zero-downtime per-tenant
cutover) lives in **[NET2APP_KUBERNETES_MIGRATION.md](./NET2APP_KUBERNETES_MIGRATION.md)**
with ready-to-apply manifests in the `k8s/` directory. The PM2 fleet stays
live until the POC is validated; schema-per-tenant isolation is preserved
on the cluster.

### SMPP Configuration


```typescript
// src/lib/smpp-client.ts — Supplier connection parameters
interface SupplierConfig {
  host: string;           // SMSC IP/hostname
  port: number;           // Typically 2775
  systemId: string;       // SMPP username
  password: string;       // SMPP password
  systemType: string;     // "SMPP" or custom
  bindMode: "TX" | "RX" | "TRX";
  tps: number;            // Throttle (messages/second)
  forceDlr: boolean;      // Require DLR for billing
  sourceTon: number;      // Type of Number (0=unknown, 1=intl, 2=national)
  sourceNpi: number;      // Numbering Plan Indicator
  destTon: number;
  destNpi: number;
}
```

### Bind Status Monitoring

The platform continuously monitors SMPP bind health:

```bash
# Check bind status across all tenants
npx tsx scripts/sync-bind-status.ts

# Manual bind test
npx tsx test-smpp-raw-bind.ts
```

---

## 6. HTTP SMS API

### Authentication

Two authentication methods are supported:

```text
Method 1: Cookie-based (Dashboard Users)
  └── JWT token in tenant_token cookie
  └── Set via POST /api/auth/login

Method 2: API Key (Programmatic Access)
  └── x-api-key: {client_http_api_key}
  └── Authorization: Bearer {client_http_api_key}
  └── Matches against clients.http_api_key OR clients.smpp_username
```

### Send SMS Endpoint

```bash
POST /api/tenant/send-sms
Content-Type: application/json
x-api-key: {your-api-key}

{
  "clientId": 1,
  "sender": "YourBrand",
  "destination": "8801615069178",
  "content": "Your OTP code is 246801. Do not share.",
  "testRouteId": null
}
```

### Response Structure

```json
{
  "success": true,
  "messageId": "MSG_1751234567890_a1b2c3d4",
  "status": "SENT",
  "dlrStatus": "PENDING",
  "routing": {
    "connectionType": "SMPP",
    "routePlan": "Default Plan",
    "route": "Primary Route",
    "trunk": "Main Trunk",
    "supplier": "Operator A SMSC"
  },
  "voiceOtp": {
    "otpCode": "246801",
    "language": "English",
    "callSid": "VOTCALL_abc123",
    "status": "IN_PROGRESS"
  },
  "cost": 0.00010,
  "translations": ["client_profile_1"]
}
```

### Rate Limiting

```text
Tenant-level TPS:  configurable via tenants.max_tps
Client-level TPS:  configurable via clients.max_tps
                  │
                  ▼
      Sliding window (1s buckets, in-memory)
      └── Exceeded → HTTP 429 + error message
```

---

## 7. Voice OTP Engine

### Architecture

```
Client API                  Voice OTP Engine              Asterisk AMI
    │                             │                            │
    │── POST /send-sms ─────────►│                            │
    │   (content: OTP 246801)    │                            │
    │                             │                            │
    │                             │── MCC Lookup ──────────── │
    │                             │   (destination prefix)    │
    │                             │◄── mcc, country, lang ───│
    │                             │                            │
    │                             │── Build Audio Playlist ── │
    │                             │   Greeting + Digits        │
    │                             │   Language-specific TTS    │
    │                             │                            │
    │                             │── AMI Originate ─────────►│
    │                             │   Channel: SIP/trunk       │
    │                             │   Context: voice-otp       │
    │                             │   Exten: {otp_code}        │
    │                             │                            │
    │                             │◄── Call Progress ─────────│
    │                             │   (ANSWER, HANGUP)         │
    │                             │                            │
    │◄── DLR Webhook ───────────│                            │
    │   (DELIVERED / FAILED)     │                            │
```

### Language Detection (220+ Countries)

```typescript
// src/lib/voice-otp-engine.ts
interface LanguageResolution {
  mcc: string;               // Mobile Country Code (e.g., "470" for Bangladesh)
  country: string;           // Country name
  primaryLanguage: string;   // Primary local language (e.g., "Bengali")
  fallbackLanguage: string;  // Fallback if primary audio not available
  isEnglishPrimary: boolean; // Whether English is the primary language
}
```

### Call Flow

```text
1. OTP Extraction
   └── Regex: /\b(\d{4,8})\b/ on message content
   └── Supports numeric + alphanumeric OTPs (e.g., AB3X9)

2. Language Resolution
   └── Parse destination number prefix
   └── Lookup MCC from mcc_mnc_database
   └── Map MCC → country → language (with fallback chain)

3. Retry Logic (3 attempts)
   Attempt 1: Primary language, standard SIP trunk
   Attempt 2: Fallback language, secondary trunk (if busy/no-answer)
   Attempt 3: English fallback, last-resort trunk

4. DLR Generation
   └── DELIVERED: Call answered + audio played fully
   └── FAILED: No answer, busy, SIP timeout, AMI error
   └── Payload pushed to client's dlr_callback_url
```

### Asterisk AMI Configuration

```text
SIP Endpoint:   configured per tenant
AMI Host:       localhost:5038
AMI User:       configured via .env
Context:        voice-otp (custom dialplan)
Timeout:        30s per attempt
Max Retries:    3
```

---

## 8. OTT Messaging (WhatsApp & Telegram)

### Architecture

```
OTT Worker (PM2)                 PostgreSQL                   Client
     │                               │                          │
     │── Load active devices ───────►│                          │
     │◄── Device list ──────────────│                          │
     │                               │                          │
     │── Connect WhatsApp ────────── │                          │
     │   (Baileys + QR auth)        │                          │
     │── Connect Telegram ───────── │                          │
     │   (MTProto + session)        │                          │
     │                               │                          │
     │── Listen for messages ◄──────│                          │
     │                               │                          │
     │── Store message ────────────►│                          │
     │   (tenant schema)            │                          │
     │                               │                          │
     │── Push DLR ◄─────────────────│                          │
     │   (delivery receipt)         │                          │
     │                               │                          │
     │── Forward to client ──────────────────────────────────►│
     │   (HTTP webhook)             │                          │
```

### Device Pairing Flow

```text
1. Admin enables OTT device in dashboard
2. QR code generated (WhatsApp) or session string (Telegram)
3. User scans QR / enters session code
4. Connection persisted in pairing_sessions table
5. OTT Worker loads devices on startup and reconnects
6. Messages routed through standard 4-layer routing engine
```

---

## 9. Translation Engine

### Purpose

The translation engine modifies SMS sender IDs, destinations, and content based on client-level or supplier-level rules — enabling per-operator message customization without changing source applications.

### Translation Types

| Type | Scope | Example |
|---|---|---|
| **Number Translation** | Per-client, per-MCC/MNC | Replace sender ID for specific operators |
| **Content Translation** | Per-client | Template-based message rewriting |
| **SID Translation** | Per-supplier | Replace sender ID based on supplier |
| **Random SID** | Per-client | Rotating sender IDs for delivery optimization |
| **OTP Extract** | Per-client | Custom regex patterns for OTP extraction |

### Translation Flow

```text
Message Received
     │
     ▼
Apply Client Translations (number + content)
     │
     ▼
Apply Route/Supplier Translations (SID mapping)
     │
     ▼
Apply Entity Translations (template-based)
     │
     ▼
Deliver translated message
```

---

## 10. DLR & Delivery Tracking

### DLR Flow

```text
                    ┌──────────────────┐
                    │  Message Status   │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
        QUEUED           SENT            FAILED
            │                │
            ▼                ▼
        PENDING          DELIVERED
                            │
                            ▼
                     DLR Webhook Push
                     (HTTP POST to client's
                      dlr_callback_url)
```

### DLR Payload (HTTP)

```json
{
  "message_id": "MSG_1751234567890_a1b2c3d4",
  "destination": "+8801615069178",
  "source": "YourBrand",
  "status": "DELIVERED",
  "cost": 0.00010,
  "timestamp": "2026-07-25T12:34:56.789Z",
  "route_name": "Primary Route",
  "supplier_name": "Operator A SMSC",
  "otp_code": "246801",
  "language": "English",
  "call_sid": "VOTCALL_abc123",
  "attempt_count": 1,
  "call_attempts": [...]
}
```

### DLR Message (SMPP)

```text
id:MSG_1751234567890_a1b2c3d4 sub:001 dlvrd:001
submit date:20260725 done date:20260725
stat:DELIVRD err:000 text:Voice OTP call delivered
```

### DLR Polling

For suppliers that don't push DLRs, the platform supports polling:

```typescript
// Configured per-supplier
pollUrl: string;       // Endpoint to query for DLR status
pollInterval: number;  // Seconds between polls
pollMethod: "GET" | "POST";
```

---

## 11. Billing & Invoicing

### Billing Modes

| Mode | Description |
|---|---|
| **Prepaid** | Clients pay upfront; SMS counter decremented per message |
| **DLR-based** | Billed only for successfully delivered messages |

### Rate Calculation

```typescript
// Per-message cost decomposition
clientRate = lookupClientRate(destination, clientId, schemaName)
supplierCost = lookupSupplierCost(destination, supplierId, schemaName)
profit = clientRate - supplierCost

// Stored in messages table
messages.cost          // What client pays
messages.supplier_cost // What supplier charges
messages.profit        // Platform margin
```

### Invoice Generation

```text
Trigger: Monthly cron or manual admin action
  │
  ▼
Aggregate messages by client, operator, status
  │
  ▼
Calculate: total_sms × rate_per_sms = invoice_amount
  │
  ▼
Generate invoice record in tenant schema
  │
  ▼
Email invoice PDF to client (nodemailer + SMTP)
```

---

## 12. Security Architecture

### Defense Layers

```text
Layer 1: Cloudflare CDN/WAF
  ├── DDoS Protection
  ├── Bot Fight Mode
  ├── SSL/TLS Termination (Edge)
  └── Rate Limiting

Layer 2: Nginx Reverse Proxy
  ├── TLS Termination (Origin)
  ├── Bot User-Agent Blocking
  ├── Security Headers (CSP, X-Frame, HSTS)
  └── Request Size Limits (100MB)

Layer 3: Application Security
  ├── JWT Authentication (tenant_token cookie)
  ├── API Key Authentication (x-api-key header)
  ├── IP Whitelisting (per-client)
  ├── TPS Rate Limiting (per-tenant, per-client)
  ├── CSRF Protection (SameSite cookies)
  └── Input Validation & Sanitization

Layer 4: Database Security
  ├── Schema-per-tenant Isolation
  ├── Parameterized Queries (SQL injection prevention)
  ├── Encrypted Passwords (bcryptjs, 12 rounds)
  └── API Key Hashing (SHA-256)

Layer 5: Network Security
  ├── Firewall (UFW): ports 22, 80, 443, 2775, 5038
  ├── Cloudflare Origin Certificates (10-year validity)
  └── SSH Key Authentication Only
```

### Security Headers (Live on net2app.com)

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Content-Security-Policy "default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval'
    https://www.googletagmanager.com https://static.cloudflareinsights.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https:;
  frame-ancestors 'self'" always;
```

### Bot Blocking

```nginx
# Blocks known site cloning tools (HTTrack, SiteSucker, etc.)
if ($http_user_agent ~* (HTTrack|SiteSucker|WebZip|WebCopier|Teleport|Offline\ Explorer)) {
    return 403;
}
```

---

## 13. Deployment & Infrastructure

### Server Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| **CPU** | 2 cores | 4+ cores (for voice transcoding) |
| **RAM** | 2 GB | 4-8 GB |
| **Storage** | 20 GB SSD | 50+ GB SSD |
| **Network** | 100 Mbps | 1 Gbps |
| **OS** | Ubuntu 22.04+ | Ubuntu 24.04 LTS |

### Process Architecture (PM2)

```text
pm2 list
┌─────┬────────────┬─────────┬──────┬────────┐
│ id  │ name       │ mode    │ status│ uptime │
├─────┼────────────┼─────────┼──────┼────────┤
│ 0   │ net2app    │ cluster │ online│ 5d     │
│ 1   │ ott-worker │ fork    │ online│ 5d     │
└─────┴────────────┴─────────┴──────┴────────┘
```

### Deployment Commands

```bash
# Build
npm run build

# Start (production)
pm2 start npm --name net2app -- run start

# Logs
pm2 logs net2app

# Restart after updates
pm2 restart net2app

# Health check
curl -f http://localhost:5555 || exit 1
```

### Environment Variables

```bash
# .env (core)
DATABASE_URL=postgresql://user:pass@localhost:5432/app_db
SMPP_PORT=2775
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_TAWKTO_ID=646f1d5874285f0ec46d8d19

# Asterisk AMI
ASTERISK_AMI_HOST=127.0.0.1
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USER=admin
ASTERISK_AMI_SECRET=secret

# Email (nodemailer)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@net2app.com
SMTP_PASS=password
```

---

## 14. Nginx Configuration

```nginx
# /etc/nginx/sites-available/net2app

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name _;
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name _;

    # Cloudflare-compatible origin cert (10-year)
    ssl_certificate /etc/nginx/ssl/net2app.crt;
    ssl_certificate_key /etc/nginx/ssl/net2app.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 100M;

    # Block cloning tools
    if ($http_user_agent ~* (HTTrack|SiteSucker|WebZip|WebCopier|Teleport|Offline\ Explorer)) {
        return 403;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; ..." always;

    # Static uploads
    location /uploads/ {
        alias /opt/net2app/public/uploads/;
        try_files $uri =404;
        expires 1h;
        add_header Cache-Control "public";
    }

    # Proxy to Next.js
    location / {
        proxy_pass http://127.0.0.1:5555;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

### Nginx Management

```bash
# Test configuration
sudo nginx -t

# Reload (zero downtime)
sudo systemctl reload nginx

# View active config
sudo nginx -T | grep -A 30 "server_name _"

# Check logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 15. API Reference

### Core API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | None | Tenant login (returns JWT cookie) |
| `POST` | `/api/auth/register` | None | Tenant registration + schema creation |
| `POST` | `/api/tenant/send-sms` | API Key or Cookie | Send SMS/Voice OTP |
| `GET` | `/api/tenant/messages` | Cookie | Message history with DLR status |
| `GET` | `/api/tenant/invoices` | Cookie | Invoice list |
| `GET` | `/api/tenant/mccmnc` | Cookie | MCC/MNC database (tree view) |
| `POST` | `/api/tenant/mccmnc` | Cookie | Batch MNC lookup for numbers |
| `GET` | `/api/tenant/route-plans` | Cookie | Route plan management |
| `GET` | `/api/tenant/sms-translations` | Cookie | Translation profiles |
| `POST` | `/api/tenant/sms-translations/preview` | Cookie | Translation preview |
| `GET` | `/api/tenant/otp-extract-rules` | Cookie | OTP extraction rules |
| `GET` | `/api/public/settings` | None | Public pricing/settings |

### Test Commands

```bash
# E2E test suites
npm run test:voice-otp-e2e    # Voice OTP full flow
npm run test:smpp-e2e         # SMPP integration
npm run test:unit             # Unit tests (id-generators + voice-otp-dlr)
npm run test:dlr-queue        # DLR queue tests
npm run test:smpp-bind        # SMPP bind validator
npm run test:dlr-persist      # DLR persistence tests

# Direct API tests
npm run test:voice-otp-call   # Direct Asterisk AMI call test

# TypeScript
npm run typecheck             # tsc --noEmit
npm run lint                  # ESLint
```

---

## 16. Troubleshooting & FAQ

### CSS Not Loading / Site Appears Unstyled

**Symptom:** Landing page or dashboard renders without any styling (all text, no layout).

**Causes & Fixes:**

1. **Browser Cache:** The CSS file hash changes on each build. If your browser cached old HTML referencing the old CSS file, the page breaks.
   - **Fix:** Hard refresh (`Ctrl+Shift+R`) or open in incognito window.

2. **Stale Build Cache:** Next.js `.next` directory may contain stale cached CSS.
   - **Fix:** `rm -rf .next && npm run build`

3. **Missing tailwind.config.ts:** Tailwind CSS v3 requires this file.
   - **Fix:** Ensure `tailwind.config.ts` exists at project root with correct content paths.

4. **NODE_ENV=production in build script:** Can confuse Turbopack's PostCSS processing.
   - **Fix:** Use `"build": "next build"` instead of `"build": "NODE_ENV=production next build"`.

### SMS Not Sending / "No Active Routes in Plan"

**Symptom:** API returns error about no active routes.

**Fix:**
```bash
# Seed default routing for all tenants
npx tsx scripts/seed-tenant-routing.ts

# Verify route chain
npx tsx scripts/test-voice-otp-e2e.ts  # Suite 1: DB verification
```

### SMPP Bind Failing

**Symptom:** Bind status shows "UNBOUND" or connection refused.

**Troubleshooting:**
```bash
# Check SMPP server is listening
ss -tlnp | grep 2775

# Test raw bind
npx tsx test-smpp-raw-bind.ts

# Check supplier config
# Ensure: host, port, system_id, password are correct
# Ensure: bind_mode matches SMSC expectation (TX/RX/TRX)
```

### Voice OTP Failing

**Symptom:** Voice OTP calls not connecting or no audio.

**Troubleshooting:**
```bash
# Test Asterisk AMI connection
npx tsx scripts/test-voice-otp-call.ts

# Check AMI credentials in .env
# ASTERISK_AMI_HOST, ASTERISK_AMI_PORT,
# ASTERISK_AMI_USER, ASTERISK_AMI_SECRET

# Verify SIP trunk configuration
# Ensure: context=voice-otp, proper codec support
```

### Database Migrations

```bash
# Push schema changes (development)
npx drizzle-kit push

# Generate migration
npx drizzle-kit generate

# Apply specific migration
psql $DATABASE_URL -f drizzle/00XX_migration_name.sql
```

### PM2 Process Management

```bash
# View status
pm2 status

# View logs (last 50 lines)
pm2 logs net2app --lines 50 --nostream

# Graceful restart (zero downtime)
pm2 reload net2app

# Force restart
pm2 restart net2app

# Stop + start fresh
pm2 stop net2app
pm2 delete net2app
pm2 start npm --name net2app -- run start
```

### FAQ

**Q: Can I use Net2APP without Asterisk for Voice OTP?**
A: Voice OTP requires Asterisk AMI integration. Without it, SMS OTP still works via SMPP/HTTP. Voice OTP calls will fail gracefully with appropriate error responses.

**Q: How many tenants can a single server support?**
A: A single server can support 50-100+ active tenants depending on SMS volume. PostgreSQL schema isolation means each tenant adds minimal overhead beyond their actual message volume.

**Q: Is the platform GDPR/TCPA compliant?**
A: The platform provides the technical infrastructure for compliance (data isolation, encryption). You are responsible for configuring opt-in/opt-out handling, DND lists, and data retention policies per your local regulations.

**Q: How do I add a new SMS supplier?**
A: Create a supplier record in the tenant dashboard (or via SQL), configure the SMPP/HTTP connection parameters, create a trunk linked to it, create a route linked to the trunk, and add the route to your client's route plan.

**Q: What happens if a supplier goes down?**
A: The routing engine automatically fails over to the next route in the plan (priority order). No messages are lost — they're retried through the next available route.

---

> **Net2APP** — Deploy your own multi-tenant SMS gateway in 60 seconds.  
> Zero setup fees. Pay only for what you use.  
> [net2app.com](https://net2app.com)
