import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Developers — RESTful SMS API, SMPP v3.4 & Webhooks | Net2APP",
  description: "Developer-first SMS platform with clean RESTful APIs, full SMPP v3.4 protocol support, and webhook-based DLR callbacks. Integrate SMS, Voice OTP, RCS, WhatsApp, and Telegram into any application.",
  keywords: [
    "Developer SMS API",
    "SMS API Developer",
    "RESTful SMS API",
    "SMPP Developer",
    "SMS SDK",
    "SMS Webhook",
    "DLR Callback",
    "SMS API Integration",
    "Developer-First SMS",
    "SMS API Code Examples",
    "SMS API Node.js",
    "SMS API Python",
    "SMS API PHP",
    "Developer SMS Bangladesh",
    "SMS API India",
    "Developer SMS UAE",
    "SMS Platform Developer",
    "Programmable SMS",
  ],
  openGraph: { title: "Developer SMS API — REST, SMPP & Webhooks | Net2APP", description: "Developer-first SMS platform with REST API, SMPP v3.4, and webhook DLR callbacks." },
};


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/teams/developers#webpage",
        "url": "https://net2app.com/solutions/teams/developers",
        "name": "For Developers — RESTful SMS API, SMPP v3.4 & Webhooks",
        "description": "Developer-first SMS platform with clean RESTful APIs, full SMPP v3.4 protocol support, and webhook-based DLR callbacks.",
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
              "name": "Developers",
              "item": "https://net2app.com/solutions/teams/developers"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/teams/developers#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What programming languages are supported for SMS API integration?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP provides RESTful HTTP APIs usable from any language. We offer code examples and SDKs for Node.js, Python, and PHP. The SMPP v3.4 gateway supports any ESME client library. All APIs use standard JSON request/response format with Bearer token or API key authentication."
            }
          },
          {
            "@type": "Question",
            "name": "How does SMPP v3.4 integration work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP provides a full SMPP v3.4 gateway supporting transmitter, receiver, and transceiver bind modes. Connect your ESME client to the SMPP server, authenticate with your system ID and password, and start sending/receiving SMS. The platform handles DLR correlation, message queuing, and TPS rate limiting automatically."
            }
          },
          {
            "@type": "Question",
            "name": "How do DLR webhook callbacks work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "When you send an SMS via the HTTP API, you can specify a webhook URL. Net2APP delivers real-time delivery reports (DLRs) to your webhook endpoint with full status details — delivered, failed, pending, or expired. Each DLR includes the original message ID, timestamp, error codes, and carrier information for complete traceability."
            }
          },
          {
            "@type": "Question",
            "name": "Can I integrate Voice OTP and OTT messaging via the same API?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. A single API key gives you access to all services: SMS, Voice OTP, WhatsApp Business API, Telegram, RCS, and Flash SMS. Use different API endpoints within the same authenticated session. All services share the same authentication, rate limiting, and reporting infrastructure."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/teams/developers#app",
        "name": "Net2APP Developer SMS API",
        "url": "https://net2app.com/solutions/teams/developers",
        "description": "Developer-first SMS platform with clean RESTful APIs, SMPP v3.4 protocol support, webhook DLR callbacks, and SDKs for Node.js, Python, and PHP. Integrate SMS, Voice OTP, RCS, WhatsApp, and Telegram into any application.",
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. Full API access from day one."
        },
        "featureList": [
          "RESTful HTTP SMS API with API key + IP whitelist authentication",
          "SMPP v3.4 gateway with transmitter/receiver/transceiver binds",
          "Webhook-based DLR callbacks for real-time delivery status",
          "Voice OTP API with Asterisk AMI and 3-retry logic",
          "WhatsApp Business API via Baileys and Telegram MTProto",
          "SDK support for Node.js, Python, and PHP",
          "Rate limiting and TPS control per API key",
          "Comprehensive API documentation with code examples",
          "SMPP bind status monitoring and ESME management",
          "RCS Rich Communication Services and Flash SMS support"
        ]
      }
    ]
  };

export default function DevelopersPage() {
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
            <span className="text-6xl mb-4 block">💻</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">For Developers</h1>
            <p className="text-gray-500 text-sm font-medium mb-2">RESTful API, SMPP v3.4, Webhooks & SDKs</p>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Net2APP provides a developer-first SMS platform with clean RESTful APIs, full SMPP v3.4 protocol support, and webhook-based DLR callbacks. Integrate SMS, Voice OTP, RCS, WhatsApp, and Telegram into any application with minimal code.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/http-sms-api" className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">HTTP SMS API Docs →</Link>
              <Link href="/whatsapp-telegram-api" className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-semibold">WhatsApp & Telegram API →</Link>
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Features</h2>
            <ul className="space-y-3">{["RESTful HTTP API with API key + IP whitelist auth", "SMPP v3.4 gateway with transmitter/receiver/transceiver binds", "DLR webhook callbacks for real-time delivery status", "Voice OTP API with Asterisk AMI integration", "WhatsApp & Telegram Business API via Baileys & MTProto", "Rate limiting, TPS control, and message queuing"].map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>
            ))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Start Building</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your SMS API in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="py-12 bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link>
            <p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link>
              <Link href="/solutions/teams" className="text-blue-400 hover:text-white text-sm transition">Teams</Link>
              <Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div>
        </div>
      </footer>
    </div>
  );
}
