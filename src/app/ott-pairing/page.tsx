import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "OTT Device Pairing — WhatsApp & Telegram Device Connection | Net2APP",
  description:
    "Net2APP OTT device pairing enables WhatsApp and Telegram messaging through QR code device pairing. Connect WhatsApp Web/WhatsApp Business via QR code pairing code, and Telegram accounts via MTProto API. Includes persistent session management for stable connections.",
  keywords: [
    "OTT Device Pairing", "WhatsApp Pairing", "WhatsApp QR Code",
    "Telegram Pairing", "WhatsApp Web API", "Telegram MTProto",
    "WhatsApp Business Pairing", "Baileys WhatsApp", "WhiskeySockets",
    "WhatsApp Device Connection", "Telegram Device Connection",
    "OTT Messaging Gateway", "WhatsApp API Gateway",
    "Telegram API Gateway", "Multi-Device WhatsApp",
    "QR Code Pairing", "WhatsApp Session Management",
    "Telegram Session Management", "OTT Device Management",
    "WhatsApp Cloud API Alternative", "Telegram Bot API",
  ],
  openGraph: {
    title: "OTT Device Pairing — WhatsApp & Telegram | Net2APP",
    description:
      "Connect WhatsApp and Telegram devices via QR code pairing. Baileys-powered WhatsApp integration with multi-device support and MTProto Telegram API connection.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/ott-pairing#webpage",
      "url": "https://net2app.com/ott-pairing",
      "name": "OTT Device Pairing — WhatsApp & Telegram",
      "description":
        "Net2APP OTT device pairing enables WhatsApp and Telegram messaging through QR code device pairing.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "OTT Device Pairing", "item": "https://net2app.com/ott-pairing" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/ott-pairing#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is OTT device pairing?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "OTT (Over-The-Top) device pairing is the process of connecting a WhatsApp or Telegram account to the Net2APP platform for automated messaging. WhatsApp uses QR code pairing (similar to WhatsApp Web) through the Baileys library, while Telegram uses MTProto API connection with API ID and hash. Once paired, messages can be sent programmatically through the Net2APP Business API.",
          },
        },
        {
          "@type": "Question",
          "name": "How does WhatsApp device pairing work on Net2APP?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP uses the WhiskeySockets/Baileys library (a lightweight WhatsApp Web API implementation) to pair WhatsApp devices. The process is: (1) Initiate pairing via the dashboard or API, (2) Scan the generated QR code with WhatsApp, (3) The session is persisted and maintained automatically. Supports WhatsApp multi-device mode for stable long-term connections.",
          },
        },
        {
          "@type": "Question",
          "name": "How does Telegram device connection work?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Telegram devices are connected using MTProto API. You provide your Telegram API ID and API Hash (obtained from my.telegram.org), and Net2APP establishes an authenticated session. This enables sending messages, media, and files through Telegram's native protocol with higher rate limits than the Bot API.",
          },
        },
        {
          "@type": "Question",
          "name": "What is the OTT worker and how does it function?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The OTT (Over-The-Top) Worker is a background process that manages WhatsApp and Telegram device connections. It handles session persistence, automatic reconnection, media downloading/uploading (including images, video, audio, documents), incoming message processing, and pairing status monitoring. The worker ensures OTT devices remain connected and operational at all times.",
          },
        },
        {
          "@type": "Question",
          "name": "How does Net2APP maintain stable OTT device connections?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP uses official protocols — WhatsApp Web (via Baileys) and Telegram MTProto — for direct, stable device connections. The OTT Worker maintains persistent WebSocket/MTProto sessions with automatic reconnection and exponential backoff. Sessions are persisted to the database and restored automatically on server restart, ensuring continuous availability.",
          },
        },
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://net2app.com/ott-pairing#app",
      "name": "Net2APP OTT Device Pairing Engine",
      "url": "https://net2app.com/ott-pairing",
      "description": "OTT device pairing engine for WhatsApp and Telegram. QR code device pairing via Baileys library, MTProto API connection, multi-device support, and automatic session persistence with exponential backoff reconnection.",
      "applicationCategory": "CommunicationApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free to start. No setup fees. Pay-as-you-go pricing."
      },
      "featureList": [
        "QR Code WhatsApp Device Pairing via Baileys Library",
        "Telegram MTProto API Connection with API ID and Hash",
        "Multi-Device Support with Independent Session Management",
        "Automatic Session Persistence and Database-Backed Storage",
        "Exponential Backoff Reconnection on Connection Drops",
        "Media Download Support: Images, Video, Audio, Documents",
        "Real-Time Pairing Status Dashboard and Monitoring",
        "Unpair and Re-pair Devices Without Data Conflicts",
        "OTT Worker Background Process for Connection Management",
        "Full Business API Integration for Programmatic Messaging"
      ]
    },
  ],
};

export default function OttPairingPage() {
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
              <span className="text-blue-700 text-sm font-medium">OTT Pairing — WhatsApp + Telegram</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
              OTT Device Pairing
              <span className="block bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">WhatsApp & Telegram API Connection</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Connect WhatsApp and Telegram accounts to your SMS platform via <strong className="text-gray-900">QR code device pairing</strong>.
              Powered by <strong className="text-gray-900">Baileys (WhiskeySockets)</strong> for WhatsApp and <strong className="text-gray-900">MTProto</strong> for Telegram.
              Includes automatic session persistence, multi-device support, and persistent session management.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="https://net2app.com" className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-lg shadow-sm text-center">
                Deploy OTT Pairing Free →
              </a>
              <Link href="/whatsapp-telegram-api" className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-semibold text-lg text-center">
                Business API Details
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "QR", label: "WhatsApp Pairing", desc: "Scan QR code to connect device" },
              { value: "MTProto", label: "Telegram API", desc: "MTProto protocol connection" },
              { value: "∞", label: "Multi-Device", desc: "Unlimited device connections" },
              { value: "Auto", label: "Session Persistence", desc: "Automatic reconnection" },
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

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">How OTT Device Pairing Works</h2>
            <p className="text-gray-500 text-lg">Connect WhatsApp and Telegram devices in three simple steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* WhatsApp */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">💚</span>
                <h3 className="text-2xl font-bold text-white">WhatsApp Pairing</h3>
              </div>
              <div className="space-y-6">
                {[
                  { step: "1", title: "Initiate Pairing", desc: "From the Net2APP dashboard, click 'Pair New Device' under OTT Devices. A QR code is generated by the Baileys WhatsApp Web library." },
                  { step: "2", title: "Scan QR Code", desc: "Open WhatsApp on your phone → Menu → Linked Devices → Link a Device. Scan the QR code displayed on the dashboard." },
                  { step: "3", title: "Connected", desc: "The device appears as 'Connected' in the dashboard. The OTT Worker persists the session and maintains the connection automatically with reconnection logic." },
                  { step: "4", title: "Start Messaging", desc: "Once paired, send WhatsApp messages programmatically through the Net2APP Business API with persistent session management." },
                ].map((s, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">{s.step}</div>
                    <div>
                      <h4 className="text-white font-medium text-sm">{s.title}</h4>
                      <p className="text-gray-500 text-xs mt-1 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Telegram */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">🔵</span>
                <h3 className="text-2xl font-bold text-white">Telegram Connection</h3>
              </div>
              <div className="space-y-6">
                {[
                  { step: "1", title: "Get API Credentials", desc: "Visit my.telegram.org, log in with your phone number, and retrieve your API ID and API Hash from the App Configuration section." },
                  { step: "2", title: "Enter Credentials", desc: "In the Net2APP dashboard, go to OTT Devices → Add Telegram Device. Enter your API ID and API Hash." },
                  { step: "3", title: "Authenticate", desc: "Enter the verification code sent to your Telegram account. The system establishes an MTProto connection using the telegram library." },
                  { step: "4", title: "Connected", desc: "Your Telegram account is now connected. Send messages via the Business API with MTProto's higher rate limits compared to Bot API." },
                ].map((s, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">{s.step}</div>
                    <div>
                      <h4 className="text-white font-medium text-sm">{s.title}</h4>
                      <p className="text-gray-500 text-xs mt-1 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">OTT Device Pairing Features</h2>
            <p className="text-gray-500 text-lg">Enterprise-grade OTT device management for WhatsApp and Telegram</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "QR Code WhatsApp Pairing", desc: "Quick and secure QR code-based device pairing using the Baileys (WhiskeySockets) library. No third-party services required — direct WhatsApp Web protocol implementation." },
              { title: "Telegram MTProto API", desc: "Full MTProto protocol support for Telegram connections using your personal API ID and Hash. Higher rate limits compared to the standard Bot API." },
              { title: "Multi-Device Support", desc: "Pair multiple WhatsApp and Telegram devices simultaneously. Each device has independent session management, status monitoring, and proxy configuration." },
              { title: "Automatic Session Persistence", desc: "Sessions are persisted to the database and automatically restored on server restart. The OTT Worker handles reconnection with exponential backoff." },
              { title: "Persistent Sessions", desc: "Device sessions are persisted to the database and restored automatically. The OTT Worker maintains connections with exponential backoff reconnection." },
              { title: "Pairing Status Dashboard", desc: "Real-time monitoring of all OTT device connections. View connection status (Connected/Connecting/Disconnected/Error), last activity, and proxy configuration." },
              { title: "Unpair & Re-pair", desc: "Easily unpair devices that are no longer needed and re-pair new devices. Session data is cleaned up properly on unpair to prevent conflicts." },
              { title: "Media Download Support", desc: "Automatic media downloading for incoming messages — images, videos, audio files, and documents are processed by the OTT Worker and stored for API access." },
              { title: "Business API Integration", desc: "Paired OTT devices are fully integrated with the Net2APP Business API. Send WhatsApp and Telegram messages programmatically via REST API endpoints." },
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
      <section id="faq" className="py-20 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">OTT Device Pairing — FAQ</h2>
            <p className="text-gray-500">Common questions about WhatsApp and Telegram device pairing</p>
          </div>
          <div className="space-y-4">
            {[
              { q: "Is the WhatsApp pairing safe and secure?", a: "Yes. Net2APP uses the Baileys library, which is an open-source implementation of the WhatsApp Web protocol. The QR code pairing process is the same official method used by WhatsApp Web. All sessions are encrypted and stored securely in the database. No third-party servers are involved in the pairing process." },
              { q: "Will my WhatsApp account get banned for using OTT pairing?", a: "Net2APP uses the official WhatsApp Web protocol (via Baileys) which is the same method used by WhatsApp Web and the WhatsApp desktop app. Using residential proxies and following reasonable usage patterns (not sending bulk messages at very high rates) helps maintain account health." },
              { q: "How many OTT devices can I pair?", a: "You can pair an unlimited number of WhatsApp and Telegram devices. Each device has independent session management, status monitoring, and proxy configuration. Your plan's TPS limit applies cumulatively across all paired devices." },
              { q: "What happens if the OTT device disconnects?", a: "The OTT Worker automatically detects disconnections and attempts to reconnect with exponential backoff. The worker runs as a background process (npx tsx src/workers/ott-worker.ts) and can be configured to restart automatically via process managers like systemd or PM2." },
              { q: "How do I maintain stable OTT device connections?", a: "Net2APP's OTT Worker automatically maintains persistent connections with automatic reconnection and session persistence. The worker handles connection drops with exponential backoff and restores sessions on server restart. Using reasonable message rates and avoiding spam patterns helps maintain account health." },
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
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Start Pairing OTT Devices — Free</h2>
          <p className="text-blue-100 text-lg mb-8">Connect WhatsApp and Telegram devices to your SMS platform. QR code pairing, MTProto support, persistent sessions, and full Business API integration. No setup fees.</p>
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
              <Link href="/voice-otp" className="text-blue-400 hover:text-white text-sm transition">Voice OTP</Link>
              <Link href="/http-sms-api" className="text-blue-400 hover:text-white text-sm transition">HTTP SMS API</Link>
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
