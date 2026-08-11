/**
 * llms.txt — the AI-friendly content index for Net2APP.
 * Format per https://llmstxt.org (H1 title, blockquote summary, H2 sections with
 * annotated markdown links). Served at both /.well-known/llms.txt and /llms.txt.
 */
export const LLMS_TXT = `# Net2APP

> Net2APP is a multi-tenant CPaaS (Communications Platform as a Service) that lets you deploy your own white-label SMS gateway in under 60 seconds — SMPP v3.4, HTTP SMS API, Voice OTP, RCS, WhatsApp and Telegram messaging, with zero setup fees and pay-as-you-go pricing.

## What is Net2APP?

Net2APP is a self-deployed, multi-tenant SMS gateway and CPaaS platform. Each tenant gets an isolated PostgreSQL schema for complete data privacy. It includes an SMPP v3.4 gateway with bind status monitoring, a RESTful HTTP SMS API, call-based Voice OTP (Asterisk AMI, 220+ countries, automatic language detection), RCS messaging, Flash SMS, WhatsApp & Telegram OTT messaging, multi-layer routing (Route Plans → Routes → Trunks → Suppliers) with automatic failover, DLR delivery reports, per-client rates, bulk rate management, SID/number/content translation, IP whitelisting, and sub-client management for resellers.

- Overview: https://net2app.com/
- Pricing: https://net2app.com/pricing
- How it works / FAQ: https://net2app.com/faq
- Full Tenant User Guide: https://net2app.com/tenant-guide
- Resources & Knowledge Base: https://net2app.com/resources
- API Documentation: https://net2app.com/api-documentation

## Key Features

- **SMPP v3.4 Gateway** — Transceiver/Transmitter/Receiver binds, 80+ preloaded supplier connectors, live bind status: https://net2app.com/
- **HTTP SMS API** — RESTful send/status API with DLR webhooks, IP whitelisting and rate limits: https://net2app.com/http-sms-api
- **Voice OTP** — call-based one-time passwords with Asterisk AMI, 220+ countries, MCC language detection, alphanumeric OTPs: https://net2app.com/voice-otp
- **SMS Routing** — 4-layer routing with priority-based failover, per-client route plans, MCC allow/deny trunks: https://net2app.com/sms-routing
- **WhatsApp & Telegram API** — OTT messaging via Baileys (WhatsApp Web protocol) and Telegram MTProto: https://net2app.com/whatsapp-telegram-api
- **OTT Device Pairing** — QR-code device pairing, session persistence, exponential backoff reconnection: https://net2app.com/ott-pairing
- **IP Whitelisting** — per-API-key IP allowlists and CIDR ranges, 403 blocking for untrusted IPs: https://net2app.com/ip-whitelisting
- **Translations** — SID, number and content (OTP extraction) translation rules with priority ordering: https://net2app.com/tenant-guide
- **Bulk Rate Management** — set rates for all operators in a country at once, per-operator MCC/MNC rates: https://net2app.com/tenant-guide
- **Billing** — pay-as-you-go, crypto top-ups (USDT, BTC, BNB), no setup or monthly fees on Starter: https://net2app.com/pricing

## Pricing

Net2APP has zero setup fees and zero hidden fees — you pay only for the SMS you send. The Starter plan is free (100 SMS trial credits on signup, no credit card required). Professional and Enterprise plans include dedicated servers, higher TPS, and white-label branding.

- Pricing details: https://net2app.com/pricing
- Net2APP vs traditional CPaaS: https://net2app.com/comparisons

## Frequently Asked Questions

Concise answers to the 13 most common Net2APP questions (getting started, suppliers, routing, billing, translations, support):

- FAQ: https://net2app.com/faq

## Documentation & Guides

- Tenant User Guide (8 chapters, 44 sections: account setup, suppliers, bind status, routing, rates, billing, translations, study guide): https://net2app.com/tenant-guide
- API Documentation: https://net2app.com/api-documentation
- Knowledge Base / Resources: https://net2app.com/resources
- Case Studies: https://net2app.com/case-studies
- Blog: https://net2app.com/blog
- Contact & Support: https://net2app.com/contact

## Company

Net2APP is operated by Tri Angle Trade Centre FZE LLC (UAE). Enterprise SMS Gateway & Voice OTP Platform — multi-tenant SaaS. Email: info@net2app.com
`;
