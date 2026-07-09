import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Enterprise SMS Gateway — Dedicated Infrastructure, White-Label, SLA | Net2APP",
  description:
    "Net2APP Enterprise SMS gateway with dedicated infrastructure, unlimited TPS, white-label branding, SLA guarantees, 24/7 priority support, and multi-tenant PostgreSQL schema isolation.",
  keywords: [
    "Enterprise SMS Gateway",
    "Enterprise SMS Platform",
    "White-Label SMS",
    "Dedicated SMS Infrastructure",
    "Enterprise SMS API",
    "Unlimited TPS SMS",
    "SLA SMS Gateway",
    "Enterprise CPaaS",
    "Enterprise SMS Bangladesh",
    "Enterprise SMS India",
    "Enterprise SMS UAE",
    "Corporate SMS Platform",
    "Large-Scale SMS",
    "Enterprise SMS Solution",
    "Enterprise Messaging",
  ],
  openGraph: {
    title: "Enterprise SMS Gateway — Dedicated & White-Label | Net2APP",
    description: "Enterprise-grade SMS infrastructure with dedicated servers, unlimited TPS, white-label branding, and SLA guarantees.",
  },
};


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/enterprise#webpage",
        "url": "https://net2app.com/solutions/enterprise",
        "name": "SMS Gateway for Enterprise — Unlimited TPS, Dedicated Infrastructure",
        "description": "Enterprise-grade SMS gateway with unlimited TPS, dedicated infrastructure, custom SLAs, and advanced security features.",
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
              "name": "Enterprise",
              "item": "https://net2app.com/solutions/enterprise"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/enterprise#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is included in the Enterprise plan?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "The Enterprise plan ($400/month) includes dedicated server infrastructure, unlimited TPS throughput, unlimited SMS volume, all connection types (SMPP, HTTP, RCS, Voice, OTT, WhatsApp, Email), white-label branding, 99.9% SLA guarantee, 24/7 priority support via phone/email/Slack, custom connector development, multi-region deployment options, advanced security controls, and audit logging."
            }
          },
          {
            "@type": "Question",
            "name": "Can I white-label the platform for my business?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. The Enterprise plan includes full white-label branding. Your company name, logo, and custom domain replace all Net2APP branding. Your end customers will see only your brand throughout the SMS gateway dashboard, API endpoints, and documentation portal."
            }
          },
          {
            "@type": "Question",
            "name": "What SLA guarantees does Net2APP offer for enterprise customers?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Enterprise customers receive a 99.9% uptime SLA with service credits for any downtime. Our dedicated infrastructure eliminates resource contention, and the 4-layer intelligent routing engine with auto failover ensures messages are always delivered even during supplier outages."
            }
          },
          {
            "@type": "Question",
            "name": "How does data isolation work at enterprise scale?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Each tenant receives a completely isolated PostgreSQL schema with no shared tables. Enterprise customers get dedicated servers (not shared instances), ensuring zero resource contention. All data — customer contacts, message logs, API keys, billing records, and routing configurations — stays fully separated at the database level for maximum security and compliance."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/enterprise#app",
        "name": "Net2APP Enterprise SMS Platform",
        "url": "https://net2app.com/solutions/enterprise",
        "description": "Enterprise-grade SMS gateway with dedicated infrastructure, unlimited TPS, white-label branding, 99.9% SLA guarantees, and 24/7 priority support. Complete data isolation with per-tenant PostgreSQL schemas.",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "400",
          "priceCurrency": "USD",
          "description": "$400/month with unlimited TPS, dedicated infrastructure, white-label branding, and 24/7 priority support."
        },
        "featureList": [
          "Dedicated server infrastructure with no resource contention",
          "Unlimited TPS throughput with no rate limits",
          "Full white-label branding — your logo, domain, and identity",
          "99.9% uptime SLA with service credits for downtime",
          "24/7/365 priority support via phone, email, and Slack",
          "Per-tenant PostgreSQL schema isolation for complete data separation",
          "Custom connector development for any SMS provider",
          "Advanced security: IP whitelisting, API key rotation, audit logging",
          "Multi-region deployment with local infrastructure options",
          "Unlimited sub-clients with individual rates and routing plans"
        ]
      }
    ]
  };

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span>
            </Link>
            <div className="hidden lg:flex items-center gap-1">
              <Link href="/solutions" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Solutions</Link>
              <Link href="/solutions/startup" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Startup</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/contact" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Contact Sales</Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="bg-gradient-to-br from-purple-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-purple-100 border border-purple-200 rounded-full px-4 py-1.5 mb-6">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span className="text-purple-700 text-sm font-medium">Enterprise Grade • White-Label • SLA</span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
                Enterprise SMS Gateway
                <span className="block text-purple-600">Dedicated Infrastructure for Scale</span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Deploy a dedicated, white-label SMS gateway for your enterprise with <strong className="text-gray-900">unlimited TPS</strong>,
                <strong className="text-gray-900"> dedicated servers</strong>, <strong className="text-gray-900">SLA guarantees</strong>,
                and <strong className="text-gray-900">24/7 priority support</strong>. Full PostgreSQL schema isolation ensures complete data separation.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/contact" className="px-8 py-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition font-semibold text-lg shadow-lg shadow-purple-600/20 text-center">Contact Sales →</Link>
                <Link href="/solutions/see-all" className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition font-semibold text-lg text-center">See All Solutions</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[{ value: "Unlimited", label: "TPS Throughput", desc: "No rate limits on traffic" },{ value: "White-Label", label: "Branding", desc: "Your brand, your platform" },{ value: "99.9%", label: "SLA Guarantee", desc: "Enterprise uptime commitment" },{ value: "Dedicated", label: "Infrastructure", desc: "Isolated servers & db" }].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <p className="text-3xl font-bold text-gray-900 mb-1">{s.value}</p>
                  <p className="text-gray-700 font-medium text-sm">{s.label}</p>
                  <p className="text-gray-500 text-xs mt-1">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12"><h2 className="text-3xl font-bold text-gray-900 mb-3">Enterprise Features</h2><p className="text-gray-500">Everything you need to run SMS at scale</p></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{ title: "Dedicated Server", desc: "Your own isolated server instance with dedicated resources. No resource contention with other tenants." },{ title: "Unlimited TPS", desc: "No rate limits on messages per second. Handle any traffic volume without throttling." },{ title: "White-Label Branding", desc: "Full white-label experience. Your company name, logo, and domain — no Net2APP branding visible." },{ title: "SLA Guarantee", desc: "99.9% uptime SLA with service credits for any downtime. Enterprise-grade reliability." },{ title: "24/7 Priority Support", desc: "Dedicated support team available 24/7/365. Phone, email, and Slack channel access." },{ title: "PostgreSQL Isolation", desc: "Per-tenant database schema isolation. Complete data separation with no shared tables." },{ title: "Custom Integrations", desc: "Custom connector development for any SMS provider. Tailored routing logic and reporting." },{ title: "Advanced Security", desc: "IP whitelisting, API key rotation, audit logging, and SOC2-ready security controls." },{ title: "Multi-Region Deployment", desc: "Deploy in your preferred region. Global reach with local infrastructure options." }].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition group">
                <h3 className="text-gray-900 font-semibold text-lg mb-2 group-hover:text-purple-600 transition">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-r from-purple-600 to-pink-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Ready for Enterprise Scale?</h2>
          <p className="text-blue-100 text-lg mb-8">Contact our sales team for a personalized demo and enterprise pricing.</p>
          <Link href="/contact" className="inline-block px-10 py-4 bg-white text-purple-600 rounded-xl hover:bg-purple-50 transition font-semibold text-lg shadow-xl">Contact Sales →</Link>
        </div>
      </section>

      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div>
                <span className="text-white font-semibold text-lg">Net2APP</span>
              </Link>
              <p className="text-gray-400 text-sm max-w-md leading-relaxed">Enterprise SMS Gateway & Voice OTP Platform. Multi-tenant SaaS with SMPP, HTTP API, RCS, Voice OTP, and OTT messaging.</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Solutions</p>
              <div className="space-y-2.5">
                <Link href="/solutions/use-cases" className="block text-sm text-gray-400 hover:text-white transition">Use Cases</Link>
                <Link href="/solutions/teams" className="block text-sm text-gray-400 hover:text-white transition">Teams</Link>
                <Link href="/solutions/industries" className="block text-sm text-gray-400 hover:text-white transition">Industries</Link>
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Company</p>
              <div className="space-y-2.5">
                <Link href="/contact" className="block text-sm text-gray-400 hover:text-white transition">Contact</Link>
                <Link href="/solutions/startup" className="block text-sm text-gray-400 hover:text-white transition">Startup</Link>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center">
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
