import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Center — Omnichannel SMS, Voice OTP, WhatsApp & Telegram | Net2APP",
  description: "Integrate SMS, Voice OTP, WhatsApp, and Telegram into your contact center platform. Unify omnichannel communications with a single API, routing engine, and analytics dashboard.",
  keywords: [
    "Contact Center SMS",
    "Omnichannel Contact Center",
    "SMS Contact Center",
    "Contact Center Integration",
    "Multi-Channel Contact Center",
    "SMS Customer Service",
    "WhatsApp Contact Center",
    "Telegram Support",
    "Unified Communications Platform",
    "Agent Productivity SMS",
    "Contact Center Bangladesh",
    "Contact Center India",
    "Contact Center UAE",
    "SMS Support Platform",
    "Contact Center API",
  ],
  openGraph: { title: "Contact Center — Omnichannel SMS Platform | Net2APP", description: "Unify SMS, Voice OTP, WhatsApp, and Telegram in your contact center with one API." },
};


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/use-cases/contact-center#webpage",
        "url": "https://net2app.com/solutions/use-cases/contact-center",
        "name": "Contact Center — Omnichannel SMS, Voice OTP & OTT Integration",
        "description": "Integrate SMS, Voice OTP, WhatsApp, and Telegram into your contact center. Unify omnichannel communications with a single API.",
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
              "name": "Contact Center",
              "item": "https://net2app.com/solutions/use-cases/contact-center"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/use-cases/contact-center#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How does omnichannel contact center integration work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP provides a unified API for SMS, Voice OTP, WhatsApp, and Telegram. Your contact center platform connects to a single API endpoint and routes messages across all channels, with conversation history maintained per customer across channels."
            }
          },
          {
            "@type": "Question",
            "name": "Can agents handle multiple channels from one interface?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. The Net2APP dashboard provides a unified inbox that consolidates messages from SMS, WhatsApp, and Telegram. Agents can view full conversation history and respond through any channel from a single interface."
            }
          },
          {
            "@type": "Question",
            "name": "Does the system support agent routing and assignment?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Incoming messages can be routed to specific agents or teams based on rules (channel, customer segment, time of day). Agent assignment supports round-robin, skills-based, and manual routing."
            }
          }
        ]
      }
    ]
  };

export default function ContactCenterPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200"><div className="max-w-7xl mx-auto px-6 lg:px-8"><div className="flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div><span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span></Link>
          <div className="hidden lg:flex items-center gap-1">
            <Link href="/solutions/use-cases" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Use Cases</Link>
          </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</a>
      </div></div></nav>
      <section className="max-w-6xl mx-auto px-6 lg:px-12 pt-16 pb-20">
        <div className="flex items-center gap-3 mb-4"><Link href="/solutions/use-cases" className="text-blue-600 hover:text-blue-700 font-medium text-sm transition">← Back to Use Cases</Link></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-6xl mb-4 block">🏢</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">Contact Center</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Integrate SMS, Voice OTP, WhatsApp, and Telegram into your contact center platform. Unify omnichannel communications with a single API, routing engine, and analytics dashboard.</p>
            <a href="https://net2app.com" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Deploy Your Instance →</a>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Capabilities</h2>
            <ul className="space-y-3">{["Omnichannel contact center", "Unified API integration", "Multi-channel routing", "Real-time analytics", "Agent productivity tools"].map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>
            ))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Unify Your Contact Center</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy omnichannel contact center in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      <footer className="py-12 bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link>
            <p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link>
              <Link href="/solutions/use-cases" className="text-blue-400 hover:text-white text-sm transition">Use Cases</Link>
              <Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div>
        </div>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </footer>
    </div>
  );
}
