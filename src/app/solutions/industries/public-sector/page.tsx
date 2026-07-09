import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Solutions for Public Sector — Emergency Alerts & Citizen Notifications | Net2APP",
  description: "Emergency alerts, citizen notifications, public service updates, and government communications via reliable SMS and Voice infrastructure.",
  keywords: [
    "Public Sector SMS",
    "Government SMS",
    "Citizen Notification SMS",
    "Emergency Alert Government",
    "Public Service SMS",
    "Emergency Broadcast Government",
    "Government SMS Bangladesh",
    "Public Sector SMS India",
    "Government SMS UAE",
    "Municipal SMS",
    "Public Safety SMS",
    "Crisis Communication SMS",
    "Government SMS API",
  ],
  openGraph: { title: "Public Sector SMS — Emergency Alerts & Citizen Notifications | Net2APP", description: "SMS and Voice alerts for public sector: emergency broadcasts, citizen notifications, and government communications." },
};

const features = ["Emergency alert broadcasts", "Citizen notification system", "Public service reminders", "Multi-channel alerts (SMS + Voice)", "High-priority Flash SMS"];


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/industries/public-sector#webpage",
        "url": "https://net2app.com/solutions/industries/public-sector",
        "name": "SMS Solutions for Public Sector — Citizen Alerts & Emergency Notifications",
        "description": "Emergency alerts, citizen notifications, public service updates, and government communications for the public sector.",
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
              "name": "Industries",
              "item": "https://net2app.com/solutions/industries"
            },
            {
              "@type": "ListItem",
              "position": 4,
              "name": "Public Sector",
              "item": "https://net2app.com/solutions/industries/public-sector"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/industries/public-sector#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How can government agencies use SMS for citizen communications?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Send service notifications (renewal reminders, permit approvals, benefit updates), appointment confirmations for government services, emergency alerts for natural disasters or public safety incidents, and public health announcements. SMS reaches citizens instantly regardless of internet access."
            }
          },
          {
            "@type": "Question",
            "name": "How does Flash SMS help with emergency alerts?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Flash SMS messages appear directly on the phone screen without being saved to the inbox, ensuring urgent government alerts are seen immediately. Use for evacuation orders, severe weather warnings, amber alerts, and public safety notifications where immediate attention is critical."
            }
          },
          {
            "@type": "Question",
            "name": "Is citizen data secure on the Net2APP platform?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Net2APP provides PostgreSQL schema isolation (complete data separation), IP whitelisting (API access control), API key rotation, audit logging for all access and activity, and encrypted SMPP connections. Each department or agency can have its own isolated database schema for regulatory compliance."
            }
          },
          {
            "@type": "Question",
            "name": "Can different government departments share the same platform?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Net2APP's multi-tenant architecture lets you create isolated sub-clients for each department or agency. Each gets its own API keys, sender IDs, message templates, and citizen contact lists — enabling department-specific communications while using a single centralized platform with appropriate data separation."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/industries/public-sector#app",
        "name": "Net2APP Public Sector SMS Solution",
        "url": "https://net2app.com/solutions/industries/public-sector",
        "description": "Government and public sector SMS platform for citizen alerts, emergency notifications, service updates, appointment scheduling, and public health communications via SMS, Voice OTP, and WhatsApp.",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. Government-grade security included."
        },
        "featureList": [
          "Emergency alert broadcasts for natural disasters and public safety",
          "Citizen service notifications for renewals, permits, and benefits",
          "Appointment scheduling and reminder SMS for government services",
          "Public health communication via SMS, Voice, and WhatsApp",
          "Flash SMS for urgent government alerts and warnings",
          "Voice OTP for citizen identity verification and authentication",
          "PostgreSQL schema isolation for sensitive citizen data",
          "IP whitelisting and audit logging for security compliance",
          "Multi-language support for diverse citizen populations",
          "Sub-client isolation for managing multiple departments/agencies"
        ]
      }
    ]
  };

export default function PublicSectorPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200"><div className="max-w-7xl mx-auto px-6 lg:px-8"><div className="flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div><span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span></Link>
          <div className="hidden lg:flex items-center gap-1">
            <Link href="/solutions/industries" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Industries</Link>
          </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</a>
      </div></div></nav>
      <section className="max-w-6xl mx-auto px-6 lg:px-12 pt-16 pb-20">
        <div className="flex items-center gap-3 mb-4"><Link href="/solutions/industries" className="text-blue-600 hover:text-blue-700 font-medium text-sm transition">← Back to Industries</Link></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-6xl mb-4 block">🏛️</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">Public Sector</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Emergency alerts, citizen notifications, public service updates, and government communications. Public sector organizations use Net2APP's reliable SMS infrastructure for critical communications.</p>
            <a href="https://net2app.com" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Deploy Your Instance →</a>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Features</h2>
            <ul className="space-y-3">{features.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-slate-600 to-gray-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Reliable Public Communications</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy public sector SMS in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-slate-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="py-12 bg-gray-900 border-t border-gray-800"><div className="max-w-7xl mx-auto px-6 lg:px-12"><div className="flex flex-col md:flex-row items-center justify-between gap-4"><Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link><p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p><div className="flex items-center gap-4 flex-wrap justify-center"><Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link><Link href="/solutions/industries" className="text-blue-400 hover:text-white text-sm transition">Industries</Link><Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link></div></div><div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div></div></footer>
    </div>
  );
}
