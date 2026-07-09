import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Case Studies — Real-World SMS Gateway Success Stories | Net2APP",
  description:
    "Net2APP case studies: see how businesses across financial services, healthcare, ecommerce, education, and retail use our SMS gateway for authentication, marketing, notifications, and customer engagement. Real results with SMPP, Voice OTP, RCS, and OTT messaging.",
  keywords: [
    "SMS Gateway Case Studies", "SMS Case Study", "Voice OTP Case Study",
    "SMS Marketing Case Study", "Bulk SMS Success Story",
    "SMS Gateway Implementation", "Enterprise SMS Case Study",
    "CPaaS Case Study", "SMS API Case Study", "SMS Platform Results",
    "SMS Authentication Case Study", "SMS Notification Success",
    "Multi-Tenant SMS Case Study", "Financial Services SMS",
    "Healthcare SMS Case Study", "Ecommerce SMS Case Study",
    "Retail SMS Case Study", "Education SMS Case Study",
    "SMS Gateway ROI", "SMS Platform Success Story",
  ],
  openGraph: {
    title: "Case Studies — Real-World SMS Gateway Success Stories | Net2APP",
    description:
      "Real results from businesses using Net2APP SMS gateway. Financial services, healthcare, ecommerce, education, and retail success stories.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/case-studies#webpage",
      "url": "https://net2app.com/case-studies",
      "name": "Case Studies — Real-World SMS Gateway Success Stories | Net2APP",
      "description": "Real results from businesses using Net2APP SMS gateway across financial services, healthcare, ecommerce, and more.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "Case Studies", "item": "https://net2app.com/case-studies" },
        ],
      },
    },
    {
      "@type": "ItemList",
      "name": "Net2APP SMS Gateway Case Studies",
      "numberOfItems": 6,
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "FinTech Startup Scales OTP Delivery with Multi-Tenant SMS Gateway" },
        { "@type": "ListItem", "position": 2, "name": "Healthcare Provider Reduces No-Shows by 40% with SMS Appointment Reminders" },
        { "@type": "ListItem", "position": 3, "name": "Ecommerce Platform Boosts Revenue with SMS Cart Recovery and RCS Promotions" },
        { "@type": "ListItem", "position": 4, "name": "Bank Secures Transactions with Voice OTP Authentication" },
        { "@type": "ListItem", "position": 5, "name": "Education Network Sends 2M Emergency Alerts via Flash SMS" },
        { "@type": "ListItem", "position": 6, "name": "Retail Chain Unifies Customer Engagement with WhatsApp + SMS" },
      ],
    },
    {
      "@type": "Organization",
      "@id": "https://net2app.com/case-studies#organization",
      "name": "Net2APP",
      "url": "https://net2app.com",
      "description": "Enterprise SMS Gateway & Voice OTP Platform. Multi-tenant SaaS with SMPP v3.4, HTTP API, RCS, Voice OTP, and OTT messaging.",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.9",
        "bestRating": "5"
      }
    },
  ],
};

const caseStudies = [
  {
    company: "FinGuard Technologies",
    industry: "Financial Services",
    challenge: "A fast-growing fintech startup needed a scalable OTP delivery system for 2FA authentication across 15 countries. Their existing service was unreliable in emerging markets with poor SMS infrastructure.",
    solution: "Deployed Net2APP multi-tenant SMS gateway with Voice OTP as SMS fallback. Configured intelligent routing with 4 suppliers per country for maximum delivery rates. Used MCC-based language detection for localized Voice OTP calls.",
    results: [
      { metric: "99.7%", label: "OTP delivery rate" },
      { metric: "2.1s", label: "Average OTP delivery time" },
      { metric: "60%", label: "Cost reduction vs previous provider" },
      { metric: "15", label: "Countries served" },
    ],
    quote: "Net2APP's Voice OTP fallback eliminated our authentication failures in markets where SMS was unreliable. The multi-tenant architecture let us isolate each country's configuration.",
    icon: "🏦",
    color: "from-blue-500 to-cyan-500",
  },
  {
    company: "MediConnect Health",
    industry: "Healthcare",
    challenge: "A network of 200+ clinics struggled with 30% patient no-show rates, costing millions in lost revenue. Manual reminder calls were expensive and inconsistent. Needed automated, multi-language appointment reminders.",
    solution: "Integrated Net2APP HTTP SMS API with their EHR system. Automated SMS reminders at 72h, 24h, and 2h before appointments. Used Unicode support for multi-language messaging in English, Spanish, and Arabic.",
    results: [
      { metric: "40%", label: "Reduction in no-shows" },
      { metric: "3.2M", label: "SMS reminders sent/month" },
      { metric: "$1.8M", label: "Annual revenue recovered" },
      { metric: "94%", label: "Patient satisfaction" },
    ],
    quote: "The automated SMS reminders transformed our operations. We recovered $1.8M in annual revenue and patients love the convenience of text message confirmations.",
    icon: "🏥",
    color: "from-green-500 to-emerald-500",
  },
  {
    company: "ShopStream Ecommerce",
    industry: "Ecommerce",
    challenge: "A mid-market ecommerce platform had 68% cart abandonment rate and needed to recover lost sales. Email recovery was underperforming with 2% conversion. Wanted to leverage RCS for rich product showcases.",
    solution: "Implemented SMS cart recovery triggers via Net2APP API. Launched RCS messaging with product images, prices, and direct checkout buttons. Added order confirmations and shipping updates via SMS.",
    results: [
      { metric: "18%", label: "Cart recovery rate via SMS" },
      { metric: "85%", label: "RCS message open rate" },
      { metric: "$4.2M", label: "Incremental annual revenue" },
      { metric: "3x", label: "ROI on SMS investment" },
    ],
    quote: "SMS cart recovery outperformed email by 9x. RCS messages with product images and one-click checkout buttons drove conversion rates we never thought possible.",
    icon: "🛒",
    color: "from-purple-500 to-pink-500",
  },
  {
    company: "National Trust Bank",
    industry: "Banking",
    challenge: "A regional bank needed to secure high-value transactions ($10K+) against SIM-swap fraud. SMS OTP was vulnerable to SS7 attacks. Required voice-based verification with regulatory compliance.",
    solution: "Deployed Net2APP Voice OTP with Asterisk AMI integration. Configured alphanumeric OTPs (8-character) with 3-retry logic. Integrated with core banking system via REST API. Enabled real-time call logging for audit compliance.",
    results: [
      { metric: "100%", label: "Fraud prevention on Voice OTP" },
      { metric: "2.8M", label: "Secure transactions/year" },
      { metric: "8-char", label: "Alphanumeric OTP complexity" },
      { metric: "99.99%", label: "Voice call uptime" },
    ],
    quote: "Voice OTP gave us the security assurance we needed for high-value transactions. Zero fraud incidents since deployment, and our regulators approved the alphanumeric OTP implementation.",
    icon: "🏛️",
    color: "from-amber-500 to-orange-500",
  },
  {
    company: "EduAlert Network",
    industry: "Education",
    challenge: "A statewide education network covering 500+ schools needed instant emergency notification to 2M+ students, parents, and staff. Existing email system had 45-minute average delivery lag during crises.",
    solution: "Deployed Flash SMS (Class 0) for emergency alerts appearing immediately on screen. Used bulk SMS for non-urgent notifications. Configured SMS routing with 200 TPS throughput for mass delivery in under 2 minutes.",
    results: [
      { metric: "1.8s", label: "Average Flash SMS delivery" },
      { metric: "2M+", label: "Recipients per broadcast" },
      { metric: "98.5%", label: "First-attempt delivery rate" },
      { metric: "500+", label: "Schools connected" },
    ],
    quote: "Flash SMS delivers emergency alerts in under 2 seconds to all 2 million recipients. During our last weather emergency, parents received notifications before local news broadcasts.",
    icon: "🎓",
    color: "from-indigo-500 to-purple-500",
  },
  {
    company: "StyleHouse Retail",
    industry: "Retail",
    challenge: "A retail chain with 150+ stores wanted to unify customer engagement across SMS, WhatsApp, and email. Needed to manage loyalty programs, send personalized promotions, and handle customer support inquiries.",
    solution: "Integrated Net2APP WhatsApp Business API and SMS API into their CRM. Used Conversation Orchestrator for seamless cross-channel handoff. Set up automated loyalty point notifications and birthday promotions via WhatsApp.",
    results: [
      { metric: "92%", label: "WhatsApp message read rate" },
      { metric: "35%", label: "Increase in loyalty engagement" },
      { metric: "4.5M", label: "Monthly customer messages" },
      { metric: "150+", label: "Stores unified" },
    ],
    quote: "WhatsApp transformed our customer engagement. 92% read rates compared to 20% for email. The Conversation Orchestrator means customers get consistent experience whether they text, WhatsApp, or call.",
    icon: "🏪",
    color: "from-rose-500 to-red-500",
  },
];

export default function CaseStudiesPage() {
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
            <span className="text-blue-200 text-sm font-medium">Real Results from Real Customers</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
            Customer Case Studies
            <span className="block text-blue-400">SMS Gateway Success Across Industries</span>
          </h1>
          <p className="text-lg text-blue-200 max-w-3xl mx-auto">
            See how <strong className="text-white">financial services</strong>,{" "}
            <strong className="text-white">healthcare</strong>,{" "}
            <strong className="text-white">ecommerce</strong>,{" "}
            <strong className="text-white">banking</strong>,{" "}
            <strong className="text-white">education</strong>, and{" "}
            <strong className="text-white">retail</strong> businesses achieve real results with Net2APP SMS gateway.
          </p>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 space-y-16">
          {caseStudies.map((cs, i) => (
            <div key={i} className={`bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}>
              <div className={`bg-gradient-to-br ${cs.color} p-8 lg:p-12 flex items-center justify-center lg:w-80 shrink-0`}>
                <div className="text-center">
                  <span className="text-6xl block mb-3">{cs.icon}</span>
                  <p className="text-white font-bold text-xl">{cs.company}</p>
                  <p className="text-white/70 text-sm">{cs.industry}</p>
                </div>
              </div>
              <div className="p-8 lg:p-10 flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Challenge</p>
                    <p className="text-gray-600 text-sm leading-relaxed">{cs.challenge}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Solution</p>
                    <p className="text-gray-600 text-sm leading-relaxed">{cs.solution}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Results</p>
                    <div className="grid grid-cols-2 gap-3">
                      {cs.results.map((r, j) => (
                        <div key={j} className="bg-gray-50 rounded-xl p-3 text-center">
                          <p className="text-xl font-bold text-blue-600">{r.metric}</p>
                          <p className="text-gray-500 text-xs">{r.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-500 text-sm">
                  &ldquo;{cs.quote}&rdquo;
                </blockquote>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Industry-Wide Impact</h2>
          <p className="text-gray-500 text-lg mb-10">Aggregate results across all Net2APP customers</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { metric: "50M+", label: "SMS messages sent monthly" },
              { metric: "99.99%", label: "Platform uptime SLA" },
              { metric: "220+", label: "Countries with Voice OTP" },
              { metric: "15+", label: "Industries served" },
              { metric: "2.1s", label: "Average SMS delivery time" },
              { metric: "99.7%", label: "First-attempt delivery rate" },
              { metric: "80+", label: "Pre-built connectors" },
              { metric: "60s", label: "Average deployment time" },
            ].map((s, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-6">
                <p className="text-3xl font-bold text-blue-600 mb-1">{s.metric}</p>
                <p className="text-gray-500 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Become Our Next Success Story</h2>
          <p className="text-blue-100 text-lg mb-8">Join 1,000+ businesses using Net2APP for SMS, Voice OTP, and OTT messaging. Deploy in 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Free Now →</a>
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
              <Link href="/case-studies" className="text-blue-400 hover:text-white text-sm transition">Case Studies</Link>
              <Link href="/blog" className="text-blue-400 hover:text-white text-sm transition">Blog</Link>
              <Link href="/pricing" className="text-blue-400 hover:text-white text-sm transition">Pricing</Link>
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
