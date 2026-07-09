import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Voice OTP Service — Call-Based One-Time Password Delivery | Net2APP",
  description:
    "Net2APP Voice OTP delivers one-time passwords via phone call using Asterisk AMI integration. Supports 220+ countries with automatic MCC language detection, alphanumeric OTPs (A-Z, 0-9), and 3-retry call logic. Voice OTP API with SIP trunking.",
  keywords: [
    "Voice OTP", "Call OTP", "Voice Call OTP", "Phone Call OTP",
    "Asterisk AMI OTP", "Voice OTP API", "Voice Verification",
    "Two-Factor Authentication Voice", "2FA Voice Call",
    "OTP Over Phone", "Voice OTP Service", "Voice OTP Gateway",
    "Alphanumeric Voice OTP", "MCC Language Detection",
    "SIP Trunk OTP", "Voice OTP Bangladesh", "Voice OTP India",
    "Voice OTP UAE", "Voice OTP Middle East",
    "Programmable Voice OTP", "Cloud Voice OTP",
    "Voice OTP Platform", "Call-Based OTP Delivery",
  ],
  openGraph: {
    title: "Voice OTP Service — Call-Based OTP Delivery | Net2APP",
    description:
      "Deliver one-time passwords via phone call with automatic language detection across 220+ countries. Alphanumeric OTPs, 3-retry logic, Asterisk AMI integration.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/voice-otp#webpage",
      "url": "https://net2app.com/voice-otp",
      "name": "Voice OTP Service — Call-Based One-Time Password Delivery",
      "description":
        "Net2APP Voice OTP delivers one-time passwords via phone call. Supports 220+ countries, automatic MCC language detection, alphanumeric OTPs.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "Voice OTP", "item": "https://net2app.com/voice-otp" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/voice-otp#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is Voice OTP?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Voice OTP (One-Time Password) delivers authentication codes via an automated phone call instead of SMS. The call reads the OTP aloud using text-to-speech or pre-recorded audio, making it useful when SMS delivery is unreliable or for accessibility purposes. Net2APP Voice OTP supports 220+ countries with automatic language detection based on the destination MCC (Mobile Country Code).",
          },
        },
        {
          "@type": "Question",
          "name": "How does Net2APP Voice OTP work?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP Voice OTP uses Asterisk AMI (Asterisk Manager Interface) integration. When a Voice OTP request is made, the system detects the destination country from the phone number prefix (MCC), maps it to the local language using a database of 220+ countries, builds an audio playlist (greeting announcement + individual digit/letter audio files for the OTP), and originates a call with 3-retry logic. Alphanumeric OTPs (e.g. AB3X9) are fully supported with A-Z letter audio files.",
          },
        },
        {
          "@type": "Question",
          "name": "Does Voice OTP support alphanumeric codes?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Net2APP Voice OTP supports both numeric (0-9) and alphanumeric (A-Z, 0-9) one-time passwords. Each letter has a pre-recorded audio file, and the system dynamically builds a playlist concatenating the greeting audio with each character's audio file in sequence.",
          },
        },
        {
          "@type": "Question",
          "name": "What countries are supported for Voice OTP?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP Voice OTP supports 220+ countries with automatic MCC-based language detection. The system uses the Mobile Country Code (MCC) from the destination phone number to determine the appropriate language for the voice greeting and instructions. This enables localized Voice OTP delivery worldwide.",
          },
        },
        {
          "@type": "Question",
          "name": "Can I integrate Voice OTP via API?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Net2APP provides a RESTful HTTP API for Voice OTP integration. You can trigger Voice OTP calls programmatically, configure SIP trunking, set retry counts, and receive call status webhooks. The API supports authentication via API keys with IP whitelisting for security.",
          },
        },
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://net2app.com/voice-otp#app",
      "name": "Net2APP Voice OTP Service",
      "url": "https://net2app.com/voice-otp",
      "description": "Call-based one-time password delivery service with Asterisk AMI integration, 220+ country MCC language detection, alphanumeric OTP support (A-Z, 0-9), and 3-retry call logic.",
      "applicationCategory": "SecurityApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free to start. No setup fees. Pay-as-you-go Voice OTP pricing."
      },
      "featureList": [
        "220+ Country MCC-Based Automatic Language Detection",
        "Asterisk AMI Integration for Reliable Call Origination",
        "Alphanumeric OTP Support: A-Z Letters and 0-9 Digits",
        "3-Retry Call Logic with Configurable Intervals",
        "RESTful HTTP API for Voice OTP Integration",
        "SIP Trunk Configuration with Multi-Provider Failover",
        "Custom Audio Greetings in Multiple Languages",
        "Real-Time Call Logging and Analytics Dashboard",
        "Multi-Tenant Isolation with PostgreSQL Schema Separation",
        "Webhook Callbacks for Call Status and Delivery Events"
      ]
    },
  ],
};

export default function VoiceOTPPage() {
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
              <span className="text-blue-700 text-sm font-medium">Voice OTP Service — 220+ Countries</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
              Voice OTP API
              <span className="block bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Call-Based Authentication</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Deliver one-time passwords via automated phone calls with automatic language detection across 220+ countries.
              Net2APP Voice OTP integrates with <strong className="text-gray-900">Asterisk AMI</strong> for reliable call origination,
              supports <strong className="text-gray-900">alphanumeric OTPs</strong> (A-Z, 0-9), and includes
              built-in <strong className="text-gray-900">3-retry logic</strong> with full call logging.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="https://net2app.com"
                className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-lg shadow-sm text-center"
              >
                Deploy Voice OTP Free →
              </a>
              <Link
                href="/sms-routing"
                className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-semibold text-lg text-center"
              >
                Explore SMS Routing
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "220+", label: "Countries Supported", desc: "Automatic MCC language detection" },
              { value: "A-Z,0-9", label: "Alphanumeric OTPs", desc: "Full letter + digit support" },
              { value: "3x", label: "Retry Logic", desc: "Automatic call retry on failure" },
              { value: "Asterisk", label: "AMI Integration", desc: "Reliable call origination" },
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
            <h2 className="text-3xl font-bold text-gray-900 mb-3">How Voice OTP Works</h2>
            <p className="text-gray-500 text-lg">End-to-end Voice OTP delivery flow — from API request to phone call</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "API Request", desc: "Your application sends an HTTP POST request with the phone number and OTP value to the Net2APP Voice OTP API endpoint." },
              { step: "2", title: "Language Detection", desc: "The system extracts the MCC (Mobile Country Code) from the destination number, maps it to the local language from a 220+ country database." },
              { step: "3", title: "Audio Assembly", desc: "An audio playlist is dynamically built: greeting audio in the detected language, followed by individual audio clips for each character of the OTP (digits and letters)." },
              { step: "4", title: "Call Origination", desc: "Asterisk AMI originates the call to the destination number. On no-answer or failure, the system retries up to 3 times with configurable intervals." },
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
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Voice OTP Features</h2>
            <p className="text-gray-500 text-lg">Enterprise-grade Voice OTP infrastructure for global authentication</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "MCC Language Detection", desc: "Automatic country-to-language mapping using a database of 220+ Mobile Country Codes. Supports local language voice greetings for better user comprehension." },
              { title: "Alphanumeric OTP Support", desc: "Full support for A-Z letters and 0-9 digits. Each character has a pre-recorded audio file. The system dynamically builds the playback sequence for any OTP value." },
              { title: "Asterisk AMI Integration", desc: "Deep integration with Asterisk Manager Interface for reliable call origination. Supports SIP trunking, call progress detection, and call detail recording." },
              { title: "3-Retry Call Logic", desc: "Automatic retry on busy signals, no-answer, or failed calls. Configurable retry count, interval, and timeout settings per Voice OTP request." },
              { title: "Call Logging & Analytics", desc: "Full call logs with status, duration, retry count, and timestamps. Real-time Voice OTP call monitoring via the Net2APP dashboard." },
              { title: "RESTful Voice OTP API", desc: "Simple HTTP API for Voice OTP integration. Trigger calls, check status, configure SIP settings, and receive webhook callbacks for delivery events." },
              { title: "SIP Trunk Support", desc: "Connect your own SIP trunk or use Net2APP's built-in SIP configuration. Configure multiple SIP providers with failover for high availability." },
              { title: "Custom Audio Greetings", desc: "Upload custom greeting audio files in multiple languages. Per-language greetings can be configured from the super admin panel." },
              { title: "Multi-Tenant Isolation", desc: "Each tenant has isolated Voice OTP configuration, call logs, and audio files. PostgreSQL schema-based data separation ensures complete privacy." },
            ].map((f, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition group">
                <h3 className="text-gray-900 font-semibold text-lg mb-2 group-hover:text-blue-600 transition">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Voice OTP Use Cases</h2>
            <p className="text-gray-500">Where Voice OTP delivers the most value</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "User Authentication", desc: "Deliver OTPs for user login, account registration, and password reset flows. Voice OTP provides a reliable fallback when SMS delivery fails or is delayed." },
              { title: "Transaction Verification", desc: "Verify high-value financial transactions, wire transfers, and payment approvals with a phone call that reads the verification code aloud." },
              { title: "Account Recovery", desc: "Help users recover access to their accounts with voice-based identity verification. Works even when SMS is unavailable or the user has changed their SIM card." },
              { title: "Two-Factor Authentication (2FA)", desc: "Add an extra layer of security to your applications with voice-based 2FA. Users receive OTPs via phone call as a second authentication factor." },
              { title: "Accessibility Solutions", desc: "Voice OTP serves users with visual impairments or reading difficulties who may struggle with text-based OTP delivery methods like SMS or email." },
              { title: "High-Security Environments", desc: "For banking, government, and healthcare applications where SMS-based OTP is considered less secure due to SIM-swap attacks and SS7 vulnerabilities." },
            ].map((u, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-gray-900 font-semibold text-lg mb-3">{u.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{u.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Voice OTP — Frequently Asked Questions</h2>
            <p className="text-gray-500">Everything you need to know about Voice OTP service</p>
          </div>
          <div className="space-y-4">
            {[
              { q: "What is the difference between Voice OTP and SMS OTP?", a: "Voice OTP delivers the one-time password via an automated phone call rather than an SMS text message. Voice OTP is useful when SMS delivery is unreliable (e.g., in regions with poor SMS infrastructure), for accessibility purposes (users with visual impairments), or as a security measure against SIM-swap attacks and SS7 vulnerabilities that can intercept SMS messages." },
              { q: "How does language detection work for Voice OTP calls?", a: "Net2APP Voice OTP extracts the MCC (Mobile Country Code) from the destination phone number's country code prefix. It then maps this MCC to the most common language for that country using a database of 220+ countries. For example, a Bangladeshi number (+880) will receive the OTP in Bengali, while an Indian number (+91) will receive it in Hindi or English based on configuration." },
              { q: "Can I use my own SIP trunk for Voice OTP?", a: "Yes. Net2APP Voice OTP supports custom SIP trunk configuration. You can connect your own SIP provider for call origination. The system supports multiple SIP providers with failover routing for high availability. SIP settings are configurable from the Voice OTP SIP configuration panel." },
              { q: "What happens if the call is not answered?", a: "Net2APP Voice OTP includes automatic retry logic. If a call is not answered, the line is busy, or the call fails, the system will automatically retry up to 3 times with configurable intervals between attempts. The retry count and interval can be customized per request." },
              { q: "How do I integrate Voice OTP into my application?", a: "Net2APP provides a RESTful HTTP API for Voice OTP integration. You send a POST request with the destination phone number and OTP value. The API authenticates using API keys with optional IP whitelisting. Integration guides and code examples are available in the documentation." },
              { q: "Is Voice OTP more secure than SMS OTP?", a: "Voice OTP is generally considered more secure than SMS OTP because it is not vulnerable to SS7 signaling attacks or SIM-swap attacks that can intercept SMS messages. Voice-based delivery adds an additional layer of security for high-value transactions and sensitive authentication flows." },
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
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Deploy Voice OTP in 60 Seconds</h2>
          <p className="text-blue-100 text-lg mb-8">No setup fees, no hidden fees. Deploy your Voice OTP service with Asterisk AMI integration, 220+ country support, and alphanumeric OTP delivery.</p>
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
              <Link href="/http-sms-api" className="text-blue-400 hover:text-white text-sm transition">HTTP SMS API</Link>
              <Link href="/sms-routing" className="text-blue-400 hover:text-white text-sm transition">SMS Routing</Link>
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

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
