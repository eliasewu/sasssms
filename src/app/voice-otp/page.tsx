import type { Metadata } from "next";
import Link from "next/link";
import { pickFaqs, faqSchema, type FaqItem } from "@/lib/tenant-faq";

// Page FAQ — tenant-guide questions relevant to this page plus the strongest
// page-specific questions.
const PAGE_FAQS: FaqItem[] = [
  ...pickFaqs(1, 2, 13),
  { q: "What is the difference between Voice OTP and SMS OTP?", a: "Voice OTP delivers the one-time password via an automated phone call rather than an SMS text message. Voice OTP is useful when SMS delivery is unreliable (e.g., in regions with poor SMS infrastructure), for accessibility purposes (users with visual impairments), or as a security measure against SIM-swap attacks and SS7 vulnerabilities that can intercept SMS messages." },
  { q: "How does language detection work for Voice OTP calls?", a: "Net2APP Voice OTP extracts the MCC (Mobile Country Code) from the destination phone number's country code prefix. It then maps this MCC to the most common language for that country using a database of 220+ countries. For example, a Bangladeshi number (+880) will receive the OTP in Bengali, while an Indian number (+91) will receive it in Hindi or English based on configuration." },
  { q: "Is Voice OTP more secure than SMS OTP?", a: "Voice OTP is generally considered more secure than SMS OTP because it is not vulnerable to SS7 signaling attacks or SIM-swap attacks that can intercept SMS messages. Voice-based delivery adds an additional layer of security for high-value transactions and sensitive authentication flows." },
];



export const metadata: Metadata = {
  title: "Voice OTP Service — Call-Based One-Time Password Delivery",
  description:
    "Net2APP Voice OTP delivers one-time passwords via phone call using Asterisk AMI integration. Supports 220+ countries with automatic MCC language detection, alphanumeric OTPs (A-Z, 0-9), and 3-retry call logic. Voice OTP API with SIP trunking.",
  keywords: [
    "Voice OTP", "Call OTP", "Voice Call OTP", "Phone Call OTP",
    "Asterisk AMI OTP", "Voice OTP API", "Voice Verification",
    "Two-Factor Authentication Voice", "2FA Voice Call",
    "OTP Over Phone", "Voice OTP Service", "Voice OTP Gateway",
    "Alphanumeric Voice OTP", "MCC Language Detection",
    "SIP Trunk OTP", "Voice OTP Bangladesh", "Voice OTP India",
    "Voice OTP UAE", "Voice OTP Middle East",
    "Programmable Voice OTP", "Cloud Voice OTP",
    "Voice OTP Platform", "Call-Based OTP Delivery",
  ],
  openGraph: {
    title: "Voice OTP Service — Call-Based OTP Delivery",
    description:
      "Deliver one-time passwords via phone call with automatic language detection across 220+ countries. Alphanumeric OTPs, 3-retry logic, Asterisk AMI integration.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/voice-otp#webpage",
      "url": "https://net2app.com/voice-otp",
      "name": "Voice OTP Service — Call-Based One-Time Password Delivery",
      "description":
        "Net2APP Voice OTP delivers one-time passwords via phone call. Supports 220+ countries, automatic MCC language detection, alphanumeric OTPs.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "Voice OTP", "item": "https://net2app.com/voice-otp" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/voice-otp#faq",
      "mainEntity": faqSchema(PAGE_FAQS),
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://net2app.com/voice-otp#app",
      "name": "Net2APP Voice OTP Service",
      "url": "https://net2app.com/voice-otp",
      "description": "Call-based one-time password delivery service with Asterisk AMI integration, 220+ country MCC language detection, alphanumeric OTP support (A-Z, 0-9), and 3-retry call logic.",
      "applicationCategory": "SecurityApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free to start. No setup fees. Pay-as-you-go Voice OTP pricing."
      },
      "featureList": [
        "220+ Country MCC-Based Automatic Language Detection",
        "Asterisk AMI Integration for Reliable Call Origination",
        "Alphanumeric OTP Support: A-Z Letters and 0-9 Digits",
        "3-Retry Call Logic with Configurable Intervals",
        "RESTful HTTP API for Voice OTP Integration",
        "SIP Trunk Configuration with Multi-Provider Failover",
        "Custom Audio Greetings in Multiple Languages",
        "Real-Time Call Logging and Analytics Dashboard",
        "Multi-Tenant Isolation with PostgreSQL Schema Separation",
        "Webhook Callbacks for Call Status and Delivery Events"
      ]
    },
  ],
};

export default function VoiceOTPPage() {
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
              <span className="text-blue-700 text-sm font-medium">Voice OTP Service — 220+ Countries</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
              Voice OTP API
              <span className="block bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Call-Based Authentication</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Deliver one-time passwords via automated phone calls with automatic language detection across 220+ countries.
              Net2APP Voice OTP integrates with <strong className="text-gray-900">Asterisk AMI</strong> for reliable call origination,
              supports <strong className="text-gray-900">alphanumeric OTPs</strong> (A-Z, 0-9), and includes
              built-in <strong className="text-gray-900">3-retry logic</strong> with full call logging.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="https://net2app.com"
                className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-lg shadow-sm text-center"
              >
                Deploy Voice OTP Free →
              </a>
              <Link
                href="/sms-routing"
                className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-semibold text-lg text-center"
              >
                Explore SMS Routing
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
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Deploy Voice OTP in 60 Seconds</h2>
          <p className="text-blue-100 text-lg mb-8">No setup fees, no hidden fees. Deploy your Voice OTP service with Asterisk AMI integration, 220+ country support, and alphanumeric OTP delivery.</p>
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
              <Link href="/sms-routing" className="text-blue-400 hover:text-white text-sm transition">SMS Routing</Link>
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

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
