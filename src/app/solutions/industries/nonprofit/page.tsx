import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Solutions for Nonprofits — Donation Campaigns & Volunteer Alerts | Net2APP",
  description: "Donation campaign SMS, volunteer coordination, event notifications, and impact updates for nonprofit organizations reaching supporters directly on mobile.",
  keywords: [
    "Nonprofit SMS",
    "Charity SMS",
    "Donation Campaign SMS",
    "Volunteer Coordination SMS",
    "Fundraising SMS",
    "NGO SMS",
    "Event Notification SMS",
    "Impact Update SMS",
    "Nonprofit SMS Bangladesh",
    "Charity SMS India",
    "NGO SMS UAE",
    "Crowdfunding SMS",
    "Nonprofit Messaging",
    "Donor Engagement SMS",
  ],
  openGraph: { title: "Nonprofit SMS — Donation Campaigns & Volunteer Alerts | Net2APP", description: "SMS solutions for nonprofits: donation campaigns, volunteer coordination, and event notifications." },
};

const features = ["Donation campaign messaging", "Volunteer coordination SMS", "Event reminders and updates", "Impact story sharing", "Supporter engagement analytics"];


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/industries/nonprofit#webpage",
        "url": "https://net2app.com/solutions/industries/nonprofit",
        "name": "SMS Solutions for Nonprofits — Donation Campaigns & Volunteer Coordination",
        "description": "Donation campaign SMS, volunteer coordination, event notifications, and impact updates for nonprofit organizations.",
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
              "name": "Nonprofit",
              "item": "https://net2app.com/solutions/industries/nonprofit"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/industries/nonprofit#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How can nonprofits use SMS for fundraising?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Send SMS fundraising campaigns with direct donation links, matching gift reminders, and year-end giving appeals. SMS open rates exceed 90%, making it the most effective channel for time-sensitive fundraising. Include personalized donor information and track campaign performance with delivery analytics."
            }
          },
          {
            "@type": "Question",
            "name": "Can I send impact updates to donors via SMS?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Send thank-you messages and impact updates to donors showing how their contributions made a difference. Include photos and stories via WhatsApp for richer storytelling. Regular donor communications improve retention rates and encourage recurring giving."
            }
          },
          {
            "@type": "Question",
            "name": "How does SMS help with volunteer coordination?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Send event reminders, shift confirmations, and last-minute updates to volunteers via two-way SMS. Volunteers can confirm availability, ask questions, or report issues by replying directly. Use group messaging for quick coordination during events and crisis response situations."
            }
          },
          {
            "@type": "Question",
            "name": "Is Net2APP affordable for nonprofit organizations?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Net2APP's pay-as-you-go pricing with zero setup fees and zero monthly minimums makes it accessible for nonprofits of all sizes. Start with the free Starter plan and only pay for the SMS you send. Scale up as your donor base and campaign needs grow."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/industries/nonprofit#app",
        "name": "Net2APP Nonprofit SMS Solution",
        "url": "https://net2app.com/solutions/industries/nonprofit",
        "description": "Nonprofit SMS platform for donor communications, fundraising campaigns, event invitations, volunteer coordination, and impact updates via SMS, WhatsApp, and Voice OTP.",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. Affordable nonprofit messaging included."
        },
        "featureList": [
          "Fundraising campaign SMS with donation links and CTAs",
          "Donor thank-you messages and impact update broadcasts",
          "Event invitation and reminder SMS automation",
          "Volunteer coordination via two-way SMS and WhatsApp",
          "Emergency relief broadcast SMS for crisis response",
          "WhatsApp messaging for rich campaign storytelling",
          "Voice OTP for donor identity verification",
          "Bulk SMS for newsletter distribution and annual reports",
          "Opt-in compliance tracking for nonprofit regulations",
          "Sub-client isolation for managing multiple campaigns"
        ]
      }
    ]
  };

export default function NonprofitPage() {
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
            <span className="text-6xl mb-4 block">🤝</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">Nonprofit</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Donation campaign SMS, volunteer coordination, event notifications, and impact updates. Nonprofits reach supporters directly on their mobile phones with cost-effective bulk SMS.</p>
            <a href="https://net2app.com" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Deploy Your Instance →</a>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Features</h2>
            <ul className="space-y-3">{features.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-green-600 to-emerald-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Amplify Your Mission</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy nonprofit SMS in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-green-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="py-12 bg-gray-900 border-t border-gray-800"><div className="max-w-7xl mx-auto px-6 lg:px-12"><div className="flex flex-col md:flex-row items-center justify-between gap-4"><Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link><p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p><div className="flex items-center gap-4 flex-wrap justify-center"><Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link><Link href="/solutions/industries" className="text-blue-400 hover:text-white text-sm transition">Industries</Link><Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link></div></div><div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div></div></footer>
    </div>
  );
}
