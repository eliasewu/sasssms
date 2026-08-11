import { TENANT_FAQS } from "@/lib/tenant-faq";

export const dynamic = "force-static";

const FAQ_SECTION = TENANT_FAQS.map((f) => `### ${f.q}\n\n${f.a}\n`).join("\n");

const LLMS_FULL = `# Net2APP

> Net2APP is a multi-tenant CPaaS (Communications Platform as a Service) that lets you deploy your own white-label SMS gateway in under 60 seconds — SMPP v3.4, HTTP SMS API, Voice OTP, RCS, WhatsApp and Telegram messaging, with zero setup fees and pay-as-you-go pricing.

## About

Net2APP is a self-deployed, multi-tenant SMS gateway and CPaaS platform. Each tenant receives an isolated PostgreSQL schema, giving complete data separation from other tenants — no shared tables, no data leakage. The platform is designed for SMS resellers, aggregators and enterprises that want to own their messaging infrastructure, connect their own suppliers, set their own rates and even onboard sub-clients as tenants.

Net2APP is operated by Tri Angle Trade Centre FZE LLC (UAE). Email: info@net2app.com

## Product Overview

The platform combines an SMPP v3.4 gateway, RESTful HTTP SMS API, Voice OTP engine, RCS messaging, Flash SMS, WhatsApp & Telegram OTT messaging, and a multi-layer routing engine in a single white-label dashboard.

- SMPP v3.4 gateway with Transceiver/Transmitter/Receiver binds and 80+ preloaded supplier connector templates.
- HTTP SMS API with DLR webhooks, per-tenant TPS rate limits, and optional IP whitelisting per API key.
- Voice OTP via Asterisk AMI: MCC-based language detection across 220+ countries, alphanumeric OTPs (A-Z, 0-9), 3-retry call logic, custom SIP trunks.
- Routing hierarchy: Route Plans → Routes → Trunks → Suppliers, with priority-based failover and per-client route plans.
- Translations: SID translation (regex), number translation (strip digits / add prefixes), content translation (OTP extraction with {{OTP}} templates).
- Billing: pay-as-you-go per-SMS pricing, crypto top-ups (USDT, BTC, BNB), no setup or monthly fees on Starter.

### Key Pages

- Home: https://net2app.com/
- Pricing: https://net2app.com/pricing
- HTTP SMS API: https://net2app.com/http-sms-api
- Voice OTP: https://net2app.com/voice-otp
- SMS Routing: https://net2app.com/sms-routing
- WhatsApp & Telegram API: https://net2app.com/whatsapp-telegram-api
- OTT Device Pairing: https://net2app.com/ott-pairing
- IP Whitelisting: https://net2app.com/ip-whitelisting
- Comparisons: https://net2app.com/comparisons
- FAQ: https://net2app.com/faq
- Tenant User Guide: https://net2app.com/tenant-guide
- Resources: https://net2app.com/resources
- API Documentation: https://net2app.com/api-documentation
- Case Studies: https://net2app.com/case-studies
- Blog: https://net2app.com/blog
- Contact: https://net2app.com/contact

## Pricing

Net2APP has zero setup fees, zero hidden fees and pay-as-you-go pricing. The Starter plan is free — 100 SMS trial credits on signup, no credit card required. Professional and Enterprise plans add dedicated servers, higher TPS, white-label branding and more.

## Frequently Asked Questions

${FAQ_SECTION}
## Support

For help, browse the Knowledge Base at https://net2app.com/resources or create a private support ticket from the dashboard (Settings → Support Tickets). Including your tenant name and message IDs speeds up resolution.
`;

export function GET() {
  return new Response(LLMS_FULL, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
