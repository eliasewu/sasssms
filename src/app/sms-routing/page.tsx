import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SMS Routing — Multi-Layer Intelligent SMS Routing Engine | Net2APP",
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
    title: "SMS Routing — Multi-Layer Intelligent Routing Engine | Net2APP",
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
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is the SMS routing architecture?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP uses a multi-layer SMS routing architecture: Route Plans → Routes → Trunks → Suppliers. A Route Plan contains one or more Routes, each Route contains one or more Trunks, and each Trunk connects to a Supplier. When a message is sent, the system evaluates the Route Plan, selects the Route, sends through the Trunk to the Supplier, and tracks the DLR (Delivery Report) back through the same path. This architecture provides maximum flexibility and redundancy.",
          },
        },
        {
          "@type": "Question",
          "name": "How does SMS failover routing work?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "SMS failover routing works on multiple levels: (1) Within a Route, Trunks are ordered by priority. If the highest-priority Trunk fails, the next Trunk is tried automatically. (2) If all Trunks in a Route fail, the next Route in the Route Plan is tried. (3) If all Routes fail, the message is queued for retry or returned as undelivered. Failover decisions are based on supplier response, DLR timeout, and connection status.",
          },
        },
        {
          "@type": "Question",
          "name": "What are Route Plans, Routes, Trunks, and Suppliers?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Route Plan: A named plan that groups Routes together and defines overall routing strategy. Routes: Ordered list of routing paths within a plan, each with a priority. Trunks: Connection definitions that specify how to connect to a specific Supplier — protocol (SMPP, HTTP), credentials (username, password, system_id), TPS limits, and bind mode (transmitter, receiver, transceiver). Suppliers: The actual SMS provider or aggregator endpoints that deliver messages to mobile networks.",
          },
        },
        {
          "@type": "Question",
          "name": "How does DLR tracking work in SMS routing?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "DLR (Delivery Report) tracking follows the reverse path of message delivery. When a mobile network sends a delivery confirmation, it flows: Supplier → Trunk → Route → Route Plan → Client (via HTTP webhook or SMPP ESME). Each message has a unique ID that correlates the DLR back to the original message. DLR status codes include DELIVERED, UNDELIVERABLE, EXPIRED, REJECTED, ENROUTE, and more.",
          },
        },
        {
          "@type": "Question",
          "name": "Can I create custom Route Plans for different clients?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Each tenant (client) can have their own Route Plans with different Routes, Trunks, and Suppliers. This allows per-client routing strategies optimized for their specific destinations, volume, and quality requirements. Sub-clients can also be assigned individual routes, providing granular traffic management.",
          },
        },
      ],
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
            {[
              { value: "4-Layer", label: "Routing Architecture", desc: "Plan → Route → Trunk → Supplier" },
              { value: "Auto", label: "Failover Routing", desc: "Automatic failover on failure" },
              { value: "DLR", label: "Delivery Tracking", desc: "End-to-end DLR correlation" },
              { value: "Multi", label: "Connection Types", desc: "SMPP, HTTP, RCS, OTT, Voice" },
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

      {/* Architecture Flow */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">SMS Routing Architecture</h2>
            <p className="text-gray-500 text-lg">Complete message flow from client to mobile operator and back</p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8 mb-8">
            <div className="flex flex-wrap items-center justify-center gap-3 lg:gap-4 text-sm lg:text-base mb-8">
              {["Client", "→", "Route Plan", "→", "Routes", "→", "Trunks", "→", "Suppliers", "→", "Mobile"].map((s, i) =>
                s === "→" ? <span key={i} className="text-blue-400 text-2xl font-bold">→</span> :
                <span key={i} className="bg-blue-600 px-4 lg:px-6 py-2 lg:py-3 rounded-xl text-white font-medium shadow-sm">{s}</span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { name: "Client", desc: "HTTP API, SMPP ESME, Dashboard" },
                { name: "Route Plan", desc: "Routing strategy & grouping" },
                { name: "Routes", desc: "Priority-ordered paths" },
                { name: "Trunks", desc: "Connection configurations" },
                { name: "Suppliers", desc: "SMS providers & aggregators" },
              ].map((r, i) => (
                <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                  <p className="text-gray-900 font-bold text-lg">{r.name}</p>
                  <p className="text-gray-500 text-xs mt-1">{r.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-6 text-center">
              <p className="text-amber-700 text-sm"><strong>DLR Flow (Reverse):</strong> Mobile → Supplier → Trunks → Routes → Route Plan → Client (HTTP/ESME Push)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Layers Explained */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Each Layer Explained</h2>
            <p className="text-gray-500 text-lg">Complete control at every stage of SMS delivery</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: "Route Plans", icon: "📋",
                features: [
                  "Named routing strategies that group Routes together",
                  "Assign plans to specific clients or sub-clients",
                  "Enable/disable plans without affecting other configurations",
                  "Per-plan monitoring and analytics",
                ],
              },
              {
                title: "Routes", icon: "🛤️",
                features: [
                  "Ordered list of routing paths within a plan",
                  "Priority-based selection — highest priority tried first",
                  "Automatic failover to next route on failure",
                  "Route-specific TPS and volume configuration",
                ],
              },
              {
                title: "Trunks", icon: "🔌",
                features: [
                  "Connection definitions — SMPP v3.4, HTTP, or custom protocols",
                  "Credentials: host, port, username, password, system_id",
                  "Bind mode: transmitter, receiver, or transceiver",
                  "TPS limits, connection pooling, and keep-alive settings",
                ],
              },
              {
                title: "Suppliers", icon: "🏭",
                features: [
                  "SMS provider endpoints that deliver to mobile networks",
                  "80+ pre-configured connector templates included",
                  "Support for Reve SMS, 5GVision, LRS, Al Muqeet, and more",
                  "Supplier-specific rate configuration and billing",
                ],
              },
            ].map((layer, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition group">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{layer.icon}</span>
                  <h3 className="text-gray-900 font-bold text-xl group-hover:text-blue-600 transition">{layer.title}</h3>
                </div>
                <ul className="space-y-2">
                  {layer.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-blue-300 text-sm">
                      <span className="text-blue-500 mt-0.5">◆</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Provider Connectors */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">80+ Pre-Built Connectors</h2>
            <p className="text-gray-500 text-lg">Ready-to-use SMS provider connectors for instant setup</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              "Reve SMS", "5GVision", "LRS", "Al Muqeet", "Vonage",
              "Plivo", "MessageBird", "ClickSend", "Infobip", "Sinch", "Telesign",
              "TextLocal", "AWS SNS",              "SMSAPI", "Kannel", "PlaySMS",
              "BulkSMS", "SMSGlobal", "CM.com", "Routee", "Mitto", "Vibes",
              "SMS Country", "SMS Discount", "VoodooSMS", "SMS4Connect",
              "Bangladesh SMS", "India SMS", "UAE SMS", "Saudi SMS",
            ].map((p, i) => (
              <span key={i} className="bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-gray-700 text-sm font-medium text-center hover:border-blue-200 hover:shadow-sm transition shadow-sm">{p}</span>
            ))}
          </div>
          <p className="text-gray-500 text-sm text-center mt-6">And many more — add custom connectors for any SMPP or HTTP SMS provider</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">SMS Routing Features</h2>
            <p className="text-gray-500 text-lg">Enterprise routing capabilities</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Priority-Based Routing", desc: "Routes are evaluated in priority order. The highest-priority route is tried first, with automatic fallback to lower-priority routes on failure." },
              { title: "Auto Failover", desc: "Automatic failover at every layer — Trunk fails → try next Trunk. Route fails → try next Route. All Routes fail → queue or return undelivered." },
              { title: "DLR Correlation", desc: "End-to-end DLR tracking with unique message IDs that correlate delivery reports back to original messages through the entire routing chain." },
              { title: "Per-Route TPS Control", desc: "Configure transactions-per-second (TPS) limits per route, trunk, and supplier. Prevent supplier throttling and manage traffic distribution." },
              { title: "Multi-Protocol Support", desc: "Routes and trunks support SMPP v3.4, HTTP REST API, RCS, and custom protocols. Mix and match protocols within a single Route Plan." },
              { title: "Client-Specific Plans", desc: "Assign different Route Plans to different clients and sub-clients. Granular routing strategy per customer with independent supplier configurations." },
              { title: "Bind Status Monitoring", desc: "Real-time SMPP bind status monitoring for all connected suppliers. View transmitter, receiver, and transceiver bind states from the dashboard." },
              { title: "Route Map Configuration", desc: "Visual route map interface showing the complete routing topology. Configure per-country routing, prefix-based routing, and default routes." },
              { title: "Real-Time Analytics", desc: "Monitor SMS delivery rates, response times, failover events, and supplier performance per route, trunk, and supplier in real-time." },
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
            <h2 className="text-3xl font-bold text-gray-900 mb-3">SMS Routing — FAQ</h2>
            <p className="text-gray-500">Common questions about multi-layer SMS routing</p>
          </div>
          <div className="space-y-4">
            {[
              { q: "How do I set up a new Route Plan?", a: "From the Net2APP dashboard, go to Route Plans → Add New Plan. Give your plan a name, then add Routes with priority ordering. For each Route, configure Trunks with supplier connections. Finally, assign the Route Plan to a client. The entire setup takes minutes and changes take effect immediately." },
              { q: "What happens when a supplier goes down?", a: "The SMS routing engine automatically detects supplier failure through connection monitoring and DLR timeouts. It then fails over to the next available Trunk in the Route. If all Trunks in a Route fail, it moves to the next Route in the Plan. This failover happens in real-time without manual intervention." },
              { q: "Can I route messages based on destination country?", a: "Yes. Net2APP supports prefix-based routing and country-specific route maps. You can configure different Routes for different country prefixes, allowing optimal supplier selection per destination. For example, route Bangladesh traffic through one supplier and India traffic through another." },
              { q: "How long does failover take?", a: "Failover is nearly instant. The system monitors supplier connections via SMPP bind status and HTTP response times. When a supplier fails to respond within the configured timeout (typically 2-5 seconds), the next Trunk is tried immediately. Failover at the Route level is similarly fast." },
              { q: "Can I test routing before going live?", a: "Yes. Net2APP provides test SMS functionality and a route testing interface. You can send test messages through specific routes to verify delivery, check DLR responses, and validate supplier configurations before assigning routes to production clients." },
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
