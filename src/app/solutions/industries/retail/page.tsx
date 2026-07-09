import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Solutions for Retail — Promotions, RCS & Order Updates | Net2APP",
  description: "Promotional SMS campaigns, order updates, loyalty program communications, and personalized shopping experiences with RCS rich messaging for retail.",
  keywords: [
    "Retail SMS",
    "Retail SMS Marketing",
    "SMS Promotions Retail",
    "Order Update SMS",
    "Loyalty Program SMS",
    "RCS Retail",
    "Personalized Retail SMS",
    "SMS Shopping",
    "Retail SMS Bangladesh",
    "Retail SMS India",
    "Retail SMS UAE",
    "Store SMS",
    "Retail Messaging Platform",
    "POS SMS Integration",
    "Retail SMS API",
  ],
  openGraph: { title: "Retail SMS — Promotions, RCS & Order Updates | Net2APP", description: "SMS marketing, RCS rich media, and order updates for retail businesses." },
};

const features = ["Promotional SMS campaigns", "RCS rich media messaging", "Order status updates", "Loyalty program SMS", "Flash SMS for flash sales"];


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/industries/retail#webpage",
        "url": "https://net2app.com/solutions/industries/retail",
        "name": "SMS Solutions for Retail — Promotional Campaigns & Order Updates",
        "description": "Promotional SMS campaigns, order updates, loyalty program communications, and personalized shopping experiences for retail businesses.",
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
              "name": "Retail",
              "item": "https://net2app.com/solutions/industries/retail"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/industries/retail#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How can retail stores use SMS for promotions?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Send bulk SMS broadcasts for in-store promotions, flash sales, new arrivals, and seasonal campaigns. Segment customers by location, purchase history, and engagement level. SMS open rates exceed 90%, making it the most effective channel for time-sensitive retail promotions."
            }
          },
          {
            "@type": "Question",
            "name": "Can I integrate SMS with my loyalty program?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Send personalized loyalty offers, points balance updates, and reward notifications via SMS. Use merge fields to include customer names, points balances, and personalized offer codes. Integrate with your loyalty platform via Net2APP's REST API and webhook callbacks."
            }
          },
          {
            "@type": "Question",
            "name": "How does location-based SMS targeting work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Segment your subscriber list by store location, city, or region. Send store-specific promotions to customers near each location. Use geo-triggered campaigns to send offers when customers are near a store (requires integration with your mobile app's location services)."
            }
          },
          {
            "@type": "Question",
            "name": "Can I manage SMS communications across multiple store locations?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Net2APP's sub-client architecture lets you create isolated profiles for each store location. Each store gets its own API keys, sender IDs (with store-specific names), message templates, and customer lists — enabling location-specific campaigns while using a single platform."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/industries/retail#app",
        "name": "Net2APP Retail SMS Solution",
        "url": "https://net2app.com/solutions/industries/retail",
        "description": "Retail SMS platform for in-store promotions, loyalty program messaging, inventory alerts, staff communications, and customer engagement via SMS, WhatsApp, and Voice OTP.",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. Full retail SMS toolkit included."
        },
        "featureList": [
          "In-store promotion and flash sale SMS broadcasts",
          "Loyalty program messaging with personalized offers",
          "Inventory alert notifications for staff and customers",
          "WhatsApp Business API for rich product showcasing",
          "Voice OTP for customer identity verification at pickup",
          "Location-based SMS targeting with geo-segmentation",
          "Two-way SMS for customer service and inquiries",
          "Bulk SMS for seasonal campaigns and holiday promotions",
          "DLR tracking to measure campaign effectiveness",
          "Multi-store management with sub-client isolation"
        ]
      }
    ]
  };

export default function RetailPage() {
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
            <span className="text-6xl mb-4 block">🛍️</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">Retail</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Promotional SMS campaigns, order updates, loyalty program communications, and personalized shopping experiences. RCS rich messaging enables retailers to send branded messages with product images and interactive buttons.</p>
            <a href="https://net2app.com" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Deploy Your Instance →</a>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Features</h2>
            <ul className="space-y-3">{features.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-pink-600 to-rose-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Engage Your Customers</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy retail SMS in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-pink-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="py-12 bg-gray-900 border-t border-gray-800"><div className="max-w-7xl mx-auto px-6 lg:px-12"><div className="flex flex-col md:flex-row items-center justify-between gap-4"><Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link><p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p><div className="flex items-center gap-4 flex-wrap justify-center"><Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link><Link href="/solutions/industries" className="text-blue-400 hover:text-white text-sm transition">Industries</Link><Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link></div></div><div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div></div></footer>
    </div>
  );
}
