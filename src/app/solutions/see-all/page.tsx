import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "All SMS Gateway Solutions — Complete Directory | Net2APP",
  description:
    "Browse every Net2APP SMS gateway solution: use cases (verification, fraud prevention, marketing, AI agents), teams (developers, marketing, product), industries (financial, healthcare, retail), and company size (startup, enterprise).",
  keywords: [
    "SMS Solutions Directory",
    "SMS Gateway Solutions",
    "All SMS Solutions",
    "SMS Use Cases Directory",
    "SMS Team Solutions",
    "SMS Industry Solutions",
    "Complete SMS Platform",
    "SMS Solution Guide",
    "SMS Solutions Bangladesh",
    "SMS Solutions India",
    "SMS Solutions UAE",
    "SMS Platform Directory",
    "SMS Features List",
    "SMS Solution Overview",
    "SMS All Features",
  ],
  openGraph: {
    title: "All SMS Gateway Solutions | Net2APP",
    description: "Complete directory of Net2APP solutions by use case, team, industry, and company size.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/solutions/see-all#webpage",
      "url": "https://net2app.com/solutions/see-all",
      "name": "All SMS Solutions — Complete Platform Overview",
      "description":
        "Browse all Net2APP SMS gateway solutions: use cases, industries, teams, and integrations. Everything the platform offers in one place.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "Solutions", "item": "https://net2app.com/solutions" },
          { "@type": "ListItem", "position": 3, "name": "See All", "item": "https://net2app.com/solutions/see-all" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/solutions/see-all#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Where should I start with Net2APP?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "If you're new to SMS gateways, start with the Verification & Identity use case (OTP delivery) or explore the Developer documentation for API integration. For business use, check Solutions by Team to find tools suited to your role. The Startup plan is free with zero setup fees — a great way to explore the full platform.",
          },
        },
        {
          "@type": "Question",
          "name": "What's the difference between use cases, teams, and industries?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Use Cases show what you can do (verification, marketing, fraud prevention), Teams show who uses the platform (developers, marketers, product managers), and Industries show where it's applied (financial services, healthcare, retail). Together they give you a complete picture of Net2APP's capabilities and how they map to your needs.",
          },
        },
        {
          "@type": "Question",
          "name": "Do I need separate accounts for different solutions?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. A single Net2APP tenant gives you access to all solutions — all 15 use cases, all team tools, and all industry configurations. There are no per-feature charges or separate accounts. The Starter plan includes all features with pay-as-you-go pricing.",
          },
        },
        {
          "@type": "Question",
          "name": "Can I get a personalized demo of the platform?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Visit the Contact page to request a demo or email info@net2app.com. Our team can walk you through the specific solutions relevant to your use case, team, and industry. You can also deploy your own instance free in 60 seconds to explore the platform yourself.",
          },
        },
      ],
    },
  ],
};


const allSolutions = [
  { category: "Use Cases", items: [
    { href: "/solutions/use-cases/verification-and-identity", icon: "✅", title: "Verification & Identity", desc: "OTP delivery, 2FA, identity verification via SMS and Voice OTP" },
    { href: "/solutions/use-cases/fraud-prevention", icon: "🛡️", title: "Fraud Prevention", desc: "Real-time fraud alerts, suspicious activity notifications" },
    { href: "/solutions/use-cases/alerts-and-notifications", icon: "🔔", title: "Alerts & Notifications", desc: "System alerts, emergency broadcasts, Flash SMS priority" },
    { href: "/solutions/use-cases/appointment-reminders", icon: "📅", title: "Appointment Reminders", desc: "Automated confirmations, reminders, rescheduling" },
    { href: "/solutions/use-cases/lead-alerts", icon: "⚡", title: "Lead Alerts", desc: "Instant SMS/WhatsApp/Telegram lead notifications" },
    { href: "/solutions/use-cases/mass-texting", icon: "📨", title: "Mass Texting", desc: "High-throughput broadcast SMS campaigns" },
    { href: "/solutions/use-cases/marketing-and-promotions", icon: "📣", title: "Marketing & Promotions", desc: "SMS campaigns, RCS rich media, personalized offers" },
    { href: "/solutions/use-cases/sms-marketing", icon: "💬", title: "SMS Marketing", desc: "Subscriber lists, segmentation, campaign analytics" },
    { href: "/solutions/use-cases/cross-sell-and-upsell", icon: "📈", title: "Cross-Sell & Upsell", desc: "Behavior-triggered product recommendations" },
    { href: "/solutions/use-cases/optimize-ad-spend", icon: "💰", title: "Optimize Ad Spend", desc: "SMS retargeting, coupon delivery, conversion tracking" },
    { href: "/solutions/use-cases/support-and-sales", icon: "🎧", title: "Support & Sales", desc: "Omnichannel support via SMS, WhatsApp, Telegram" },
    { href: "/solutions/use-cases/ai-agent-productivity", icon: "🤖", title: "AI Agent Productivity", desc: "AI chatbots, automated lead qualification, FAQ" },
    { href: "/solutions/use-cases/ivr", icon: "📞", title: "IVR", desc: "Interactive Voice Response with Voice OTP" },
    { href: "/solutions/use-cases/contact-center", icon: "🏢", title: "Contact Center", desc: "Omnichannel contact center integration" },
    { href: "/solutions/use-cases/customer-data-management", icon: "📊", title: "Customer Data Management", desc: "SMS surveys, feedback, data enrichment" },
  ]},
  { category: "By Team", items: [
    { href: "/solutions/teams/developers", icon: "💻", title: "Developers", desc: "RESTful API, SMPP v3.4, webhooks, SDKs" },
    { href: "/solutions/teams/data-engineering", icon: "📊", title: "Data Engineering", desc: "SMS data pipelines, DLR analytics, export" },
    { href: "/solutions/teams/marketing", icon: "📣", title: "Marketing", desc: "Campaigns, RCS, segmentation, analytics" },
    { href: "/solutions/teams/product", icon: "🎯", title: "Product", desc: "Voice OTP, messaging API, white-label" },
    { href: "/solutions/teams/customer-experience", icon: "❤️", title: "Customer Experience", desc: "Omnichannel engagement, automation" },
  ]},
  { category: "By Industry", items: [
    { href: "/solutions/industries/financial-services", icon: "🏦", title: "Financial Services", desc: "Secure alerts, Voice OTP for banking" },
    { href: "/solutions/industries/healthcare", icon: "🏥", title: "Healthcare", desc: "Appointments, prescriptions, patient notifications" },
    { href: "/solutions/industries/retail", icon: "🛍️", title: "Retail", desc: "Promotions, orders, loyalty, RCS" },
    { href: "/solutions/industries/nonprofit", icon: "🤝", title: "Nonprofit", desc: "Donations, volunteers, events" },
    { href: "/solutions/industries/hospitality", icon: "🏨", title: "Hospitality", desc: "Bookings, check-ins, guest feedback" },
    { href: "/solutions/industries/ecommerce", icon: "🛒", title: "Ecommerce", desc: "Orders, shipping, cart recovery" },
    { href: "/solutions/industries/public-sector", icon: "🏛️", title: "Public Sector", desc: "Emergency alerts, citizen notifications" },
    { href: "/solutions/industries/education", icon: "🎓", title: "Education", desc: "Attendance, grades, campus broadcasts" },
  ]},
  { category: "By Company Size", items: [
    { href: "/solutions/startup", icon: "🚀", title: "Startup", desc: "$0 setup, pay-as-you-go, deploy in 60s" },
    { href: "/solutions/enterprise", icon: "🏢", title: "Enterprise", desc: "Dedicated infra, unlimited TPS, white-label, SLA" },
  ]},
  { category: "Platform Features", items: [
    { href: "/voice-otp", icon: "📞", title: "Voice OTP", desc: "Call-based OTP with 220+ country language detection" },
    { href: "/http-sms-api", icon: "🌐", title: "HTTP SMS API", desc: "RESTful API with RCS, Flash SMS, DLR webhooks" },
    { href: "/sms-routing", icon: "🔀", title: "SMS Routing", desc: "Multi-layer routing: Plans → Routes → Trunks → Suppliers" },
    { href: "/ott-pairing", icon: "📱", title: "OTT Device Pairing", desc: "WhatsApp QR pairing & Telegram MTProto connection" },
    { href: "/whatsapp-telegram-api", icon: "💬", title: "WhatsApp & Telegram API", desc: "Business API with multi-device support" },
    { href: "/ip-whitelisting", icon: "🛡️", title: "IP Whitelisting", desc: "API security with IP-based access control" },
    { href: "/contact", icon: "📧", title: "Contact Us", desc: "Get in touch with our team" },
  ]},
];

export default function SeeAllPage() {
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
              <Link href="/solutions/use-cases" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Use Cases</Link>
              <Link href="/solutions/teams" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Teams</Link>
              <Link href="/solutions/industries" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Industries</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/contact" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            All Solutions
            <span className="block text-blue-600">Complete Directory</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Browse every Net2APP solution by category. Click any solution to learn more.
          </p>
        </div>
      </section>

      {/* Directory */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-20">
        {allSolutions.map((group) => (
          <div key={group.category} className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b border-gray-200 pb-3">{group.category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.items.map((item) => (
                <Link key={item.title} href={item.href} className="bg-white rounded-xl p-4 border border-gray-100 hover:border-blue-300 hover:shadow-sm transition group flex items-start gap-3">
                  <span className="text-2xl shrink-0">{item.icon}</span>
                  <div>
                    <h3 className="text-gray-900 font-medium text-sm group-hover:text-blue-600 transition">{item.title}</h3>
                    <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Not Sure Where to Start?</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your SMS gateway in 60 seconds — free, no setup fees, no hidden costs.</p>
          <Link href="/contact" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</Link>
        </div>
      </section>

      {/* Footer */}
      
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
                <Link href="/solutions" className="block text-sm text-gray-400 hover:text-white transition">Overview</Link>
                <Link href="/solutions/use-cases" className="block text-sm text-gray-400 hover:text-white transition">Use Cases</Link>
                <Link href="/solutions/industries" className="block text-sm text-gray-400 hover:text-white transition">Industries</Link>
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Company</p>
              <div className="space-y-2.5">
                <Link href="/contact" className="block text-sm text-gray-400 hover:text-white transition">Contact</Link>
                <Link href="/solutions/startup" className="block text-sm text-gray-400 hover:text-white transition">Startup</Link>
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
