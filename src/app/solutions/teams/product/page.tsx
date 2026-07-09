import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Product Teams — Voice OTP, In-App Messaging & API-First Design | Net2APP",
  description: "Add communication features to your product with a single API integration. SMS, Voice OTP, WhatsApp, and Telegram — all through one platform with multi-tenant architecture.",
  keywords: [
    "Product SMS Integration",
    "SMS Product Features",
    "Voice OTP Product",
    "SMS API Product",
    "WhatsApp API Product",
    "White-Label SMS",
    "SMS Product Roadmap",
    "CPaaS Product",
    "Messaging Product Platform",
    "Product SMS Bangladesh",
    "SMS Product India",
    "Product SMS UAE",
    "SMS Feature Integration",
    "Product API",
    "SMS Product Development",
  ],
  openGraph: { title: "Product Teams — SMS, Voice OTP & WhatsApp API | Net2APP", description: "Add SMS, Voice OTP, WhatsApp, and Telegram to your product with one API integration." },
};


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/teams/product#webpage",
        "url": "https://net2app.com/solutions/teams/product",
        "name": "For Product Teams — Voice OTP, In-App Messaging & API-First Design",
        "description": "Add communication features to your product with a single API integration. SMS, Voice OTP, WhatsApp, and Telegram — all through one platform.",
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
              "name": "Product",
              "item": "https://net2app.com/solutions/teams/product"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/teams/product#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How can I integrate SMS notifications into my product?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Use Net2APP's RESTful HTTP API to trigger SMS notifications from your product backend. Common use cases include user onboarding messages, account verification, feature announcements, password resets, and transactional alerts. The API supports bulk sending for large user bases with automatic rate control."
            }
          },
          {
            "@type": "Question",
            "name": "Can I manage different environments (dev, staging, production)?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Generate separate API keys for development, staging, and production environments. Each key has independent rate limits, IP whitelists, and routing configurations. This lets you test SMS integration safely without affecting production traffic."
            }
          },
          {
            "@type": "Question",
            "name": "How does Voice OTP improve product authentication?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Voice OTP provides a fallback when SMS delivery fails or when users prefer voice calls. Net2APP's Asterisk AMI integration with 3-retry logic and 220+ country MCC language detection ensures your users always receive verification codes — improving onboarding completion rates and reducing support tickets."
            }
          },
          {
            "@type": "Question",
            "name": "Can I send rich notifications via WhatsApp and Telegram?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Net2APP supports WhatsApp Business API and Telegram MTProto for rich messaging. Send product updates with images, buttons, and interactive elements that go beyond plain SMS. Use the same API key and infrastructure for all channels."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/teams/product#app",
        "name": "Net2APP Product Communication Suite",
        "url": "https://net2app.com/solutions/teams/product",
        "description": "Product communication platform for in-app SMS notifications, transactional messaging, user onboarding, and feature announcements. Integrate SMS into your product experience.",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. All product messaging tools included."
        },
        "featureList": [
          "Transactional SMS for user onboarding and account verification",
          "In-app notification triggers via REST API and webhooks",
          "Feature announcement and product update SMS broadcasts",
          "Voice OTP for secure product authentication flows",
          "DLR tracking to ensure critical notifications are delivered",
          "Multi-language SMS support with template management",
          "API key management with per-environment keys (dev/staging/prod)",
          "Rate limiting and TPS control for controlled rollout",
          "WhatsApp and Telegram messaging for rich product notifications",
          "Sub-client isolation for multi-product portfolio management"
        ]
      }
    ]
  };

export default function ProductPage() {
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
            <span className="text-6xl mb-4 block">🎯</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">For Product Teams</h1>
            <p className="text-gray-500 text-sm font-medium mb-2">Voice OTP, In-App Messaging & API-First Design</p>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Add communication features to your product with a single API integration. SMS, Voice OTP, WhatsApp, and Telegram — all through one platform. Net2APP's multi-tenant architecture means each customer gets isolated data.</p>
            <Link href="/voice-otp" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Voice OTP for Product →</Link>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Features</h2>
            <ul className="space-y-3">{["Single API for SMS, Voice, WhatsApp, Telegram", "Multi-tenant architecture with data isolation", "Voice OTP for user verification flows", "White-label branding support", "Scalable from prototype to enterprise"].map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>
            ))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Ship Communication Features</h2>
          <p className="text-blue-100 text-lg mb-8">Integrate SMS in your product in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="py-12 bg-gray-900 border-t border-gray-800"><div className="max-w-7xl mx-auto px-6 lg:px-12"><div className="flex flex-col md:flex-row items-center justify-between gap-4"><Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link><p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p><div className="flex items-center gap-4 flex-wrap justify-center"><Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link><Link href="/solutions/teams" className="text-blue-400 hover:text-white text-sm transition">Teams</Link><Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link></div></div><div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div></div></footer>
    </div>
  );
}
