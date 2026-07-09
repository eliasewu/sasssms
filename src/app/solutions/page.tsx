"use client";

import Link from "next/link";
import { useState } from "react";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/solutions#webpage",
      "url": "https://net2app.com/solutions",
      "name": "SMS Gateway Solutions — Use Cases, Teams & Industries | Net2APP",
      "description": "Net2APP SMS gateway solutions for every use case, team, and industry. Multi-tenant platform with SMPP v3.4, HTTP API, RCS, Voice OTP, WhatsApp, and Telegram.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "Solutions", "item": "https://net2app.com/solutions" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/solutions#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What SMS solutions does Net2APP offer?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP offers a comprehensive multi-tenant SMS gateway platform covering 15+ use cases (verification OTP, fraud prevention, appointment reminders, marketing campaigns, mass texting, AI agents, and more), 5 team-focused solutions (developers, data engineering, marketing, product, customer experience), and 8 industry-specific solutions (financial services, healthcare, retail, ecommerce, education, hospitality, nonprofit, public sector). All solutions include SMPP v3.4, HTTP API, RCS, Voice OTP, WhatsApp, and Telegram."
          }
        },
        {
          "@type": "Question",
          "name": "Which use cases are best for businesses getting started?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The most popular starting points are: Verification & Identity (SMS/voice OTP for user authentication), Alerts & Notifications (transactional messages and system alerts), Appointment Reminders (automated scheduling with 30-50% no-show reduction), and SMS Marketing (subscriber lists, segmentation, and targeted campaigns). All use cases are available on the free Starter plan with zero setup fees."
          }
        },
        {
          "@type": "Question",
          "name": "How does Net2APP serve different industries?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP provides industry-specific solutions with tailored features: financial services get Voice OTP for secure banking 2FA and Flash SMS fraud alerts; healthcare gets HIPAA-ready appointment reminders and patient notifications; ecommerce and retail get cart abandonment recovery and shipping updates; education gets attendance alerts and parent-teacher messaging; and public sector gets emergency broadcast SMS. Each industry solution benefits from PostgreSQL schema isolation for regulatory compliance."
          }
        },
        {
          "@type": "Question",
          "name": "Can I mix and match solutions for my business?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Absolutely. Net2APP is a single platform with all solutions available under one API key. You can combine verification OTP for user sign-ups, SMS marketing for customer engagement, and appointment reminders for service scheduling — all from the same multi-tenant infrastructure. Each department or business unit can have its own isolated sub-client with individual routing and rates."
          }
        }
      ]
    }
  ],
};

const useCases = [
  { icon: "✅", title: "Verification & Identity", href: "/solutions/use-cases/verification-and-identity", desc: "OTP delivery, two-factor authentication, identity verification via SMS and Voice OTP with 220+ country support." },
  { icon: "🛡️", title: "Fraud Prevention", href: "/solutions/use-cases/fraud-prevention", desc: "Real-time transaction alerts, suspicious activity notifications, and SIM-swap detection through voice and SMS." },
  { icon: "🔔", title: "Alerts & Notifications", href: "/solutions/use-cases/alerts-and-notifications", desc: "System alerts, status updates, emergency broadcasts, and critical notifications with Flash SMS priority delivery." },
  { icon: "📅", title: "Appointment Reminders", href: "/solutions/use-cases/appointment-reminders", desc: "Automated SMS appointment confirmations, reminders, and rescheduling notifications to reduce no-shows." },
  { icon: "⚡", title: "Lead Alerts", href: "/solutions/use-cases/lead-alerts", desc: "Instant lead notifications via SMS, WhatsApp, and Telegram so your sales team responds in seconds." },
  { icon: "📨", title: "Mass Texting", href: "/solutions/use-cases/mass-texting", desc: "Broadcast SMS campaigns to thousands of recipients with high throughput, DLR tracking, and intelligent routing." },
  { icon: "📣", title: "Marketing & Promotions", href: "/solutions/use-cases/marketing-and-promotions", desc: "SMS marketing campaigns with personalized messaging, RCS rich media, and Flash SMS for time-sensitive offers." },
  { icon: "💬", title: "SMS Marketing", href: "/solutions/use-cases/sms-marketing", desc: "Build subscriber lists, segment audiences, and run targeted SMS marketing campaigns with delivery analytics." },
  { icon: "📈", title: "Cross-Sell & Upsell", href: "/solutions/use-cases/cross-sell-and-upsell", desc: "Triggered SMS based on customer behavior, purchase history, and engagement patterns to drive revenue." },
  { icon: "💰", title: "Optimize Ad Spend", href: "/solutions/use-cases/optimize-ad-spend", desc: "SMS-driven retargeting, coupon delivery, and personalized offers to maximize ROI on advertising campaigns." },
  { icon: "🎧", title: "Support & Sales", href: "/solutions/use-cases/support-and-sales", desc: "Omnichannel customer support via SMS, WhatsApp, and Telegram with automated responses and agent handoff." },
  { icon: "🤖", title: "AI Agent Productivity", href: "/solutions/use-cases/ai-agent-productivity", desc: "AI-powered SMS agents for automated customer interactions, lead qualification, and intelligent message routing." },
  { icon: "📞", title: "IVR", href: "/solutions/use-cases/ivr", desc: "Interactive Voice Response with Voice OTP, menu navigation, and SMS fallback for enhanced customer self-service." },
  { icon: "🏢", title: "Contact Center", href: "/solutions/use-cases/contact-center", desc: "Omnichannel contact center integration with SMS, Voice OTP, WhatsApp, and Telegram in a single platform." },
  { icon: "📊", title: "Customer Data Management", href: "/solutions/use-cases/customer-data-management", desc: "SMS-based data collection, customer surveys, feedback forms, and real-time customer data enrichment." },
];

const teams = [
  { icon: "💻", title: "Developers", href: "/solutions/teams/developers", desc: "RESTful SMS API, SMPP v3.4, webhook integrations, SDK examples, and comprehensive documentation." },
  { icon: "📊", title: "Data Engineering", href: "/solutions/teams/data-engineering", desc: "SMS data pipelines, DLR analytics, message logs, and real-time data export for your data infrastructure." },
  { icon: "📣", title: "Marketing", href: "/solutions/teams/marketing", desc: "SMS campaign management, audience segmentation, RCS rich messaging, and campaign performance analytics." },
  { icon: "🎯", title: "Product", href: "/solutions/teams/product", desc: "SMS API integration, Voice OTP, WhatsApp/Telegram messaging — add communication features to any product." },
  { icon: "❤️", title: "Customer Experience", href: "/solutions/teams/customer-experience", desc: "Omnichannel customer engagement, personalized messaging, automated journeys, and real-time feedback." },
];

const industries = [
  { icon: "🏦", title: "Financial Services", href: "/solutions/industries/financial-services", desc: "Secure transaction alerts, Voice OTP for banking, fraud detection, and regulatory compliance messaging." },
  { icon: "🏥", title: "Healthcare", href: "/solutions/industries/healthcare", desc: "Appointment reminders, prescription alerts, patient notifications, and HIPAA-compliant messaging." },
  { icon: "🛍️", title: "Retail", href: "/solutions/industries/retail", desc: "Promotional SMS, order updates, loyalty programs, and personalized shopping experiences via SMS and RCS." },
  { icon: "🤝", title: "Nonprofit", href: "/solutions/industries/nonprofit", desc: "Donation campaigns, volunteer coordination, event notifications, and impact updates via SMS." },
  { icon: "🏨", title: "Hospitality", href: "/solutions/industries/hospitality", desc: "Booking confirmations, check-in reminders, guest feedback surveys, and concierge SMS services." },
  { icon: "🛒", title: "Ecommerce", href: "/solutions/industries/ecommerce", desc: "Order confirmations, shipping updates, cart abandonment recovery, and personalized product recommendations." },
  { icon: "🏛️", title: "Public Sector", href: "/solutions/industries/public-sector", desc: "Emergency alerts, citizen notifications, public service updates, and government communication via SMS." },
  { icon: "🎓", title: "Education", href: "/solutions/industries/education", desc: "Attendance alerts, grade notifications, emergency campus broadcasts, and parent-teacher communication." },
];

export default function SolutionsHubPage() {
  const [showMobile, setShowMobile] = useState(false);
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
              <Link href="/solutions/use-cases" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Use Cases</Link>
              <Link href="/solutions/teams" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Teams</Link>
              <Link href="/solutions/industries" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Industries</Link>
              <Link href="/solutions/enterprise" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Enterprise</Link>
              {/* Features hover dropdown */}
              <div className="relative group">
                <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Features ▾</button>
                <div className="absolute top-full left-0 mt-1 w-[200px] bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="space-y-1">
                    {[
                      { name: "Voice OTP", href: "/voice-otp", icon: "📞" },
                      { name: "HTTP SMS API", href: "/http-sms-api", icon: "🌐" },
                      { name: "SMS Routing", href: "/sms-routing", icon: "🔀" },
                      { name: "WhatsApp & Telegram", href: "/whatsapp-telegram-api", icon: "💬" },
                      { name: "IP Whitelisting", href: "/ip-whitelisting", icon: "🛡️" },
                      { name: "OTT Pairing", href: "/ott-pairing", icon: "🔗" },
                    ].map((f) => (
                      <Link key={f.name} href={f.href} className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                        <span className="text-base">{f.icon}</span>
                        <span>{f.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/contact" className="hidden sm:inline-flex px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started Free</Link>
              <button onClick={() => setShowMobile(!showMobile)} className="lg:hidden p-2 text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showMobile ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
              </button>
            </div>
          </div>
        </div>
        {/* Mobile Menu */}
        {showMobile && (
          <div className="lg:hidden pb-6 border-t border-gray-200 pt-4 space-y-3">
            <Link href="/solutions/use-cases" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2" onClick={() => setShowMobile(false)}>Use Cases</Link>
            <Link href="/solutions/teams" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2" onClick={() => setShowMobile(false)}>Teams</Link>
            <Link href="/solutions/industries" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2" onClick={() => setShowMobile(false)}>Industries</Link>
            <Link href="/solutions/enterprise" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2" onClick={() => setShowMobile(false)}>Enterprise</Link>
            <div className="border-t border-gray-200 pt-3 mt-1">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2 px-1">Features</p>
              <div className="space-y-1">
                {[
                  { name: "Voice OTP", href: "/voice-otp", icon: "📞" },
                  { name: "HTTP SMS API", href: "/http-sms-api", icon: "🌐" },
                  { name: "SMS Routing", href: "/sms-routing", icon: "🔀" },
                  { name: "WhatsApp & Telegram", href: "/whatsapp-telegram-api", icon: "💬" },
                  { name: "IP Whitelisting", href: "/ip-whitelisting", icon: "🛡️" },
                  { name: "OTT Pairing", href: "/ott-pairing", icon: "🔗" },
                ].map((f) => (
                  <Link key={f.name} href={f.href} className="flex items-center gap-2 px-1 py-1.5 text-sm text-gray-600 hover:text-blue-600 transition" onClick={() => setShowMobile(false)}>
                    <span>{f.icon}</span>
                    <span>{f.name}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="pt-2"><Link href="/contact" className="block w-full text-center px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition" onClick={() => setShowMobile(false)}>Get Started Free</Link></div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 border border-blue-200 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            <span className="text-blue-700 text-sm font-medium">Solutions for Every Use Case, Team & Industry</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            SMS Gateway Solutions
            <span className="block text-blue-600">Built for Every Business Need</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-4xl mx-auto mb-10 leading-relaxed">
            From <strong className="text-gray-900">verification and fraud prevention</strong> to <strong className="text-gray-900">marketing campaigns and AI agents</strong> — 
            Net2APP's multi-tenant SMS gateway platform powers communication across every department, industry, and company size.
            SMPP, HTTP API, RCS, Voice OTP, WhatsApp, Telegram — all in one platform.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/solutions/use-cases" className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-lg shadow-lg shadow-blue-600/20">Explore Use Cases →</Link>
            <Link href="/solutions/industries" className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition font-semibold text-lg">By Industry</Link>
            <Link href="/solutions/teams" className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition font-semibold text-lg">By Team</Link>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Use Cases</h2>
            <p className="text-gray-500 text-lg">Solve real business problems with SMS, Voice OTP, RCS, and OTT messaging</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {useCases.map((uc, i) => (
              <Link key={i} href={uc.href} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition group">
                <div className="flex items-start gap-4">
                  <span className="text-3xl shrink-0">{uc.icon}</span>
                  <div>
                    <h3 className="text-gray-900 font-semibold group-hover:text-blue-600 transition mb-1">{uc.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{uc.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/solutions/use-cases" className="text-blue-600 hover:text-blue-700 transition font-medium">View all use cases →</Link>
          </div>
        </div>
      </section>

      {/* Teams */}
      <section id="teams" className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">By Team</h2>
            <p className="text-gray-500 text-lg">Tailored tools for every department in your organization</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((t, i) => (
              <Link key={i} href={t.href} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-green-200 transition group">
                <div className="text-4xl mb-4">{t.icon}</div>
                <h3 className="text-gray-900 font-semibold text-lg mb-2 group-hover:text-green-600 transition">{t.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{t.desc}</p>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/solutions/teams" className="text-blue-600 hover:text-blue-700 transition font-medium">View all teams →</Link>
          </div>
        </div>
      </section>

      {/* Industries */}
      <section id="industries" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">By Industry</h2>
            <p className="text-gray-500 text-lg">Industry-specific solutions for regulated and fast-moving sectors</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {industries.map((ind, i) => (
              <Link key={i} href={ind.href} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition group">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{ind.icon}</span>
                  <div>
                    <h3 className="text-gray-900 font-semibold group-hover:text-purple-600 transition">{ind.title}</h3>
                    <p className="text-gray-500 text-xs mt-1">{ind.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/solutions/industries" className="text-blue-600 hover:text-blue-700 transition font-medium">View all industries →</Link>
          </div>
        </div>
      </section>

      {/* Company Size */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">By Company Size</h2>
            <p className="text-gray-500 text-lg">Solutions scaled for your organization</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Link href="/solutions/startup" className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-md hover:border-cyan-200 transition group text-center">
              <span className="text-5xl mb-4 block">🚀</span>
              <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-cyan-600 transition">Startup</h3>
              <p className="text-gray-500 text-sm mb-4">Pay-as-you-go SMS API with zero setup fees. No monthly minimums, no hidden costs. Scale as you grow.</p>
              <span className="text-blue-600 font-medium text-sm">Learn more →</span>
            </Link>
            <Link href="/solutions/enterprise" className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition group text-center">
              <span className="text-5xl mb-4 block">🏢</span>
              <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition">Enterprise</h3>
              <p className="text-gray-500 text-sm mb-4">Dedicated infrastructure, unlimited TPS, white-label branding, SLA guarantees, and 24/7 priority support.</p>
              <span className="text-blue-600 font-medium text-sm">Learn more →</span>
            </Link>
          </div>
          <div className="text-center mt-8">
            <Link href="/solutions/see-all" className="text-blue-600 hover:text-blue-700 transition font-medium">See all solutions →</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Find Your Solution</h2>
          <p className="text-blue-100 text-lg mb-8">Not sure where to start? Explore all solutions or contact our team for a personalized recommendation.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/solutions/see-all" className="px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">See All Solutions →</Link>
            <Link href="/contact" className="px-10 py-4 border-2 border-white/50 text-white rounded-xl hover:bg-white/10 transition font-semibold text-lg">Talk to Sales</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div>
                <span className="text-white font-semibold text-lg">Net2APP</span>
              </Link>
              <p className="text-gray-400 text-sm max-w-md leading-relaxed">Enterprise SMS Gateway & Voice OTP Platform. Multi-tenant SaaS with SMPP, HTTP API, RCS, Voice OTP, and OTT messaging. No setup fees — pay only for what you use.</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Solutions</p>
              <div className="space-y-2.5">
                <Link href="/solutions/use-cases" className="block text-sm text-gray-400 hover:text-white transition">Use Cases</Link>
                <Link href="/solutions/teams" className="block text-sm text-gray-400 hover:text-white transition">Teams</Link>
                <Link href="/solutions/industries" className="block text-sm text-gray-400 hover:text-white transition">Industries</Link>
                <Link href="/solutions/see-all" className="block text-sm text-gray-400 hover:text-white transition">All Solutions</Link>
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Company</p>
              <div className="space-y-2.5">
                <Link href="/contact" className="block text-sm text-gray-400 hover:text-white transition">Contact</Link>
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
