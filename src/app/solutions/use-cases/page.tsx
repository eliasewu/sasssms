import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Use Cases — Verification, Fraud Prevention, Marketing, AI Agents & More | Net2APP",
  description:
    "Explore 15 SMS use cases powered by Net2APP: verification & identity, fraud prevention, alerts, appointment reminders, lead alerts, mass texting, marketing, cross-sell, AI agents, IVR, contact centers, and customer data management.",
  keywords: [
    "SMS Use Cases",
    "SMS Gateway Use Cases",
    "SMS Business Use Cases",
    "Voice OTP Use Cases",
    "SMS Marketing Use Cases",
    "SMS API Use Cases",
    "CPaaS Use Cases",
    "Enterprise SMS Use Cases",
    "SMS Automation Use Cases",
    "SMS Use Case Bangladesh",
    "SMS Use Case India",
    "SMS Use Case UAE",
    "SMS Solution Use Cases",
    "SMS Platform Use Cases",
    "SMS Business Solutions",
  ],
  openGraph: {
    title: "SMS Use Cases — 15 Ways to Use SMS, Voice OTP & RCS | Net2APP",
    description: "From OTP verification and fraud alerts to AI agents and contact centers — explore every SMS use case on one platform.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/solutions/use-cases#webpage",
      "url": "https://net2app.com/solutions/use-cases",
      "name": "SMS Use Cases — Verification, Fraud Prevention, Marketing & More",
      "description":
        "Explore 15 SMS use cases powered by Net2APP: verification & identity, fraud prevention, alerts, appointment reminders, lead alerts, mass texting, marketing, cross-sell, AI agents, IVR, contact centers, and customer data management.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "Solutions", "item": "https://net2app.com/solutions" },
          { "@type": "ListItem", "position": 3, "name": "Use Cases", "item": "https://net2app.com/solutions/use-cases" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/solutions/use-cases#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Which SMS use case should I start with?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Most businesses start with Verification & Identity (OTP delivery) or Alerts & Notifications since these are foundational. From there, you can expand to Marketing, Fraud Prevention, AI Agents, or any of the 15 use cases. Net2APP's single API platform supports all use cases, so you can add new ones without changing your integration.",
          },
        },
        {
          "@type": "Question",
          "name": "Can I combine multiple use cases on one platform?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Net2APP is designed as a unified CPaaS platform. You can use SMS OTP for verification, Voice OTP for 2FA, Flash SMS for fraud alerts, bulk SMS for marketing campaigns, and WhatsApp/Telegram APIs for support — all through a single API integration. There are no separate setups or additional fees for different use cases.",
          },
        },
        {
          "@type": "Question",
          "name": "Do I need different integrations for SMS vs Voice OTP?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. Net2APP provides a unified API that handles SMS, Voice OTP, RCS, WhatsApp, and Telegram from the same endpoints. Authentication, rate limiting, DLR tracking, and IP whitelisting work consistently across all channels. Code examples are available in Node.js, Python, and PHP.",
          },
        },
        {
          "@type": "Question",
          "name": "How do AI agents use the SMS platform?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "AI agents and chatbots connect to Net2APP's messaging APIs (SMS, WhatsApp, Telegram) to send and receive messages programmatically. The agent handles customer queries, qualifies leads, answers FAQs, and escalates complex issues to human agents — all through a single API integration with full conversation history.",
          },
        },
      ],
    },
  ],
};


const useCaseSections = [
  {
    id: "verification",
    icon: "✅",
    title: "Verification & Identity",
    href: "/solutions/use-cases/verification-and-identity",
    desc: "Deliver one-time passwords (OTPs) via SMS, Voice Call, WhatsApp, and Telegram for user verification, account registration, password reset, and two-factor authentication (2FA). Net2APP's Voice OTP engine supports 220+ countries with automatic MCC-based language detection.",
    features: ["SMS OTP delivery with 99.9% uptime", "Voice OTP with Asterisk AMI and 3-retry logic", "Alphanumeric OTP support (A-Z, 0-9)", "220+ country language detection", "WhatsApp and Telegram OTP delivery"],
  },
  {
    id: "fraud",
    icon: "🛡️",
    title: "Fraud Prevention",
    href: "/solutions/use-cases/fraud-prevention",
    desc: "Send real-time fraud alerts and suspicious activity notifications via SMS, Flash SMS (priority screen pop-up), and Voice OTP. IP whitelisting for API security ensures only authorized users can trigger communications.",
    features: ["Real-time fraud alert SMS", "Flash SMS for urgent notifications", "Voice OTP for high-risk transactions", "IP whitelisting for API security", "Multi-factor authentication support"],
  },
  {
    id: "alerts",
    icon: "🔔",
    title: "Alerts & Notifications",
    href: "/solutions/use-cases/alerts-and-notifications",
    desc: "Send system alerts, status updates, emergency broadcasts, and critical notifications. Use Flash SMS (Class 0) for messages that appear as instant screen pop-ups that cannot be ignored.",
    features: ["Flash SMS priority delivery", "System status notifications", "Emergency broadcast capability", "Scheduled alert delivery", "DLR confirmation tracking"],
  },
  {
    id: "appointments",
    icon: "📅",
    title: "Appointment Reminders",
    href: "/solutions/use-cases/appointment-reminders",
    desc: "Reduce no-shows with automated SMS appointment reminders. Send confirmations, reminders, rescheduling links, and follow-up messages. Suitable for healthcare, hospitality, and service businesses.",
    features: ["Automated reminder scheduling", "Two-way SMS confirmation", "Calendar integration support", "Multi-language reminders", "Analytics and delivery tracking"],
  },
  {
    id: "leads",
    icon: "⚡",
    title: "Lead Alerts",
    href: "/solutions/use-cases/lead-alerts",
    desc: "Get instant lead notifications via SMS, WhatsApp, and Telegram the moment a prospect fills out a form. Speed-to-lead is critical — respond in seconds, not hours.",
    features: ["Instant SMS lead alerts", "WhatsApp and Telegram notifications", "CRM integration ready", "Customizable alert templates", "Round-robin lead distribution"],
  },
  {
    id: "mass-texting",
    icon: "📨",
    title: "Mass Texting",
    href: "/solutions/use-cases/mass-texting",
    desc: "Broadcast SMS campaigns to thousands of recipients with high throughput. Net2APP's intelligent routing engine automatically selects the best supplier for each destination. Includes DLR tracking and real-time analytics.",
    features: ["High-throughput bulk SMS", "Intelligent multi-supplier routing", "Real-time DLR tracking", "Audience segmentation", "Campaign analytics dashboard"],
  },
  {
    id: "marketing",
    icon: "📣",
    title: "Marketing & Promotions",
    href: "/solutions/use-cases/marketing-and-promotions",
    desc: "Run SMS marketing campaigns with personalized messaging at scale. Use RCS (Rich Communication Services) for branded messages with images, carousels, and interactive buttons.",
    features: ["Personalized bulk SMS campaigns", "RCS rich media messaging", "Flash SMS for time-sensitive offers", "Audience segmentation", "Campaign A/B testing"],
  },
  {
    id: "sms-marketing",
    icon: "💬",
    title: "SMS Marketing",
    href: "/solutions/use-cases/sms-marketing",
    desc: "Build subscriber lists, create audience segments, and run targeted SMS marketing campaigns. Deliver exclusive offers, product launches, and personalized recommendations directly to mobile phones.",
    features: ["Subscriber list management", "Audience segmentation tools", "Automated campaign triggers", "Personalized message templates", "Performance analytics"],
  },
  {
    id: "cross-sell",
    icon: "📈",
    title: "Cross-Sell & Upsell",
    href: "/solutions/use-cases/cross-sell-and-upsell",
    desc: "Trigger SMS messages based on customer behavior — purchase history, browsing patterns, and engagement. Send personalized product recommendations and upsell offers at the right moment.",
    features: ["Behavior-triggered messaging", "Purchase history integration", "Personalized recommendations", "Post-purchase follow-ups", "Revenue attribution tracking"],
  },
  {
    id: "ad-spend",
    icon: "💰",
    title: "Optimize Ad Spend",
    href: "/solutions/use-cases/optimize-ad-spend",
    desc: "Maximize ROI on advertising campaigns with SMS-driven retargeting. Send personalized coupons, exclusive offers, and time-sensitive promotions to warm leads who have already shown interest.",
    features: ["Ad retargeting via SMS", "Personalized coupon delivery", "Time-sensitive offer campaigns", "Conversion tracking", "Cost-per-acquisition optimization"],
  },
  {
    id: "support",
    icon: "🎧",
    title: "Support & Sales",
    href: "/solutions/use-cases/support-and-sales",
    desc: "Omnichannel customer support via SMS, WhatsApp, and Telegram. Automate common responses with templates and seamlessly hand off to human agents when needed.",
    features: ["Omnichannel support inbox", "Automated response templates", "Agent assignment routing", "Conversation history", "Multi-device agent access"],
  },
  {
    id: "ai-agents",
    icon: "🤖",
    title: "AI Agent Productivity",
    href: "/solutions/use-cases/ai-agent-productivity",
    desc: "Power AI agents and chatbots with SMS, WhatsApp, and Telegram APIs. Automate customer interactions, qualify leads, answer FAQs, and route complex issues to human agents.",
    features: ["AI chatbot SMS integration", "Automated lead qualification", "FAQ auto-response", "Intelligent conversation routing", "API-first agent architecture"],
  },
  {
    id: "ivr",
    icon: "📞",
    title: "IVR (Interactive Voice Response)",
    href: "/solutions/use-cases/ivr",
    desc: "Build IVR systems with Voice OTP, menu navigation, and SMS fallback. Net2APP's Asterisk AMI integration provides reliable call origination for voice-based customer self-service.",
    features: ["Voice OTP for IVR auth", "Menu navigation support", "SMS fallback on failed calls", "Asterisk AMI integration", "Call progress detection"],
  },
  {
    id: "contact-center",
    icon: "🏢",
    title: "Contact Center",
    href: "/solutions/use-cases/contact-center",
    desc: "Integrate SMS, Voice OTP, WhatsApp, and Telegram into your contact center platform. Unify omnichannel communications with a single API, routing engine, and analytics dashboard.",
    features: ["Omnichannel contact center", "Unified API integration", "Multi-channel routing", "Real-time analytics", "Agent productivity tools"],
  },
  {
    id: "data",
    icon: "📊",
    title: "Customer Data Management",
    href: "/solutions/use-cases/customer-data-management",
    desc: "Collect customer data via SMS surveys, feedback forms, and interactive messaging. Enrich customer profiles with real-time responses and behavioral data.",
    features: ["SMS survey collection", "Real-time data enrichment", "Customer profile updates", "Feedback form automation", "Data export and analytics"],
  },
];

export default function UseCasesPage() {
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
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-12 text-center">
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            15 SMS Use Cases
            <span className="block text-blue-600">Powered by Net2APP</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-4xl mx-auto">
            From verification and fraud prevention to marketing automation and AI agents — discover how businesses use Net2APP's
            SMS gateway platform to solve real problems.
          </p>
        </div>
      </section>

      {/* Quick Navigation */}
      <section className="pb-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <p className="text-gray-500 text-sm font-medium mb-3">Explore use cases:</p>
            <div className="flex flex-wrap gap-2">
              {useCaseSections.map((uc) => (
                <Link key={uc.id} href={uc.href} className="bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-blue-600 text-xs px-3 py-1.5 rounded-full transition">{uc.title}</Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Use Case Sections */}      {useCaseSections.map((uc, i) => (
        <Link key={uc.id} href={uc.href} className={`block py-16 ${i % 2 === 1 ? 'bg-gray-50' : ''} hover:bg-white transition group`}>
          <div className="max-w-6xl mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{uc.icon}</span>
                  <h2 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition">{uc.title}</h2>
                </div>
                <p className="text-gray-600 leading-relaxed mb-6">{uc.desc}</p>
                <span className="inline-block text-blue-600 group-hover:text-blue-700 font-medium transition text-sm">View page →</span>
              </div>
              <div className="lg:col-span-2">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
                  <h3 className="text-gray-900 font-semibold text-sm mb-3">Key Capabilities</h3>
                  <ul className="space-y-2">
                    {uc.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2 text-gray-600 text-sm">
                        <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your own SMS gateway in under 60 seconds. No setup fees. Pay only for messages sent.</p>
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
                <Link href="/solutions/teams" className="block text-sm text-gray-400 hover:text-white transition">Teams</Link>
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
