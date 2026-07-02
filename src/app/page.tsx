"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface LandingSettings {
  costPerSms: string;
  packages: Array<{
    id: number; name: string; description: string; price: string;
    monthlyFee: string; smsCredits: number; freeSmsPerMonth: boolean;
    features: string[]; requiresLicense: boolean; isActive: boolean;
  }>;
}

export default function LandingPage() {
  const [mode, setMode] = useState<"landing" | "login" | "register">("landing");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [smsVolume, setSmsVolume] = useState(100000);
  const [settings, setSettings] = useState<LandingSettings>({ costPerSms: "0.00030", packages: [] });
  const router = useRouter();

  // Fetch dynamic settings from super admin
  useEffect(() => {
    fetch("/api/public/settings")
      .then(r => r.json())
      .then(setSettings)
      .catch(() => {});
  }, []);

  const costPerSms = parseFloat(settings.costPerSms) || 0.00030;
  const estimatedCost = (smsVolume * costPerSms).toFixed(2);

  const starterPkg = settings.packages.find(p => p.name === "Starter" && p.isActive);
  const proPkg = settings.packages.find(p => p.name === "Professional" && p.isActive);
  const entPkg = settings.packages.find(p => p.name === "Enterprise" && p.isActive);

  const proMonthly = proPkg?.monthlyFee || "150";
  const entMonthly = entPkg?.monthlyFee || "400";

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
      credentials: "include",
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    router.push("/dashboard");
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: fd.get("companyName"), email: fd.get("email"), phone: fd.get("phone"), password: fd.get("password") }),
      credentials: "include",
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    router.push("/dashboard");
  };

  if (mode !== "landing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">N</div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Net2APP</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">{mode === "login" ? "Welcome Back" : "Create Your Account"}</h2>
          <p className="text-gray-500 mb-6 text-sm">{mode === "login" ? "Sign in to your tenant dashboard" : "Deploy your isolated SMS platform in seconds"}</p>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm mb-4">{error}</div>}
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input name="email" type="email" required className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><input name="password" type="password" required className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
              <button disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 shadow-lg">{loading ? "Signing in..." : "Sign In"}</button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label><input name="companyName" required className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input name="email" type="email" required className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label><input name="phone" type="tel" required className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Password *</label><input name="password" type="password" required minLength={6} className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3"><p className="text-xs text-green-700">✓ No Setup Fees • ✓ No Hidden Fees • ✓ Pay Only For What You Use</p></div>
              <button disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 shadow-lg">{loading ? "Creating..." : "Create Account →"}</button>
            </form>
          )}
          <p className="text-center mt-6 text-sm text-gray-500">{mode === "login" ? "Don't have an account?" : "Already registered?"}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="text-blue-600 font-medium ml-1 hover:underline">{mode === "login" ? "Get Started" : "Sign In"}</button>
          </p>
          <button onClick={() => setMode("landing")} className="block text-center mt-3 text-sm text-gray-400 hover:text-gray-600 mx-auto">← Back to Home</button>
          <p className="text-center text-xs text-slate-400 mt-6">© {new Date().getFullYear()} Tri Angle Trade Centre Fze LLC. All Rights Reserved.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 lg:px-12 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">N</div>
          <span className="text-white text-2xl font-bold tracking-tight">Net2APP</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#pricing" className="text-blue-200 hover:text-white transition hidden md:block">Pricing</a>
          <a href="#features" className="text-blue-200 hover:text-white transition hidden md:block">Features</a>
          <a href="/webmail" className="text-blue-100 hover:text-white transition font-medium">Webmail</a>
          <button onClick={() => setMode("login")} className="text-blue-100 hover:text-white transition font-medium">Sign In</button>
          <button onClick={() => setMode("register")} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-400 hover:to-indigo-400 transition font-semibold shadow-lg">Get Started Free</button>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-400/30 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-green-200 text-sm font-medium">No Setup Fees • No Hidden Fees • Pay As You Go</span>
            </div>
            <h1 className="text-4xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
              SMS Gateway & Voice OTP
              <span className="block bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Platform</span>
            </h1>
            <p className="text-xl text-blue-200 mb-8 leading-relaxed">
              Deploy your own multi-tenant SMS gateway with SMPP v3.4, HTTP SMS API, Voice OTP with Asterisk, RCS messaging, Flash SMS, OTT (WhatsApp + Telegram), and intelligent multi-layer SMS routing. <strong className="text-white">Pure pay-as-you-go — only pay for SMS sent.</strong>
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => setMode("register")} className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-400 hover:to-indigo-400 transition font-semibold text-lg shadow-xl shadow-blue-500/30">Deploy Your Instance Free →</button>
              <a href="#calculator" className="px-8 py-4 border-2 border-blue-400/50 text-blue-200 rounded-xl hover:bg-blue-800/30 transition font-semibold text-lg text-center">Calculate Cost</a>
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-8 text-sm">
              <span className="text-green-300">✓ $0 Setup Fee</span>
              <span className="text-green-300">✓ $0 Monthly Fee</span>
              <span className="text-green-300">✓ $0 Hidden Fees</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: `$${costPerSms.toFixed(5)}`, label: "Per SMS Cost", desc: "Bulk SMS API pricing" },
              { value: "8+", label: "Connection Types", desc: "SMPP, HTTP, RCS, OTT, Voice" },
              { value: "$0", label: "Setup & Monthly Fee", desc: "Zero fees, just SMS cost" },
              { value: "100%", label: "Data Isolation", desc: "Dedicated per-tenant schema" },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5">
                <p className="text-3xl font-bold text-white mb-1">{s.value}</p>
                <p className="text-blue-200 font-medium">{s.label}</p>
                <p className="text-blue-400 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost Calculator - Dynamic Rate */}
      <div id="calculator" className="bg-gradient-to-b from-blue-900/50 to-slate-900/50 py-20">
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">SMS Gateway Cost Calculator</h2>
            <p className="text-blue-200">See exactly what you&apos;ll pay — no surprises, just simple bulk SMS pricing</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-3xl border border-white/10 p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <label className="block text-blue-200 mb-3 font-medium">Monthly SMS Volume</label>
                <input type="range" min="1000" max="10000000" step="1000" value={smsVolume} onChange={e => setSmsVolume(parseInt(e.target.value))}
                  className="w-full h-3 bg-blue-900 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                <div className="flex justify-between text-blue-400 text-sm mt-2">
                  <span>1K</span>
                  <span className="text-white font-bold text-lg">{(smsVolume / 1000).toFixed(0)}K SMS</span>
                  <span>10M</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl p-6 text-center">
                <p className="text-green-100 text-sm mb-1">Your Monthly Cost</p>
                <p className="text-5xl font-bold text-white mb-2">${estimatedCost}</p>
                <p className="text-green-200 text-sm">@ ${costPerSms.toFixed(5)} per SMS</p>
                <div className="mt-4 pt-4 border-t border-white/20 space-y-1">
                  <p className="text-white text-sm">✓ No setup fees</p>
                  <p className="text-white text-sm">✓ No monthly minimums</p>
                  <p className="text-white text-sm">✓ No hidden charges</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SMS Flow */}
      <div className="py-20 bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12"><h2 className="text-3xl font-bold text-white mb-3">SMPP SMS Routing Architecture</h2><p className="text-blue-200">Intelligent SMS routing with complete control at every layer — from client to mobile operator</p></div>
          <div className="bg-white/5 backdrop-blur rounded-3xl border border-white/10 p-8">
            <div className="flex flex-wrap items-center justify-center gap-3 lg:gap-4 text-sm lg:text-base mb-8">
              {["Client", "→", "Route Plan", "→", "Routes", "→", "Trunks", "→", "Suppliers", "→", "Mobile"].map((s, i) =>
                s === "→" ? <span key={i} className="text-blue-400 text-2xl font-bold">→</span> :
                <span key={i} className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 lg:px-6 py-2 lg:py-3 rounded-xl text-white font-medium shadow-lg">{s}</span>
              )}
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
              <p className="text-amber-200 text-sm"><strong>DLR Flow (Reverse):</strong> Mobile → Supplier → Trunks → Routes → Route Plan → Client (HTTP/ESME Push)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16"><h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Enterprise SMS Platform Features</h2><p className="text-blue-200 text-lg">Everything you need to run a professional SMS gateway operation — bulk SMS, Voice OTP, RCS, OTT</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "🔒", title: "Tenant Isolation", desc: "PostgreSQL schema isolation per SMS gateway client." },
              { icon: "🔀", title: "Smart SMS Routing", desc: "Route Plans → Routes → Trunks → Suppliers with priority." },
              { icon: "📞", title: "Voice OTP Service", desc: "MCC language detection, Asterisk AMI, alphanumeric OTP." },
              { icon: "💬", title: "SMPP v3.4 Gateway", desc: "Full SMPP bind status monitoring and ESME support." },
              { icon: "🌐", title: "HTTP SMS API", desc: "RESTful API with auth, rate limiting, DLR webhooks." },
              { icon: "👥", title: "Sub-Client Mgmt", desc: "Unlimited sub-clients with individual SMS rates." },
              { icon: "📊", title: "SMS DLR Reports", desc: "Real-time delivery reports and analytics." },
              { icon: "💰", title: "SMS Billing System", desc: "Automated invoices and payment tracking." },
              { icon: "🛡️", title: "IP Whitelisting", desc: "API security with IP-based access control." },
              { icon: "💎", title: "RCS Messaging", desc: "Rich Communication Services — next-gen SMS." },
              { icon: "⚡", title: "Flash SMS", desc: "Priority screen messages for urgent alerts." },
              { icon: "📱", title: "OTT & WhatsApp Business", desc: "WhatsApp Business API + Telegram SMS." },
            ].map((f, i) => (
              <div key={i} className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:border-blue-500/50 transition group">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-white font-semibold text-lg mb-2 group-hover:text-blue-300 transition">{f.title}</h3>
                <p className="text-blue-300 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Keyword-Rich Content for Search Engines */}
      <section className="py-16 bg-slate-900/80">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-white font-bold text-lg mb-3">SMS Gateway & Voice OTP Services</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Net2APP provides a complete SMS gateway platform with SMPP v3.4, HTTP SMS API, bulk SMS messaging, Voice OTP with Asterisk AMI integration, RCS messaging, Flash SMS, and OTT messaging via WhatsApp Business API and Telegram. Our multi-tenant SMS platform supports A2P SMS, P2P SMS, transactional SMS, OTP SMS, and SMS marketing with intelligent routing, DLR delivery reports, and real-time analytics. Deploy your own white-label SMS gateway with zero setup fees.
              </p>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-3">SMPP Server & SMS Routing Platform</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Our SMPP gateway supports full SMPP v3.4 protocol with ESME bind status monitoring, SMS firewall, and SMS aggregator capabilities. The multi-layer SMS routing engine — Route Plans, Routes, Trunks, and Suppliers — gives you complete control over SMS delivery paths. Compare Net2APP to Twilio, Vonage, and other CPaaS alternatives: we offer dedicated per-tenant PostgreSQL schema isolation, white-label branding, and pure pay-as-you-go bulk SMS pricing with no monthly commitments.
              </p>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-3">Global SMS Coverage — Bangladesh, India, UAE, Middle East</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Net2APP serves SMS gateway clients worldwide including Bangladesh SMS gateway providers, India SMS API services, UAE SMS platforms, and Middle East SMS solutions. Our Voice OTP engine supports 220+ countries with automatic MCC-based language detection. Partners include Reve SMS, 5GVision, LRS, and Al Muqeet. Whether you need an enterprise SMS server, cloud SMS platform, or white-label SMS gateway — deploy in 60 seconds with zero setup cost.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Connection Types */}
      <div className="py-16 bg-gradient-to-r from-blue-900/50 to-indigo-900/50">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-6">SMS Gateway Connection Types</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {["SMPP", "HTTP API", "RCS", "Flash SMS", "Voice OTP", "OTT", "Business API", "Email"].map((t, i) => (
              <span key={i} className="bg-white/10 border border-white/20 px-6 py-3 rounded-xl text-white font-medium hover:bg-white/20 transition">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing - Dynamic from Super Admin */}
      <div id="pricing" className="py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">SMS Gateway Pricing — $0 Setup, Pay-As-You-Go</h2>
            <p className="text-blue-200 text-lg">No setup fees • No hidden fees • Pay only for SMS sent • Bulk SMS rates from ${costPerSms.toFixed(5)}/SMS</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
              <h3 className="text-2xl font-bold text-white mb-1">Starter</h3>
              <div className="mb-2"><span className="text-4xl font-bold text-white">Free</span><span className="text-blue-200 ml-2 text-sm">platform access</span></div>
              <p className="text-blue-200 mb-6 text-sm font-medium">Pay-as-you-go • ${costPerSms.toFixed(5)}/SMS</p>
              <ul className="space-y-3 mb-8">
                {(starterPkg?.features || ["Isolated database","50 TPS","HTTP API","Basic routing","5 sub-clients","Email support"]).map((f: string, j: number) => (
                  <li key={j} className="flex items-center gap-2 text-white text-sm"><span className="text-green-400">✓</span> {f}</li>
                ))}
              </ul>
              <button onClick={() => setMode("register")} className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 transition">Get Started Free</button>
            </div>

            {/* Professional - Dynamic price */}
            <div className="bg-gradient-to-b from-blue-600 to-indigo-600 border-2 border-blue-400 rounded-3xl p-8 scale-105 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 px-4 py-1 rounded-full text-sm font-bold">Most Popular</div>
              <h3 className="text-2xl font-bold text-white mb-1">Professional</h3>
              <div className="mb-2"><span className="text-4xl font-bold text-white">${proMonthly}</span><span className="text-blue-200 ml-2 text-sm">/month</span></div>
              <p className="text-blue-200 mb-6 text-sm font-medium">Dedicated server • 200 TPS • 10M SMS included</p>
              <ul className="space-y-3 mb-8">
                {(proPkg?.features || ["Everything in Starter","Dedicated server","200 TPS","10M SMS/month INCLUDED","NO per-SMS charge","SMPP & Voice OTP","Unlimited clients","Priority support"]).map((f: string, j: number) => (
                  <li key={j} className="flex items-center gap-2 text-white text-sm"><span className="text-green-400">✓</span> {f}</li>
                ))}
              </ul>
              <button onClick={() => setMode("register")} className="w-full py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition">Go Professional</button>
            </div>

            {/* Enterprise - Dynamic price */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
              <h3 className="text-2xl font-bold text-white mb-1">Enterprise</h3>
              <div className="mb-2"><span className="text-4xl font-bold text-white">${entMonthly}</span><span className="text-blue-200 ml-2 text-sm">/month</span></div>
              <p className="text-blue-200 mb-6 text-sm font-medium">Unlimited everything • All services</p>
              <ul className="space-y-3 mb-8">
                {(entPkg?.features || ["Everything in Pro","Unlimited TPS","Unlimited volume","All connection types","RCS & OTT & WhatsApp","White-label","24/7 support","SLA guarantee"]).map((f: string, j: number) => (
                  <li key={j} className="flex items-center gap-2 text-white text-sm"><span className="text-green-400">✓</span> {f}</li>
                ))}
              </ul>
              <button onClick={() => setMode("register")} className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 transition">Contact Sales</button>
            </div>
          </div>
          <div className="mt-12 bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
            <p className="text-green-200 text-lg font-medium">💰 All plans: <strong className="text-white">${costPerSms.toFixed(5)} per SMS</strong> • No setup fees • No monthly fees • No hidden fees</p>
            <p className="text-green-300 text-sm mt-1">Rates and package prices updated dynamically from admin panel</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Deploy Your SMS Gateway Platform — Free, Instant Setup</h2>
          <p className="text-blue-100 text-lg mb-8">Get your isolated multi-tenant SMS platform running in under 60 seconds. SMPP, HTTP API, Voice OTP, RCS included. Completely free to start.</p>
          <button onClick={() => setMode("register")} className="px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</button>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 bg-slate-900 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div>
              <span className="text-white font-semibold text-lg">Net2APP</span>
            </div>
            <p className="text-blue-400 text-sm">Enterprise SMS Gateway & Voice OTP Platform • Multi-Tenant SaaS • SMPP, HTTP API, RCS, OTT</p>
            <div className="flex items-center gap-4">
              <a href="/webmail" className="text-blue-400 hover:text-white text-sm transition">Webmail</a>
              <a href="/super" className="text-slate-500 hover:text-slate-400 text-sm">Admin</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/10 text-center">
            <p className="text-slate-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre Fze LLC. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
