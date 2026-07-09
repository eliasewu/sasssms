import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "WhatsApp & Telegram Business API — Multi-Device Messaging Gateway | Net2APP",
  description:
    "Net2APP WhatsApp Business API and Telegram Business API. Send WhatsApp messages via Baileys WhatsApp Web API. Send Telegram messages via MTProto API. RESTful Business API with device pairing, media support, and multi-device management.",
  keywords: [
    "WhatsApp Business API", "Telegram Business API", "WhatsApp API Gateway",
    "Telegram API Gateway", "WhatsApp Baileys API", "Telegram MTProto API",
    "WhatsApp Messaging API", "Telegram Messaging API",
    "WhatsApp Cloud API Alternative", "WhatsApp Business Gateway",
    "Telegram Gateway", "OTT Business API", "Multi-Device WhatsApp API",
    "WhatsApp Message API", "Telegram Message API",
    "WhatsApp API Bangladesh", "WhatsApp API UAE", "WhatsApp API India",
    "WhatsApp Bulk Message API", "Telegram Bulk Message API",
  ],
  openGraph: {
    title: "WhatsApp & Telegram Business API — Multi-Device Messaging | Net2APP",
    description:
      "WhatsApp Business API via Baileys and Telegram MTProto API. Send messages programmatically through a unified RESTful interface with full media support.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/whatsapp-telegram-api#webpage",
      "url": "https://net2app.com/whatsapp-telegram-api",
      "name": "WhatsApp & Telegram Business API — Multi-Device Messaging",
      "description":
        "Send WhatsApp and Telegram messages programmatically via Net2APP Business API. Includes device pairing, media handling, and multi-device management.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "WhatsApp & Telegram API", "item": "https://net2app.com/whatsapp-telegram-api" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/whatsapp-telegram-api#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is the WhatsApp Business API?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP's WhatsApp Business API allows you to send and receive WhatsApp messages programmatically through a RESTful HTTP API. It uses the Baileys library (WhiskeySockets) to implement the WhatsApp Web protocol — the same protocol used by WhatsApp Web and the WhatsApp desktop app. Messages can include text, images, videos, audio, and documents. The API supports multi-device connections with session persistence.",
          },
        },
        {
          "@type": "Question",
          "name": "What is the Telegram Business API?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP's Telegram Business API leverages MTProto (the native Telegram protocol) to send messages through your personal Telegram account. Unlike the Telegram Bot API which has lower rate limits and limited features, MTProto provides higher rate limits, supports sending to any phone number (not just users who started a chat with a bot), and full media support including images, videos, documents, and files.",
          },
        },
        {
          "@type": "Question",
          "name": "How does Net2APP maintain stable WhatsApp and Telegram connections?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP uses the official WhatsApp Web protocol (via Baileys) and the native Telegram MTProto protocol for direct, stable connections. The OTT Worker maintains persistent sessions with automatic reconnection and exponential backoff, ensuring your devices stay connected and operational at all times.",
          },
        },
        {
          "@type": "Question",
          "name": "Can I send bulk messages via WhatsApp and Telegram?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. The Net2APP Business API supports sending messages to multiple recipients through both WhatsApp and Telegram connections. Messages are queued and sent through the OTT Worker with rate limiting to maintain account health. You can send text, media, and file messages in bulk via the REST API with appropriate throttling configured per device.",
          },
        },
        {
          "@type": "Question",
          "name": "How do I integrate the Business API into my application?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP provides a RESTful Business API with simple HTTP endpoints. After pairing your WhatsApp or Telegram device, you send POST requests to the API with the message content, recipient, and optional media files. Authentication uses your tenant API key. The API supports JSON payloads and multipart file uploads for media messages. Integration guides and code examples are available in the dashboard.",
          },
        },
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://net2app.com/whatsapp-telegram-api#app",
      "name": "Net2APP WhatsApp & Telegram Business API",
      "url": "https://net2app.com/whatsapp-telegram-api",
      "description": "Unified RESTful Business API for WhatsApp and Telegram messaging. WhatsApp via Baileys Web protocol, Telegram via MTProto native protocol, with multi-device management, media support, and session persistence.",
      "applicationCategory": "CommunicationApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free to start. No setup fees. Pay-as-you-go messaging pricing."
      },
      "featureList": [
        "WhatsApp Messaging via Baileys Library (WhatsApp Web Protocol)",
        "Telegram Messaging via MTProto Native API (Higher Rate Limits)",
        "RESTful HTTP API with JSON Request/Response Format",
        "Multi-Device Management with Independent Sessions",
        "Full Media Support: Images, Video, Audio, and Documents",
        "Device Session Persistence with Automatic Reconnection",
        "Bulk Messaging with Per-Device Rate Limiting",
        "Round-Robin Message Distribution Across Multiple Devices",
        "OTT Worker Background Processing with Exponential Backoff",
        "Unified API Key Authentication for Both Platforms"
      ]
    },
  ],
};

export default function WhatsappTelegramApiPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200"><div className="max-w-7xl mx-auto px-6 lg:px-8"><div className="flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span>
        </Link>
        <div className="hidden lg:flex items-center gap-1">
          <Link href="/" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Home</Link>
          <Link href="#faq" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition hidden md:block">FAQ</Link>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</a>
          </div>
        </div>
      </div></nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-100 border border-blue-200 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              <span className="text-blue-700 text-sm font-medium">WhatsApp + Telegram Business API</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
              WhatsApp & Telegram
              <span className="block bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">Business API for Messaging</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Send and receive messages via <strong className="text-gray-900">WhatsApp Business API</strong> (Baileys/WhiskeySockets) and
              <strong className="text-gray-900"> Telegram MTProto API</strong> through a unified RESTful interface.
              Includes <strong className="text-gray-900">multi-device management</strong> with persistent session handling and automatic reconnection.
              Full media support — images, videos, audio, and documents.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="https://net2app.com" className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-lg shadow-sm text-center">
                Deploy Business API Free →
              </a>
              <Link href="/ott-pairing" className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-semibold text-lg text-center">
                OTT Device Pairing
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "WhatsApp", label: "Baileys API", desc: "WhatsApp Web protocol integration" },
              { value: "Telegram", label: "MTProto API", desc: "Native Telegram protocol" },
              { value: "Multi", label: "Device Support", desc: "Multiple devices per account" },
              { value: "Media", label: "Full Media Support", desc: "Images, video, audio, docs" },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <p className="text-3xl font-bold text-gray-900 mb-1">{s.value}</p>
                <p className="text-gray-700 font-medium">{s.label}</p>
                <p className="text-gray-500 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Overview */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Business API Endpoints</h2>
            <p className="text-gray-500 text-lg">RESTful API for WhatsApp and Telegram messaging</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">💚</span>
                <h3 className="text-xl font-bold text-white">WhatsApp API</h3>
              </div>
              <div className="space-y-3">
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 font-mono text-xs text-gray-600">
                  POST /api/tenant/social-api/whatsapp/send<br />
                  {"{"}"to": "8801712345678",<br />
                  &nbsp;&nbsp;"message": "Hello from API!",<br />
                  &nbsp;&nbsp;"device_id": 1{"}"}
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 font-mono text-xs text-gray-600">
                  POST /api/tenant/social-api/whatsapp/send-media<br />
                  (multipart/form-data with file)
                </div>
                <ul className="space-y-2 text-blue-300 text-xs">
                  <li className="text-gray-500">• Send text, image, video, audio, document messages</li>
                  <li>• ╴Multi-device support with session persistence</li>
                  <li>• ╴Automatic reconnection via OTT Worker</li>
                </ul>
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🔵</span>
                <h3 className="text-xl font-bold text-white">Telegram API</h3>
              </div>
              <div className="space-y-3">
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 font-mono text-xs text-gray-600">
                  POST /api/tenant/social-api/telegram/send<br />
                  {"{"}"to": "8801712345678",<br />
                  &nbsp;&nbsp;"message": "Hello from API!",<br />
                  &nbsp;&nbsp;"device_id": 2{"}"}
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 font-mono text-xs text-gray-600">
                  POST /api/tenant/social-api/telegram/send-media<br />
                  (multipart/form-data with file)
                </div>
                <ul className="space-y-2 text-blue-300 text-xs">
                  <li>• ╴Send via MTProto — higher rate limits</li>
                  <li>• ╴Message any phone number, not just bot users</li>
                  <li>• ╴Full media support: images, video, audio, docs</li>
                  <li>• ╴API ID + Hash authentication from my.telegram.org</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Device Management */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Multi-Device Management</h2>
            <p className="text-gray-500 text-lg">Manage unlimited WhatsApp and Telegram devices from one dashboard</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h3 className="text-white font-semibold text-lg mb-4">Device Connection Benefits</h3>
              <ul className="space-y-3 text-blue-300 text-sm">
                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">✓</span> Connect multiple WhatsApp and Telegram devices to a single API gateway</li>
                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">✓</span> Each device gets independent session management and status monitoring</li>
                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">✓</span> Automatic session persistence — sessions survive server restarts</li>
                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">✓</span> Round-robin message distribution across multiple devices for higher throughput</li>
                <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">✓</span> Real-time connection status monitoring with automatic alerts</li>
              </ul>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h3 className="text-white font-semibold text-lg mb-4">Device Configuration</h3>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-4 font-mono text-xs text-gray-600">
                {`// Device Configuration (per device)
{
  "device_id": "wa_001",
  "type": "whatsapp",
  "status": "connected",
  "last_active": "2025-01-15T10:30:00Z"
}`}
              </div>
              <p className="text-blue-300 text-sm leading-relaxed mb-4">
                Configure and manage devices from the dashboard or API. Net2APP's OTT Worker maintains persistent WebSocket connections
                for WhatsApp (Baileys) and MTProto connections for Telegram with automatic reconnection.
              </p>
              <p className="text-blue-400 text-xs">
                💡 <strong>Tip:</strong> Use multiple devices with round-robin distribution for high-volume messaging
                while maintaining account health across all connected devices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Business API Features</h2>
            <p className="text-gray-500 text-lg">Comprehensive WhatsApp and Telegram messaging capabilities</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "WhatsApp Text Messaging", desc: "Send text messages through WhatsApp using the Baileys WhatsApp Web protocol. Supports emoji, formatting, and message queuing." },
              { title: "WhatsApp Media Messages", desc: "Send images, videos, audio files, and documents through WhatsApp. Supports thumbnail generation and automatic media processing." },
              { title: "Telegram Text Messaging", desc: "Send text messages via Telegram MTProto API with higher rate limits than the Bot API. Message any phone number on Telegram." },
              { title: "Telegram Media Messages", desc: "Send images, videos, audio files, and documents through Telegram. Full media type support with automatic compression." },
              { title: "Session Persistence", desc: "Persistent device sessions that survive server restarts. Automatic session restoration ensures continuous messaging availability." },
              { title: "Multi-Device Management", desc: "Manage unlimited WhatsApp and Telegram devices from a single dashboard. View status, proxy config, and activity logs." },
              { title: "RESTful API Design", desc: "Clean HTTP REST API for all messaging operations. Simple authentication with tenant API keys. JSON request/response format." },
              { title: "OTT Worker Processing", desc: "Background OTT Worker manages device connections, message queuing, media processing, and automatic reconnection with exponential backoff." },
              { title: "Bulk Message Support", desc: "Send messages to multiple recipients in a single API call. Message queuing with rate limiting per device for account safety." },
            ].map((f, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition group">
                <h3 className="text-gray-900 font-semibold text-lg mb-2 group-hover:text-blue-600 transition">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">WhatsApp & Telegram API — FAQ</h2>
            <p className="text-gray-500">Common questions about the Business API</p>
          </div>
          <div className="space-y-4">
            {[
              { q: "Do I need a business verification for WhatsApp API?", a: "Net2APP uses the Baileys library which implements the WhatsApp Web protocol — the same method used by WhatsApp Web and the desktop app. You do NOT need WhatsApp Business API approval or a verified business account. Any WhatsApp account can be connected via QR code pairing." },
              { q: "What are the advantages of MTProto over Telegram Bot API?", a: "MTProto (used by the Telegram mobile/desktop app) offers: (1) Higher rate limits — send more messages per second. (2) Message any phone number, not just users who started a chat with a bot. (3) Full media support including all file types. (4) Access to your personal contacts and groups. The Bot API has stricter limits and limited functionality." },
              { q: "Can I use both WhatsApp and Telegram with the same API key?", a: "Yes. The Net2APP Business API uses a single tenant API key for both WhatsApp and Telegram endpoints. You specify the device_id in the API request to select which paired device to send from. This allows unified API integration for both messaging platforms." },
              { q: "How does the OTT Worker maintain connections?", a: "The OTT Worker is a background Node.js process (src/workers/ott-worker.ts) that maintains persistent WebSocket connections for each paired device. It handles: automatic reconnection on disconnection with exponential backoff, session persistence to database, media download for incoming messages, and keep-alive pings to detect connection drops." },
              { q: "Is there a limit on how many messages I can send?", a: "Message rates are limited per device to maintain account health. Default rate limits are configurable from the dashboard. For high-volume WhatsApp messaging, we recommend using multiple paired devices with round-robin message distribution for optimal throughput." },
            ].map((faq, i) => (
              <details key={i} className="bg-white border border-gray-100 rounded-xl shadow-sm group open:border-blue-500/50 transition">
                <summary className="text-gray-900 font-medium px-6 py-4 cursor-pointer list-none flex items-center justify-between group-open:border-b border-gray-100">
                  <span>{faq.q}</span>
                  <span className="text-blue-400 text-xl group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-6 py-4">
                  <p className="text-gray-600 text-sm leading-relaxed">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Start Using WhatsApp & Telegram API — Free</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your Business API gateway with WhatsApp and Telegram support. Multi-device management, persistent sessions, and full REST API. No setup fees.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div>
              <span className="text-white font-semibold text-lg">Net2APP</span>
            </Link>
            <p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform • Multi-Tenant SaaS</p>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <Link href="/" className="text-blue-400 hover:text-white text-sm transition">Home</Link>
              <Link href="/http-sms-api" className="text-blue-400 hover:text-white text-sm transition">HTTP SMS API</Link>
              <Link href="/ip-whitelisting" className="text-blue-400 hover:text-white text-sm transition">IP Whitelisting</Link>
              <Link href="/case-studies" className="text-blue-400 hover:text-white text-sm transition">Case Studies</Link>
              <Link href="/comparisons" className="text-blue-400 hover:text-white text-sm transition">Comparisons</Link>
              <Link href="/webmail" className="text-blue-400 hover:text-white text-sm transition">Webmail</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center">
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p>
          </div>
        </div>
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
