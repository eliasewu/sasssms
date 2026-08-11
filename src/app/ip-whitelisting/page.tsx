import type { Metadata } from "next";
import Link from "next/link";
import { pickFaqs, faqSchema, type FaqItem } from "@/lib/tenant-faq";

// Page FAQ — tenant-guide questions relevant to this page plus the strongest
// page-specific questions.
const PAGE_FAQS: FaqItem[] = [
  ...pickFaqs(1, 4, 13),
  { q: "Is IP whitelisting required or optional?", a: "IP whitelisting is optional but strongly recommended for production API integrations. It provides an additional security layer beyond API key authentication. You can enable it per API key from the dashboard and add trusted IP addresses as needed." },
  { q: "Can I use IP whitelisting with the SMPP gateway?", a: "Yes. IP whitelisting extends to all Net2APP services including the SMPP v3.4 gateway. SMPP bind requests from non-whitelisted IPs are rejected at the network level before any SMPP protocol negotiation begins." },
];



export const metadata: Metadata = {
  title: "IP Whitelisting — API Security & Access Control",
  description:
    "Net2APP IP whitelisting provides API security with IP-based access control. Restrict API access to trusted IP addresses only. Supports IPv4, CIDR notation, per-API-key whitelists, and real-time IP management from the dashboard. Secure your SMS gateway, Voice OTP, and Business API endpoints.",
  keywords: [
    "IP Whitelisting", "IP Allowlisting", "API Security",
    "IP-based Access Control", "SMS API Security",
    "IP Restriction", "IP Filtering", "CIDR Whitelist",
    "IPv4 Whitelist", "API Key Security",
    "SMS Gateway Security", "Secure SMS API",
    "Voice OTP Security", "Business API Security",
    "IP Access Management", "Network Security",
    "SMS Platform Security", "Multi-Tenant API Security",
    "IP Whitelist API", "Restrict API Access",
    "Secure HTTP SMS API", "Firewall SMS Gateway",
    "API Authentication", "IP Validation",
  ],
  openGraph: {
    title: "IP Whitelisting — API Security & Access Control",
    description:
      "Secure your SMS gateway API with IP whitelisting. Restrict access to trusted IPs. Supports IPv4, CIDR, and per-key whitelists.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/ip-whitelisting#webpage",
      "url": "https://net2app.com/ip-whitelisting",
      "name": "IP Whitelisting — API Security & Access Control",
      "description":
        "Secure your Net2APP API endpoints with IP whitelisting. Restrict access to trusted IP addresses. IPv4, CIDR, and per-API-key support.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "IP Whitelisting", "item": "https://net2app.com/ip-whitelisting" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/ip-whitelisting#faq",
      "mainEntity": faqSchema(PAGE_FAQS),
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://net2app.com/ip-whitelisting#app",
      "name": "Net2APP IP Whitelisting Security",
      "url": "https://net2app.com/ip-whitelisting",
      "description": "API security with IP-based access control. Restrict API access to trusted IPv4 addresses and CIDR ranges with per-API-key whitelists and real-time management.",
      "applicationCategory": "SecurityApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free to start. No setup fees. Included with all Net2APP plans."
      },
      "featureList": [
        "IPv4 Address Whitelisting with Exact Match Support",
        "CIDR Notation Range Whitelisting (e.g., 192.168.1.0/24)",
        "Per-API-Key Whitelist Configuration for Granular Control",
        "Real-Time Whitelist Updates Without Service Interruption",
        "403 Forbidden Response for Non-Whitelisted IPs",
        "Dashboard and REST API Management of Whitelist Entries",
        "Multi-Tenant Isolation with Independent IP Whitelists",
        "Defense in Depth: IP Whitelisting + API Key + Rate Limiting",
        "Audit Logging of Blocked Requests and Access Attempts",
        "SMPP Gateway IP Whitelisting at Network Level"
      ]
    },
  ],
};

export default function IpWhitelistingPage() {
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
              <span className="text-blue-700 text-sm font-medium">API Security — IP Access Control</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
              IP Whitelisting
              <span className="block bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">API Security & Access Control</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Restrict API access to <strong className="text-gray-900">trusted IP addresses only</strong>.
              Net2APP IP whitelisting provides an <strong className="text-gray-900">additional layer of security</strong> beyond API key authentication.
              Supports <strong className="text-gray-900">IPv4 addresses</strong>, <strong className="text-gray-900">CIDR notation</strong> ranges,
              and <strong className="text-gray-900">per-API-key whitelist</strong> configuration.
              Manage whitelist entries from the dashboard or via the REST API.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="https://net2app.com" className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-lg shadow-sm text-center">
                Deploy Secure API Free →
              </a>
              <Link href="/http-sms-api" className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-semibold text-lg text-center">
                HTTP SMS API
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
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Secure Your API with IP Whitelisting — Free</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your secure SMS gateway with IP whitelisting, API key authentication, and rate limiting. No setup fees. Enterprise-grade security for your SMS infrastructure.</p>
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
              <Link href="/sms-routing" className="text-blue-400 hover:text-white text-sm transition">SMS Routing</Link>
              <Link href="/voice-otp" className="text-blue-400 hover:text-white text-sm transition">Voice OTP</Link>
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
