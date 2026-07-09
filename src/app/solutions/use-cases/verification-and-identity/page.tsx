import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verification & Identity — SMS OTP, Voice OTP & 2FA Solutions | Net2APP",
  description:
    "Deliver one-time passwords (OTPs) via SMS, Voice Call, WhatsApp, and Telegram for user verification, account registration, password reset, and two-factor authentication (2FA) with 220+ country support.",
  keywords: [
    "Identity Verification SMS",
    "SMS OTP Verification",
    "Voice OTP 2FA",
    "Two-Factor Authentication SMS",
    "Multi-Factor Authentication",
    "OTP Delivery SMS",
    "Phone Number Verification",
    "Account Verification",
    "WhatsApp OTP",
    "Telegram OTP",
    "Alphanumeric OTP",
    "MCC Language Detection",
    "220 Country OTP",
    "SMS 2FA API",
    "Verification Bangladesh",
    "OTP India",
    "2FA UAE",
    "User Authentication SMS",
    "Password Reset SMS",
  ],
  openGraph: {
    title: "Verification & Identity — OTP Delivery Solutions | Net2APP",
    description: "SMS OTP, Voice OTP, WhatsApp and Telegram verification with 99.9% uptime and 220+ country language detection.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/solutions/use-cases/verification-and-identity#webpage",
      "url": "https://net2app.com/solutions/use-cases/verification-and-identity",
      "name": "Verification & Identity — SMS OTP, Voice OTP & 2FA",
      "description": "Deliver one-time passwords (OTPs) via SMS, Voice Call, WhatsApp, and Telegram for user verification, account registration, password reset, and two-factor authentication (2FA) with 220+ country support.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://net2app.com"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Solutions",
            "item": "https://net2app.com/solutions"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "Verification & Identity",
            "item": "https://net2app.com/solutions/use-cases/verification-and-identity"
          }
        ]
      }
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/solutions/use-cases/verification-and-identity#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What OTP delivery channels does Net2APP support?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP supports SMS OTP, Voice OTP (via Asterisk AMI with 3-retry logic), WhatsApp OTP, and Telegram OTP. The intelligent routing engine selects the optimal channel based on the user's country, carrier, and delivery preferences across 220+ countries."
          }
        },
        {
          "@type": "Question",
          "name": "How does MCC-based language detection work for Voice OTP?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "When a Voice OTP call is placed, Net2APP detects the recipient's Mobile Country Code (MCC) and automatically selects the appropriate language for the spoken OTP message. This ensures users worldwide receive verification calls in their local language without manual configuration."
          }
        },
        {
          "@type": "Question",
          "name": "Can I use alphanumeric sender IDs for OTP messages?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Net2APP supports alphanumeric sender IDs (A-Z, 0-9) for SMS OTP messages, allowing your verification messages to appear from your brand name rather than a random number. This increases trust and open rates for verification messages."
          }
        },
        {
          "@type": "Question",
          "name": "Is the OTP verification platform multi-tenant ready?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Net2APP is built on a multi-tenant architecture with PostgreSQL schema isolation, ensuring each tenant's OTP data, API keys, and verification logs are completely separated. Each tenant gets dedicated database schemas, SIP trunks, and SMS routes for maximum security."
          }
        }
      ]
    }
  ]
};

export default function VerificationIdentityPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200"><div className="max-w-7xl mx-auto px-6 lg:px-8"><div className="flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span>
        </Link>
          <div className="hidden lg:flex items-center gap-1">
            <Link href="/solutions/use-cases" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Use Cases</Link>
          </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</a>
      </div></div></nav>

      <section className="max-w-6xl mx-auto px-6 lg:px-12 pt-16 pb-20">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/solutions/use-cases" className="text-blue-600 hover:text-blue-700 font-medium text-sm transition">← Back to Use Cases</Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-6xl mb-4 block">✅</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">Verification & Identity</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">
              Deliver one-time passwords (OTPs) via SMS, Voice Call, WhatsApp, and Telegram for user verification,
              account registration, password reset, and two-factor authentication (2FA).
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="https://net2app.com" className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Deploy Your Instance →</a>
              <Link href="/voice-otp" className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-semibold">Learn About Voice OTP</Link>
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Capabilities</h2>
            <ul className="space-y-3">
              {["SMS OTP delivery with 99.9% uptime", "Voice OTP with Asterisk AMI and 3-retry logic", "Alphanumeric OTP support (A-Z, 0-9)", "220+ country language detection via MCC", "WhatsApp and Telegram OTP delivery", "Multi-tenant architecture with data isolation"].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "1", title: "User Requests OTP", desc: "User initiates login, registration, or transaction — your app requests an OTP via Net2APP's API." },
              { step: "2", title: "Intelligent Delivery", desc: "Net2APP selects the optimal channel (SMS, Voice, WhatsApp, Telegram) based on user's country and preferences." },
              { step: "3", title: "Verification Complete", desc: "User receives OTP, enters it in your app, and verification is confirmed via API callback." },
            ].map((s, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-2xl p-6 shadow-sm text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-blue-600 font-bold text-xl">{s.step}</span></div>
                <h3 className="text-gray-900 font-semibold mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Related Solutions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/voice-otp" className="bg-gray-50 border border-gray-100 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition group text-center">
              <span className="text-3xl block mb-2">📞</span>
              <span className="text-gray-900 font-semibold group-hover:text-blue-600 transition">Voice OTP</span>
            </Link>
            <Link href="/solutions/use-cases/fraud-prevention" className="bg-gray-50 border border-gray-100 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition group text-center">
              <span className="text-3xl block mb-2">🛡️</span>
              <span className="text-gray-900 font-semibold group-hover:text-blue-600 transition">Fraud Prevention</span>
            </Link>
            <Link href="/solutions/use-cases/alerts-and-notifications" className="bg-gray-50 border border-gray-100 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition group text-center">
              <span className="text-3xl block mb-2">🔔</span>
              <span className="text-gray-900 font-semibold group-hover:text-blue-600 transition">Alerts & Notifications</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Ready to Add Verification?</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your own SMS & Voice OTP gateway in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>

      <footer className="py-12 bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link>
            <p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link>
              <Link href="/solutions/use-cases" className="text-blue-400 hover:text-white text-sm transition">Use Cases</Link>
              <Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div>
        </div>
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
