import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Marketing Teams — SMS Campaigns, RCS & Audience Segmentation | Net2APP",
  description: "Run SMS marketing campaigns with powerful segmentation, personalization, and analytics. Use RCS rich messaging for branded campaigns with images and interactive buttons.",
  keywords: [
    "SMS Marketing Team",
    "Marketing SMS Platform",
    "SMS Campaign Management",
    "Audience Segmentation SMS",
    "RCS Marketing Team",
    "SMS Personalization",
    "SMS Campaign Analytics",
    "A/B Testing SMS",
    "SMS Marketing Automation",
    "Marketing SMS Bangladesh",
    "Marketing SMS India",
    "Marketing SMS UAE",
    "CRM SMS Integration",
    "SMS Marketing Dashboard",
    "Marketing SMS API",
  ],
  openGraph: { title: "Marketing — SMS Campaigns, RCS & Segmentation | Net2APP", description: "SMS marketing campaigns with RCS rich media, audience segmentation, and campaign analytics." },
};


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/teams/marketing#webpage",
        "url": "https://net2app.com/solutions/teams/marketing",
        "name": "For Marketing — SMS Campaign Management, RCS & Segmentation",
        "description": "Run SMS marketing campaigns with powerful segmentation, personalization, and analytics. Use RCS rich messaging for branded campaigns.",
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
              "name": "Marketing",
              "item": "https://net2app.com/solutions/teams/marketing"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/teams/marketing#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How do I build and manage subscriber lists?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP provides subscriber list management tools where you can add contacts manually, import from CSV files, or integrate via API. All subscribers must opt-in for TCPA and GDPR compliance. The platform tracks opt-in status, consent timestamps, and unsubscribe requests automatically."
            }
          },
          {
            "@type": "Question",
            "name": "Can I create audience segments for targeted campaigns?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Create audience segments based on demographics, purchase history, engagement level, location, and custom attributes. Send targeted campaigns that deliver personalized messages to each segment for higher conversion rates and better ROI."
            }
          },
          {
            "@type": "Question",
            "name": "How do I measure SMS campaign performance?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP provides real-time campaign analytics including delivery rates, click-through rates, conversion tracking, and ROI analysis. View performance by segment, time period, and message type. Export campaign data for integration with your CRM or marketing analytics platform."
            }
          },
          {
            "@type": "Question",
            "name": "Can I automate recurring SMS marketing campaigns?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Set up automated drip campaigns with multi-step sequences triggered by time intervals, user actions, or API events. Schedule promotional messages, abandoned cart reminders, and re-engagement campaigns to run automatically based on your defined rules."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/teams/marketing#app",
        "name": "Net2APP SMS Marketing Platform",
        "url": "https://net2app.com/solutions/teams/marketing",
        "description": "SMS marketing platform with subscriber list management, audience segmentation, automated campaign triggers, and performance analytics. Build targeted SMS campaigns with delivery tracking.",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. Full SMS marketing tools included."
        },
        "featureList": [
          "Subscriber list management with CSV import and API integration",
          "Audience segmentation based on demographics and engagement",
          "Automated campaign triggers and scheduled SMS broadcasts",
          "Personalized message templates with merge fields",
          "Real-time campaign analytics with delivery and click tracking",
          "Opt-in compliance tracking for TCPA and GDPR",
          "A/B testing for message content and send times",
          "Drip campaign automation with multi-step sequences",
          "Sub-client campaign management with separate lists",
          "Bulk SMS throughput with intelligent routing optimization"
        ]
      }
    ]
  };

export default function MarketingPage() {
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
            <span className="text-6xl mb-4 block">📣</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">For Marketing Teams</h1>
            <p className="text-gray-500 text-sm font-medium mb-2">Campaign Management, RCS & Audience Segmentation</p>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Run SMS marketing campaigns with powerful segmentation, personalization, and analytics. Use RCS rich messaging for branded campaigns with images and interactive buttons. Flash SMS for urgent promotions.</p>
            <Link href="/http-sms-api" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">RCS & HTTP SMS API →</Link>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Features</h2>
            <ul className="space-y-3">{["Bulk SMS campaign management", "RCS rich media messaging (images, carousels, buttons)", "Audience segmentation and list management", "Personalized message templates", "Campaign performance analytics", "A/B testing and optimization"].map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>
            ))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-pink-600 to-rose-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Launch Campaigns Faster</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your SMS marketing platform in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-pink-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="py-12 bg-gray-900 border-t border-gray-800"><div className="max-w-7xl mx-auto px-6 lg:px-12"><div className="flex flex-col md:flex-row items-center justify-between gap-4"><Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link><p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p><div className="flex items-center gap-4 flex-wrap justify-center"><Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link><Link href="/solutions/teams" className="text-blue-400 hover:text-white text-sm transition">Teams</Link><Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link></div></div><div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div></div></footer>
    </div>
  );
}
