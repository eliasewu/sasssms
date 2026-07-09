import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Solutions for Hospitality — Bookings, Check-In & Guest Feedback | Net2APP",
  description: "Booking confirmations, check-in reminders, guest feedback surveys, and concierge SMS services for hotels and travel businesses.",
  keywords: [
    "Hospitality SMS",
    "Hotel SMS",
    "Booking Confirmation SMS",
    "Check-In Reminder SMS",
    "Guest Feedback SMS",
    "Concierge SMS",
    "Hospitality Messaging",
    "Hotel Guest SMS",
    "Hospitality SMS Bangladesh",
    "Hotel SMS India",
    "Hospitality SMS UAE",
    "Travel SMS",
    "Tourism SMS",
    "Guest Engagement SMS",
    "Hotel SMS API",
  ],
  openGraph: { title: "Hospitality SMS — Bookings & Guest Engagement | Net2APP", description: "SMS solutions for hospitality: booking confirmations, check-in reminders, and guest feedback." },
};

const features = ["Booking confirmation SMS", "Check-in/check-out reminders", "Guest feedback surveys", "Concierge messaging service", "Multi-language guest comms"];


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/industries/hospitality#webpage",
        "url": "https://net2app.com/solutions/industries/hospitality",
        "name": "SMS Solutions for Hospitality — Booking Confirmations & Guest Engagement",
        "description": "Booking confirmations, check-in reminders, guest feedback surveys, and concierge SMS services for hospitality businesses.",
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
              "name": "Hospitality",
              "item": "https://net2app.com/solutions/industries/hospitality"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/industries/hospitality#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How can hotels use SMS for guest communications?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Send automated booking confirmations, pre-arrival welcome messages with check-in instructions, room-ready notifications, and post-stay feedback requests. Offer concierge services via two-way SMS so guests can request amenities, book dining, or ask questions without calling the front desk."
            }
          },
          {
            "@type": "Question",
            "name": "Can I send personalized promotional offers to guests?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Send targeted offers for room upgrades, spa services, dining reservations, and local experiences based on guest profiles and stay history. Use WhatsApp for rich promotional messages with images, menus, and direct booking buttons."
            }
          },
          {
            "@type": "Question",
            "name": "How does WhatsApp enhance the guest experience?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "WhatsApp Business API enables rich messaging with images, quick reply buttons, and interactive elements. Send welcome messages with property photos, dining menus with reservation buttons, and local attraction guides. Guests can reply and interact without downloading a separate app."
            }
          },
          {
            "@type": "Question",
            "name": "Can I manage guest communications across multiple properties?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Net2APP's sub-client architecture lets you create isolated environments for each hotel, resort, or property in your portfolio. Each property gets its own API keys, sender IDs, message templates, and guest lists — enabling property-specific branding while using a single platform."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/industries/hospitality#app",
        "name": "Net2APP Hospitality SMS Solution",
        "url": "https://net2app.com/solutions/industries/hospitality",
        "description": "Hospitality SMS platform for booking confirmations, check-in reminders, guest services, promotional offers, and concierge communications for hotels, resorts, and travel businesses.",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. Complete hospitality messaging toolkit included."
        },
        "featureList": [
          "Booking confirmation and check-in reminder SMS automation",
          "Pre-arrival welcome messages with property information",
          "Concierge service requests via two-way SMS and WhatsApp",
          "Promotional offers for upgrades, dining, and spa services",
          "Post-stay feedback and review request SMS",
          "WhatsApp Business API for rich guest communications",
          "Voice OTP for guest identity verification at check-in",
          "Emergency and safety alert SMS for guests on property",
          "Multi-language support for international guests",
          "Sub-client isolation for multi-property hospitality groups"
        ]
      }
    ]
  };

export default function HospitalityPage() {
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
            <span className="text-6xl mb-4 block">🏨</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">Hospitality</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Booking confirmations, check-in reminders, guest feedback surveys, and concierge SMS services. Hotels and travel businesses enhance guest experience with timely, personalized SMS communication.</p>
            <a href="https://net2app.com" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Deploy Your Instance →</a>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Features</h2>
            <ul className="space-y-3">{features.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-teal-600 to-cyan-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Elevate Guest Experience</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy hospitality SMS in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-teal-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="py-12 bg-gray-900 border-t border-gray-800"><div className="max-w-7xl mx-auto px-6 lg:px-12"><div className="flex flex-col md:flex-row items-center justify-between gap-4"><Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link><p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p><div className="flex items-center gap-4 flex-wrap justify-center"><Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link><Link href="/solutions/industries" className="text-blue-400 hover:text-white text-sm transition">Industries</Link><Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link></div></div><div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div></div></footer>
    </div>
  );
}
