import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Gateway for Startups — Pay-as-You-Go, No Setup Fees | Net2APP",
  description:
    "Startup-friendly SMS API with zero setup fees, pay-as-you-go pricing, no monthly minimums, and no hidden costs. Deploy your SMS gateway in 60 seconds with SMPP, HTTP API, Voice OTP, and WhatsApp support.",
  keywords: [
    "SMS Gateway Startup",
    "Startup SMS API",
    "Free SMS Gateway",
    "Pay-as-You-Go SMS",
    "No Setup Fee SMS",
    "Startup SMS Platform",
    "SMS for Founders",
    "Bootstrapped SMS",
    "Early Stage SMS",
    "Startup SMS Bangladesh",
    "Startup SMS India",
    "Startup SMS UAE",
    "SaaS SMS Startup",
    "Affordable SMS Gateway",
    "Startup Communications",
  ],
  openGraph: {
    title: "SMS API for Startups — $0 Setup, Pay-as-You-Go | Net2APP",
    description: "Startup-friendly SMS gateway with zero setup fees, pay-as-you-go pricing, and no monthly minimums.",
  },
};


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/startup#webpage",
        "url": "https://net2app.com/solutions/startup",
        "name": "SMS Gateway for Startups — Pay-as-You-Go, No Setup Fees",
        "description": "Startup-friendly SMS API with zero setup fees, pay-as-you-go pricing, no monthly minimums, and no hidden costs. Deploy your SMS gateway in 60 seconds.",
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
              "name": "Startup",
              "item": "https://net2app.com/solutions/startup"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/startup#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Is Net2APP really free for startups?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. The Starter plan has zero setup fees, zero monthly fees, and zero hidden costs. You pay only for the SMS you send at our standard pay-as-you-go rate. All features — SMPP v3.4, HTTP API, Voice OTP, RCS, WhatsApp, Telegram — are available on the free Starter plan from day one."
            }
          },
          {
            "@type": "Question",
            "name": "How quickly can I deploy my SMS gateway?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "You can deploy your isolated SMS gateway in under 60 seconds. Net2APP's automated provisioning creates a dedicated PostgreSQL schema, API keys, and routing infrastructure instantly — no manual setup, no waiting for server provisioning."
            }
          },
          {
            "@type": "Question",
            "name": "Can I upgrade from Starter to Professional or Enterprise later?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Absolutely. All plans share the same API and infrastructure, so migrating is seamless. Start with 50 TPS on Starter, upgrade to 200 TPS on Professional ($150/month with 10M SMS included), or go unlimited on Enterprise ($400/month). Your integration code doesn't change."
            }
          },
          {
            "@type": "Question",
            "name": "What features do startups get on the free plan?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "The free Starter plan includes: isolated PostgreSQL database schema, RESTful HTTP SMS API, SMPP v3.4 gateway, Voice OTP with Asterisk AMI, RCS messaging, Flash SMS, WhatsApp Business API, Telegram MTProto, 4-layer intelligent SMS routing, DLR delivery reports, IP whitelisting, 5 sub-clients, and email support. Everything a startup needs to build and test their SMS application."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/startup#app",
        "name": "Net2APP Startup SMS Platform",
        "url": "https://net2app.com/solutions/startup",
        "description": "Startup-friendly SMS API with zero setup fees, pay-as-you-go pricing, no monthly minimums, and all enterprise features from day one. Deploy your SMS gateway in 60 seconds.",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. No setup fees, no monthly minimums."
        },
        "featureList": [
          "60-second automated deployment with no manual setup",
          "RESTful HTTP SMS API with API key + IP whitelist authentication",
          "SMPP v3.4 gateway with full ESME bind support",
          "Voice OTP via Asterisk AMI with 220+ country MCC detection",
          "WhatsApp Business API and Telegram MTProto messaging",
          "4-layer intelligent SMS routing with auto failover",
          "Real-time DLR delivery reports and webhook callbacks",
          "Multi-tenant PostgreSQL schema isolation per customer",
          "Sub-client management with individual rates and routing",
          "RCS rich messaging and Flash SMS support included"
        ]
      }
    ]
  };

export default function StartupPage() {
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
              <Link href="/solutions/enterprise" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Enterprise</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/contact" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started Free</Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="bg-gradient-to-br from-cyan-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-cyan-100 border border-cyan-200 rounded-full px-4 py-1.5 mb-6">
                <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                <span className="text-cyan-700 text-sm font-medium">$0 Setup • $0 Monthly • Pay-as-You-Go</span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
                SMS Gateway for Startups
                <span className="block text-cyan-600">Start Free, Scale as You Grow</span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Launch your SMS infrastructure in <strong className="text-gray-900">60 seconds</strong> with <strong className="text-gray-900">zero setup fees</strong>,
                <strong className="text-gray-900"> zero monthly fees</strong>, and <strong className="text-gray-900">no hidden costs</strong>.
                Pay only for the SMS you send. SMPP, HTTP API, Voice OTP, RCS, WhatsApp, and Telegram — all included from day one.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/contact" className="px-8 py-4 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition font-semibold text-lg shadow-lg shadow-cyan-600/20 text-center">Deploy Free →</Link>
                <Link href="/solutions/see-all" className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition font-semibold text-lg text-center">See All Solutions</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[{ value: "$0", label: "Setup Fee", desc: "No upfront costs" },{ value: "$0/mo", label: "Monthly Fee", desc: "No monthly minimums" },{ value: "60s", label: "Deploy Time", desc: "Instant provisioning" },{ value: "All", label: "Features Included", desc: "SMPP, HTTP, RCS, Voice, OTT" }].map((s, i) => (
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
          <div className="text-center mb-12"><h2 className="text-3xl font-bold text-gray-900 mb-3">Why Startups Choose Net2APP</h2><p className="text-gray-500">Built for builders, priced for founders</p></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{ title: "Zero Risk to Start", desc: "No setup fees, no monthly minimums, no long-term contracts. Deploy your SMS gateway for free and only pay when you send messages." },{ title: "Enterprise Features from Day 1", desc: "SMPP v3.4, HTTP API, Voice OTP, RCS, Flash SMS, WhatsApp, Telegram — all features available on the free Starter plan." },{ title: "Built to Scale", desc: "Start with 50 TPS and grow to unlimited. Migrate from Starter to Professional to Enterprise without rebuilding your integration." },{ title: "Multi-Tenant by Default", desc: "Each customer gets an isolated database schema. Add sub-clients with individual rates, routing, and API keys." },{ title: "Developer-First APIs", desc: "Clean RESTful APIs, full SMPP protocol support, webhook callbacks, and comprehensive documentation." },{ title: "99.9% Uptime", desc: "Enterprise-grade infrastructure with intelligent multi-supplier routing ensures your messages are always delivered." }].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-cyan-200 transition group">
                <h3 className="text-gray-900 font-semibold text-lg mb-2 group-hover:text-cyan-600 transition">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-r from-cyan-600 to-blue-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Start Building — Free</h2>
          <p className="text-blue-100 text-lg mb-8">No setup fees. No monthly fees. No hidden fees. Deploy your SMS gateway in 60 seconds.</p>
          <Link href="/contact" className="inline-block px-10 py-4 bg-white text-cyan-600 rounded-xl hover:bg-cyan-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</Link>
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
                <Link href="/solutions/enterprise" className="block text-sm text-gray-400 hover:text-white transition">Enterprise</Link>
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
