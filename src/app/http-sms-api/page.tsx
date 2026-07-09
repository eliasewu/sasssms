import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "HTTP SMS API — RCS Messaging & Flash SMS Gateway | Net2APP",
  description:
    "Net2APP provides RESTful HTTP SMS API with RCS (Rich Communication Services), Flash SMS priority messaging, bulk SMS, DLR webhooks, and rate limiting. Integrate SMS into any application with simple HTTP requests. Supports Unicode, alphanumeric sender IDs, and delivery reports.",
  keywords: [
    "HTTP SMS API", "SMS REST API", "SMS API Gateway", "RCS Messaging",
    "Rich Communication Services", "RCS Business Messaging", "Flash SMS",
    "Flash SMS Gateway", "Priority SMS", "Bulk SMS API",
    "Transactional SMS API", "SMS Webhook", "DLR Callback",
    "SMS Delivery Reports API", "Unicode SMS API",
    "Alphanumeric Sender ID", "SMS API Documentation",
    "Programmable SMS API", "HTTP SMS Gateway Bangladesh",
    "HTTP SMS API India", "HTTP SMS API UAE", "Cloud SMS API",
    "SMS API Integration", "CPaaS SMS API",
    "Enterprise SMS API",
  ],
  openGraph: {
    title: "HTTP SMS API — RCS & Flash SMS Gateway | Net2APP",
    description:
      "RESTful HTTP SMS API with RCS messaging, Flash SMS, DLR webhooks, and rate limiting. Simple HTTP POST integration for bulk and transactional SMS.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/http-sms-api#webpage",
      "url": "https://net2app.com/http-sms-api",
      "name": "HTTP SMS API — RCS Messaging & Flash SMS Gateway",
      "description":
        "RESTful HTTP SMS API with RCS, Flash SMS, DLR webhooks, and rate limiting. Integrate SMS into any application with simple HTTP requests.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "HTTP SMS API", "item": "https://net2app.com/http-sms-api" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/http-sms-api#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is the HTTP SMS API?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP's HTTP SMS API is a RESTful API that allows you to send SMS messages using simple HTTP POST requests. It supports bulk SMS, transactional SMS, RCS (Rich Communication Services), Flash SMS (priority screen messages), Unicode characters, alphanumeric sender IDs, and delivery report callbacks via webhooks. Authentication is handled via API keys with optional IP whitelisting for security.",
          },
        },
        {
          "@type": "Question",
          "name": "What is RCS Messaging?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "RCS (Rich Communication Services) is the next-generation SMS standard that supports rich media, interactive buttons, branded messaging, read receipts, and typing indicators. Unlike traditional SMS, RCS enables businesses to send messages with images, videos, carousels, quick reply buttons, and suggested actions — providing an app-like messaging experience directly in the native SMS app on Android devices.",
          },
        },
        {
          "@type": "Question",
          "name": "What is Flash SMS?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Flash SMS (also called Class 0 SMS) is a special type of SMS message that appears immediately on the recipient's screen as a pop-up notification without being saved to the inbox. Flash SMS is ideal for urgent alerts, emergency notifications, time-sensitive one-time passwords, and critical system alerts where immediate visibility is required.",
          },
        },
        {
          "@type": "Question",
          "name": "Does the HTTP SMS API support DLR (Delivery Reports)?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Net2APP's HTTP SMS API provides real-time DLR (Delivery Report) support via webhook callbacks. When you send an SMS via the API, you register a callback URL, and the system pushes delivery reports (DELIVERED, UNDELIVERABLE, EXPIRED, REJECTED, etc.) to your endpoint asynchronously. Standard DLR status codes are supported including ENROUTE, DELIVERED, EXPIRED, DELETED, UNDELIVERABLE, ACCEPTED, UNKNOWN, REJECTED, and SKIPPED.",
          },
        },
        {
          "@type": "Question",
          "name": "How do I authenticate with the HTTP SMS API?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP HTTP SMS API supports multiple authentication methods: (1) API Key — include your unique API key in the request header or as a query parameter. (2) IP Whitelisting — restrict API access to specific IP addresses for enhanced security. Both authentication methods can be configured from the Net2APP dashboard.",
          },
        },
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://net2app.com/http-sms-api#app",
      "name": "Net2APP HTTP SMS API",
      "url": "https://net2app.com/http-sms-api",
      "description": "RESTful HTTP SMS API with RCS rich messaging, Flash SMS priority delivery, bulk SMS, DLR webhooks, and rate limiting. Simple HTTP POST integration for any programming language.",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free to start. No setup fees. Pay-as-you-go SMS pricing."
      },
      "featureList": [
        "RESTful API Design with Simple HTTP POST/GET Integration",
        "RCS Rich Messaging: Images, Carousels, Quick Reply Buttons",
        "Flash SMS (Class 0) Priority Screen-Pop Notifications",
        "DLR Webhook Callbacks for Real-Time Delivery Reports",
        "Bulk SMS Support with JSON Array, CSV, and Deduplication",
        "Unicode and International Character Set Support",
        "Alphanumeric Sender ID Configuration",
        "Configurable Rate Limiting and TPS Throttling",
        "IP Whitelisting Security with API Key Authentication",
        "Multi-Language Code Examples: Node.js, Python, PHP"
      ]
    },
  ],
};

export default function HttpSmsApiPage() {
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
          <Link href="#faq" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition hidden md:block">FAQ</Link>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</a>
          </div>
        </div>
      </div></nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-100 border border-blue-200 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              <span className="text-blue-700 text-sm font-medium">HTTP SMS API • RCS • Flash SMS</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
              HTTP SMS API Gateway
              <span className="block bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">RCS + Flash SMS + Bulk SMS</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Send SMS, RCS messages, and Flash SMS via simple RESTful HTTP API calls.
              Net2APP supports <strong className="text-gray-900">bulk SMS</strong>, <strong className="text-gray-900">transactional SMS</strong>,
              <strong className="text-gray-900"> RCS</strong> (Rich Communication Services) with rich media and interactive buttons,
              and <strong className="text-gray-900">Flash SMS</strong> for urgent screen-pop notifications.
              Includes DLR webhooks, rate limiting, and IP whitelisting.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="https://net2app.com" className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-lg shadow-sm text-center">
                Deploy SMS API Free →
              </a>
              <Link href="/whatsapp-telegram-api" className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-semibold text-lg text-center">
                WhatsApp & Telegram API
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "RESTful", label: "HTTP API", desc: "Simple POST/GET integration" },
              { value: "RCS", label: "Rich Messaging", desc: "Images, buttons, carousels" },
              { value: "Flash", label: "Priority SMS", desc: "Screen-pop notifications" },
              { value: "DLR", label: "Webhooks", desc: "Real-time delivery reports" },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <p className="text-3xl font-bold text-gray-900 mb-1">{s.value}</p>
                <p className="text-gray-700 font-medium">{s.label}</p>
                <p className="text-gray-500 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Methods */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">SMS API Methods</h2>
            <p className="text-gray-500 text-lg">Three ways to send SMS — choose the method that fits your application</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="text-4xl mb-4">📡</div>
              <h3 className="text-gray-900 font-semibold text-lg mb-3">Standard SMS</h3>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-4 font-mono text-xs text-gray-600">
                POST /api/send-sms<br />
                {"{"}"to": "+8801712345678",<br />
                &nbsp;&nbsp;"message": "Hello World",<br />
                &nbsp;&nbsp;"sender_id": "NET2APP"{"}"}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">Send standard SMS messages with alphanumeric sender ID, Unicode support, and configurable TPS (transactions per second).</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="text-4xl mb-4">💎</div>
              <h3 className="text-gray-900 font-semibold text-lg mb-3">RCS Messaging</h3>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-4 font-mono text-xs text-gray-600">
                POST /api/rcs/send<br />
                {"{"}"to": "+8801712345678",<br />
                &nbsp;&nbsp;"rich_card": {"{"}<br />
                &nbsp;&nbsp;&nbsp;&nbsp;"title": "Offer!",<br />
                &nbsp;&nbsp;&nbsp;&nbsp;"image_url": "..."{"}"}{"}"}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">Rich Communication Services with image carousels, action buttons, suggested replies, and branded messaging for enhanced customer engagement.</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-gray-900 font-semibold text-lg mb-3">Flash SMS</h3>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-4 font-mono text-xs text-gray-600">
                POST /api/flash-sms<br />
                {"{"}"to": "+8801712345678",<br />
                &nbsp;&nbsp;"message": "URGENT: ...",<br />
                &nbsp;&nbsp;"class": 0{"}"}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">Class 0 Flash SMS messages that appear instantly as screen pop-ups without being saved to the inbox. Ideal for urgent alerts and emergency notifications.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">HTTP SMS API Features</h2>
            <p className="text-gray-500 text-lg">Enterprise-grade SMS API infrastructure for developers</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "RESTful API Design", desc: "Clean, well-documented RESTful API endpoints for sending SMS, checking delivery status, and managing messages. Simple HTTP POST/GET integration compatible with any programming language." },
              { title: "DLR Webhook Callbacks", desc: "Real-time delivery report push via HTTP POST callbacks when message status changes. Supports standard DLR status codes: DELIVERED, UNDELIVERABLE, EXPIRED, REJECTED, ENROUTE, and more." },
              { title: "Rate Limiting & Throttling", desc: "Configurable per-tenant rate limits and TPS (transactions per second) throttling. Per-API-key rate limiting ensures fair usage and protects against abuse." },
              { title: "Unicode & Special Characters", desc: "Full Unicode support for international character sets including Bengali, Arabic, Hindi, Chinese, and other non-Latin scripts. Automatic character encoding detection." },
              { title: "Alphanumeric Sender ID", desc: "Use custom alphanumeric sender IDs (e.g., BRAND, APPNAME) instead of numeric phone numbers. Supports sender ID registration and compliance with global regulations." },
              { title: "Bulk SMS Support", desc: "Send SMS to multiple recipients in a single API request. Supported formats: JSON array, comma-separated values, and CSV upload. Automatic deduplication and validation." },
              { title: "RCS Rich Media", desc: "Send rich messages with images, videos, carousels, quick reply buttons, suggested actions, and branded templates. Enhanced engagement with app-like messaging experience." },
              { title: "Flash SMS (Class 0)", desc: "Priority SMS that appears as an instant screen pop-up notification. The message is displayed immediately without being saved to the inbox. Perfect for urgent alerts." },
              { title: "IP Whitelisting Security", desc: "Restrict API access to specific IP addresses for enhanced security. Configure IP whitelists per API key from the dashboard. Supports IPv4 and CIDR notation." },
            ].map((f, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition group">
                <h3 className="text-gray-900 font-semibold text-lg mb-2 group-hover:text-blue-600 transition">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">HTTP SMS API — FAQ</h2>
            <p className="text-gray-500">Common questions about our SMS API, RCS, and Flash SMS services</p>
          </div>
          <div className="space-y-4">
            {[
              { q: "What programming languages can I use with the HTTP SMS API?", a: "The HTTP SMS API works with any programming language that can make HTTP requests — JavaScript/Node.js, Python, PHP, Ruby, Java, C#, Go, Rust, and more. We provide code examples and SDK snippets for popular languages." },
              { q: "How do I receive delivery reports (DLR) for my messages?", a: "When sending an SMS via the API, you provide a callback URL. The system pushes DLR updates to this URL as HTTP POST requests whenever the message status changes. The payload includes message ID, status, timestamp, and error codes." },
              { q: "What is the difference between RCS and standard SMS?", a: "RCS (Rich Communication Services) supports rich media (images, videos), interactive buttons, branded messaging, read receipts, and typing indicators. Standard SMS is plain text only. RCS requires compatible devices and carriers but provides a significantly enhanced user experience similar to OTT messaging apps." },
              { q: "Can I send Flash SMS programmatically?", a: "Yes. Flash SMS can be sent through the HTTP SMS API by specifying a message class parameter (Class 0). Flash SMS messages appear as pop-up notifications on the recipient's screen and are not automatically saved to the inbox. They are ideal for urgent alerts and time-sensitive notifications." },
              { q: "What are the rate limits for the HTTP SMS API?", a: "Rate limits are configurable per tenant and displayed in the dashboard. You can set maximum TPS (transactions per second), daily message caps, and per-API-key rate limits. Professional and Enterprise plans include higher TPS allocations." },
            ].map((faq, i) => (
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
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Start Using the SMS API — Free</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your own SMS API gateway with HTTP, RCS, and Flash SMS support in under 60 seconds. No setup fees. Pay only for messages sent.</p>
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
              <Link href="/voice-otp" className="text-blue-400 hover:text-white text-sm transition">Voice OTP</Link>
              <Link href="/ott-pairing" className="text-blue-400 hover:text-white text-sm transition">OTT Pairing</Link>
              <Link href="/case-studies" className="text-blue-400 hover:text-white text-sm transition">Case Studies</Link>
              <Link href="/comparisons" className="text-blue-400 hover:text-white text-sm transition">Comparisons</Link>
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
