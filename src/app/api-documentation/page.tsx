import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API Documentation — SMS, Voice OTP, WhatsApp & Telegram API Reference | Net2APP",
  description:
    "Net2APP complete API documentation: SMS API (HTTP REST + SMPP v3.4), Voice OTP API (Asterisk AMI), WhatsApp Business API (Baileys), Telegram MTProto API, SMS Routing API, DLR Webhooks. Authentication, rate limiting, and code examples for Node.js, Python, PHP, and more.",
  keywords: [
    "SMS API Documentation", "SMS API Reference", "SMS REST API Documentation",
    "Voice OTP API Docs", "WhatsApp Business API Documentation",
    "Telegram API Documentation", "SMS API Integration Guide",
    "SMPP API Documentation", "SMS Gateway API Docs", "SMS API SDK",
    "SMS API Code Examples", "SMS API Node.js", "SMS API Python",
    "SMS API PHP", "SMS API Authentication", "API Webhook Documentation",
    "DLR Webhook API", "SMS API Rate Limiting", "REST API SMS Gateway",
    "SMS API Developer Guide", "Programmable SMS API Docs",
    "CPaaS API Documentation", "SMS Platform API Reference",
  ],
  openGraph: {
    title: "API Documentation — SMS, Voice OTP & OTT API Reference | Net2APP",
    description:
      "Complete API documentation for Net2APP SMS gateway: SMS API, Voice OTP API, WhatsApp & Telegram API, SMS Routing API, and DLR webhooks.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/api-documentation#webpage",
      "url": "https://net2app.com/api-documentation",
      "name": "API Documentation — SMS, Voice OTP & OTT API Reference | Net2APP",
      "description": "Complete API documentation for Net2APP multi-tenant SMS gateway platform. SMS API, Voice OTP API, WhatsApp & Telegram API, and SMS Routing API.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "API Documentation", "item": "https://net2app.com/api-documentation" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/api-documentation#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do I authenticate with the Net2APP API?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP supports API key authentication — include your unique API key in the X-API-Key request header or as an api_key query parameter. For enhanced security, configure IP whitelisting per API key from the dashboard. All API endpoints return standard HTTP status codes with JSON error bodies on failure.",
          },
        },
        {
          "@type": "Question",
          "name": "What programming languages can I use with the SMS API?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The Net2APP HTTP SMS API works with any programming language that can make HTTP requests. Code examples are provided for Node.js (using axios), Python (using requests), and PHP (using cURL). The RESTful API design uses standard JSON request/response format, making integration straightforward from JavaScript, Ruby, Java, C#, Go, Rust, and any other language with HTTP client support.",
          },
        },
        {
          "@type": "Question",
          "name": "How do I receive delivery reports (DLR) for my messages?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Configure a webhook URL in the Net2APP dashboard, and the system will automatically POST JSON payloads to your endpoint whenever a message status changes. The payload includes the message ID, status (DELIVERED, UNDELIVERABLE, EXPIRED, etc.), timestamp, and error details. You can also poll the /api/sms/status/:messageId endpoint for specific message status.",
          },
        },
        {
          "@type": "Question",
          "name": "What rate limits apply to the API?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Rate limits are configurable per tenant and displayed in the dashboard. You can set maximum TPS (transactions per second), daily message caps, and per-API-key rate limits. Rate limit information is returned in response headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset). Professional and Enterprise plans include higher TPS allocations.",
          },
        },
      ],
    },
    {
      "@type": "HowTo",
      "name": "How to Send an SMS via the Net2APP HTTP API",
      "description": "Step-by-step guide to send your first SMS message using the Net2APP RESTful HTTP API in Node.js, Python, or PHP.",
      "totalTime": "PT5M",
      "tool": [
        { "@type": "HowToTool", "name": "Net2APP API Key" },
        { "@type": "HowToTool", "name": "HTTP Client (curl, axios, requests, or cURL)" }
      ],
      "step": [
        {
          "@type": "HowToStep",
          "position": 1,
          "name": "Get Your API Key",
          "text": "Sign up at net2app.com and navigate to the dashboard. Go to Settings → API Keys and copy your unique API key. This key authenticates all your API requests.",
          "url": "https://net2app.com"
        },
        {
          "@type": "HowToStep",
          "position": 2,
          "name": "Choose Your Integration Method",
          "text": "Decide between Standard SMS, Flash SMS, or RCS messaging. Use /api/send-sms for standard SMS, /api/flash-sms for priority screen-pop messages, or /api/rcs/send for rich media messages with images and buttons.",
          "url": "https://net2app.com/api-documentation"
        },
        {
          "@type": "HowToStep",
          "position": 3,
          "name": "Send Your First SMS",
          "text": "Make an HTTP POST request to the API endpoint with your API key, recipient phone number, message text, and optional sender ID. Use the code examples provided for Node.js, Python, or PHP as a starting point. The API returns a JSON response with the message ID for tracking.",
          "url": "https://net2app.com/api-documentation#code-examples"
        },
        {
          "@type": "HowToStep",
          "position": 4,
          "name": "Track Delivery with DLR Webhooks",
          "text": "Register a webhook callback URL in the dashboard to receive real-time delivery reports. Net2APP POSTs JSON payloads to your endpoint with message status (DELIVERED, UNDELIVERABLE, etc.), timestamps, and error details. Poll /api/sms/status/:messageId for on-demand status checks.",
          "url": "https://net2app.com/api-documentation"
        }
      ]
    },
    {
      "@type": "TechArticle",
      "headline": "Net2APP SMS Gateway API Documentation",
      "description": "Complete API reference for Net2APP multi-tenant SMS gateway platform covering SMS API, Voice OTP, WhatsApp, Telegram, and SMS routing APIs.",
      "proficiencyLevel": "Beginner",
      "about": {
        "@type": "SoftwareApplication",
        "name": "Net2APP SMS Gateway API",
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "All",
      },
    },
  ],
};

const apiEndpoints = [
  {
    category: "SMS API",
    icon: "📨",
    endpoints: [
      { method: "POST", path: "/api/send-sms", desc: "Send a single or bulk SMS message. Supports Unicode, alphanumeric sender IDs, and DLR tracking." },
      { method: "POST", path: "/api/rcs/send", desc: "Send RCS (Rich Communication Services) messages with images, buttons, carousels, and branded templates." },
      { method: "POST", path: "/api/flash-sms", desc: "Send Class 0 Flash SMS messages that appear as screen pop-ups without saving to the inbox." },
      { method: "GET", path: "/api/sms/status/:messageId", desc: "Check the delivery status of a previously sent SMS message. Returns DLR status and timestamps." },
      { method: "GET", path: "/api/sms/history", desc: "Retrieve SMS sending history with pagination, date filtering, and status filtering." },
    ],
  },
  {
    category: "Voice OTP API",
    icon: "📞",
    endpoints: [
      { method: "POST", path: "/api/voice-otp/send", desc: "Initiate a Voice OTP call to a phone number. Supports numeric and alphanumeric OTPs with 3-retry logic." },
      { method: "GET", path: "/api/voice-otp/status/:callId", desc: "Check the status of a Voice OTP call — ringing, answered, completed, or failed." },
      { method: "GET", path: "/api/voice-otp/logs", desc: "Retrieve Voice OTP call logs with duration, retry counts, and status details." },
    ],
  },
  {
    category: "WhatsApp & Telegram API",
    icon: "💬",
    endpoints: [
      { method: "POST", path: "/api/ott/whatsapp/send", desc: "Send a WhatsApp text message via the Baileys WhatsApp Web protocol to any phone number." },
      { method: "POST", path: "/api/ott/whatsapp/media", desc: "Send images, videos, audio, or documents through WhatsApp with automatic media processing." },
      { method: "POST", path: "/api/ott/telegram/send", desc: "Send a Telegram message via MTProto API with higher rate limits than the Bot API." },
      { method: "POST", path: "/api/ott/telegram/media", desc: "Send media files through Telegram with automatic compression and format handling." },
    ],
  },
  {
    category: "SMS Routing API",
    icon: "🔀",
    endpoints: [
      { method: "POST", path: "/api/routing/plans", desc: "Create a new SMS routing plan. Define routing strategy with ordered routes, trunks, and suppliers." },
      { method: "GET", path: "/api/routing/plans", desc: "List all SMS routing plans for the tenant with status, priorities, and configuration details." },
      { method: "GET", path: "/api/routing/suppliers", desc: "List configured SMS suppliers with connection status, throughput, and delivery success rates." },
    ],
  },
  {
    category: "Webhooks",
    icon: "🪝",
    endpoints: [
      { method: "POST", path: "/your-callback-url (DLR)", desc: "Receive DLR delivery report callbacks. Net2APP POSTs JSON payload with message ID, status, timestamp, and error codes." },
      { method: "POST", path: "/your-callback-url (Voice)", desc: "Receive Voice OTP call status callbacks. Payload includes call ID, status, duration, and retry count." },
      { method: "POST", path: "/your-callback-url (Inbound)", desc: "Receive inbound SMS messages. Net2APP forwards incoming messages to your registered webhook URL." },
    ],
  },
];

const authMethods = [
  { title: "API Key Authentication", desc: "Include your unique API key in the X-API-Key request header or as an api_key query parameter. API keys are generated from the Net2APP dashboard.", code: 'curl -X POST https://net2app.com/api/send-sms \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"to":"+1234567890","message":"Hello"}\'' },
  { title: "IP Whitelisting", desc: "Restrict API access to specific IP addresses for enhanced security. Configure IP whitelists per API key from the dashboard. Supports IPv4 and CIDR notation.", code: "# Dashboard → Settings → IP Whitelisting\n# Add: 203.0.113.50 (single IP)\n# Add: 203.0.113.0/24 (CIDR range)" },
  { title: "Rate Limiting", desc: "Per-API-key rate limits control throughput. Configure TPS (transactions per second), daily caps, and concurrent connections. Rate limit headers included in all API responses.", code: "# Response headers:\nX-RateLimit-Limit: 50\nX-RateLimit-Remaining: 42\nX-RateLimit-Reset: 1640000000\nRetry-After: 60" },
];

const codeExamples = [
  {
    language: "Node.js",
    code: `const axios = require('axios');

async function sendSMS(to, message) {
  const response = await axios.post(
    'https://net2app.com/api/send-sms',
    { to, message, sender_id: 'NET2APP' },
    { headers: { 'X-API-Key': 'YOUR_API_KEY' } }
  );
  return response.data;
}

// Usage
sendSMS('+1234567890', 'Hello from Net2APP!')
  .then(console.log)
  .catch(console.error);`,
  },
  {
    language: "Python",
    code: `import requests

def send_sms(to, message):
    response = requests.post(
        "https://net2app.com/api/send-sms",
        json={"to": to, "message": message, "sender_id": "NET2APP"},
        headers={"X-API-Key": "YOUR_API_KEY"}
    )
    return response.json()

# Usage
result = send_sms("+1234567890", "Hello from Net2APP!")
print(result)`,
  },
  {
    language: "PHP",
    code: `<?php

function sendSMS($to, $message) {
    $ch = curl_init('https://net2app.com/api/send-sms');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'X-API-Key: YOUR_API_KEY',
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'to' => $to,
            'message' => $message,
            'sender_id' => 'NET2APP'
        ])
    ]);
    $result = curl_exec($ch);
    curl_close($ch);
    return json_decode($result, true);
}

// Usage
$result = sendSMS('+1234567890', 'Hello from Net2APP!');
print_r($result);`,
  },
];

export default function ApiDocumentationPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span>
            </Link>
            <div className="hidden lg:flex items-center gap-1">
              <Link href="/" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Home</Link>
              <Link href="/pricing" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Pricing</Link>
              <Link href="/resources" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Resources</Link>
              <a href="#code-examples" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Code Examples</a>
            </div>
            <div className="flex items-center gap-3">
              <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started Free</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
            <span className="text-blue-200 text-sm font-medium">Complete API Reference</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
            API Documentation
            <span className="block text-blue-400">SMS • Voice OTP • WhatsApp • Telegram</span>
          </h1>
          <p className="text-lg text-blue-200 max-w-3xl mx-auto mb-10 leading-relaxed">
            Everything you need to integrate Net2APP into your application.{" "}
            <strong className="text-white">RESTful SMS API</strong>,{" "}
            <strong className="text-white">Voice OTP API</strong>,{" "}
            <strong className="text-white">WhatsApp & Telegram APIs</strong>,{" "}
            and <strong className="text-white">SMS Routing API</strong> — with code examples in Node.js, Python, and PHP.
          </p>
        </div>
      </section>

      {/* API Endpoints */}
      {apiEndpoints.map((category, ci) => (
        <section key={ci} className={`py-16 ${ci % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
          <div className="max-w-6xl mx-auto px-6 lg:px-12">
            <div className="flex items-center gap-3 mb-8">
              <span className="text-3xl">{category.icon}</span>
              <h2 className="text-2xl font-bold text-gray-900">{category.category}</h2>
            </div>
            <div className="space-y-3">
              {category.endpoints.map((ep, ei) => (
                <div key={ei} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition flex items-start gap-4">
                  <span className={`shrink-0 px-3 py-1 rounded-lg text-xs font-bold font-mono ${
                    ep.method === "GET" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {ep.method}
                  </span>
                  <div className="flex-1 min-w-0">
                    <code className="text-gray-900 font-mono text-sm font-semibold">{ep.path}</code>
                    <p className="text-gray-500 text-sm mt-1">{ep.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Authentication */}
      <section className="py-16 bg-slate-900">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Authentication & Security</h2>
            <p className="text-blue-300 text-lg">All APIs require authentication — choose the method that fits your security requirements</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {authMethods.map((auth, i) => (
              <div key={i} className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:border-blue-500/50 transition group">
                <h3 className="text-white font-semibold text-lg mb-2 group-hover:text-blue-300 transition">{auth.title}</h3>
                <p className="text-blue-300 text-sm mb-4 leading-relaxed">{auth.desc}</p>
                <pre className="bg-slate-800 rounded-xl p-4 text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">{auth.code}</pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Examples */}
      <section id="code-examples" className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Code Examples</h2>
            <p className="text-gray-500 text-lg">Send your first SMS in minutes with these quick-start code examples</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {codeExamples.map((ex, i) => (
              <div key={i} className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-gray-900 px-5 py-3 flex items-center justify-between">
                  <span className="text-white text-sm font-semibold">{ex.language}</span>
                  <span className="text-gray-400 text-xs">Quick Start</span>
                </div>
                <pre className="p-5 text-xs text-gray-700 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">{ex.code}</pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DLR & Webhooks */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">DLR & Webhook Integration</h2>
            <p className="text-gray-500 text-lg">Real-time message status updates via webhook callbacks</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h3 className="text-gray-900 font-semibold text-lg mb-4">DLR Status Codes</h3>
              <div className="space-y-2">
                {[
                  { code: "ENROUTE", desc: "Message accepted and queued for delivery", color: "bg-blue-100 text-blue-700" },
                  { code: "DELIVERED", desc: "Message successfully delivered to handset", color: "bg-green-100 text-green-700" },
                  { code: "UNDELIVERABLE", desc: "Message could not be delivered after retries", color: "bg-red-100 text-red-700" },
                  { code: "EXPIRED", desc: "Message TTL expired before delivery", color: "bg-amber-100 text-amber-700" },
                  { code: "REJECTED", desc: "Message rejected by carrier or supplier", color: "bg-red-100 text-red-700" },
                  { code: "DELETED", desc: "Message deleted from queue before sending", color: "bg-gray-100 text-gray-700" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`shrink-0 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold ${s.color}`}>{s.code}</span>
                    <span className="text-gray-600 text-sm">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h3 className="text-gray-900 font-semibold text-lg mb-4">Webhook Payload Format</h3>
              <pre className="bg-gray-900 rounded-xl p-4 text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">{`{
  "message_id": "msg_abc123",
  "status": "DELIVERED",
  "timestamp": "2025-01-15T10:30:00Z",
  "to": "+1234567890",
  "error_code": null,
  "error_description": null
}`}</pre>
              <p className="text-gray-500 text-sm mt-4">
                Configure your webhook URL in the Net2APP dashboard. Net2APP POSTs JSON payloads to your endpoint whenever message status changes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Start Building with Our APIs</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your SMS gateway in 60 seconds and get instant API access. All endpoints, all features — free to start.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="https://net2app.com" className="px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Free Now →</a>
            <Link href="/resources" className="px-10 py-4 border-2 border-white/40 text-white rounded-xl hover:bg-white/10 transition font-semibold text-lg">Resources Hub</Link>
          </div>
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
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <Link href="/pricing" className="text-blue-400 hover:text-white text-sm transition">Pricing</Link>
              <Link href="/resources" className="text-blue-400 hover:text-white text-sm transition">Resources</Link>
              <Link href="/api-documentation" className="text-blue-400 hover:text-white text-sm transition">API Docs</Link>
              <Link href="/case-studies" className="text-blue-400 hover:text-white text-sm transition">Case Studies</Link>
              <Link href="/comparisons" className="text-blue-400 hover:text-white text-sm transition">Comparisons</Link>
              <Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link>
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
