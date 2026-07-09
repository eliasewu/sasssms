import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "IP Whitelisting — API Security & Access Control | Net2APP",
  description:
    "Net2APP IP whitelisting provides API security with IP-based access control. Restrict API access to trusted IP addresses only. Supports IPv4, CIDR notation, per-API-key whitelists, and real-time IP management from the dashboard. Secure your SMS gateway, Voice OTP, and Business API endpoints.",
  keywords: [
    "IP Whitelisting", "IP Allowlisting", "API Security",
    "IP-based Access Control", "SMS API Security",
    "IP Restriction", "IP Filtering", "CIDR Whitelist",
    "IPv4 Whitelist", "API Key Security",
    "SMS Gateway Security", "Secure SMS API",
    "Voice OTP Security", "Business API Security",
    "IP Access Management", "Network Security",
    "SMS Platform Security", "Multi-Tenant API Security",
    "IP Whitelist API", "Restrict API Access",
    "Secure HTTP SMS API", "Firewall SMS Gateway",
    "API Authentication", "IP Validation",
  ],
  openGraph: {
    title: "IP Whitelisting — API Security & Access Control | Net2APP",
    description:
      "Secure your SMS gateway API with IP whitelisting. Restrict access to trusted IPs. Supports IPv4, CIDR, and per-key whitelists.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/ip-whitelisting#webpage",
      "url": "https://net2app.com/ip-whitelisting",
      "name": "IP Whitelisting — API Security & Access Control",
      "description":
        "Secure your Net2APP API endpoints with IP whitelisting. Restrict access to trusted IP addresses. IPv4, CIDR, and per-API-key support.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "IP Whitelisting", "item": "https://net2app.com/ip-whitelisting" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/ip-whitelisting#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is IP whitelisting?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "IP whitelisting (also called IP allowlisting) is a security mechanism that restricts API access to a predefined set of trusted IP addresses. Any request originating from an IP address not on the whitelist is automatically rejected. This provides an additional layer of security beyond API key authentication, ensuring that even if an API key is compromised, it cannot be used from unauthorized network locations.",
          },
        },
        {
          "@type": "Question",
          "name": "How does IP whitelisting work on Net2APP?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP validates the source IP address of every API request against the tenant's configured IP whitelist. The whitelist supports individual IPv4 addresses (e.g., 203.0.113.1) and CIDR notation ranges (e.g., 203.0.113.0/24). Requests from whitelisted IPs are processed normally. Requests from non-whitelisted IPs receive a 403 Forbidden response. IP whitelists are configurable per API key from the dashboard or via the IP whitelist API.",
          },
        },
        {
          "@type": "Question",
          "name": "Can IP whitelisting be used with all APIs?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. IP whitelisting is available for all Net2APP API endpoints including the HTTP SMS API, Voice OTP API, Business API (WhatsApp and Telegram), SMPP gateway, and all RESTful API endpoints. IP whitelisting can be configured per API key, providing granular access control for different integration scenarios.",
          },
        },
        {
          "@type": "Question",
          "name": "Does IP whitelisting support IPv6?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Currently, Net2APP IP whitelisting supports IPv4 addresses and IPv4 CIDR notation ranges. IPv6 support is planned for a future release. For hybrid environments, we recommend using a static IPv4 address or a network gateway with consistent outbound IP for API access.",
          },
        },
        {
          "@type": "Question",
          "name": "How do I configure IP whitelisting?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "IP whitelisting is configured from the Net2APP dashboard under the IP List or API Security section. You can add, edit, and remove IP addresses and CIDR ranges. Changes take effect immediately. You can also use the IP whitelist REST API to manage whitelist entries programmatically.",
          },
        },
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://net2app.com/ip-whitelisting#app",
      "name": "Net2APP IP Whitelisting Security",
      "url": "https://net2app.com/ip-whitelisting",
      "description": "API security with IP-based access control. Restrict API access to trusted IPv4 addresses and CIDR ranges with per-API-key whitelists and real-time management.",
      "applicationCategory": "SecurityApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free to start. No setup fees. Included with all Net2APP plans."
      },
      "featureList": [
        "IPv4 Address Whitelisting with Exact Match Support",
        "CIDR Notation Range Whitelisting (e.g., 192.168.1.0/24)",
        "Per-API-Key Whitelist Configuration for Granular Control",
        "Real-Time Whitelist Updates Without Service Interruption",
        "403 Forbidden Response for Non-Whitelisted IPs",
        "Dashboard and REST API Management of Whitelist Entries",
        "Multi-Tenant Isolation with Independent IP Whitelists",
        "Defense in Depth: IP Whitelisting + API Key + Rate Limiting",
        "Audit Logging of Blocked Requests and Access Attempts",
        "SMPP Gateway IP Whitelisting at Network Level"
      ]
    },
  ],
};

export default function IpWhitelistingPage() {
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
              <span className="text-blue-700 text-sm font-medium">API Security — IP Access Control</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
              IP Whitelisting
              <span className="block bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">API Security & Access Control</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Restrict API access to <strong className="text-gray-900">trusted IP addresses only</strong>.
              Net2APP IP whitelisting provides an <strong className="text-gray-900">additional layer of security</strong> beyond API key authentication.
              Supports <strong className="text-gray-900">IPv4 addresses</strong>, <strong className="text-gray-900">CIDR notation</strong> ranges,
              and <strong className="text-gray-900">per-API-key whitelist</strong> configuration.
              Manage whitelist entries from the dashboard or via the REST API.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="https://net2app.com" className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-lg shadow-sm text-center">
                Deploy Secure API Free →
              </a>
              <Link href="/http-sms-api" className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-semibold text-lg text-center">
                HTTP SMS API
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "IPv4", label: "IP Support", desc: "Individual IPs & CIDR ranges" },
              { value: "403", label: "Auto Reject", desc: "Non-whitelisted IPs blocked" },
              { value: "Per-Key", label: "Granular Control", desc: "Different keys, different IPs" },
              { value: "Real-time", label: "Instant Updates", desc: "Changes take effect immediately" },
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

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">How IP Whitelisting Works</h2>
            <p className="text-gray-500 text-lg">Simple, effective API access control</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Add IP Addresses", desc: "From the dashboard, add trusted IP addresses or CIDR ranges (e.g., 203.0.113.0/24) to your whitelist. Multiple IPs can be added per API key." },
              { step: "2", title: "API Request Arrives", desc: "When an API request arrives, Net2APP extracts the source IP address from the request headers. This is the client's public IP address." },
              { step: "3", title: "IP Validation", desc: "The source IP is checked against all entries in the tenant's IP whitelist. The validation supports exact IP matching and CIDR range matching." },
              { step: "4", title: "Allow or Block", desc: "If the source IP matches a whitelist entry, the request proceeds to API key authentication and processing. If not, a 403 Forbidden response is returned immediately." },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 relative shadow-sm">
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">{s.step}</div>
                <h3 className="text-gray-900 font-semibold text-lg mb-3 mt-2">{s.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">IP Whitelisting Features</h2>
            <p className="text-gray-500 text-lg">Enterprise-grade API security for your SMS platform</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "IPv4 Address Support", desc: "Whitelist individual IPv4 addresses for precise access control. Each IP address is independently validated on every API request." },
              { title: "CIDR Notation Ranges", desc: "Whitelist entire IP ranges using CIDR notation (e.g., 192.168.1.0/24). Useful for organizations with dynamic IP pools or cloud-hosted applications." },
              { title: "Per-API-Key Whitelisting", desc: "Each API key can have its own IP whitelist. Different keys for different applications or environments, each with appropriate IP restrictions." },
              { title: "Real-Time Updates", desc: "IP whitelist changes take effect immediately. Add, edit, or remove IP addresses without service interruption or API key rotation." },
              { title: "Dashboard Management", desc: "Full IP whitelist management from the Net2APP dashboard. View all entries, add new ones, and remove old ones with a simple interface." },
              { title: "REST API for IP Management", desc: "Programmatically manage IP whitelist entries via REST API. Add, list, and delete IP addresses from your applications or CI/CD pipeline." },
              { title: "403 Forbidden Response", desc: "Non-whitelisted requests receive a clear 403 Forbidden response with an error message indicating the IP address was not in the whitelist." },
              { title: "Multi-Tenant Isolation", desc: "Each tenant has an independent IP whitelist. No cross-tenant access possible. PostgreSQL schema isolation ensures complete data separation." },
              { title: "Security Best Practice", desc: "IP whitelisting is a fundamental security best practice for API endpoints. Combined with API key authentication, it provides defense in depth against unauthorized access." },
            ].map((f, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition group">
                <h3 className="text-gray-900 font-semibold text-lg mb-2 group-hover:text-blue-600 transition">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Architecture */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">API Security Architecture</h2>
            <p className="text-gray-500">Multi-layer security for your SMS gateway</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: "🛡️", title: "Layer 1 — IP Whitelisting", desc: "First line of defense. Only requests from trusted IP addresses are allowed to proceed to authentication. All other requests receive an immediate 403 response." },
              { icon: "🔑", title: "Layer 2 — API Key Auth", desc: "Second line of defense. Each request must include a valid API key. Keys can be rotated and revoked independently per tenant and per application." },
              { icon: "⚡", title: "Layer 3 — Rate Limiting", desc: "Third line of defense. Configurable rate limits per API key and per tenant prevent abuse and ensure fair resource allocation." },
            ].map((l, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <div className="text-4xl mb-4">{l.icon}</div>
                <h3 className="text-gray-900 font-semibold text-lg mb-3">{l.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{l.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">IP Whitelisting — FAQ</h2>
            <p className="text-gray-500">Common questions about IP-based access control</p>
          </div>
          <div className="space-y-4">
            {[
              { q: "Is IP whitelisting required or optional?", a: "IP whitelisting is optional but strongly recommended for production API integrations. It provides an additional security layer beyond API key authentication. You can enable it per API key from the dashboard and add trusted IP addresses as needed." },
              { q: "What happens if my IP address changes?", a: "If your IP address changes and is no longer in the whitelist, API requests will receive a 403 Forbidden response. To prevent service disruption, you can: (1) Use CIDR ranges to cover a pool of IPs, (2) Keep a fallback API key without IP restriction for emergencies, or (3) Update the whitelist via the API before the IP change." },
              { q: "Can I use IP whitelisting with the SMPP gateway?", a: "Yes. IP whitelisting extends to all Net2APP services including the SMPP v3.4 gateway. SMPP bind requests from non-whitelisted IPs are rejected at the network level before any SMPP protocol negotiation begins." },
              { q: "How do I know if an IP whitelist request was blocked?", a: "Blocked requests receive a 403 Forbidden HTTP response with a JSON error body indicating the reason. Additionally, failed authentication attempts (including IP whitelist rejections) can be viewed in the dashboard audit log." },
              { q: "Can I have different whitelists for different API keys?", a: "Yes. Each API key can have its own independent IP whitelist. This allows granular access control — for example, a production API key restricted to your application servers, a development key restricted to your office IP range, and an emergency key with no IP restriction." },
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
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Secure Your API with IP Whitelisting — Free</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your secure SMS gateway with IP whitelisting, API key authentication, and rate limiting. No setup fees. Enterprise-grade security for your SMS infrastructure.</p>
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
              <Link href="/sms-routing" className="text-blue-400 hover:text-white text-sm transition">SMS Routing</Link>
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
