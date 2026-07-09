import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Customer Experience — Omnichannel SMS & WhatsApp Engagement | Net2APP",
  description: "Deliver seamless customer experiences across SMS, Voice OTP, WhatsApp, and Telegram. Automate engagement journeys, send personalized messages, and collect feedback.",
  keywords: [
    "Customer Experience SMS",
    "CX SMS Platform",
    "Omnichannel CX SMS",
    "Customer Engagement SMS",
    "Personalized Customer SMS",
    "SMS Customer Journey",
    "Automated Customer SMS",
    "SMS NPS",
    "Customer Feedback SMS",
    "CX SMS Bangladesh",
    "CX SMS India",
    "Customer Experience UAE",
    "SMS CX Platform",
    "Customer Loyalty SMS",
    "CX Messaging Platform",
  ],
  openGraph: { title: "Customer Experience — Omnichannel SMS Engagement | Net2APP", description: "Seamless customer experiences across SMS, Voice OTP, WhatsApp, and Telegram." },
};


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/teams/customer-experience#webpage",
        "url": "https://net2app.com/solutions/teams/customer-experience",
        "name": "For Customer Experience — Omnichannel Engagement & Personalization",
        "description": "Deliver seamless customer experiences across SMS, Voice OTP, WhatsApp, and Telegram with automated engagement journeys.",
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
              "name": "Teams",
              "item": "https://net2app.com/solutions/teams"
            },
            {
              "@type": "ListItem",
              "position": 4,
              "name": "Customer Experience",
              "item": "https://net2app.com/solutions/teams/customer-experience"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/teams/customer-experience#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How does omnichannel messaging improve customer experience?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP lets you reach customers on their preferred channel — SMS, WhatsApp, Telegram, or Voice OTP — from a single API. Maintain conversation context across channels so customers don't repeat themselves when switching between SMS and WhatsApp. This unified approach improves response times and customer satisfaction."
            }
          },
          {
            "@type": "Question",
            "name": "Can I automate appointment reminders for customers?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Set up automated reminder sequences that send SMS or WhatsApp messages at configurable intervals (e.g., 72h, 24h, and 2h before appointments). Include rescheduling links and contact information. Businesses typically see a 30-50% reduction in no-show rates with automated reminders."
            }
          },
          {
            "@type": "Question",
            "name": "How do two-way SMS surveys work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Send a survey SMS with a question and collect customer responses directly via SMS reply. Net2APP captures responses via webhook callbacks and routes them to your CRM or analytics platform. Use satisfaction scores (1-5), NPS surveys, or open-ended feedback collection."
            }
          },
          {
            "@type": "Question",
            "name": "Can I manage customer communications for multiple brands?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Net2APP's multi-tenant architecture lets you manage separate customer bases for each brand or business unit. Each sub-client gets its own API keys, message templates, sender IDs, and routing — ensuring brand-specific messaging while using a single platform."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/teams/customer-experience#app",
        "name": "Net2APP Customer Messaging Platform",
        "url": "https://net2app.com/solutions/teams/customer-experience",
        "description": "Customer experience messaging platform for support communications, satisfaction surveys, appointment reminders, and personalized customer engagement via SMS, WhatsApp, and Telegram.",
        "applicationCategory": "CommunicationApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. Omnichannel customer messaging included."
        },
        "featureList": [
          "Omnichannel messaging: SMS, WhatsApp, Telegram, and Voice",
          "Automated appointment reminders with configurable schedules",
          "Customer satisfaction surveys via two-way SMS",
          "Support ticket notifications and status updates",
          "Personalized messaging with customer name and context merge",
          "Conversation history tracking across all messaging channels",
          "Automated response handling with webhook integrations",
          "Multi-language support for global customer bases",
          "Delivery tracking to ensure critical messages reach customers",
          "Sub-client isolation for managing multiple brand experiences"
        ]
      }
    ]
  };

export default function CustomerExperiencePage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200"><div className="max-w-7xl mx-auto px-6 lg:px-8"><div className="flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div><span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span></Link>
          <div className="hidden lg:flex items-center gap-1">
            <Link href="/solutions/teams" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Teams</Link>
          </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</a>
      </div></div></nav>
      <section className="max-w-6xl mx-auto px-6 lg:px-12 pt-16 pb-20">
        <div className="flex items-center gap-3 mb-4"><Link href="/solutions/teams" className="text-blue-600 hover:text-blue-700 font-medium text-sm transition">← Back to Teams</Link></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-6xl mb-4 block">❤️</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">For Customer Experience</h1>
            <p className="text-gray-500 text-sm font-medium mb-2">Omnichannel Engagement, Automation & Personalization</p>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Deliver seamless customer experiences across SMS, Voice OTP, WhatsApp, and Telegram. Automate engagement journeys, send personalized messages, and collect feedback — all from a single platform.</p>
            <a href="https://net2app.com" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Deploy Your Instance →</a>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Features</h2>
            <ul className="space-y-3">{["Omnichannel customer engagement", "Automated communication journeys", "Personalized message delivery", "Real-time feedback collection", "Customer satisfaction surveys", "Multi-language support"].map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>
            ))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-red-600 to-pink-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Delight Your Customers</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy omnichannel CX in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="py-12 bg-gray-900 border-t border-gray-800"><div className="max-w-7xl mx-auto px-6 lg:px-12"><div className="flex flex-col md:flex-row items-center justify-between gap-4"><Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link><p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p><div className="flex items-center gap-4 flex-wrap justify-center"><Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link><Link href="/solutions/teams" className="text-blue-400 hover:text-white text-sm transition">Teams</Link><Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link></div></div><div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div></div></footer>
    </div>
  );
}
