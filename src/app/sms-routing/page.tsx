import type { Metadata } from "next";
import Link from "next/link";
import { pickFaqs, faqSchema, type FaqItem } from "@/lib/tenant-faq";

// Page FAQ — tenant-guide questions relevant to this page plus the strongest
// page-specific questions.
const PAGE_FAQS: FaqItem[] = [
  ...pickFaqs(4, 5, 6, 7, 9, 13),
  { q: "How do I set up a new Route Plan?", a: "From the Net2APP dashboard, go to Route Plans → Add New Plan. Give your plan a name, then add Routes with priority ordering. For each Route, configure Trunks with supplier connections. Finally, assign the Route Plan to a client. The entire setup takes minutes and changes take effect immediately." },
  { q: "How long does failover take?", a: "Failover is nearly instant. The system monitors supplier connections via SMPP bind status and HTTP response times. When a supplier fails to respond within the configured timeout (typically 2-5 seconds), the next Trunk is tried immediately. Failover at the Route level is similarly fast." },
];



export const metadata: Metadata = {
  title: "SMS Routing — Multi-Layer Intelligent SMS Routing Engine",
  description:
    "Net2APP SMS routing engine with multi-layer architecture: Route Plans → Routes → Trunks → Suppliers. Priority-based routing, failover, DLR tracking, and real-time monitoring. Supports SMPP, HTTP, RCS, Voice OTP, and OTT routing with intelligent SMS delivery optimization.",
  keywords: [
    "SMS Routing", "SMS Route Engine", "Multi-Layer SMS Routing",
    "Route Plans", "Routes", "Trunks", "Suppliers",
    "SMS Failover Routing", "Priority SMS Routing", "SMPP Routing",
    "HTTP SMS Routing", "SMS Traffic Routing", "Message Routing",
    "SMS Delivery Optimization", "DLR Routing", "SMS Gateway Routing",
    "Intelligent SMS Routing", "Auto Failover SMS",
    "SMS Routing Platform", "Bulk SMS Routing",
    "SMS Route Management", "SMS Traffic Distribution",
    "SMPP Route Plan", "SMS Provider Routing",
    "Multi-Tenant SMS Routing", "Cloud SMS Routing",
    "SMS Routing Bangladesh", "SMS Routing UAE", "SMS Routing India",
    "Reve SMS", "5GVision", "LRS", "Al Muqeet",
    "Bangladesh Operators", "UAE Enterprises",
  ],
  openGraph: {
    title: "SMS Routing — Multi-Layer Intelligent Routing Engine",
    description:
      "Multi-layer SMS routing: Route Plans → Routes → Trunks → Suppliers. Priority-based, failover, DLR tracking, real-time monitoring.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/sms-routing#webpage",
      "url": "https://net2app.com/sms-routing",
      "name": "SMS Routing — Multi-Layer Intelligent Routing Engine",
      "description":
        "Net2APP multi-layer SMS routing engine with Route Plans, Routes, Trunks, and Suppliers. Priority-based routing with auto failover.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "SMS Routing", "item": "https://net2app.com/sms-routing" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/sms-routing#faq",
      "mainEntity": faqSchema(PAGE_FAQS),
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://net2app.com/sms-routing#app",
      "name": "Net2APP SMS Routing Engine",
      "url": "https://net2app.com/sms-routing",
      "description": "Multi-layer intelligent SMS routing engine with Route Plans, Routes, Trunks, and Suppliers. Priority-based routing with automatic failover, DLR correlation, and real-time monitoring.",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free to start. No setup fees. Pay-as-you-go SMS pricing."
      },
      "featureList": [
        "4-Layer Routing Architecture: Route Plans → Routes → Trunks → Suppliers",
        "Priority-Based Routing with Automatic Failover",
        "End-to-End DLR Correlation and Tracking",
        "Per-Route, Per-Trunk, and Per-Supplier TPS Control",
        "Multi-Protocol Support: SMPP v3.4, HTTP, RCS, Custom",
        "Client-Specific Route Plans with Granular Control",
        "Real-Time SMPP Bind Status Monitoring",
        "80+ Pre-Built Supplier Connector Templates",
        "Prefix-Based and Country-Specific Route Maps",
        "Real-Time Analytics and Performance Monitoring"
      ]
    },
  ],
};

export default function SmsRoutingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200"><div className="max-w-7xl mx-auto px-6 lg:px-8"><div className="flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span>
        </Link>
        <div className="hidden lg:flex items-center gap-1">
          <Link href="/" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Home</Link>
          <Link href="/faq" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition hidden md:block">FAQ</Link>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</a>
          </div>
        </div>
      </div></nav>

      {/* Hero */}
      <section id="faq" className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-20 scroll-mt-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-100 border border-blue-200 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              <span className="text-blue-700 text-sm font-medium">Multi-Layer SMS Routing Engine</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
              SMS Routing Engine
              <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Route Plans → Routes → Trunks → Suppliers</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Intelligent multi-layer SMS routing with complete control at every layer.
              <strong className="text-gray-900"> Route Plans</strong> define strategy,
              <strong className="text-gray-900"> Routes</strong> specify paths,
              <strong className="text-gray-900"> Trunks</strong> manage connections,
              and <strong className="text-gray-900"> Suppliers</strong> deliver messages.
              Includes <strong className="text-gray-900">auto failover</strong>, <strong className="text-gray-900">DLR tracking</strong>,
              and real-time monitoring.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="https://net2app.com" className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-lg shadow-sm text-center">
                Deploy SMS Routing Free →
              </a>
              <Link href="/http-sms-api" className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-semibold text-lg text-center">
                HTTP SMS API
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {PAGE_FAQS.map((faq, i) => (
              <details key={i} className="bg-white border border-gray-100 rounded-xl shadow-sm group open:border-blue-500/50 transition">
                <summary className="text-gray-900 font-medium px-6 py-4 cursor-pointer list-none flex items-center justify-between group-open:border-b border-gray-100">
                  <span>{faq.q}</span>
                  <span className="text-blue-400 text-xl group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-6 py-4">
                  <p className="text-gray-600 text-sm leading-relaxed">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-pink-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Deploy Multi-Layer SMS Routing — Free</h2>
          <p className="text-blue-100 text-lg mb-8">Complete SMS routing engine with Route Plans, Routes, Trunks, and Suppliers. 80+ pre-built connectors, auto failover, DLR tracking. No setup fees.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div>
              <span className="text-white font-semibold text-lg">Net2APP</span>
            </Link>
            <p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform • Multi-Tenant SaaS</p>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <Link href="/" className="text-blue-400 hover:text-white text-sm transition">Home</Link>
              <Link href="/ip-whitelisting" className="text-blue-400 hover:text-white text-sm transition">IP Whitelisting</Link>
              <Link href="/voice-otp" className="text-blue-400 hover:text-white text-sm transition">Voice OTP</Link>
              <Link href="/case-studies" className="text-blue-400 hover:text-white text-sm transition">Case Studies</Link>
              <Link href="/comparisons" className="text-blue-400 hover:text-white text-sm transition">Comparisons</Link>
              <Link href="/faq" className="text-blue-400 hover:text-white text-sm transition">FAQ</Link>
              <Link href="/webmail" className="text-blue-400 hover:text-white text-sm transition">Webmail</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center">
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p>
          </div>
        </div>
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
