"use client";

import Link from "next/link";
import { useState } from "react";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/contact#webpage",
      "url": "https://net2app.com/contact",
      "name": "Contact Us — Net2APP",
      "description": "Get in touch with Net2APP for SMS gateway inquiries, Voice OTP questions, and support.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "Contact", "item": "https://net2app.com/contact" },
        ],
      },
    },
    {
      "@type": "ContactPage",
      "@id": "https://net2app.com/contact#contact",
      "url": "https://net2app.com/contact",
      "mainEntity": {
        "@type": "Organization",
        "name": "Net2APP",
        "email": "info@net2app.com",
        "address": { "@type": "PostalAddress", "addressCountry": "AE" },
      },
    },
  ],
};

export default function ContactPage() {
  const [showFeatures, setShowFeatures] = useState(false);
  const [showMobile, setShowMobile] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Something went wrong. Please try again.");
        return;
      }
      setStatus("success");
      setFormData({ name: "", email: "", phone: "", company: "", subject: "", message: "" });
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please check your connection and try again.");
    }
  };

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
              <Link href="/solutions" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Solutions</Link>
              <div className="relative">
                <button onClick={() => setShowFeatures(!showFeatures)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition ${showFeatures ? "text-blue-600 bg-blue-50" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`}>Features ▾</button>
                {showFeatures && (
                  <div className="absolute top-full left-0 mt-1 w-[200px] bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-50">
                    <div className="space-y-1">
                      {[
                        { name: "Voice OTP", href: "/voice-otp", icon: "📞" },
                        { name: "HTTP SMS API", href: "/http-sms-api", icon: "🌐" },
                        { name: "SMS Routing", href: "/sms-routing", icon: "🔀" },
                        { name: "WhatsApp & Telegram", href: "/whatsapp-telegram-api", icon: "💬" },
                        { name: "IP Whitelisting", href: "/ip-whitelisting", icon: "🛡️" },
                        { name: "OTT Pairing", href: "/ott-pairing", icon: "🔗" },
                      ].map((f) => (
                        <Link key={f.name} href={f.href} className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" onClick={() => setShowFeatures(false)}>
                          <span className="text-base">{f.icon}</span>
                          <span>{f.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/" className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Deploy Free</Link>
              <Link href="/contact" className="hidden sm:inline-flex px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</Link>
              <button onClick={() => setShowMobile(!showMobile)} className="lg:hidden p-2 text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showMobile ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
              </button>
            </div>
          </div>
        </div>
        {/* Mobile Menu */}
        {showMobile && (
          <div className="lg:hidden pb-6 border-t border-gray-200 pt-4 space-y-3">
            <Link href="/" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2" onClick={() => setShowMobile(false)}>Home</Link>
            <Link href="/solutions" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2" onClick={() => setShowMobile(false)}>Solutions</Link>
            <div className="border-t border-gray-200 pt-3 mt-1">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2 px-1">Features</p>
              <div className="space-y-1">
                {[
                  { name: "Voice OTP", href: "/voice-otp", icon: "📞" },
                  { name: "HTTP SMS API", href: "/http-sms-api", icon: "🌐" },
                  { name: "SMS Routing", href: "/sms-routing", icon: "🔀" },
                  { name: "WhatsApp & Telegram", href: "/whatsapp-telegram-api", icon: "💬" },
                  { name: "IP Whitelisting", href: "/ip-whitelisting", icon: "🛡️" },
                  { name: "OTT Pairing", href: "/ott-pairing", icon: "🔗" },
                ].map((f) => (
                  <Link key={f.name} href={f.href} className="flex items-center gap-2 px-1 py-1.5 text-sm text-gray-600 hover:text-blue-600 transition" onClick={() => setShowMobile(false)}>
                    <span>{f.icon}</span>
                    <span>{f.name}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="pt-2"><Link href="/contact" className="block w-full text-center px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition" onClick={() => setShowMobile(false)}>Get Started</Link></div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 border border-blue-200 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            <span className="text-blue-700 text-sm font-medium">We're Here to Help — 24/7 Support</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Contact Us
            <span className="block text-blue-600">Get in Touch with Net2APP</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Have questions about our SMS gateway, Voice OTP, or Business API? Need help with setup or partnership inquiries?
            Fill out the form and our team will respond within <strong className="text-gray-900">24 hours</strong>.
          </p>
        </div>
      </section>

      {/* Contact Form Area */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Contact Info Cards */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="text-3xl mb-3">📧</div>
              <h3 className="text-gray-900 font-semibold mb-1">Email Us</h3>
              <p className="text-gray-500 text-sm mb-2">Send us an email anytime</p>
              <a href="mailto:info@net2app.com" className="text-blue-600 hover:text-blue-700 text-sm font-medium transition">info@net2app.com</a>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="text-3xl mb-3">💬</div>
              <h3 className="text-gray-900 font-semibold mb-1">Live Chat</h3>
              <p className="text-gray-500 text-sm mb-2">Chat with our team in real-time</p>
              <p className="text-blue-600 text-sm">Available via dashboard</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="text-3xl mb-3">🌍</div>
              <h3 className="text-gray-900 font-semibold mb-1">Location</h3>
              <p className="text-gray-500 text-sm">Tri Angle Trade Centre FZE LLC</p>
              <p className="text-gray-500 text-sm">United Arab Emirates</p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
            {status === "success" ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Message Sent!</h2>
                <p className="text-gray-600 mb-6">Thank you! We've received your message and will get back to you within 24 hours.</p>
                <button
                  onClick={() => setStatus("idle")}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1.5">Full Name *</label>
                    <input
                      type="text" name="name" required value={formData.name} onChange={handleChange}
                      placeholder="John Doe"
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1.5">Email Address *</label>
                    <input
                      type="email" name="email" required value={formData.email} onChange={handleChange}
                      placeholder="john@example.com"
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1.5">Phone Number</label>
                    <input
                      type="tel" name="phone" value={formData.phone} onChange={handleChange}
                      placeholder="+1 234 567 890"
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-1.5">Company</label>
                    <input
                      type="text" name="company" value={formData.company} onChange={handleChange}
                      placeholder="Your Company Ltd."
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1.5">Subject *</label>
                  <select
                    name="subject" required value={formData.subject} onChange={handleChange}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition appearance-none"
                  >
                    <option value="" disabled>Select a subject</option>
                    <option value="Sales Inquiry">Sales Inquiry</option>
                    <option value="Technical Support">Technical Support</option>
                    <option value="Partnership">Partnership Opportunity</option>
                    <option value="Billing Question">Billing Question</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1.5">Message *</label>
                  <textarea
                    name="message" required value={formData.message} onChange={handleChange}
                    rows={6}
                    placeholder="Tell us how we can help you..."
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-y"
                  />
                  <p className="text-gray-400 text-xs mt-1">{formData.message.length}/5000 characters</p>
                </div>

                {status === "error" && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                    {errorMsg}
                    <br />
                    <span className="text-xs">You can also email us directly at <a href="mailto:info@net2app.com" className="underline font-medium">info@net2app.com</a></span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-lg shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {status === "sending" ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Sending...
                    </>
                  ) : (
                    <>Send Message →</>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Support Info */}
      <section className="py-16 bg-gray-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Prefer Direct Email?</h2>
          <p className="text-gray-600 mb-6">You can reach us directly at any of these addresses</p>
          <div className="flex flex-wrap justify-center gap-6">
            <div className="bg-white border border-gray-100 rounded-xl px-6 py-4 shadow-sm">
              <p className="text-gray-500 text-xs mb-1">General Inquiries</p>
              <a href="mailto:info@net2app.com" className="text-gray-900 font-medium hover:text-blue-600 transition">info@net2app.com</a>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-6 py-4 shadow-sm">
              <p className="text-gray-500 text-xs mb-1">Technical Support</p>
              <a href="mailto:support@net2app.com" className="text-gray-900 font-medium hover:text-blue-600 transition">support@net2app.com</a>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-6 py-4 shadow-sm">
              <p className="text-gray-500 text-xs mb-1">Sales</p>
              <a href="mailto:sales@net2app.com" className="text-gray-900 font-medium hover:text-blue-600 transition">sales@net2app.com</a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your own SMS gateway platform in under 60 seconds. No setup fees, no hidden fees — just pay for SMS sent.</p>
          <Link href="/" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div>
                <span className="text-white font-semibold text-lg">Net2APP</span>
              </Link>
              <p className="text-gray-400 text-sm max-w-md leading-relaxed">Enterprise SMS Gateway & Voice OTP Platform. Multi-tenant SaaS with SMPP, HTTP API, RCS, Voice OTP, and OTT messaging.</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Products</p>
              <div className="space-y-2.5">
                <Link href="/voice-otp" className="block text-sm text-gray-400 hover:text-white transition">Voice OTP</Link>
                <Link href="/http-sms-api" className="block text-sm text-gray-400 hover:text-white transition">HTTP SMS API</Link>
                <Link href="/sms-routing" className="block text-sm text-gray-400 hover:text-white transition">SMS Routing</Link>
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Company</p>
              <div className="space-y-2.5">
                <Link href="/solutions" className="block text-sm text-gray-400 hover:text-white transition">Solutions</Link>
                <Link href="/solutions/startup" className="block text-sm text-gray-400 hover:text-white transition">Startup</Link>
                <Link href="/solutions/enterprise" className="block text-sm text-gray-400 hover:text-white transition">Enterprise</Link>
                <Link href="/case-studies" className="block text-sm text-gray-400 hover:text-white transition">Case Studies</Link>
                <Link href="/comparisons" className="block text-sm text-gray-400 hover:text-white transition">Comparisons</Link>
                <Link href="/webmail" className="block text-sm text-gray-400 hover:text-white transition">Webmail</Link>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center">
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p>
          </div>
        </div>
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
