import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const SITE_URL = "https://net2app.com";
const SITE_NAME = "Net2APP";
const DESCRIPTION = "Deploy your own multi-tenant SMS gateway with complete tenant isolation, SMPP v3.4, HTTP API, RCS messaging, Voice OTP with Asterisk integration, Flash SMS, OTT messaging, WhatsApp Business API, and intelligent multi-layer routing. No setup fees, no hidden fees — pure pay-as-you-go SMS infrastructure.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e3a5f" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export const metadata: Metadata = {
  // ── Primary ──
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Enterprise SMS Gateway Platform`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    // ── General Platform & CPaaS (34) ──
    "CPaaS", "Communications Platform as a Service", "API", "RESTful API",
    "SDK", "Cloud Communications", "Programmable Voice", "Programmable Messaging",
    "Omnichannel", "SaaS", "UCaaS", "CCaaS", "Scalable", "Infrastructure",
    "Middleware", "Webhooks", "Integration", "Developer Friendly", "Real-time",
    "Low Latency", "Global Reach", "Multi-tenant", "Elastic", "Dashboard",
    "Analytics", "Reporting", "Monitoring", "High Availability", "Redundancy",
    "Microservices", "Documentation", "Sandbox",
    // ── SMS & Messaging (44) ──
    "SMS", "Short Message Service", "MMS", "Multimedia Messaging Service",
    "A2P", "Application to Person", "P2P", "Person to Person",
    "Short Code", "Long Code", "10DLC", "Toll-Free Messaging",
    "OTP", "One-Time Password", "2FA", "Two-Factor Authentication",
    "Bulk SMS", "Transactional SMS", "Promotional SMS", "SMS Marketing",
    "RCS", "Rich Communication Services", "RBM", "Rich Business Messaging",
    "WhatsApp Business API", "Sender ID", "Alphanumeric Sender",
    "Delivery Reports", "Message Queuing", "Throughput", "MPS",
    "Messages Per Second", "Unicode", "Character Encoding",
    "Opt-in", "Opt-out", "Compliance", "TCPA", "GDPR",
    "Carrier Routing", "Failover", "Message Scrubbing",
    // ── Voice & Telephony (45) ──
    "Voice API", "VoIP", "Voice over IP", "PSTN",
    "Public Switched Telephone Network", "SIP", "Session Initiation Protocol",
    "SIP Trunking", "IVR", "Interactive Voice Response",
    "Call Routing", "Call Forwarding", "Call Recording", "Call Tracking",
    "Click to Call", "Call Masking", "DID", "Direct Inward Dialing",
    "Toll-Free Numbers", "Local Numbers", "Vanity Numbers",
    "Origination", "Termination", "Call Detail Record", "CDR",
    "CNAM", "Caller ID", "Answering Machine Detection", "AMD",
    "Text to Speech", "TTS", "Speech to Text", "STT",
    "Voice Broadcasting", "Conference Calling", "DTMF",
    "Dual-Tone Multi-Frequency", "PBX", "Private Branch Exchange",
    "Voice Gateway", "SIP Peering", "E911", "Emergency Calling",
    "Post Dial Delay", "PDD",
    // ── Marketing & Engagement (27) ──
    "Customer Engagement", "Lead Generation", "Marketing Automation",
    "Personalization", "Dynamic Messaging", "Conversational AI", "Chatbot",
    "Customer Journey", "Audience Segmentation", "Campaign Management",
    "Click Through Rate", "CTR", "Open Rate", "Conversion Rate", "ROI",
    "Customer Loyalty", "Retention", "Alerts", "Notifications", "Reminders",
    "Appointment Scheduling", "Feedback Surveys", "Polls", "Text-to-Vote",
    "Couponing", "Mobile Marketing", "Blast Messaging", "Drip Campaigns",
    // ── Technical & Security (28) ──
    "Authentication", "Authorization", "OAuth", "Encryption",
    "Data Privacy", "Fraud Prevention", "Spam Filtering",
    "STIR", "SHAKEN", "Identity Verification",
    "Blacklisting", "Whitelisting", "Rate Limiting", "Load Balancing",
    "Network Latency", "Protocol Gateway", "Signaling", "Media Streaming",
    "Opus Codec", "G.711", "WebRTC", "WebSocket",
    "REST", "JSON", "SOAP", "Integration Webhooks", "Callback",
    "Latency", "Throughput", "Uptime", "Five Nines", "SLA",
    "Service Level Agreement",
    // ── Industry Terminology (31) ──
    "Telecom", "Carrier", "Tier 1 Network", "Interconnect",
    "Termination Rate", "Local Number Portability", "LNP",
    "LATA", "NPA", "NXX", "Mobile Network Operator", "MNO",
    "Aggregator", "Reseller", "Wholesale Voice", "Wholesale SMS",
    "CPaaS Provider", "Cloud Telephony", "Virtual Number",
    "Hosted Voice", "PBX System", "Communication Infrastructure",
    "Digital Transformation", "Customer Experience", "CX",
    // ── Net2APP Specific (24) ──
    "SMS Gateway", "SMPP Gateway", "SMPP v3.4", "HTTP SMS API",
    "Voice OTP", "Voice Call OTP", "Text SMS", "SMS Platform",
    "SMS Server", "Voice Platform", "SMS Voice Platform",
    "Multi-Tenant SMS Platform", "Enterprise SMS Infrastructure",
    "White-Label SMS Gateway", "Bulk SMS API", "SaaS SMS Platform",
    "Cloud SMS Platform", "Twilio Alternative", "Vonage Alternative",
    "Reve SMS", "5GVision", "LRS SMS", "Al Muqeet SMS",
    "Bangladesh SMS Gateway", "India SMS Gateway", "UAE SMS Gateway",
    "Middle East SMS Platform",
  ],
  applicationName: SITE_NAME,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  creator: "Tri Angle Trade Centre Fze LLC",
  publisher: "Tri Angle Trade Centre Fze LLC",
  category: "Technology",
  classification: "Business",

  // ── Robots & Crawling ──
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ── Canonical & Alternates ──
  alternates: {
    canonical: SITE_URL,
    languages: {
      "en": `${SITE_URL}/`,
    },
  },

  // ── Open Graph ──
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Multi-Tenant SMS Gateway Platform`,
    description: "Deploy your own SMS gateway. SMPP, HTTP API, RCS, Voice OTP, OTT, WhatsApp. No setup fees. Pay only for SMS sent.",
    url: SITE_URL,
    locale: "en_US",
    countryName: "UAE",
    emails: ["info@net2app.com"],
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Net2APP Enterprise SMS Gateway Platform",
        type: "image/png",
      },
    ],
  },

  // ── Twitter Card ──
  twitter: {
    card: "summary_large_image",
    site: "@net2app",
    creator: "@net2app",
    title: `${SITE_NAME} — Enterprise SMS Gateway`,
    description: "Multi-tenant SMS gateway. SMPP, HTTP API, RCS, Voice OTP. $0 setup. Pay-as-you-go.",
    images: [`${SITE_URL}/og-image.png`],
  },

  // ── Verification ──
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || "",
    yandex: process.env.YANDEX_VERIFICATION || "",
  },

  // ── App Links ──
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },

  // ── Other ──
  other: {
    "msapplication-TileColor": "#1e3a5f",
    "bing-site-verification": process.env.BING_SITE_VERIFICATION || "",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://net2app.com/#organization",
        "name": "Net2APP",
        "legalName": "Tri Angle Trade Centre Fze LLC",
        "url": "https://net2app.com",
        "logo": "https://net2app.com/favicon.ico",
        "description": "Enterprise SMS Gateway Platform — Multi-tenant SaaS with SMPP, HTTP API, RCS, Voice OTP, and OTT messaging. No setup fees, pay only for SMS sent.",
        "email": "info@net2app.com",
        "foundingDate": "2024",
        "address": { "@type": "PostalAddress", "addressCountry": "AE" },
        "sameAs": ["https://github.com/eliasewu/sasssms"],
      },
      {
        "@type": "WebApplication",
        "@id": "https://net2app.com/#webapp",
        "name": "Net2APP SMS Gateway",
        "url": "https://net2app.com",
        "description": "Multi-tenant SaaS SMS Gateway with SMPP v3.4, HTTP API, RCS, Voice OTP, Flash SMS, OTT messaging, and intelligent routing.",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD", "description": "Free to start. No setup fees. Pay-as-you-go SMS pricing." },
        "browserRequirements": "Requires JavaScript",
        "featureList": [
          "Multi-Tenant Architecture with PostgreSQL Schema Isolation",
          "SMPP v3.4 Gateway with Bind Status Monitoring",
          "RESTful HTTP SMS API with Authentication",
          "Voice OTP Engine with Asterisk AMI Integration",
          "RCS (Rich Communication Services) Messaging",
          "Flash SMS Priority Messaging",
          "OTT Messaging (WhatsApp, Telegram)",
          "Multi-Layer Routing: Route Plans → Routes → Trunks → Suppliers",
          "Real-Time DLR (Delivery Reports)",
          "Automated Billing & Invoicing",
          "Sub-Client Management with Individual Rates",
          "IP Whitelisting Security",
          "80+ Preloaded API Connectors",
        ],
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/#faq",
        "mainEntity": [
          { "@type": "Question", "name": "What is Net2APP SMS Gateway?", "acceptedAnswer": { "@type": "Answer", "text": "Net2APP is a multi-tenant SaaS SMS gateway platform that lets you deploy your own isolated SMS infrastructure. It supports SMPP v3.4, HTTP API, RCS messaging, Voice OTP with Asterisk, Flash SMS, OTT messaging (WhatsApp, Telegram), and intelligent multi-layer routing. No setup fees — pure pay-as-you-go pricing." } },
          { "@type": "Question", "name": "How much does Net2APP cost?", "acceptedAnswer": { "@type": "Answer", "text": "Net2APP has zero setup fees, zero monthly fees, and zero hidden fees. You pay only for the SMS you send. The per-SMS rate is dynamically configured by the super admin and visible on the landing page. Professional and Enterprise packages are available with dedicated servers and included SMS volume." } },
          { "@type": "Question", "name": "What connection types does Net2APP support?", "acceptedAnswer": { "@type": "Answer", "text": "Net2APP supports 8+ connection types: SMPP v3.4, HTTP REST API, RCS (Rich Communication Services), Voice OTP (with Asterisk AMI integration), Flash SMS, OTT messaging (WhatsApp Business API + Telegram), Business API, and Email-to-SMS gateway." } },
          { "@type": "Question", "name": "Is my data isolated from other tenants?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Net2APP uses PostgreSQL schema-based isolation — each tenant gets their own dedicated database schema with complete data separation. No shared tables, no data leakage." } },
          { "@type": "Question", "name": "How does Voice OTP work?", "acceptedAnswer": { "@type": "Answer", "text": "Net2APP's Voice OTP engine detects the destination country from the phone number prefix (MCC), maps it to the local language using a 220+ country database, builds an audio playlist (greeting + digits/letters), and originates a call via Asterisk AMI with 3-retry logic. Alphanumeric OTPs (e.g. AB3X9) are fully supported with A-Z letter audio." } },
        ],
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://net2app.com/#breadcrumb",
        "itemListElement": [{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" }],
      },
    ],
  };

  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
