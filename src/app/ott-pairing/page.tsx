import type { Metadata } from "next";
import Link from "next/link";
import { pickFaqs, faqSchema, type FaqItem } from "@/lib/tenant-faq";

// Page FAQ — tenant-guide questions relevant to this page plus the strongest
// page-specific questions.
const PAGE_FAQS: FaqItem[] = [
  ...pickFaqs(1, 10, 13),
  { q: "Is the WhatsApp pairing safe and secure?", a: "Yes. Net2APP uses the Baileys library, which is an open-source implementation of the WhatsApp Web protocol. The QR code pairing process is the same official method used by WhatsApp Web. All sessions are encrypted and stored securely in the database. No third-party servers are involved in the pairing process." },
  { q: "What happens if the OTT device disconnects?", a: "The OTT Worker automatically detects disconnections and attempts to reconnect with exponential backoff. The worker runs as a background process (npx tsx src/workers/ott-worker.ts) and can be configured to restart automatically via process managers like systemd or PM2." },
];



export const metadata: Metadata = {
  title: "OTT Device Pairing — WhatsApp & Telegram Device Connection",
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
    title: "OTT Device Pairing — WhatsApp & Telegram",
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
      "mainEntity": faqSchema(PAGE_FAQS),
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
