import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Solutions for Ecommerce — Orders, Shipping & Cart Recovery | Net2APP",
  description: "Order confirmations, shipping updates, cart abandonment recovery, and personalized product recommendations for ecommerce businesses.",
  keywords: [
    "Ecommerce SMS",
    "Order Confirmation SMS",
    "Shipping Update SMS",
    "Cart Abandonment SMS",
    "Cart Recovery SMS",
    "Product Recommendation SMS",
    "Ecommerce SMS Marketing",
    "RCS Ecommerce",
    "Ecommerce SMS Bangladesh",
    "Ecommerce SMS India",
    "Ecommerce SMS UAE",
    "Online Store SMS",
    "D2C SMS",
    "Ecommerce SMS API",
    "Shopify SMS",
  ],
  openGraph: { title: "Ecommerce SMS — Orders, Shipping & Cart Recovery | Net2APP", description: "SMS solutions for ecommerce: order updates, shipping tracking, and cart abandonment recovery." },
};

const features = ["Order confirmation SMS", "Shipping and delivery updates", "Cart abandonment recovery", "Personalized recommendations", "Flash SMS for flash deals"];


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/industries/ecommerce#webpage",
        "url": "https://net2app.com/solutions/industries/ecommerce",
        "name": "SMS Solutions for Ecommerce — Order Updates & Cart Recovery",
        "description": "Order confirmations, shipping updates, cart abandonment recovery, and personalized product recommendations for ecommerce businesses.",
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
              "name": "Ecommerce",
              "item": "https://net2app.com/solutions/industries/ecommerce"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/industries/ecommerce#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How do abandoned cart SMS campaigns work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Trigger an automated SMS reminder when a customer leaves items in their cart without completing checkout. Include a direct link back to their cart and a time-sensitive offer. SMS open rates exceed 90%, making abandoned cart recovery via SMS significantly more effective than email alone."
            }
          },
          {
            "@type": "Question",
            "name": "Can I send order confirmations and shipping updates via SMS?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Integrate Net2APP's API with your e-commerce platform to automatically send SMS order confirmations, shipping notifications with tracking links, and delivery confirmations. Customers appreciate real-time updates, and SMS ensures they see critical order information immediately."
            }
          },
          {
            "@type": "Question",
            "name": "How does WhatsApp enhance e-commerce communications?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "WhatsApp Business API enables rich messaging with product images, catalogs, quick reply buttons, and interactive elements. Use WhatsApp for order confirmations with product images, shipping updates with tracking maps, and promotional messages with direct purchase CTAs — all from the same Net2APP API."
            }
          },
          {
            "@type": "Question",
            "name": "Can I manage SMS for multiple online stores?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Net2APP's sub-client architecture lets you create isolated environments for each store or brand. Each sub-client gets its own API keys, sender IDs, message templates, and routing plans — ensuring store-specific branding and data separation while using a single platform."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/industries/ecommerce#app",
        "name": "Net2APP E-Commerce SMS Solution",
        "url": "https://net2app.com/solutions/industries/ecommerce",
        "description": "E-commerce SMS platform for order confirmations, shipping updates, abandoned cart recovery, promotional campaigns, and customer re-engagement via SMS, WhatsApp, and Telegram.",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. Complete e-commerce SMS toolkit included."
        },
        "featureList": [
          "Order confirmation and shipping update SMS automation",
          "Abandoned cart recovery campaigns via SMS and WhatsApp",
          "Flash SMS for time-sensitive flash sale alerts",
          "Personalized product recommendations via SMS",
          "Customer re-engagement campaigns with segmentation",
          "WhatsApp Business API for rich product catalogs and CTAs",
          "DLR tracking to ensure transactional messages are delivered",
          "Bulk SMS for seasonal promotions and holiday campaigns",
          "Multi-language support for international e-commerce",
          "Sub-client isolation for multi-store management"
        ]
      }
    ]
  };

export default function EcommercePage() {
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
            <span className="text-6xl mb-4 block">🛒</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">Ecommerce</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Order confirmations, shipping updates, cart abandonment recovery, and personalized product recommendations. Ecommerce businesses drive sales and improve customer experience with automated SMS workflows.</p>
            <a href="https://net2app.com" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Deploy Your Instance →</a>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Features</h2>
            <ul className="space-y-3">{features.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Boost Online Sales</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy ecommerce SMS in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="py-12 bg-gray-900 border-t border-gray-800"><div className="max-w-7xl mx-auto px-6 lg:px-12"><div className="flex flex-col md:flex-row items-center justify-between gap-4"><Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link><p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p><div className="flex items-center gap-4 flex-wrap justify-center"><Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link><Link href="/solutions/industries" className="text-blue-400 hover:text-white text-sm transition">Industries</Link><Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link></div></div><div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div></div></footer>
    </div>
  );
}
