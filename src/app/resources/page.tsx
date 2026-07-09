import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Resources — SMS Gateway Documentation, Guides & API Reference | Net2APP",
  description:
    "Net2APP resources hub: SMS API documentation, integration guides, SMPP tutorials, Voice OTP setup, RCS messaging docs, WhatsApp Business API guides, and more. Everything you need to deploy and manage your SMS gateway platform.",
  keywords: [
    "SMS Gateway Documentation", "SMS API Documentation", "SMPP Tutorial",
    "Voice OTP Guide", "SMS Integration Guide", "SMS Gateway Setup",
    "SMS API Reference", "SMS Developer Docs", "SMS Platform Documentation",
    "SMS Gateway Resources", "SMS Guides", "CPaaS Documentation",
    "SMS API Tutorial", "Bulk SMS Guide", "RCS Documentation",
    "WhatsApp Business API Guide", "SMS Routing Documentation",
    "SMS DLR Documentation", "SMS Gateway Help", "SMS Platform Guide",
    "SMPP v3.4 Tutorial", "Asterisk Voice OTP Guide",
  ],
  openGraph: {
    title: "Resources — SMS Gateway Documentation & Guides | Net2APP",
    description:
      "Complete SMS gateway documentation, API references, integration guides, and tutorials. SMPP, HTTP API, Voice OTP, RCS, and OTT messaging resources.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/resources#webpage",
      "url": "https://net2app.com/resources",
      "name": "Resources — SMS Gateway Documentation & Guides | Net2APP",
      "description": "Complete SMS gateway documentation, integration guides, SDK references, and tutorials for Net2APP multi-tenant SMS platform.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "Resources", "item": "https://net2app.com/resources" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/resources#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Where can I find the complete SMS API documentation?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP provides comprehensive API documentation at net2app.com/api-documentation covering all endpoints — SMS, Voice OTP, RCS, WhatsApp, and Telegram. Additionally, each feature page (HTTP SMS API, Voice OTP, SMS Routing) includes dedicated API reference sections with code examples in Node.js, Python, and PHP.",
          },
        },
        {
          "@type": "Question",
          "name": "Do you provide code examples and SDKs for SMS integration?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. The API Documentation includes ready-to-use code examples in Node.js, Python, and PHP for common tasks like sending SMS, triggering Voice OTP, and setting up DLR webhooks. While we don't offer standalone SDKs, the RESTful API design makes integration straightforward from any programming language with HTTP client support.",
          },
        },
        {
          "@type": "Question",
          "name": "How do I get started with deploying my SMS gateway?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Deploying your SMS gateway takes under 60 seconds. Visit net2app.com, create a free account, and your isolated multi-tenant SMS platform is provisioned instantly. Then explore the Setup Guides section for step-by-step instructions on configuring SMPP connections, HTTP API access, Voice OTP, and more.",
          },
        },
        {
          "@type": "Question",
          "name": "Is there a sandbox or test environment available?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Every new Net2APP tenant comes with full access to all platform features in a sandbox environment. You can test SMS API calls, configure SMPP connections, set up Voice OTP, and explore routing without any charges. The Starter plan is completely free with no setup fees — perfect for development and testing before going live.",
          },
        },
      ],
    },
    {
      "@type": "ItemList",
      "name": "Net2APP Documentation Resources",
      "numberOfItems": 15,
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "HTTP SMS API Documentation" },
        { "@type": "ListItem", "position": 2, "name": "SMPP Gateway Setup Guide" },
        { "@type": "ListItem", "position": 3, "name": "Voice OTP Configuration" },
        { "@type": "ListItem", "position": 4, "name": "SMS Routing Engine Guide" },
        { "@type": "ListItem", "position": 5, "name": "WhatsApp Business API Guide" },
        { "@type": "ListItem", "position": 6, "name": "RCS Messaging Documentation" },
        { "@type": "ListItem", "position": 7, "name": "OTT Device Pairing Guide" },
        { "@type": "ListItem", "position": 8, "name": "IP Whitelisting Setup" },
        { "@type": "ListItem", "position": 9, "name": "DLR Webhook Integration" },
        { "@type": "ListItem", "position": 10, "name": "Multi-Tenant Architecture" },
        { "@type": "ListItem", "position": 11, "name": "Flash SMS Implementation" },
        { "@type": "ListItem", "position": 12, "name": "SMS Marketing Guide" },
        { "@type": "ListItem", "position": 13, "name": "API Authentication Guide" },
        { "@type": "ListItem", "position": 14, "name": "Billing & Invoicing Setup" },
        { "@type": "ListItem", "position": 15, "name": "Sub-Client Management" },
      ],
    },
  ],
};

const docSections = [
  {
    category: "API Documentation",
    icon: "📡",
    links: [
      { title: "HTTP SMS API Reference", href: "/http-sms-api", desc: "Complete RESTful SMS API documentation — send SMS, RCS, Flash SMS via HTTP POST. Includes DLR webhooks, authentication, and code examples." },
      { title: "API Documentation Overview", href: "/api-documentation", desc: "Overview of all Net2APP APIs — SMS, Voice OTP, WhatsApp, Telegram. Authentication, rate limiting, and best practices." },
      { title: "WhatsApp & Telegram API", href: "/whatsapp-telegram-api", desc: "WhatsApp Business API and Telegram MTProto API documentation. Send messages, media, and manage OTT devices." },
      { title: "SMS Routing API", href: "/sms-routing", desc: "Multi-layer SMS routing engine documentation — Route Plans, Routes, Trunks, and Suppliers API." },
    ],
  },
  {
    category: "Setup Guides",
    icon: "🚀",
    links: [
      { title: "Getting Started Guide", href: "/", desc: "Deploy your SMS gateway in 60 seconds. Step-by-step setup for new tenants including API key generation and first SMS." },
      { title: "SMPP Gateway Setup", href: "/sms-routing", desc: "Configure SMPP v3.4 connections with bind modes, TPS limits, and supplier integration. Complete SMPP setup tutorial." },
      { title: "Voice OTP Configuration", href: "/voice-otp", desc: "Set up Asterisk AMI for Voice OTP delivery. Configure SIP trunks, language detection, and audio files." },
      { title: "OTT Device Pairing", href: "/ott-pairing", desc: "Pair WhatsApp and Telegram devices using QR codes and MTProto API. Configure persistent device sessions." },
    ],
  },
  {
    category: "Feature Guides",
    icon: "📚",
    links: [
      { title: "IP Whitelisting Setup", href: "/ip-whitelisting", desc: "Secure your API with IP-based access control. Configure IPv4 addresses and CIDR ranges per API key." },
      { title: "SMS Routing Architecture", href: "/sms-routing", desc: "Deep dive into the 4-layer SMS routing engine — Route Plans, Routes, Trunks, and Suppliers with auto failover." },
      { title: "DLR Integration Guide", href: "/http-sms-api", desc: "Implement delivery report webhooks for real-time SMS status tracking. Standard DLR status codes and payload format." },
      { title: "RCS Messaging Guide", href: "/http-sms-api", desc: "Create rich communication services messages with images, buttons, carousels, and branded templates." },
    ],
  },
  {
    category: "Platform Reference",
    icon: "🏗️",
    links: [
      { title: "Multi-Tenant Architecture", href: "/", desc: "Understand PostgreSQL schema-based tenant isolation, connection pooling, and multi-tenant data separation." },
      { title: "Pricing & Plans", href: "/pricing", desc: "Complete pricing guide — pay-as-you-go rates, Professional and Enterprise plans, and volume discounts." },
      { title: "Solutions Overview", href: "/solutions", desc: "Explore all use cases, team solutions, and industry-specific SMS gateway implementations." },
    ],
  },
];

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span>
            </Link>
            <div className="hidden lg:flex items-center gap-1">
              <Link href="/" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Home</Link>
              <Link href="/pricing" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Pricing</Link>
              <Link href="/solutions" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Solutions</Link>
              <Link href="/api-documentation" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">API Docs</Link>
            </div>
            <div className="flex items-center gap-3">
              <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started Free</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
            <span className="text-blue-200 text-sm font-medium">Documentation & Resources Hub</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
            SMS Gateway Resources
            <span className="block text-blue-400">Documentation, Guides & API Reference</span>
          </h1>
          <p className="text-lg text-blue-200 max-w-3xl mx-auto mb-10 leading-relaxed">
            Everything you need to build, deploy, and manage your SMS gateway platform.{" "}
            <strong className="text-white">API documentation</strong>,{" "}
            <strong className="text-white">setup guides</strong>,{" "}
            <strong className="text-white">integration tutorials</strong>,{" "}
            and <strong className="text-white">platform references</strong> — all in one place.
          </p>
        </div>
      </section>

      {/* Documentation Sections */}
      {docSections.map((section, si) => (
        <section key={si} className={`py-16 ${si % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
          <div className="max-w-6xl mx-auto px-6 lg:px-12">
            <div className="flex items-center gap-3 mb-8">
              <span className="text-3xl">{section.icon}</span>
              <h2 className="text-2xl font-bold text-gray-900">{section.category}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {section.links.map((link, li) => (
                <Link
                  key={li}
                  href={link.href}
                  className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition group"
                >
                  <h3 className="text-gray-900 font-semibold text-lg mb-2 group-hover:text-blue-600 transition">{link.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{link.desc}</p>
                  <span className="inline-block mt-3 text-blue-600 text-sm font-medium group-hover:translate-x-1 transition-transform">Read more →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Quick Links */}
      <section className="py-16 bg-slate-900">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white mb-2">Quick Reference</h2>
            <p className="text-blue-300 text-sm">Jump to any section of the Net2APP platform</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: "HTTP SMS API", href: "/http-sms-api", icon: "🌐" },
              { label: "Voice OTP", href: "/voice-otp", icon: "📞" },
              { label: "SMS Routing", href: "/sms-routing", icon: "🔀" },
              { label: "WhatsApp API", href: "/whatsapp-telegram-api", icon: "💚" },
              { label: "OTT Pairing", href: "/ott-pairing", icon: "🔗" },
              { label: "IP Whitelisting", href: "/ip-whitelisting", icon: "🛡️" },
              { label: "Pricing", href: "/pricing", icon: "💰" },
              { label: "Solutions", href: "/solutions", icon: "🎯" },
              { label: "API Docs", href: "/api-documentation", icon: "📡" },
              { label: "Contact", href: "/contact", icon: "✉️" },
              { label: "Home", href: "/", icon: "🏠" },
              { label: "Webmail", href: "/webmail", icon: "📧" },
            ].map((link, i) => (
              <Link
                key={i}
                href={link.href}
                className="bg-white/5 backdrop-blur border border-white/10 rounded-xl px-4 py-4 text-center hover:bg-white/10 hover:border-blue-500/50 transition group"
              >
                <div className="text-2xl mb-1">{link.icon}</div>
                <span className="text-blue-200 text-sm font-medium group-hover:text-white transition">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Ready to Build?</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your SMS gateway in 60 seconds and start exploring the platform. All APIs and features included.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="https://net2app.com" className="px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Free Now →</a>
            <Link href="/api-documentation" className="px-10 py-4 border-2 border-white/40 text-white rounded-xl hover:bg-white/10 transition font-semibold text-lg">API Documentation</Link>
          </div>
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
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <Link href="/pricing" className="text-blue-400 hover:text-white text-sm transition">Pricing</Link>
              <Link href="/resources" className="text-blue-400 hover:text-white text-sm transition">Resources</Link>
              <Link href="/api-documentation" className="text-blue-400 hover:text-white text-sm transition">API Docs</Link>
              <Link href="/case-studies" className="text-blue-400 hover:text-white text-sm transition">Case Studies</Link>
              <Link href="/comparisons" className="text-blue-400 hover:text-white text-sm transition">Comparisons</Link>
              <Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link>
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
