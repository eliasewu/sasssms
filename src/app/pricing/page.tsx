"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface LandingSettings {
  costPerSms: string;
  packages: Array<{
    id: number; name: string; description: string; price: string;
    monthlyFee: string; smsCredits: number; freeSmsPerMonth: boolean;
    features: string[]; requiresLicense: boolean; isActive: boolean;
  }>;
}

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/pricing#webpage",
      "url": "https://net2app.com/pricing",
      "name": "SMS Gateway Pricing — $0 Setup, Pay-As-You-Go | Net2APP",
      "description": "Complete SMS gateway pricing with zero setup fees. Starter (free), Professional, Enterprise plans. Bulk SMS from dynamically configured rates.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "Pricing", "item": "https://net2app.com/pricing" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/pricing#faq",
      "mainEntity": [
        {
          "@type": "Question", "name": "How much does Net2APP SMS Gateway cost?",
          "acceptedAnswer": { "@type": "Answer", "text": "Net2APP offers three pricing tiers: Starter (free — pay-as-you-go), Professional (dedicated server with included SMS volume), and Enterprise (unlimited everything with all features). There are zero setup fees, zero hidden fees, and zero monthly minimums across all plans. Per-SMS rates and package prices are dynamically configured from the admin panel." },
        },
        {
          "@type": "Question", "name": "Is there really no setup fee?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. Net2APP has no setup fees, no activation fees, and no hidden charges. You can deploy your multi-tenant SMS gateway in under 60 seconds with full access to SMPP v3.4, HTTP SMS API, Voice OTP, RCS, and OTT messaging. The Starter plan is completely free to start." },
        },
        {
          "@type": "Question", "name": "Can I switch plans later?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. You can upgrade or downgrade your plan at any time from the Net2APP dashboard. Upgrades take effect immediately, and downgrades apply at the end of your current billing period. There are no long-term contracts or cancellation fees." },
        },
        {
          "@type": "Question", "name": "Do you offer custom enterprise pricing?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. For organizations with very high SMS volumes (100M+ SMS/month), custom infrastructure requirements, or white-label needs, we offer custom enterprise pricing. Contact our sales team at info@net2app.com to discuss your requirements." },
        },
      ],
    },
    {
      "@type": "Product",
      "@id": "https://net2app.com/pricing#starter",
      "name": "Net2APP Starter Plan",
      "description": "Free SMS gateway plan with pay-as-you-go pricing. Includes isolated PostgreSQL tenant schema, 50 TPS throughput, HTTP SMS API, basic SMS routing, 5 sub-clients, DLR delivery reports, and email support. Zero setup fees.",
      "category": "SMS Gateway",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free platform access — pay-as-you-go at $0.00030/SMS. No setup fees, no monthly fees.",
        "availability": "https://schema.org/InStock",
        "priceValidUntil": "2027-12-31"
      }
    },
    {
      "@type": "Product",
      "@id": "https://net2app.com/pricing#professional",
      "name": "Net2APP Professional Plan",
      "description": "Dedicated server SMS gateway plan with 10M SMS included per month, 200 TPS throughput, SMPP v3.4, Voice OTP, unlimited sub-clients, and priority support. No per-SMS charge on included volume.",
      "category": "SMS Gateway",
      "offers": {
        "@type": "Offer",
        "price": "150",
        "priceCurrency": "USD",
        "description": "$150/month with dedicated server, 10M SMS included, 200 TPS, SMPP v3.4, and Voice OTP.",
        "availability": "https://schema.org/InStock",
        "priceValidUntil": "2027-12-31"
      }
    },
    {
      "@type": "Product",
      "@id": "https://net2app.com/pricing#enterprise",
      "name": "Net2APP Enterprise Plan",
      "description": "Unlimited SMS gateway plan with dedicated infrastructure, unlimited TPS, all 8+ connection types (SMPP, HTTP, RCS, Voice, OTT, WhatsApp, Email), white-label branding, 24/7 priority support, and 99.9% SLA guarantee.",
      "category": "SMS Gateway",
      "offers": {
        "@type": "Offer",
        "price": "400",
        "priceCurrency": "USD",
        "description": "$400/month with dedicated infrastructure, unlimited TPS, white-label branding, and 24/7 dedicated support with SLA.",
        "availability": "https://schema.org/InStock",
        "priceValidUntil": "2027-12-31"
      }
    },
  ],
};

export default function PricingPage() {
  const [settings, setSettings] = useState<LandingSettings>({ costPerSms: "0.00010", packages: [] });

  useEffect(() => {
    fetch("/api/public/settings")
      .then(r => r.json())
      .then(setSettings)
      .catch(() => {});
  }, []);

  const costPerSms = parseFloat(settings.costPerSms) || 0.00010;
  const starterPkg = settings.packages.find(p => p.name === "Starter" && p.isActive);
  const proPkg = settings.packages.find(p => p.name === "Professional" && p.isActive);
  const entPkg = settings.packages.find(p => p.name === "Enterprise" && p.isActive);
  const proMonthly = proPkg?.monthlyFee || "150";
  const entMonthly = entPkg?.monthlyFee || "400";

  const plans = [
    {
      name: "Starter", price: "Free", subtitle: `Pay-as-you-go • $${costPerSms.toFixed(5)}/SMS`, popular: false,
      features: (starterPkg?.features || ["Isolated PostgreSQL tenant schema", "50 transactions per second (TPS)", "HTTP SMS API access", "Basic SMS routing", "5 sub-clients", "DLR delivery reports", "Dashboard access", "Email support"]),
      cta: "Get Started Free", href: "https://net2app.com",
    },
    {
      name: "Professional", price: `$${proMonthly}`, subtitle: `/month • ${proPkg?.smsCredits ? (proPkg.smsCredits / 1000000).toFixed(0) + "M" : "10M"} SMS included`, popular: true,
      features: (proPkg?.features || ["Everything in Starter", "Dedicated server", "200 TPS throughput", "10M SMS/month INCLUDED", "No per-SMS charge", "SMPP v3.4 & Voice OTP", "Unlimited sub-clients", "Priority support"]),
      cta: "Get Started", href: "https://net2app.com",
    },
    {
      name: "Enterprise", price: `$${entMonthly}`, subtitle: "/month • Unlimited volume", popular: false,
      features: (entPkg?.features || ["Everything in Professional", "Unlimited TPS", "Unlimited SMS volume", "All 8+ connection types", "RCS, OTT & WhatsApp API", "White-label branding", "24/7 priority support", "SLA guarantee"]),
      cta: "Contact Sales", href: "https://net2app.com",
    },
  ];

  const comparisons = [
    { feature: "Setup Fee", starter: "$0", pro: "$0", enterprise: "$0" },
    { feature: "Monthly Fee", starter: "$0", pro: `$${proMonthly}`, enterprise: `$${entMonthly}` },
    { feature: "Per-SMS Cost", starter: `$${costPerSms.toFixed(5)}`, pro: "Included", enterprise: "Included (Unlimited)" },
    { feature: "TPS Limit", starter: "50", pro: "200", enterprise: "Unlimited" },
    { feature: "Tenant Isolation", starter: "✓", pro: "✓", enterprise: "✓" },
    { feature: "HTTP SMS API", starter: "✓", pro: "✓", enterprise: "✓" },
    { feature: "SMPP v3.4", starter: "—", pro: "✓", enterprise: "✓" },
    { feature: "Voice OTP", starter: "—", pro: "✓", enterprise: "✓" },
    { feature: "RCS Messaging", starter: "—", pro: "—", enterprise: "✓" },
    { feature: "OTT (WhatsApp/Telegram)", starter: "—", pro: "—", enterprise: "✓" },
    { feature: "White-Label", starter: "—", pro: "—", enterprise: "✓" },
    { feature: "Sub-Clients", starter: "5", pro: "Unlimited", enterprise: "Unlimited" },
    { feature: "Support", starter: "Email", pro: "Priority", enterprise: "24/7 Dedicated" },
    { feature: "SLA", starter: "—", pro: "—", enterprise: "99.9%" },
  ];

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
              <Link href="/solutions" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Solutions</Link>
              <Link href="/resources" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Resources</Link>
              <a href="#faq" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">FAQ</a>
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
            <span className="text-blue-200 text-sm font-medium">Transparent SMS Gateway Pricing</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
            SMS Gateway Pricing
            <span className="block text-blue-400">$0 Setup • Pay Only for What You Use</span>
          </h1>
          <p className="text-lg text-blue-200 max-w-3xl mx-auto mb-10 leading-relaxed">
            Deploy your own multi-tenant SMS gateway with <strong className="text-white">zero setup fees</strong>,{" "}
            <strong className="text-white">zero monthly minimums</strong>, and{" "}
            <strong className="text-white">zero hidden charges</strong>.{" "}
            Bulk SMS rates from <strong className="text-white">${costPerSms.toFixed(5)}/SMS</strong>.{" "}
            Professional and Enterprise plans include dedicated servers with included SMS volume.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#plans" className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-lg shadow-lg">View Plans ↓</a>
            <a href="#compare" className="px-8 py-4 border-2 border-white/30 text-white rounded-xl hover:bg-white/10 transition font-semibold text-lg">Compare Features</a>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section id="plans" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h2>
            <p className="text-gray-500 text-lg">All plans include zero setup fees and 60-second deployment</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`bg-white rounded-3xl p-8 shadow-sm hover:shadow-md transition relative ${
                  plan.popular ? "border-2 border-blue-500 scale-105" : "border border-gray-200"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                <div className="mb-2">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500 ml-2 text-sm">{plan.subtitle}</span>
                </div>
                <ul className="space-y-3 my-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-gray-600 text-sm">
                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.href}
                  className={`block w-full py-3 rounded-xl font-semibold text-center transition ${
                    plan.popular
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
          <div className="mt-12 bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
            <p className="text-blue-800 text-lg font-medium">
              💰 All plans: <strong className="text-blue-900">${costPerSms.toFixed(5)} per SMS</strong> on Starter • No setup fees • No hidden fees
            </p>
            <p className="text-blue-600 text-sm mt-1">Rates dynamically configurable from admin panel</p>
          </div>
        </div>
      </section>

      {/* Full Feature Comparison */}
      <section id="compare" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Complete Feature Comparison</h2>
            <p className="text-gray-500 text-lg">Side-by-side comparison of all plans and features</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="py-4 px-6 text-gray-900 font-semibold">Feature</th>
                  <th className="py-4 px-6 text-center text-gray-900 font-semibold">Starter</th>
                  <th className="py-4 px-6 text-center text-gray-900 font-semibold bg-blue-50">Professional</th>
                  <th className="py-4 px-6 text-center text-gray-900 font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-gray-50/50" : ""}`}>
                    <td className="py-3 px-6 text-gray-700 font-medium text-sm">{row.feature}</td>
                    <td className="py-3 px-6 text-center text-gray-600 text-sm">{row.starter}</td>
                    <td className="py-3 px-6 text-center text-gray-600 text-sm bg-blue-50/50">{row.pro}</td>
                    <td className="py-3 px-6 text-center text-gray-600 text-sm">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* What's Included in All Plans */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Included in Every Plan</h2>
            <p className="text-gray-500 text-lg">All Net2APP plans include these core features at no extra cost</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "🔒", title: "Tenant Isolation", desc: "PostgreSQL schema isolation per SMS gateway client — complete data separation." },
              { icon: "🌐", title: "HTTP SMS API", desc: "RESTful API with authentication, DLR webhooks, and rate limiting." },
              { icon: "📊", title: "DLR Reports", desc: "Real-time delivery reports, analytics, and message tracking." },
              { icon: "🛡️", title: "IP Whitelisting", desc: "API security with IP-based access control and CIDR support." },
              { icon: "🔀", title: "SMS Routing", desc: "Multi-layer intelligent SMS routing with priority and failover." },
              { icon: "💰", title: "Billing System", desc: "Automated invoicing, payment tracking, and usage analytics." },
              { icon: "👥", title: "Sub-Client Mgmt", desc: "Create and manage unlimited sub-clients with individual rates." },
              { icon: "⚡", title: "60-Second Deploy", desc: "Get your SMS gateway running in under a minute. No waiting." },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition group">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-gray-900 font-semibold mb-1 group-hover:text-blue-600 transition">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cost Savings */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Start Saving on SMS Today</h2>
          <p className="text-blue-100 text-lg mb-8">
            No setup fees, no monthly minimums, no hidden charges. Enterprise-grade SMS infrastructure at a fraction of the cost.
            Deploy your SMS gateway in under 60 seconds and start sending immediately.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="https://net2app.com" className="px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">
              Deploy Free Now →
            </a>
            <Link href="/contact" className="px-10 py-4 border-2 border-white/40 text-white rounded-xl hover:bg-white/10 transition font-semibold text-lg">
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Pricing — Frequently Asked Questions</h2>
            <p className="text-gray-500">Common questions about Net2APP SMS gateway pricing and plans</p>
          </div>
          <div className="space-y-4">
            {[
              { q: "Is Net2APP really free to start?", a: "Yes. The Starter plan offers full platform access with zero setup fees and zero monthly fees. You pay only for the SMS you send. Deploy your isolated tenant in under 60 seconds with no credit card required." },
              { q: "What's the difference between pay-as-you-go and the Professional plan?", a: `Starter is pure pay-as-you-go — you pay per SMS with a 50 TPS limit. Professional includes a dedicated server with included SMS volume per month, 200 TPS throughput, and SMPP v3.4 + Voice OTP capabilities. Per-SMS rates and package details are dynamically configured.` },
              { q: "Are there any hidden fees?", a: "No. Net2APP has absolutely zero hidden fees. There are no setup fees, no activation fees, no termination fees, and no minimum monthly commitments. What you see on the pricing page is exactly what you pay." },
              { q: "Do you offer volume discounts?", a: "Yes. For organizations sending more than 100M SMS per month, we offer custom volume pricing. The Professional plan already includes SMS volume with no per-message charge. Contact sales for enterprise volume discounts." },
              { q: "Can I upgrade or downgrade anytime?", a: "Yes, you can change your plan at any time from the dashboard. Upgrades take effect immediately. Downgrades apply at the end of your current billing cycle. No long-term contracts required." },
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

      {/* Footer */}
      <footer className="py-12 bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div>
                <span className="text-white font-semibold text-lg">Net2APP</span>
              </Link>
              <p className="text-gray-400 text-sm max-w-md">Enterprise SMS Gateway & Voice OTP Platform. Multi-tenant SaaS. Zero setup fees — pay only for what you use.</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Pages</p>
              <div className="space-y-2.5">
                <Link href="/pricing" className="block text-sm text-gray-400 hover:text-white transition">Pricing</Link>
                <Link href="/solutions" className="block text-sm text-gray-400 hover:text-white transition">Solutions</Link>
                <Link href="/resources" className="block text-sm text-gray-400 hover:text-white transition">Resources</Link>
                <Link href="/api-documentation" className="block text-sm text-gray-400 hover:text-white transition">API Docs</Link>
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Company</p>
              <div className="space-y-2.5">
                <Link href="/contact" className="block text-sm text-gray-400 hover:text-white transition">Contact</Link>
                <Link href="/case-studies" className="block text-sm text-gray-400 hover:text-white transition">Case Studies</Link>
                <Link href="/comparisons" className="block text-sm text-gray-400 hover:text-white transition">Comparisons</Link>
                <Link href="/" className="block text-sm text-gray-400 hover:text-white transition">Home</Link>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center">
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p>
          </div>
        </div>
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
