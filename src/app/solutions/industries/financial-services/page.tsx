import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Solutions for Financial Services — Secure OTP & Alerts | Net2APP",
  description: "Secure transaction alerts, Voice OTP for banking authentication, fraud detection notifications, and regulatory compliance messaging for financial institutions.",
  keywords: [
    "Financial Services SMS",
    "Banking SMS",
    "Fintech SMS",
    "Transaction Alert SMS",
    "Voice OTP Banking",
    "Fraud Alert Banking",
    "Secure SMS Banking",
    "Regulatory Compliance SMS",
    "Financial SMS Bangladesh",
    "Banking SMS India",
    "Fintech SMS UAE",
    "SMS KYC",
    "Banking OTP SMS",
    "Financial Notification SMS",
    "Banking SMS API",
  ],
  openGraph: { title: "Financial Services SMS — Secure OTP & Fraud Alerts | Net2APP", description: "Secure SMS and Voice OTP solutions for financial services, banking, and fintech." },
};

const features = ["Voice OTP for 2FA and transaction auth", "Real-time fraud alert SMS", "Flash SMS for urgent security notifications", "IP whitelisting for API security", "DLR tracking for compliance auditing"];


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/industries/financial-services#webpage",
        "url": "https://net2app.com/solutions/industries/financial-services",
        "name": "SMS Solutions for Financial Services — Secure OTP & Alerts",
        "description": "Secure transaction alerts, Voice OTP for banking authentication, fraud detection notifications, and regulatory compliance messaging for financial institutions.",
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
              "name": "Financial Services",
              "item": "https://net2app.com/solutions/industries/financial-services"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/industries/financial-services#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How does Voice OTP improve banking security?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Voice OTP provides a secure out-of-band authentication channel for banking transactions. Net2APP's Asterisk AMI integration delivers spoken OTP codes with 3-retry logic and 220+ country MCC language detection. Unlike SMS, voice calls are harder to intercept, making them ideal for high-value transaction authorization."
            }
          },
          {
            "@type": "Question",
            "name": "Is the platform compliant with financial regulations?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP's architecture supports regulatory compliance with PostgreSQL schema isolation (complete data separation), IP whitelisting (API access control), audit logging (all API calls and message activity tracked), and encrypted SMPP connections. DLR tracking provides the delivery evidence needed for compliance audits."
            }
          },
          {
            "@type": "Question",
            "name": "How does Flash SMS help with fraud prevention?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Flash SMS messages appear directly on the phone screen without being saved to the inbox, ensuring urgent fraud alerts are seen immediately. Combine Flash SMS with Voice OTP for a multi-channel fraud notification strategy that reaches customers even when their SMS inbox is full or notifications are silenced."
            }
          },
          {
            "@type": "Question",
            "name": "Can I separate customer data across banking products?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Net2APP's multi-tenant architecture lets you create isolated sub-clients for each banking product (retail banking, credit cards, mortgages, wealth management). Each sub-client has its own PostgreSQL schema, API keys, sender IDs, and routing — ensuring regulatory data separation requirements are met."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/industries/financial-services#app",
        "name": "Net2APP Financial SMS Solution",
        "url": "https://net2app.com/solutions/industries/financial-services",
        "description": "Secure SMS and Voice OTP solutions for banking, fintech, and financial services. Transaction alerts, fraud detection notifications, 2FA authentication, and regulatory compliance messaging with PostgreSQL schema isolation.",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. SOC2-ready security controls included."
        },
        "featureList": [
          "Voice OTP for secure banking 2FA and transaction authorization",
          "Real-time fraud alert SMS with Flash SMS priority delivery",
          "IP whitelisting for API security and access control",
          "DLR tracking for regulatory compliance auditing",
          "PostgreSQL schema isolation for financial data separation",
          "Alphanumeric sender ID for branded bank communications",
          "SMPP v3.4 gateway with TLS encryption for secure transmission",
          "Multi-layer SMS routing with auto failover for reliability",
          "Audit logging for all API access and message activity",
          "Sub-client isolation for managing multiple banking products"
        ]
      }
    ]
  };

export default function FinancialServicesPage() {
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
            <span className="text-6xl mb-4 block">🏦</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">Financial Services</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Secure transaction alerts, Voice OTP for banking authentication, fraud detection notifications, and regulatory compliance messaging. Net2APP supports the security and reliability requirements of financial institutions with multi-layer SMS routing and IP whitelisting.</p>
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
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Secure Your Financial Communications</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy enterprise SMS in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="py-12 bg-gray-900 border-t border-gray-800"><div className="max-w-7xl mx-auto px-6 lg:px-12"><div className="flex flex-col md:flex-row items-center justify-between gap-4"><Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link><p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p><div className="flex items-center gap-4 flex-wrap justify-center"><Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link><Link href="/solutions/industries" className="text-blue-400 hover:text-white text-sm transition">Industries</Link><Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link></div></div><div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div></div></footer>
    </div>
  );
}
