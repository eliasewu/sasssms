import type { Metadata } from "next";
import Link from "next/link";
import { pickFaqs, faqSchema, type FaqItem } from "@/lib/tenant-faq";

// Page FAQ — tenant-guide questions relevant to this page plus the strongest
// page-specific questions.
const PAGE_FAQS: FaqItem[] = [
  ...pickFaqs(1, 10, 13),
  { q: "Do I need a business verification for WhatsApp API?", a: "Net2APP uses the Baileys library which implements the WhatsApp Web protocol — the same method used by WhatsApp Web and the desktop app. You do NOT need WhatsApp Business API approval or a verified business account. Any WhatsApp account can be connected via QR code pairing." },
  { q: "What are the advantages of MTProto over Telegram Bot API?", a: "MTProto (used by the Telegram mobile/desktop app) offers: (1) Higher rate limits — send more messages per second. (2) Message any phone number, not just users who started a chat with a bot. (3) Full media support including all file types. (4) Access to your personal contacts and groups. The Bot API has stricter limits and limited functionality." },
];



export const metadata: Metadata = {
  title: "WhatsApp & Telegram Business API — Multi-Device Messaging Gateway",
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
    title: "WhatsApp & Telegram Business API — Multi-Device Messaging",
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
      "mainEntity": faqSchema(PAGE_FAQS),
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
          <Link href="/faq" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition hidden md:block">FAQ</Link>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</a>
          </div>
        </div>
      </div></nav>

      {/* Hero */}
      <section id="faq" className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-20 scroll-mt-20">
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
            {PAGE_FAQS.map((faq, i) => (
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
              <Link href="/faq" className="text-blue-400 hover:text-white text-sm transition">FAQ</Link>
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
