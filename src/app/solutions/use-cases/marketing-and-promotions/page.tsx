import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketing & Promotions — SMS, RCS & Flash SMS Campaigns | Net2APP",
  description: "Run SMS marketing campaigns with personalized messaging at scale. Use RCS for branded messages with images, carousels, and interactive buttons. Flash SMS for time-sensitive offers.",
  keywords: [
    "SMS Marketing",
    "SMS Campaign",
    "Bulk SMS Marketing",
    "Promotional SMS",
    "RCS Marketing",
    "Rich Media SMS",
    "SMS Advertising",
    "Personalized SMS Marketing",
    "SMS Promotion Campaign",
    "Flash SMS Promotion",
    "SMS Campaign Management",
    "SMS A/B Testing",
    "SMS Marketing Bangladesh",
    "SMS Marketing India",
    "SMS Marketing UAE",
    "RCS Campaign",
    "SMS Brand Marketing",
  ],
  openGraph: { title: "Marketing & Promotions — SMS & RCS Campaigns | Net2APP", description: "SMS marketing, RCS rich media, and Flash SMS campaigns with audience segmentation and analytics." },
};


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/use-cases/marketing-and-promotions#webpage",
        "url": "https://net2app.com/solutions/use-cases/marketing-and-promotions",
        "name": "Marketing & Promotions — Bulk SMS Marketing, RCS & Personalized Campaigns",
        "description": "Run SMS marketing campaigns with personalized messaging at scale. Use RCS for branded messages with images, carousels, and interactive buttons.",
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
              "name": "Marketing & Promotions",
              "item": "https://net2app.com/solutions/use-cases/marketing-and-promotions"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/use-cases/marketing-and-promotions#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is RCS marketing and how is it different from SMS?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "RCS (Rich Communication Services) enables branded marketing messages with images, carousels, quick-reply buttons, and suggested actions — providing an app-like experience. Standard SMS is plain text only. RCS typically achieves 5-10x higher engagement rates than traditional SMS."
            }
          },
          {
            "@type": "Question",
            "name": "Can I segment audiences for targeted campaigns?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Net2APP supports audience segmentation based on demographics, behavior, purchase history, and engagement levels. Create targeted segments and send personalized campaigns that match each audience's interests."
            }
          },
          {
            "@type": "Question",
            "name": "How do I measure campaign performance?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP provides real-time campaign analytics including delivery rates, click-through rates (for RCS), conversion tracking, and ROI analysis. Export campaign reports via the dashboard or API."
            }
          }
        ]
      }
    ]
  };

export default function MarketingPromotionsPage() {
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
            <span className="text-6xl mb-4 block">📣</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">Marketing & Promotions</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Run SMS marketing campaigns with personalized messaging at scale. Use RCS (Rich Communication Services) for branded messages with images, carousels, and interactive buttons.</p>
            <Link href="/http-sms-api" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Learn About RCS Messaging →</Link>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Capabilities</h2>
            <ul className="space-y-3">{["Personalized bulk SMS campaigns", "RCS rich media messaging", "Flash SMS for time-sensitive offers", "Audience segmentation", "Campaign A/B testing"].map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>
            ))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-pink-600 to-rose-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Launch Your Campaign</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your SMS marketing platform in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-pink-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
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
