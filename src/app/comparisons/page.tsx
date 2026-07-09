import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SMS Gateway Comparison — Net2APP vs Alternatives | CPaaS Comparison Guide",
  description:
    "Comprehensive SMS gateway comparison: Net2APP vs traditional CPaaS providers, SMS aggregators, and open-source alternatives. Compare pricing, features, architecture, scalability, and total cost of ownership. Find the best SMS platform for your business.",
  keywords: [
    "SMS Gateway Comparison", "CPaaS Comparison", "SMS API Comparison",
    "SMS Platform Comparison", "SMS Gateway vs CPaaS", "SMS Provider Comparison",
    "Bulk SMS Comparison", "SMS Gateway Pricing Comparison",
    "Enterprise SMS Comparison", "SMS API Provider Comparison",
    "SMS Gateway Alternatives", "CPaaS Alternatives",
    "Multi-Tenant SMS vs CPaaS", "Self-Hosted SMS Gateway Comparison",
    "SMS Platform Feature Comparison", "SMS Gateway Cost Comparison",
    "Best SMS Gateway", "Top SMS API", "SMS Gateway Review",
    "SMS Gateway Bangladesh", "SMS Gateway India", "SMS Gateway UAE",
    "SMPP Gateway Comparison", "Voice OTP Comparison",
    "Open Source SMS Gateway Comparison",
  ],
  openGraph: {
    title: "SMS Gateway Comparison — Net2APP vs CPaaS Alternatives | Net2APP",
    description:
      "Compare Net2APP SMS gateway with traditional CPaaS providers. Feature-by-feature comparison of pricing, architecture, scalability, and features.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/comparisons#webpage",
      "url": "https://net2app.com/comparisons",
      "name": "SMS Gateway Comparison — Net2APP vs CPaaS Alternatives",
      "description": "Comprehensive SMS gateway comparison: Net2APP vs traditional CPaaS providers, pricing, features, architecture, and TCO analysis.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "Comparisons", "item": "https://net2app.com/comparisons" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/comparisons#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How does Net2APP compare to traditional CPaaS providers?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Unlike traditional CPaaS providers that charge per-message premiums and lock you into their infrastructure, Net2APP lets you deploy your own multi-tenant SMS gateway with zero setup fees. You own the infrastructure, control your routing, and pay only per SMS at wholesale rates. Net2APP offers PostgreSQL schema-based tenant isolation, SMPP v3.4, Voice OTP, RCS, and OTT messaging — features that typically cost thousands per month with traditional CPaaS vendors.",
          },
        },
        {
          "@type": "Question",
          "name": "Is Net2APP cheaper than CPaaS providers?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Net2APP's Starter plan has zero monthly fees — you pay only per SMS sent. Traditional CPaaS providers typically charge monthly platform fees plus per-message premiums. For organizations sending 1M+ SMS monthly, Net2APP's Professional plan ($150/month with 10M SMS included) can save 60-80% compared to traditional CPaaS pricing. The total cost of ownership is significantly lower because there are no per-message markups, no platform fees on Starter, and you can connect your own suppliers directly.",
          },
        },
        {
          "@type": "Question",
          "name": "How does Net2APP's multi-tenant architecture compare to traditional SaaS SMS platforms?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP uses PostgreSQL schema-based multi-tenancy, giving each tenant a completely isolated database schema. Traditional SaaS SMS platforms typically use shared tables with tenant_id columns, which can lead to data leakage risks and noisy neighbor problems. Net2APP's architecture provides true data isolation, independent scaling per tenant, and the ability to run dedicated servers for Professional and Enterprise customers.",
          },
        },
        {
          "@type": "Question",
          "name": "Can Net2APP replace my existing SMS gateway or CPaaS provider?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Net2APP supports SMPP v3.4, HTTP SMS API, RCS, Voice OTP, WhatsApp Business API, Telegram, and Flash SMS — covering essentially all messaging channels. With 80+ pre-built supplier connectors, auto failover routing, and DLR tracking, you can migrate from any existing SMS gateway or CPaaS provider. The multi-tenant architecture means you can even onboard your own clients as sub-tenants.",
          },
        },
      ],
    },
  ],
};

const comparisons = [
  {
    title: "Pricing Model",
    winner: "net2app",
    features: [
      { feature: "Setup Fee", net2app: "$0", traditional: "$0 - $500+", other: "$0 - $1,000+" },
      { feature: "Monthly Platform Fee", net2app: "$0 (Starter)", traditional: "$0 - $2,500+", other: "$0 - $500+" },
      { feature: "Per-SMS Cost", net2app: "$0.00030 (Starter)", traditional: "$0.005 - $0.05+", other: "$0.002 - $0.03" },
      { feature: "Included SMS Volume", net2app: "10M/mo (Pro)", traditional: "1K - 100K", other: "None typically" },
      { feature: "Hidden Fees", net2app: "None", traditional: "Carrier surcharges", other: "Support/Setup fees" },
      { feature: "Volume Discounts", net2app: "Built-in at Pro/Ent", traditional: "Negotiate sales", other: "Custom quotes" },
    ],
  },
  {
    title: "Architecture & Infrastructure",
    winner: "net2app",
    features: [
      { feature: "Multi-Tenant Isolation", net2app: "Schema-level (PostgreSQL)", traditional: "Shared DB / API-key", other: "Shared DB typically" },
      { feature: "Self-Hosted Option", net2app: "Yes (all plans)", traditional: "No", other: "Depends on vendor" },
      { feature: "Dedicated Server", net2app: "Pro & Enterprise", traditional: "Enterprise only", other: "Enterprise only" },
      { feature: "White-Label", net2app: "Enterprise plan", traditional: "Enterprise only", other: "Varies" },
      { feature: "Deployment Time", net2app: "60 seconds", traditional: "Days to weeks", other: "Days" },
      { feature: "Database Control", net2app: "Full access", traditional: "No access", other: "Limited/No access" },
    ],
  },
  {
    title: "Messaging Features",
    winner: "tie",
    features: [
      { feature: "SMPP v3.4", net2app: "✓ Full support", traditional: "✓", other: "Varies" },
      { feature: "HTTP REST API", net2app: "✓", traditional: "✓", other: "✓" },
      { feature: "Voice OTP", net2app: "✓ Asterisk AMI", traditional: "Add-on cost", other: "Limited" },
      { feature: "RCS Messaging", net2app: "✓ (Enterprise)", traditional: "Add-on cost", other: "Rare" },
      { feature: "WhatsApp Business API", net2app: "✓ (Enterprise)", traditional: "Add-on cost", other: "Add-on cost" },
      { feature: "Flash SMS (Class 0)", net2app: "✓", traditional: "Limited", other: "Rare" },
      { feature: "DLR Webhooks", net2app: "✓", traditional: "✓", other: "✓" },
      { feature: "OTT Messaging", net2app: "✓ WhatsApp + Telegram", traditional: "Limited", other: "Limited" },
    ],
  },
  {
    title: "Routing & Delivery",
    winner: "net2app",
    features: [
      { feature: "Multi-Layer Routing", net2app: "4-layer (Plan→Route→Trunk→Supplier)", traditional: "Basic", other: "Basic" },
      { feature: "Auto Failover", net2app: "At every layer", traditional: "Basic retry", other: "Basic" },
      { feature: "Supplier Connectors", net2app: "80+ pre-built", traditional: "Managed for you", other: "Varies" },
      { feature: "Custom Suppliers", net2app: "✓ Unlimited", traditional: "Limited/No", other: "Varies" },
      { feature: "Per-Route TPS Control", net2app: "✓", traditional: "Account-level", other: "Account-level" },
      { feature: "Client-Specific Routing", net2app: "✓ Per-tenant plans", traditional: "No", other: "No" },
    ],
  },
];

const pricingComparison = [
  { volume: "10K SMS/month", net2app: "$3.00/mo", cpaas: "$50 - $500/mo", savings: "94 - 99%" },
  { volume: "100K SMS/month", net2app: "$30.00/mo", cpaas: "$500 - $5,000/mo", savings: "94 - 99%" },
  { volume: "1M SMS/month", net2app: "$150/mo (Pro)", cpaas: "$5,000 - $50,000/mo", savings: "97 - 99.7%" },
  { volume: "10M SMS/month", net2app: "$150/mo (Pro)", cpaas: "$50,000 - $500,000/mo", savings: "99.7%+" },
  { volume: "100M SMS/month", net2app: "$400/mo (Ent)", cpaas: "$500,000 - $5M/mo", savings: "99.9%+" },
];

export default function ComparisonsPage() {
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
              <Link href="/" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Home</Link>
              <Link href="/pricing" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Pricing</Link>
              <Link href="/blog" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Blog</Link>
              <Link href="/resources" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Resources</Link>
            </div>
            <div className="flex items-center gap-3">
              <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started Free</a>
            </div>
          </div>
        </div>
      </nav>

      <section className="bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
            <span className="text-blue-200 text-sm font-medium">Objective Feature Comparison</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
            SMS Gateway Comparison
            <span className="block text-blue-400">Net2APP vs Traditional CPaaS & SMS Platforms</span>
          </h1>
          <p className="text-lg text-blue-200 max-w-3xl mx-auto">
            Compare <strong className="text-white">pricing</strong>,{" "}
            <strong className="text-white">architecture</strong>,{" "}
            <strong className="text-white">features</strong>,{" "}
            and <strong className="text-white">total cost of ownership</strong> across SMS gateway solutions.
            See why businesses save 60-99% by choosing Net2APP over traditional CPaaS providers.
          </p>
        </div>
      </section>

      {comparisons.map((section, si) => (
        <section key={si} className={`py-16 ${si % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
          <div className="max-w-6xl mx-auto px-6 lg:px-12">
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
              {section.winner === "net2app" && (
                <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">Net2APP Advantage</span>
              )}
              {section.winner === "tie" && (
                <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">Comparable</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="py-3 px-4 text-gray-500 text-xs font-semibold uppercase tracking-wider">Feature</th>
                    <th className="py-3 px-4 text-center text-blue-600 text-xs font-semibold uppercase tracking-wider bg-blue-50/50">Net2APP</th>
                    <th className="py-3 px-4 text-center text-gray-500 text-xs font-semibold uppercase tracking-wider">Traditional CPaaS</th>
                    <th className="py-3 px-4 text-center text-gray-500 text-xs font-semibold uppercase tracking-wider">Other Platforms</th>
                  </tr>
                </thead>
                <tbody>
                  {section.features.map((row, ri) => (
                    <tr key={ri} className={`border-b border-gray-100 ${ri % 2 === 0 ? "bg-gray-50/30" : ""}`}>
                      <td className="py-3 px-4 text-gray-700 text-sm font-medium">{row.feature}</td>
                      <td className="py-3 px-4 text-center text-blue-700 text-sm font-semibold bg-blue-50/30">{row.net2app}</td>
                      <td className="py-3 px-4 text-center text-gray-600 text-sm">{row.traditional}</td>
                      <td className="py-3 px-4 text-center text-gray-600 text-sm">{row.other}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}

      <section className="py-16 bg-slate-900">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Cost Savings Analysis</h2>
            <p className="text-blue-300 text-lg">How much you save with Net2APP vs traditional CPaaS providers</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-3 px-4 text-blue-300 text-xs font-semibold uppercase tracking-wider">Monthly SMS Volume</th>
                  <th className="py-3 px-4 text-center text-green-400 text-xs font-semibold uppercase tracking-wider">Net2APP Cost</th>
                  <th className="py-3 px-4 text-center text-red-400 text-xs font-semibold uppercase tracking-wider">Typical CPaaS Cost</th>
                  <th className="py-3 px-4 text-center text-yellow-400 text-xs font-semibold uppercase tracking-wider">Your Savings</th>
                </tr>
              </thead>
              <tbody>
                {pricingComparison.map((row, i) => (
                  <tr key={i} className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/5" : ""}`}>
                    <td className="py-3 px-4 text-white text-sm font-medium">{row.volume}</td>
                    <td className="py-3 px-4 text-center text-green-400 text-sm font-semibold">{row.net2app}</td>
                    <td className="py-3 px-4 text-center text-red-400 text-sm">{row.cpaas}</td>
                    <td className="py-3 px-4 text-center text-yellow-400 text-sm font-bold">{row.savings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-blue-400 text-sm text-center mt-6">* CPaaS pricing estimates based on publicly available pricing from major providers. Actual costs vary by contract and volume.</p>
        </div>
      </section>

      <section id="faq" className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Comparison FAQ</h2>
            <p className="text-gray-500">Common questions when comparing SMS gateway platforms</p>
          </div>
          <div className="space-y-4">
            {[
              { q: "What makes Net2APP different from traditional CPaaS providers?", a: "The key difference is the business model and architecture. Traditional CPaaS providers are managed services — they own the carrier relationships, set the rates, and you pay per-message premiums. Net2APP is a self-deployed SMS gateway platform — you own the infrastructure, connect your own suppliers, set your own rates, and can even onboard your own clients as sub-tenants. The multi-tenant architecture with PostgreSQL schema isolation means true data separation without shared infrastructure." },
              { q: "Is Net2APP suitable as a white-label SMS platform for resellers?", a: "Yes, this is one of Net2APP's primary use cases. The multi-tenant architecture with schema-level isolation, unlimited sub-clients, white-label branding (Enterprise plan), and the ability to set individual rates per client makes it ideal for SMS resellers and aggregators. You can deploy your own branded SMS gateway and onboard clients immediately." },
              { q: "How does the total cost of ownership compare?", a: "For organizations sending 1M+ SMS monthly, Net2APP's TCO is typically 60-99% lower than traditional CPaaS. The Starter plan has zero monthly fees with per-SMS pricing at wholesale rates. The Professional plan ($150/month) includes 10M SMS — at traditional CPaaS rates, 10M SMS would cost $50,000-$500,000. Even adding server costs, the savings are substantial." },
              { q: "Can I use my own SMS suppliers with Net2APP?", a: "Yes. Unlike traditional CPaaS providers that lock you into their supplier network, Net2APP lets you connect any SMPP or HTTP SMS supplier. The platform includes 80+ pre-built connectors for major aggregators worldwide, and you can add custom suppliers. You control routing, failover, and cost optimization per destination." },
              { q: "Does Net2APP support the same features as major CPaaS platforms?", a: "Net2APP supports SMPP v3.4, HTTP REST API, Voice OTP (with Asterisk AMI), RCS messaging, Flash SMS, WhatsApp Business API, Telegram MTProto, DLR webhooks, IP whitelisting, multi-layer routing with auto failover, sub-client management, and automated billing. The feature set is comparable or exceeds most traditional CPaaS providers." },
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

      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">See the Difference Yourself</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your own SMS gateway in 60 seconds. Compare features, pricing, and performance — risk free.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="https://net2app.com" className="px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Free Now →</a>
            <Link href="/pricing" className="px-10 py-4 border-2 border-white/40 text-white rounded-xl hover:bg-white/10 transition font-semibold text-lg">View Pricing</Link>
          </div>
        </div>
      </section>

      <footer className="py-12 bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div>
              <span className="text-white font-semibold text-lg">Net2APP</span>
            </Link>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <Link href="/comparisons" className="text-blue-400 hover:text-white text-sm transition">Comparisons</Link>
              <Link href="/pricing" className="text-blue-400 hover:text-white text-sm transition">Pricing</Link>
              <Link href="/blog" className="text-blue-400 hover:text-white text-sm transition">Blog</Link>
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
