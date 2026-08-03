"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";

const TAWKTO_ID = process.env.NEXT_PUBLIC_TAWKTO_ID || "";

export const dynamic = "force-dynamic";

// Google "G" logo SVG — defined at module level to avoid re-creation on every render
function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

interface LandingSettings {
  costPerSms: string;
  promo?: { active: boolean; title: string; text: string; badge: string; bonusSms: number; minAmount: number; signupBonus: number };
  packages: Array<{
    id: number; name: string; description: string; price: string;
    monthlyFee: string; smsCredits: number; freeSmsPerMonth: boolean;
    features: string[]; requiresLicense: boolean; isActive: boolean;
  }>;
}





const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://net2app.com/#website",
      "url": "https://net2app.com",
      "name": "Net2APP — SMS Gateway, Voice OTP & CPaaS Platform",
      "description": "Deploy your own multi-tenant SMS gateway with SMPP v3.4, HTTP SMS API, Voice OTP, RCS, WhatsApp, and Telegram. Zero setup fees, pay-as-you-go pricing.",

    },
    {
      "@type": "Organization",
      "@id": "https://net2app.com/#organization",
      "name": "Net2APP",
      "url": "https://net2app.com",
      "logo": "https://net2app.com/logo.png",
      "description": "Enterprise SMS Gateway & Voice OTP Platform. Multi-tenant SaaS with SMPP, HTTP API, RCS, Voice OTP, and OTT messaging.",
      "sameAs": []
    },
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/#webpage",
      "url": "https://net2app.com",
      "name": "SMS Gateway & Voice OTP Platform — Net2APP",
      "description": "Deploy your own multi-tenant SMS gateway with SMPP v3.4, HTTP SMS API, Voice OTP, RCS, WhatsApp, and Telegram. Zero setup fees, pay-as-you-go pricing.",
      "isPartOf": { "@id": "https://net2app.com/#website" },
      "about": { "@id": "https://net2app.com/#organization" },
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" }]
      },
    },      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/#app",
        "name": "Net2APP CPaaS Platform",
        "url": "https://net2app.com",
        "description": "Deploy your own multi-tenant SMS gateway with SMPP v3.4, HTTP SMS API, Voice OTP, RCS, WhatsApp, and Telegram. Complete CPaaS platform with conversations, communications, authentication, and customer data tools.",
        "applicationCategory": "CommunicationApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. No setup fees, no monthly minimums."
        },
        "featureList": [
          "Multi-tenant PostgreSQL schema isolation per customer",
          "SMPP v3.4 gateway with transmitter/receiver/transceiver binds",
          "RESTful HTTP SMS API with API key + IP whitelist authentication",
          "Voice OTP with Asterisk AMI and 220+ country MCC language detection",
          "4-layer intelligent SMS routing: Route Plans → Routes → Trunks → Suppliers",
          "WhatsApp Business API via Baileys and Telegram MTProto",
          "RCS Rich Communication Services and Flash SMS support",
          "Real-time DLR delivery reports and webhook callbacks",
          "OTT device pairing engine with QR code and session persistence",
          "Sub-client management with individual rates, routing, and API keys"
        ]
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is Net2APP and how does it work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP is a multi-tenant CPaaS (Communications Platform as a Service) that lets you deploy your own SMS gateway in under 60 seconds. It includes SMPP v3.4, HTTP SMS API, Voice OTP, RCS, WhatsApp, and Telegram — all with zero setup fees and pay-as-you-go pricing. Each tenant gets an isolated PostgreSQL schema for complete data privacy."
            }
          },
          {
            "@type": "Question",
            "name": "How much does Net2APP cost?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP has zero setup fees, zero monthly minimums, and zero hidden costs. You pay only for the SMS you send, starting at $0.00030/SMS on the Starter plan. The Professional plan ($150/month) includes 10M SMS with no per-message charge, and the Enterprise plan ($400/month) offers unlimited TPS with SLA guarantees."
            }
          },
          {
            "@type": "Question",
            "name": "What protocols and connection types does Net2APP support?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP supports 8+ connection types: SMPP v3.4, HTTP/REST API, RCS (Rich Communication Services), Flash SMS, Voice OTP (via Asterisk AMI), OTT messaging (WhatsApp Business API + Telegram MTProto), Email SMTP, and SIP Trunking. Pre-built connector templates for 80+ SMS providers are included."
            }
          },
          {
            "@type": "Question",
            "name": "Is Net2APP suitable for serving multiple clients?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Net2APP is built from the ground up as a multi-tenant platform. Each client gets an isolated PostgreSQL schema, dedicated API keys, individual routing plans, and separate billing. You can create unlimited sub-clients with their own rates, TPS limits, and features — making it ideal for SMS resellers, aggregators, and enterprises managing multiple business units."
            }
          }
        ]
      },
      {
      "@type": "ItemList",
      "name": "Net2APP Products & Services",
      "description": "Complete CPaaS product suite including conversations, communications, authentication, and customer data platforms.",
      "numberOfItems": 27,
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Conversation Memory" },
        { "@type": "ListItem", "position": 2, "name": "Conversation Orchestrator" },
        { "@type": "ListItem", "position": 3, "name": "Conversation Intelligence" },
        { "@type": "ListItem", "position": 4, "name": "Conversation Relay" },
        { "@type": "ListItem", "position": 5, "name": "Messaging API" },
        { "@type": "ListItem", "position": 6, "name": "SMS Gateway" },
        { "@type": "ListItem", "position": 7, "name": "WhatsApp Business API" },
        { "@type": "ListItem", "position": 8, "name": "RCS Messaging" },
        { "@type": "ListItem", "position": 9, "name": "Voice API" },
        { "@type": "ListItem", "position": 10, "name": "SIP Trunking" },
        { "@type": "ListItem", "position": 11, "name": "Email Service" },
        { "@type": "ListItem", "position": 12, "name": "SMTP Service" },
        { "@type": "ListItem", "position": 13, "name": "Phone Numbers" },
        { "@type": "ListItem", "position": 14, "name": "Toll-Free Numbers" },
        { "@type": "ListItem", "position": 15, "name": "IODLC" },
        { "@type": "ListItem", "position": 16, "name": "Short Codes" },
        { "@type": "ListItem", "position": 17, "name": "Video API" },
        { "@type": "ListItem", "position": 18, "name": "Flex" },
        { "@type": "ListItem", "position": 19, "name": "Verify (OTP)" },
        { "@type": "ListItem", "position": 20, "name": "Lookup" },
        { "@type": "ListItem", "position": 21, "name": "Connections" },
        { "@type": "ListItem", "position": 22, "name": "Warehouses" },
        { "@type": "ListItem", "position": 23, "name": "Protocols" },
        { "@type": "ListItem", "position": 24, "name": "Unify" },
        { "@type": "ListItem", "position": 25, "name": "Engage" },
        { "@type": "ListItem", "position": 26, "name": "Audiences" },
        { "@type": "ListItem", "position": 27, "name": "Journeys" },
      ]
    }
  ]
};

export default function LandingPage() {
  const [mode, setMode] = useState<"landing" | "login" | "register">("landing");
  const [showProducts, setShowProducts] = useState(false);
  const [showSolutions, setShowSolutions] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showMobile, setShowMobile] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [smsVolume, setSmsVolume] = useState(100000);
  const [showIosWaitlist, setShowIosWaitlist] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [settings, setSettings] = useState<LandingSettings>({ costPerSms: "0.00010", packages: [] });
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);

  // Determine the safe redirect target after login
  const getRedirectPath = (): string => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (redirect) {
      try {
        const url = new URL(redirect, window.location.origin);
        if (url.origin !== window.location.origin) return "/dashboard";
        const path = url.pathname + url.search + url.hash;
        // n8n paths are served by nginx, not Next.js — use full navigation instead of router.push
        if (path.startsWith("/n8n")) {
          window.location.href = path;
          return ""; // caller will see empty string and skip router.push
        }
        return path;
      } catch { /* invalid URL, ignore */ }
    }
    return "/dashboard";
  };

  // Handle auth_error from Google callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      if (authError === "account_suspended") setError("Your account has been suspended. Please contact support.");
      else if (authError === "google_failed") setError("Google sign-in failed. Please try again or use email/password.");
      else if (authError === "access_denied") setError("Google sign-in was cancelled. You can try again.");
      setMode("login");
      // Clear the URL param
      window.history.replaceState({}, "", "/");
    }
    // Auto-show login form if there's a redirect param (user was sent here from a protected page)
    if (params.has("redirect")) {
      setMode("login");
    }
  }, []);

  // Fetch dynamic settings from super admin
  useEffect(() => {
    fetch("/api/public/settings")
      .then(r => r.json())
      .then(setSettings)
      .catch(() => {});
  }, []);

  // Check if user has an active tenant session (for direct download button)
  useEffect(() => {
    const hasCookie = document.cookie.includes("tenant_token=");
    if (!hasCookie) return;
    fetch("/api/tenant/android-app/share-link", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.downloadUrl) {
          setIsLoggedIn(true);
          setDownloadUrl(data.downloadUrl);
        }
      })
      .catch(() => {});
  }, []);

  const handleGoogleAuth = (authMode: "login" | "register") => {
    setGoogleLoading(true);
    window.location.href = `/api/auth/google?mode=${authMode}`;
  };

  const costPerSms = parseFloat(settings.costPerSms) || 0.00010;
  const estimatedCost = (smsVolume * costPerSms).toFixed(2);

  const starterPkg = settings.packages.find(p => p.name === "Starter" && p.isActive);
  const proPkg = settings.packages.find(p => p.name === "Professional" && p.isActive);
  const entPkg = settings.packages.find(p => p.name === "Enterprise" && p.isActive);

  const promo = settings.promo;
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
    const redirect = getRedirectPath();
    if (redirect) router.push(redirect);
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const body: Record<string, string> = {
      companyName: fd.get("companyName") as string,
      email: fd.get("email") as string,
      phone: fd.get("phone") as string,
      password: fd.get("password") as string,
    };
    const res = await fetch("/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    const redirect = getRedirectPath();
    if (redirect) router.push(redirect);
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
              <div className="text-right"><Link href="/auth/forgot-password" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Forgot password?</Link></div>
              <button disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 shadow-lg">{loading ? "Signing in..." : "Sign In"}</button>
              <div className="relative my-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div><div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-gray-400">or continue with</span></div></div>
              <button type="button" onClick={() => handleGoogleAuth("login")} disabled={googleLoading} className="w-full flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 transition"><GoogleIcon /> {googleLoading ? "Redirecting..." : "Google"}</button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label><input name="companyName" required className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input name="email" type="email" required className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label><input name="phone" type="tel" required className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Password *</label><input name="password" type="password" required minLength={6} className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition" /></div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3"><p className="text-xs text-green-700">✓ No Setup Fees • ✓ No Hidden Fees • ✓ Pay Only For What You Use</p></div>
              <button disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 shadow-lg">{loading ? "Creating..." : "Create Account →"}</button>
              <div className="relative my-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div><div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-gray-400">or sign up with</span></div></div>
              <button type="button" onClick={() => handleGoogleAuth("register")} disabled={googleLoading} className="w-full flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 transition"><GoogleIcon /> {googleLoading ? "Redirecting..." : "Google"}</button>
            </form>
          )}
          <p className="text-center mt-6 text-sm text-gray-500">{mode === "login" ? "Don't have an account?" : "Already registered?"}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="text-blue-600 font-medium ml-1 hover:underline">{mode === "login" ? "Get Started" : "Sign In"}</button>
          </p>
          <button onClick={() => setMode("landing")} className="block text-center mt-3 text-sm text-gray-400 hover:text-gray-600 mx-auto">← Back to Home</button>
          <p className="text-center text-xs text-slate-400 mt-6">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav ref={navRef} className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button onClick={() => setMode("landing")} className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span>
            </button>
            <div className="hidden lg:flex items-center gap-1">
              <div className="relative">
                <button onClick={() => { setShowProducts(!showProducts); setShowSolutions(false); setShowFeatures(false); setShowMobile(false); }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition ${showProducts ? "text-blue-600 bg-blue-50" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`}>Products ▾</button>
                {showProducts && (
                  <div className="absolute top-full left-0 mt-1 w-[700px] bg-white rounded-xl shadow-xl border border-gray-200 p-6 grid grid-cols-3 gap-6 z-50">
                    {[
                      { category: "Conversations", items: [
                        { name: "Conversation Memory", href: "/solutions/use-cases/customer-data-management", icon: "🧠", desc: "Persistent customer interaction history" },
                        { name: "Conversation Orchestrator", href: "/solutions/use-cases/support-and-sales", icon: "🎼", desc: "Seamless cross-channel handoff" },
                        { name: "Conversation Intelligence", href: "/solutions/use-cases/ai-agent-productivity", icon: "📊", desc: "Real-time sentiment extraction" },
                        { name: "Conversation Relay", href: "/solutions/use-cases/ivr", icon: "🔁", desc: "Voice AI for conversations" },
                      ]},
                      { category: "Communications", items: [
                        { name: "SMS Gateway", href: "/http-sms-api", icon: "📨", desc: "Bulk & transactional SMS" },
                        { name: "Voice OTP", href: "/voice-otp", icon: "📞", desc: "Call-based OTP, 220+ countries" },
                        { name: "WhatsApp API", href: "/whatsapp-telegram-api", icon: "💚", desc: "WhatsApp Business messaging" },{ name: "RCS Messaging", href: "/http-sms-api", icon: "📱", desc: "Rich Communication Services" },
                        { name: "OTT Pairing", href: "/ott-pairing", icon: "🔗", desc: "WhatsApp & Telegram device bridge" },
]},
                      { category: "Auth & Data", items: [
                        { name: "Verify (OTP)", href: "/solutions/use-cases/verification-and-identity", icon: "✅", desc: "SMS, Voice, WhatsApp OTP" },
                        { name: "Lookup", href: "/solutions/use-cases/verification-and-identity", icon: "🔍", desc: "Phone number intelligence" },
                        { name: "IP Whitelisting", href: "/ip-whitelisting", icon: "🛡️", desc: "API security & access control" },
                        { name: "SMS Routing", href: "/sms-routing", icon: "🔀", desc: "Multi-layer intelligent routing" },
                      ]},
                    ].map((group) => (
                      <div key={group.category}>
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">{group.category}</p>
                        <div className="space-y-3">{group.items.map((item) => (
                          <Link key={item.name} href={item.href} className="block group" onClick={() => setShowProducts(false)}>
                            <div className="flex items-start gap-2.5">
                              <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
                              <div><p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition">{item.name}</p><p className="text-xs text-gray-500">{item.desc}</p></div>
                            </div>
                          </Link>
                        ))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button onClick={() => { setShowSolutions(!showSolutions); setShowProducts(false); setShowFeatures(false); }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition ${showSolutions ? "text-blue-600 bg-blue-50" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`}>Solutions ▾</button>
                {showSolutions && (
                  <div className="absolute top-full left-0 mt-1 w-[500px] bg-white rounded-xl shadow-xl border border-gray-200 p-6 grid grid-cols-2 gap-6 z-50">
                    <div><p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">By Use Case</p><div className="space-y-3">
                      {[{ n: "Verification", h: "/solutions/use-cases/verification-and-identity", i: "✅" },{ n: "Fraud Prevention", h: "/solutions/use-cases/fraud-prevention", i: "🛡️" },{ n: "Marketing", h: "/solutions/use-cases/marketing-and-promotions", i: "📣" },{ n: "AI Agents", h: "/solutions/use-cases/ai-agent-productivity", i: "🤖" }].map((item) => (
                        <Link key={item.n} href={item.h} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition" onClick={() => setShowSolutions(false)}><span>{item.i}</span> {item.n}</Link>
                      ))}</div></div>
                    <div><p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">By Team</p><div className="space-y-3">
                      {[{ n: "Developers", h: "/solutions/teams/developers", i: "💻" },{ n: "Marketing", h: "/solutions/teams/marketing", i: "📣" },{ n: "Product", h: "/solutions/teams/product", i: "🎯" },{ n: "CX", h: "/solutions/teams/customer-experience", i: "❤️" }].map((item) => (
                        <Link key={item.n} href={item.h} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition" onClick={() => setShowSolutions(false)}><span>{item.i}</span> {item.n}</Link>
                      ))}</div>
                      <div className="mt-4 pt-4 border-t border-gray-200"><Link href="/solutions/see-all" className="text-sm text-blue-600 hover:text-blue-700 font-medium" onClick={() => setShowSolutions(false)}>See all →</Link></div>
                    </div>
                  </div>
                )}
              </div>
              <div className="relative">
                <button onClick={() => { setShowFeatures(!showFeatures); setShowProducts(false); setShowSolutions(false); }}
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
              <Link href="/case-studies" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Case Studies</Link>
              <Link href="/comparisons" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Comparisons</Link>
              <Link href="/blog" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Blog</Link>
              <Link href="/pricing" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Pricing</Link>
              <Link href="/contact" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Contact</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/webmail" className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 transition">Webmail</Link>
              <button onClick={() => handleGoogleAuth("login")} disabled={googleLoading} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition border border-gray-200"><GoogleIcon />{googleLoading ? "..." : "Google"}</button>
              <button onClick={() => setMode("login")} className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">Sign In</button>
              <button onClick={() => setMode("register")} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started Free</button>
              <button onClick={() => setShowMobile(!showMobile)} className="lg:hidden p-2 text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showMobile ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
              </button>
            </div>
          </div>
          {showMobile && (
            <div className="lg:hidden pb-6 border-t border-gray-200 pt-4 space-y-3">
              <button onClick={() => { setMode("landing"); setShowMobile(false); document.getElementById('products')?.scrollIntoView({behavior:'smooth'}); }} className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2">Products</button>
              <Link href="/solutions" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2" onClick={() => setShowMobile(false)}>Solutions</Link>
              <div className="border-t border-gray-200 pt-3 mt-1">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2 px-1">By Use Case</p>
                <div className="space-y-1">
                  {[
                    { name: "Verification & Identity", href: "/solutions/use-cases/verification-and-identity", icon: "✅" },
                    { name: "Fraud Prevention", href: "/solutions/use-cases/fraud-prevention", icon: "🛡️" },
                    { name: "SMS Marketing", href: "/solutions/use-cases/sms-marketing", icon: "💰" },
                    { name: "Mass Texting", href: "/solutions/use-cases/mass-texting", icon: "📨" },
                    { name: "Alerts & Notifications", href: "/solutions/use-cases/alerts-and-notifications", icon: "🔔" },
                    { name: "AI Agent Productivity", href: "/solutions/use-cases/ai-agent-productivity", icon: "🤖" },
                  ].map((f) => (
                    <Link key={f.name} href={f.href} className="flex items-center gap-2 px-1 py-1.5 text-sm text-gray-600 hover:text-blue-600 transition" onClick={() => setShowMobile(false)}>
                      <span>{f.icon}</span>
                      <span>{f.name}</span>
                    </Link>
                  ))}
                  <Link href="/solutions/use-cases" className="flex items-center gap-2 px-1 py-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition" onClick={() => setShowMobile(false)}>
                    <span>→</span>
                    <span>See all 15 use cases</span>
                  </Link>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-3 mt-1">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2 px-1">By Team</p>
                <div className="space-y-1">
                  {[
                    { name: "Developer Tools", href: "/solutions/teams/developers", icon: "💻" },
                    { name: "Data Engineering", href: "/solutions/teams/data-engineering", icon: "📊" },
                    { name: "Marketing Teams", href: "/solutions/teams/marketing", icon: "📣" },
                    { name: "Product Teams", href: "/solutions/teams/product", icon: "🎯" },
                    { name: "Customer Experience", href: "/solutions/teams/customer-experience", icon: "❤️" },
                  ].map((f) => (
                    <Link key={f.name} href={f.href} className="flex items-center gap-2 px-1 py-1.5 text-sm text-gray-600 hover:text-blue-600 transition" onClick={() => setShowMobile(false)}>
                      <span>{f.icon}</span>
                      <span>{f.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-200 pt-3 mt-1">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2 px-1">By Industry</p>
                <div className="space-y-1">
                  {[
                    { name: "Financial Services", href: "/solutions/industries/financial-services", icon: "🏦" },
                    { name: "Healthcare", href: "/solutions/industries/healthcare", icon: "🏥" },
                    { name: "Ecommerce", href: "/solutions/industries/ecommerce", icon: "🛒" },
                    { name: "Retail", href: "/solutions/industries/retail", icon: "🏪" },
                    { name: "Education", href: "/solutions/industries/education", icon: "🎓" },
                    { name: "Hospitality", href: "/solutions/industries/hospitality", icon: "🏨" },
                    { name: "Nonprofit", href: "/solutions/industries/nonprofit", icon: "🤝" },
                    { name: "Public Sector", href: "/solutions/industries/public-sector", icon: "🏛️" },
                  ].map((f) => (
                    <Link key={f.name} href={f.href} className="flex items-center gap-2 px-1 py-1.5 text-sm text-gray-600 hover:text-blue-600 transition" onClick={() => setShowMobile(false)}>
                      <span>{f.icon}</span>
                      <span>{f.name}</span>
                    </Link>
                  ))}
                  <Link href="/solutions/industries" className="flex items-center gap-2 px-1 py-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition" onClick={() => setShowMobile(false)}>
                    <span>→</span>
                    <span>See all 8 industries</span>
                  </Link>
                </div>
              </div>
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
              <Link href="/case-studies" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2" onClick={() => setShowMobile(false)}>Case Studies</Link>
              <Link href="/comparisons" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2" onClick={() => setShowMobile(false)}>Compare Platforms</Link>
              <Link href="/blog" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2" onClick={() => setShowMobile(false)}>Blog</Link>
              <Link href="/pricing" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2" onClick={() => setShowMobile(false)}>Pricing</Link>
              <Link href="/contact" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2" onClick={() => setShowMobile(false)}>Contact</Link>
              <Link href="/webmail" className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-2" onClick={() => setShowMobile(false)}>Webmail</Link>
              <div className="pt-2"><button onClick={() => { setMode("register"); setShowMobile(false); }} className="block w-full text-center px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">Get Started Free</button></div>
            </div>
          )}
        </div>
      </nav>

      {/* Promo Banner */}
      {promo?.active && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-3 flex items-center justify-center gap-3 flex-wrap text-center">
            <span className="text-2xl">🎉</span>
            <span className="font-bold text-sm lg:text-base">{promo.text}</span>
            <span className="bg-white/20 rounded-full px-3 py-0.5 text-xs font-semibold whitespace-nowrap">{promo.title}</span>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-50 via-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-100 border border-blue-200 rounded-full px-4 py-1.5 mb-6">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span className="text-blue-700 text-sm font-medium">No Setup Fees • Pay As You Go</span>
              </div>
              {promo?.active && (
                <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-4 ml-2">
                  <span className="text-lg">🔥</span>
                  <span className="text-amber-700 text-sm font-bold">{promo.badge}</span>
                </div>
              )}
              <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
                The platform for
                <span className="block text-blue-600">conversations in the AI era</span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-xl">
                Deploy your own multi-tenant SMS gateway with SMPP v3.4, HTTP API, Voice OTP, RCS, 
                WhatsApp, and Telegram. <strong className="text-gray-900">Pay only for what you use — zero setup, zero monthly fees.</strong>
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => setMode("register")} className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-lg shadow-lg shadow-blue-600/20">
                  Start for free →
                </button>
                <button onClick={() => handleGoogleAuth("register")} disabled={googleLoading} className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition font-semibold text-lg text-center flex items-center justify-center gap-2"><GoogleIcon />{googleLoading ? "Please wait..." : "Sign up with Google"}</button>
                <button onClick={() => document.getElementById('calculator')?.scrollIntoView({behavior:'smooth'})} className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition font-semibold text-lg text-center">
                  Calculate cost
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-5 mt-8">
                {["$0 Setup Fee", "$0 Monthly Fee", "$0 Hidden Fees", `${costPerSms.toFixed(5)}/SMS`].map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
                <p className="text-3xl font-bold text-gray-900 mb-1">${costPerSms.toFixed(5)}</p>
                <p className="text-gray-700 font-medium text-sm">Per SMS</p>
                <p className="text-gray-500 text-xs mt-1">Bulk SMS API pricing</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
                <p className="text-3xl font-bold text-gray-900 mb-1">8+</p>
                <p className="text-gray-700 font-medium text-sm">Connection Types</p>
                <p className="text-gray-500 text-xs mt-1">SMPP, HTTP, RCS, OTT, Voice</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
                <p className="text-3xl font-bold text-gray-900 mb-1">$0</p>
                <p className="text-gray-700 font-medium text-sm">Setup Fee</p>
                <p className="text-gray-500 text-xs mt-1">Zero fees, just SMS cost</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
                <p className="text-3xl font-bold text-gray-900 mb-1">100%</p>
                <p className="text-gray-700 font-medium text-sm">Data Isolation</p>
                <p className="text-gray-500 text-xs mt-1">Per-tenant PostgreSQL schema</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Service Platform Showcase */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-full px-4 py-1.5 mb-4">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              <span className="text-blue-700 text-sm font-medium">All Available Solutions</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Complete Communication Platform Suite</h2>
            <p className="text-gray-500 text-lg max-w-3xl mx-auto">From bulk SMS to VoIP softswitch, VPN services, and VOS3000 hosting — deploy any solution on your own infrastructure with zero setup fees</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* SMS Platform */}
            <div className="group bg-white rounded-2xl border-2 border-blue-100 hover:border-blue-400 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-4xl">📨</span>
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
                </div>
                <h3 className="text-2xl font-bold text-white">SMS Platform</h3>
                <p className="text-blue-100 text-sm mt-1">Multi-Tenant SMS Gateway</p>
              </div>
              <div className="p-6">
                <p className="text-gray-600 text-sm leading-relaxed mb-4">Deploy your own white-label SMS gateway with SMPP v3.4, HTTP API, Voice OTP, RCS, WhatsApp & Telegram. Complete CPaaS with tenant isolation, intelligent routing, and real-time DLR.</p>
                <div className="space-y-2 mb-5">
                  {["SMPP v3.4 Gateway", "HTTP REST API", "Voice OTP (220+ countries)", "WhatsApp & Telegram OTT", "4-Layer SMS Routing", "Multi-Tenant Architecture"].map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs text-gray-500"><span className="text-green-500">✓</span> {f}</div>
                  ))}
                </div>
                <button onClick={() => setMode("register")} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold transition">Get Started →</button>
              </div>
            </div>

            {/* VoIP Softswitch */}
            <div className="group bg-white rounded-2xl border-2 border-purple-100 hover:border-purple-400 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="bg-gradient-to-br from-purple-500 to-purple-700 p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-4xl">📞</span>
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">VoIP</span>
                </div>
                <h3 className="text-2xl font-bold text-white">VoIP Softswitch</h3>
                <p className="text-purple-100 text-sm mt-1">Class 4 & Class 5 Switching</p>
              </div>
              <div className="p-6">
                <p className="text-gray-600 text-sm leading-relaxed mb-4">Complete VoIP softswitch solution with SIP signaling, RTP media relay, transcoding, billing, and multi-tenant support. Built for carriers and service providers.</p>
                <div className="space-y-2 mb-5">
                  {["SIP Signaling (TLS/SIPS)", "RTP Media Relay", "SRTP Encryption", "Multi-Tenant Billing", "Asterisk 20 Integration", "Class 4 & 5 Routing"].map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs text-gray-500"><span className="text-purple-500">✓</span> {f}</div>
                  ))}
                </div>
                <Link href="/contact" className="block w-full text-center bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-xl text-sm font-semibold transition">Contact Sales →</Link>
              </div>
            </div>

            {/* VOS3000 Hosting */}
            <div className="group bg-white rounded-2xl border-2 border-amber-100 hover:border-amber-400 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="bg-gradient-to-br from-amber-500 to-amber-700 p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-4xl">🖥️</span>
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">Hosting</span>
                </div>
                <h3 className="text-2xl font-bold text-white">VOS3000 Hosting</h3>
                <p className="text-amber-100 text-sm mt-1">Managed Softswitch Infrastructure</p>
              </div>
              <div className="p-6">
                <p className="text-gray-600 text-sm leading-relaxed mb-4">Fully managed VOS3000 hosting on dedicated servers. Includes installation, configuration, monitoring, DDoS protection, and 24/7 support. Deploy in Canada, France, or Germany.</p>
                <div className="space-y-2 mb-5">
                  {["Dedicated Server Hosting", "VOS3000 Installation", "DDoS Protection", "24/7 Monitoring", "Automated Backups", "Multi-Location Deploy"].map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs text-gray-500"><span className="text-amber-500">✓</span> {f}</div>
                  ))}
                </div>
                <Link href="/contact" className="block w-full text-center bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl text-sm font-semibold transition">Contact Sales →</Link>
              </div>
            </div>

            {/* VPN for GSM Gateway */}
            <div className="group bg-white rounded-2xl border-2 border-green-100 hover:border-green-400 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="bg-gradient-to-br from-green-500 to-green-700 p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-4xl">🔐</span>
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">VPN</span>
                </div>
                <h3 className="text-2xl font-bold text-white">VPN for GSM Gateway</h3>
                <p className="text-green-100 text-sm mt-1">Secure Tunnel for GSM Modems</p>
              </div>
              <div className="p-6">
                <p className="text-gray-600 text-sm leading-relaxed mb-4">Secure VPN tunnels for GSM modem/gateway connectivity. Connect your remote GSM hardware directly to our SMPP servers with encrypted, low-latency tunnels.</p>
                <div className="space-y-2 mb-5">
                  {["Encrypted VPN Tunnel", "Static IP Assignment", "Low Latency Routing", "GSM Modem Compatible", "Auto-Reconnect", "Bandwidth Monitoring"].map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs text-gray-500"><span className="text-green-500">✓</span> {f}</div>
                  ))}
                </div>
                <Link href="/contact" className="block w-full text-center bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-semibold transition">Contact Sales →</Link>
              </div>
            </div>

            {/* VOS3000 Mobile Billing */}
            <div className="group bg-white rounded-2xl border-2 border-rose-100 hover:border-rose-400 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="bg-gradient-to-br from-rose-500 to-rose-700 p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-4xl">📱</span>
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">Mobile</span>
                </div>
                <h3 className="text-2xl font-bold text-white">VOS3000 Mobile Billing</h3>
                <p className="text-rose-100 text-sm mt-1">Customized Billing Platform</p>
              </div>
              <div className="p-6">
                <p className="text-gray-600 text-sm leading-relaxed mb-4">Customized VOS3000 mobile billing solution with prepaid/postpaid support, real-time CDR processing, multi-currency, and white-label customer portal for resellers.</p>
                <div className="space-y-2 mb-5">
                  {["Prepaid & Postpaid Billing", "Real-Time CDR Processing", "Multi-Currency Support", "White-Label Portal", "Reseller Management", "API Integration"].map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs text-gray-500"><span className="text-rose-500">✓</span> {f}</div>
                  ))}
                </div>
                <Link href="/contact" className="block w-full text-center bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl text-sm font-semibold transition">Contact Sales →</Link>
              </div>
            </div>

            {/* VPN for Android */}
            <div className="group bg-white rounded-2xl border-2 border-teal-100 hover:border-teal-400 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="bg-gradient-to-br from-teal-500 to-teal-700 p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-4xl">🤖</span>
                  <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">Android</span>
                </div>
                <h3 className="text-2xl font-bold text-white">VPN for Android</h3>
                <p className="text-teal-100 text-sm mt-1">Mobile VPN Service</p>
              </div>
              <div className="p-6">
                <p className="text-gray-600 text-sm leading-relaxed mb-4">Dedicated VPN service for Android devices used as SMS gateways. Secure, always-on connection with automatic failover and remote management dashboard.</p>
                <div className="space-y-2 mb-5">
                  {["Always-On VPN", "Auto Failover", "Remote Management", "Bandwidth Control", "Multiple Protocols", "Device Dashboard"].map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs text-gray-500"><span className="text-teal-500">✓</span> {f}</div>
                  ))}
                </div>
                <Link href="/contact" className="block w-full text-center bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-xl text-sm font-semibold transition">Contact Sales →</Link>
              </div>
            </div>
          </div>

          {/* CTA Banner */}
          <div className="mt-14 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-8 text-center shadow-xl">
            <h3 className="text-2xl font-bold text-white mb-2">Ready to deploy your communication platform?</h3>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">Choose any solution and get deployed in under 60 seconds. Zero setup fees, pay-as-you-go pricing.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={() => setMode("register")} className="px-8 py-3 bg-white text-blue-700 rounded-xl hover:bg-blue-50 transition font-bold shadow-lg">Start Free →</button>
              <Link href="/contact" className="px-8 py-3 border-2 border-white/30 text-white rounded-xl hover:bg-white/10 transition font-bold">Talk to Sales</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Apps Download Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-full px-4 py-1.5 mb-4">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-green-700 text-sm font-medium">Mobile Apps</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Turn Your Phone Into an SMS Gateway</h2>
            <p className="text-gray-500 text-lg max-w-3xl mx-auto">Download the Net2APP mobile app and transform any Android phone into a powerful SMS gateway. iOS app coming soon.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Android Card */}
            <div className="group relative bg-white rounded-3xl border-2 border-green-200 hover:border-green-400 shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-green-400/20 to-transparent rounded-bl-full -mr-4 -mt-4"></div>
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18c0 .55.45 1 1 1h1v3.5a1.5 1.5 0 0 0 3 0V19h2v3.5a1.5 1.5 0 0 0 3 0V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0 0 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31A5.983 5.983 0 0 0 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Android App</h3>
                    <p className="text-green-600 text-sm font-medium">SMS Gateway • v1.0.0</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {[
                    { icon: "📨", text: "Send & receive SMS via SMPP" },
                    { icon: "🔗", text: "Auto-connect to nearest server" },
                    { icon: "📊", text: "Real-time delivery reports" },
                    { icon: "🔐", text: "Encrypted communication" },
                    { icon: "🌍", text: "5 global server locations" },
                  ].map(f => (
                    <div key={f.text} className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="text-base shrink-0">{f.icon}</span>
                      <span>{f.text}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  {isLoggedIn ? (
                    <>
                      <a href={downloadUrl || "/api/tenant/android-app/download"} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3.5 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition shadow-lg shadow-green-500/25 group-hover:shadow-green-500/40 text-center inline-flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download APK (65 MB)
                      </a>
                      <p className="text-xs text-gray-400 text-center">
                        You&apos;re signed in — <a href="/dashboard/android-app" className="text-blue-500 hover:text-blue-600 underline">view setup guide</a>
                      </p>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setMode("register")} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3.5 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition shadow-lg shadow-green-500/25 group-hover:shadow-green-500/40">
                        Sign Up & Download APK →
                      </button>
                      <p className="text-xs text-gray-400 text-center">Create a free account to access the download</p>
                    </>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>🟢 Android 7.0+</span>
                    <span>📦 65 MB</span>
                    <span>🔄 Auto-updates</span>
                  </div>
                </div>
              </div>
            </div>

            {/* iOS Card */}
            <div className={`group relative bg-white rounded-3xl border-2 shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden ${showIosWaitlist ? "border-slate-400" : "border-gray-200 hover:border-gray-300"}`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-slate-400/10 to-transparent rounded-bl-full -mr-4 -mt-4"></div>
              <div className="absolute top-5 right-5">
                <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">Coming Soon</span>
              </div>
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-500/20 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">iOS <span className="text-slate-400 font-normal">(iPhone)</span></h3>
                    <p className="text-slate-500 text-sm font-medium">net2app for iOS</p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed mb-5">
                  The iOS version is currently in development. It will offer the same SMPP gateway
                  functionality — turn your iPhone into an SMS gateway with auto-discovery, background
                  connectivity, and real-time DLR.
                </p>

                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1 rounded-full border border-amber-200">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                    In Development
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-medium px-3 py-1 rounded-full">
                    SMPP v3.4
                  </span>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
                  <div className="flex items-start gap-2.5">
                    <span className="text-base shrink-0 mt-0.5">💻</span>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Build pipeline is ready via Expo EAS — iOS app compiles in the cloud.
                      Join the waitlist to be first to know when it drops.
                    </p>
                  </div>
                </div>

                {waitlistDone ? (
                  <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-xl p-5 text-center">
                    <div className="text-3xl mb-2">🎉</div>
                    <p className="text-white font-bold text-sm mb-1">You&apos;re on the list!</p>
                    <p className="text-slate-400 text-xs">We&apos;ll notify you when the iOS app launches.</p>
                  </div>
                ) : showIosWaitlist ? (
                  <form onSubmit={async (e) => { e.preventDefault(); if (!waitlistEmail) return; setWaitlistLoading(true); try { await fetch("/api/public/ios-waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: waitlistEmail }) }); setWaitlistDone(true); } catch {} setWaitlistLoading(false); }} className="flex flex-col gap-3">
                    <div className="relative">
                      <input type="email" value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)} placeholder="Enter your email address" required className="w-full border-2 border-slate-300 focus:border-slate-500 rounded-xl px-4 py-3 text-sm outline-none transition" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">📧</span>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={waitlistLoading} className="flex-1 bg-gradient-to-r from-slate-700 to-slate-900 text-white py-3 rounded-xl font-semibold hover:from-slate-800 hover:to-black transition shadow-lg disabled:opacity-50">
                        {waitlistLoading ? "Joining..." : "Join Waitlist →"}
                      </button>
                      <button type="button" onClick={() => setShowIosWaitlist(false)} className="px-4 py-3 text-sm text-slate-400 hover:text-slate-600 transition">✕</button>
                    </div>
                    <p className="text-xs text-gray-400 text-center">No spam, just a launch notification.</p>
                  </form>
                ) : (
                  <div className="flex flex-col gap-3">
                    <button onClick={() => setShowIosWaitlist(true)} className="w-full bg-gradient-to-r from-slate-700 to-slate-900 text-white py-3.5 rounded-xl font-semibold hover:from-slate-800 hover:to-black transition shadow-lg shadow-slate-500/25 group-hover:shadow-slate-500/40">
                      🔔 Get Notified When Ready
                    </button>
                    <p className="text-xs text-gray-400 text-center">
                      Join the waitlist for early access
                    </p>
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-300">
                    <span>🍎 iOS 15+</span>
                    <span>⏳ In Development</span>
                    <span>🚀 Q4 2026</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 py-12">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="group">
              <div className="text-3xl lg:text-4xl font-extrabold text-white mb-1 group-hover:scale-110 transition-transform duration-300">5</div>
              <div className="text-slate-400 text-sm font-medium">🌍 Global Server Locations</div>
              <div className="text-slate-600 text-xs mt-1">Canada, France, Germany, Australia</div>
            </div>
            <div className="group">
              <div className="text-3xl lg:text-4xl font-extrabold text-white mb-1 group-hover:scale-110 transition-transform duration-300">8+</div>
              <div className="text-slate-400 text-sm font-medium">🔌 Connection Types</div>
              <div className="text-slate-600 text-xs mt-1">SMPP, HTTP, RCS, OTT, Voice & more</div>
            </div>
            <div className="group">
              <div className="text-3xl lg:text-4xl font-extrabold text-white mb-1 group-hover:scale-110 transition-transform duration-300">99.9%</div>
              <div className="text-slate-400 text-sm font-medium">📊 Platform Uptime</div>
              <div className="text-slate-600 text-xs mt-1">Multi-region redundancy</div>
            </div>
            <div className="group">
              <div className="text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent mb-1 group-hover:scale-110 transition-transform duration-300">$0</div>
              <div className="text-slate-400 text-sm font-medium">💰 Setup & Monthly Fees</div>
              <div className="text-slate-600 text-xs mt-1">Pay only for what you use</div>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-700/50">
            <div className="flex flex-wrap items-center justify-center gap-6 text-slate-500 text-xs">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                End-to-end encrypted SMPP connections
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                Per-tenant PostgreSQL schema isolation
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                24/7 automated health monitoring
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                Deploy in under 60 seconds
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Calculator - Clean Design */}
      <div id="calculator" className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">SMS Gateway Cost Calculator</h2>
            <p className="text-gray-500">See exactly what you&apos;ll pay — no surprises, just simple bulk SMS pricing</p>
          </div>
          <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <label className="block text-gray-700 mb-3 font-medium">Monthly SMS Volume</label>
                <input type="range" min="1000" max="10000000" step="1000" value={smsVolume} onChange={e => setSmsVolume(parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                <div className="flex justify-between text-gray-500 text-sm mt-2">
                  <span>1K</span>
                  <span className="text-gray-900 font-bold text-lg">{(smsVolume / 1000).toFixed(0)}K SMS</span>
                  <span>10M</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-6 text-center shadow-lg">
                <p className="text-blue-100 text-sm mb-1">Your Monthly Cost</p>
                <p className="text-5xl font-bold text-white mb-2">${estimatedCost}</p>
                <p className="text-blue-200 text-sm">@ ${costPerSms.toFixed(5)} per SMS</p>
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

      {/* SMS Flow - Clean Design */}
      <div className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12"><h2 className="text-3xl font-bold text-gray-900 mb-3">SMPP SMS Routing Architecture</h2><p className="text-gray-500">Intelligent SMS routing with complete control at every layer — from client to mobile operator</p></div>
          <div className="bg-gray-50 border border-gray-200 rounded-3xl p-8">
            <div className="flex flex-wrap items-center justify-center gap-3 lg:gap-4 text-sm lg:text-base mb-8">
              {["Client", "→", "Route Plan", "→", "Routes", "→", "Trunks", "→", "Suppliers", "→", "Mobile"].map((s, i) =>
                s === "→" ? <span key={i} className="text-blue-500 text-2xl font-bold">→</span> :
                <span key={i} className="bg-blue-600 text-white px-4 lg:px-6 py-2 lg:py-3 rounded-xl font-medium shadow-sm">{s}</span>
              )}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-amber-700 text-sm"><strong>DLR Flow (Reverse):</strong> Mobile → Supplier → Trunks → Routes → Route Plan → Client (HTTP/ESME Push)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Features - Clean Design */}
      <div id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16"><h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Enterprise SMS Platform Features</h2><p className="text-gray-500 text-lg">Everything you need to run a professional SMS gateway operation — bulk SMS, Voice OTP, RCS, OTT</p></div>
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
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition group">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-gray-900 font-semibold text-lg mb-2 group-hover:text-blue-600 transition">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Social Proof — Customer Testimonials */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 mb-4">
              <span className="text-yellow-500 text-sm">★★★★★</span>
              <span className="text-green-700 text-sm font-medium">Rated 4.9/5 by SMS gateway operators</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">What Our Customers Say</h2>
            <p className="text-gray-500 text-lg">Join thousands of businesses that trust Net2APP for their SMS infrastructure</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote: "Net2APP's multi-tenant architecture saved us months of development. We deployed our own SMS gateway in 60 seconds and started serving clients the same day. The intelligent routing engine handles 500K+ SMS daily without a single failure.",
                name: "Ahmed R.",
                role: "CTO, Dhaka SMS Solutions",
                country: "Bangladesh",
                stars: 5,
                metric: "500K+ SMS/day",
                icon: "🇧🇩",
              },
              {
                quote: "We evaluated 8 CPaaS platforms before choosing Net2APP. The Voice OTP with Asterisk AMI integration is unmatched — 220+ country language detection just works. Our banking clients love the alphanumeric OTP support. Game changer for fintech.",
                name: "Priya S.",
                role: "VP Engineering, Mumbai FinTech",
                country: "India",
                stars: 5,
                metric: "99.7% delivery rate",
                icon: "🇮🇳",
              },
              {
                quote: "Zero setup fees and pay-as-you-go pricing let us start small and scale to enterprise volumes. The PostgreSQL schema isolation gives each of our clients complete data privacy. Best SMS gateway investment we've made.",
                name: "Mohammed K.",
                role: "Founder, Dubai Cloud Comms",
                country: "UAE",
                stars: 5,
                metric: "3x revenue growth",
                icon: "🇦🇪",
              },
              {
                quote: "The 4-layer SMS routing engine is brilliant. Route Plans → Routes → Trunks → Suppliers gives us complete control. Auto failover saved us during a major supplier outage — our clients never noticed.",
                name: "Carlos M.",
                role: "SMS Operations Lead, Global Messaging Co.",
                country: "International",
                stars: 5,
                metric: "Zero downtime",
                icon: "🌍",
              },
              {
                quote: "WhatsApp Business API + Telegram MTProto in a single platform is exactly what we needed. Device pairing is seamless and the session persistence keeps our connections stable. Deployment was incredibly fast.",
                name: "Lisa T.",
                role: "Product Manager, SEA Communications",
                country: "Singapore",
                stars: 5,
                metric: "2M+ messages/month",
                icon: "🇸🇬",
              },
              {
                quote: "We migrated from a legacy SMPP setup to Net2APP in under an hour. The pre-built connector templates for 80+ providers eliminated weeks of configuration. Our SMS delivery rates immediately improved by 12%.",
                name: "David W.",
                role: "Infrastructure Lead, UK Telecom",
                country: "United Kingdom",
                stars: 5,
                metric: "12% delivery improvement",
                icon: "🇬🇧",
              },
            ].map((t, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition p-6 flex flex-col group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">{t.icon}</div>
                  <div>
                    <div className="flex items-center gap-0.5 mb-0.5">
                      {[...Array(t.stars)].map((_, j) => (
                        <span key={j} className="text-yellow-400 text-sm">★</span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400">{t.country}</p>
                  </div>
                  <div className="ml-auto bg-green-50 border border-green-100 rounded-lg px-2.5 py-1">
                    <span className="text-xs font-bold text-green-700">{t.metric}</span>
                  </div>
                </div>
                <blockquote className="text-gray-600 text-sm leading-relaxed mb-4 flex-1 italic">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-gray-900 font-semibold text-sm">{t.name}</p>
                  <p className="text-gray-500 text-xs">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/case-studies" className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">
              Read Full Case Studies →
            </Link>
          </div>
        </div>
      </section>

      {/* Products Showcase */}
      <section id="products" className="py-20 bg-gradient-to-b from-indigo-900 to-slate-900">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-4">
            <span className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-1.5 mb-4">
              <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
              <span className="text-blue-200 text-sm font-medium">Full Product Suite</span>
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">All Net2APP Products</h2>
            <p className="text-blue-200 text-lg max-w-3xl mx-auto">From conversations and communications to authentication and customer data — a complete cloud communications platform</p>
          </div>

          {/* Conversations */}
          <div className="mb-14">
            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2"><span className="text-blue-400">💬</span> Conversations</h3>
            <p className="text-blue-400 text-sm mb-5">Build persistent, intelligent conversations across every channel</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: "Conversation Memory", desc: "Build a persistent memory of customer interactions across sessions and channels for context-aware responses.", icon: "🧠", href: "/solutions/use-cases/customer-data-management" },
                { title: "Conversation Orchestrator", desc: "Keep conversations connected across channels — SMS, WhatsApp, Voice, Email — with seamless handoff.", icon: "🎼", href: "/solutions/use-cases/support-and-sales" },
                { title: "Conversation Intelligence", desc: "Extract context, sentiment, and intent from real-time conversations to improve customer experience.", icon: "📊", href: "/solutions/use-cases/ai-agent-productivity" },
                { title: "Conversation Relay", desc: "Build advanced voice AI for natural, human-like conversations with speech recognition and TTS.", icon: "🔁", href: "/solutions/use-cases/ivr" },
              ].map((p, i) => (
                p.href ? (
                  <Link key={i} href={p.href} className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10 hover:border-blue-500/50 transition group block">
                    <span className="text-3xl block mb-3">{p.icon}</span>
                    <h4 className="text-white font-semibold group-hover:text-blue-300 transition mb-1">{p.title}</h4>
                    <p className="text-blue-300 text-sm leading-relaxed">{p.desc}</p>
                  </Link>
                ) : (
                  <div key={i} className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10 hover:border-blue-500/50 transition group">
                    <span className="text-3xl block mb-3">{p.icon}</span>
                    <h4 className="text-white font-semibold group-hover:text-blue-300 transition mb-1">{p.title}</h4>
                    <p className="text-blue-300 text-sm leading-relaxed">{p.desc}</p>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Communications */}
          <div className="mb-14">
            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2"><span className="text-green-400">📡</span> Communications</h3>
            <p className="text-blue-400 text-sm mb-5">Omnichannel communication APIs — messaging, voice, video, and email</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { title: "Messaging", icon: "💬", desc: "Multi-channel messaging API", href: "/solutions/use-cases" },
                { title: "SMS", icon: "📨", desc: "Bulk SMS & transactional SMS", href: "/http-sms-api" },
                { title: "WhatsApp", icon: "💚", desc: "WhatsApp Business API", href: "/whatsapp-telegram-api" },
                { title: "RCS", icon: "📱", desc: "Rich Communication Services", href: "/http-sms-api" },
                { title: "Voice", icon: "📞", desc: "Voice calls & IVR systems", href: "/voice-otp" },
                { title: "SIP Trunking", icon: "🔗", desc: "SIP trunk connectivity" },
                { title: "Email", icon: "✉️", desc: "Transactional & bulk email" },
                { title: "SMTP Service", icon: "⚙️", desc: "SMTP relay & delivery" },
                { title: "Phone Numbers", icon: "📋", desc: "Local & toll-free numbers" },
                { title: "Toll-Free", icon: "📞", desc: "Toll-free number provisioning" },
                { title: "IODLC", icon: "🔐", desc: "International ODLC SMS" },
                { title: "Short Codes", icon: "🔢", desc: "Short code SMS services" },
                { title: "Video API", icon: "🎥", desc: "Video calling & conferencing" },
                { title: "Flex", icon: "🔧", desc: "Flexible communication flows" },
                { title: "SMS Routing", icon: "🔀", desc: "Multi-layer intelligent SMS routing", href: "/sms-routing" },
                { title: "IP Whitelisting", icon: "🛡️", desc: "API security & access control", href: "/ip-whitelisting" },
                { title: "OTT Pairing", icon: "🔗", desc: "WhatsApp & Telegram device bridge", href: "/ott-pairing" },
              ].map((p, i) => (
                p.href ? (
                  <Link key={i} href={p.href} className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 hover:border-green-500/50 transition group text-center block">
                    <span className="text-2xl block mb-2">{p.icon}</span>
                    <h4 className="text-white font-semibold text-sm group-hover:text-green-300 transition">{p.title}</h4>
                    <p className="text-blue-400 text-xs mt-0.5">{p.desc}</p>
                  </Link>
                ) : (
                  <div key={i} className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 hover:border-green-500/50 transition group text-center">
                    <span className="text-2xl block mb-2">{p.icon}</span>
                    <h4 className="text-white font-semibold text-sm group-hover:text-green-300 transition">{p.title}</h4>
                    <p className="text-blue-400 text-xs mt-0.5">{p.desc}</p>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Authentication */}
          <div className="mb-14">
            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2"><span className="text-amber-400">🛡️</span> Authentication</h3>
            <p className="text-blue-400 text-sm mb-5">Verify user identity with global phone intelligence and OTP delivery</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              {[
                { title: "Verify", icon: "✅", desc: "Send OTPs via SMS, Voice, WhatsApp, and Telegram for user verification, account registration, password reset, and 2FA. Supports 220+ countries with automatic language detection.", href: "/solutions/use-cases/verification-and-identity" },
                { title: "Lookup", icon: "🔍", desc: "Phone number intelligence — validate numbers, detect carrier and line type, lookup operator and country info for SMS delivery optimization.", href: "/solutions/use-cases/verification-and-identity" },
              ].map((p, i) => (
                p.href ? (
                  <Link key={i} href={p.href} className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10 hover:border-amber-500/50 transition group block">
                    <span className="text-3xl block mb-3">{p.icon}</span>
                    <h4 className="text-white font-semibold group-hover:text-amber-300 transition mb-1">{p.title}</h4>
                    <p className="text-blue-300 text-sm leading-relaxed">{p.desc}</p>
                  </Link>
                ) : (
                  <div key={i} className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10 hover:border-amber-500/50 transition group">
                    <span className="text-3xl block mb-3">{p.icon}</span>
                    <h4 className="text-white font-semibold group-hover:text-amber-300 transition mb-1">{p.title}</h4>
                    <p className="text-blue-300 text-sm leading-relaxed">{p.desc}</p>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Customer Data */}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2"><span className="text-purple-400">📊</span> Customer Data</h3>
            <p className="text-blue-400 text-sm mb-5">Unify, engage, and understand your customers with data platform tools</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[
                { title: "Connections", icon: "🔗", desc: "Connect data sources & APIs" },
                { title: "Warehouses", icon: "🏛️", desc: "Customer data warehousing" },
                { title: "Protocols", icon: "📋", desc: "Data protocol management" },
                { title: "Unify", icon: "🔄", desc: "Unify customer profiles" },
                { title: "Engage", icon: "📣", desc: "Multi-channel engagement" },
                { title: "Audiences", icon: "👥", desc: "Audience segmentation" },
                { title: "Journeys", icon: "🗺️", desc: "Customer journey automation" },
              ].map((p, i) => (
                <div key={i} className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 hover:border-purple-500/50 transition group text-center">
                  <span className="text-2xl block mb-2">{p.icon}</span>
                  <h4 className="text-white font-semibold text-sm group-hover:text-purple-300 transition">{p.title}</h4>
                  <p className="text-blue-400 text-xs mt-0.5">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center mt-10">
            <Link href="/solutions/see-all" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">
              See all products and solutions →
            </Link>
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* SEO Internal Links */}
      <section className="py-12 bg-slate-900 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Explore Net2APP Services</h2>
            <p className="text-blue-300 text-sm">In-depth guides and documentation for every Net2APP service</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { href: "/voice-otp", label: "Voice OTP Service", icon: "📞" },
              { href: "/http-sms-api", label: "HTTP SMS API", icon: "🌐" },
              { href: "/sms-routing", label: "SMS Routing", icon: "🔀" },
              { href: "/ott-pairing", label: "OTT Device Pairing", icon: "📱" },
              { href: "/whatsapp-telegram-api", label: "WhatsApp & Telegram", icon: "💬" },
              { href: "/ip-whitelisting", label: "IP Whitelisting", icon: "🛡️" },
              { href: "/blog", label: "Blog & Guides", icon: "📝" },
              { href: "/pricing", label: "Pricing Plans", icon: "💰" },
              { href: "/case-studies", label: "Case Studies", icon: "📊" },
              { href: "/comparisons", label: "Compare SMS Platforms", icon: "⚖️" },
              { href: "/resources", label: "Resources & Docs", icon: "📚" },
              { href: "/api-documentation", label: "API Reference", icon: "📡" },
            ].map((link, i) => (
              <Link
                key={i}
                href={link.href}
                className="bg-white/5 backdrop-blur border border-white/10 rounded-xl px-4 py-4 text-center hover:bg-white/10 hover:border-blue-500/50 transition group"
              >
                <div className="text-2xl mb-1">{link.icon}</div>
                <span className="text-blue-200 text-sm font-medium group-hover:text-white transition">{link.label}</span>
              </Link>
            ))}
          </div>

          {/* Use Cases SEO Links */}
          <div className="mt-12 pt-10 border-t border-white/10">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-1">SMS Solutions by Use Case</h2>
              <p className="text-blue-300 text-sm">Specialized SMS and CPaaS solutions for every business requirement</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { href: "/solutions/use-cases/verification-and-identity", label: "Verification & Identity", icon: "✅" },
                { href: "/solutions/use-cases/fraud-prevention", label: "Fraud Prevention", icon: "🛡️" },
                { href: "/solutions/use-cases/sms-marketing", label: "SMS Marketing", icon: "💰" },
                { href: "/solutions/use-cases/marketing-and-promotions", label: "Marketing & Promotions", icon: "📣" },
                { href: "/solutions/use-cases/mass-texting", label: "Mass Texting", icon: "📨" },
                { href: "/solutions/use-cases/alerts-and-notifications", label: "Alerts & Notifications", icon: "🔔" },
                { href: "/solutions/use-cases/appointment-reminders", label: "Appointment Reminders", icon: "📅" },
                { href: "/solutions/use-cases/lead-alerts", label: "Lead Alerts", icon: "🚨" },
                { href: "/solutions/use-cases/ai-agent-productivity", label: "AI Agent Productivity", icon: "🤖" },
                { href: "/solutions/use-cases/support-and-sales", label: "Support & Sales", icon: "💬" },
                { href: "/solutions/use-cases/cross-sell-and-upsell", label: "Cross-Sell & Upsell", icon: "📈" },
                { href: "/solutions/use-cases/customer-data-management", label: "Customer Data", icon: "🧠" },
                { href: "/solutions/use-cases/ivr", label: "IVR Systems", icon: "🔁" },
                { href: "/solutions/use-cases/contact-center", label: "Contact Center", icon: "📞" },
                { href: "/solutions/use-cases/optimize-ad-spend", label: "Optimize Ad Spend", icon: "📊" },
              ].map((link, i) => (
                <Link
                  key={i}
                  href={link.href}
                  className="bg-white/5 backdrop-blur border border-white/10 rounded-xl px-4 py-4 text-center hover:bg-white/10 hover:border-blue-500/50 transition group"
                >
                  <div className="text-2xl mb-1">{link.icon}</div>
                  <span className="text-blue-200 text-sm font-medium group-hover:text-white transition">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Teams SEO Links */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-1">SMS Solutions by Team</h2>
              <p className="text-blue-300 text-sm">Role-specific SMS tools for developers, marketers, product managers, and more</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { href: "/solutions/teams/developers", label: "Developer Tools", icon: "💻" },
                { href: "/solutions/teams/data-engineering", label: "Data Engineering", icon: "📊" },
                { href: "/solutions/teams/marketing", label: "Marketing Teams", icon: "📣" },
                { href: "/solutions/teams/product", label: "Product Teams", icon: "🎯" },
                { href: "/solutions/teams/customer-experience", label: "Customer Experience", icon: "❤️" },
              ].map((link, i) => (
                <Link
                  key={i}
                  href={link.href}
                  className="bg-white/5 backdrop-blur border border-white/10 rounded-xl px-4 py-4 text-center hover:bg-white/10 hover:border-blue-500/50 transition group"
                >
                  <div className="text-2xl mb-1">{link.icon}</div>
                  <span className="text-blue-200 text-sm font-medium group-hover:text-white transition">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Industries SEO Links */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-1">SMS Solutions by Industry</h2>
              <p className="text-blue-300 text-sm">Industry-specific SMS platforms for finance, healthcare, retail, education, and more</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { href: "/solutions/industries/financial-services", label: "Financial Services", icon: "🏦" },
                { href: "/solutions/industries/healthcare", label: "Healthcare", icon: "🏥" },
                { href: "/solutions/industries/ecommerce", label: "Ecommerce", icon: "🛒" },
                { href: "/solutions/industries/retail", label: "Retail", icon: "🏪" },
                { href: "/solutions/industries/education", label: "Education", icon: "🎓" },
                { href: "/solutions/industries/hospitality", label: "Hospitality", icon: "🏨" },
                { href: "/solutions/industries/nonprofit", label: "Nonprofit", icon: "🤝" },
                { href: "/solutions/industries/public-sector", label: "Public Sector", icon: "🏛️" },
              ].map((link, i) => (
                <Link
                  key={i}
                  href={link.href}
                  className="bg-white/5 backdrop-blur border border-white/10 rounded-xl px-4 py-4 text-center hover:bg-white/10 hover:border-blue-500/50 transition group"
                >
                  <div className="text-2xl mb-1">{link.icon}</div>
                  <span className="text-blue-200 text-sm font-medium group-hover:text-white transition">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Keyword-Rich Content for Search Engines */}
      <section className="py-16 bg-slate-900">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-white font-bold text-lg mb-3">SMS Gateway & Voice OTP Services</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Net2APP provides a complete SMS gateway platform with SMPP v3.4, HTTP SMS API, bulk SMS messaging, Voice OTP with Asterisk AMI integration, RCS messaging, Flash SMS, and OTT messaging via WhatsApp Business API and Telegram. Our multi-tenant SMS platform supports A2P SMS, P2P SMS, transactional SMS, OTP SMS, and SMS marketing with intelligent routing, DLR delivery reports, and real-time analytics. Deploy your own white-label SMS gateway with zero setup fees.
              </p>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-3">Conversations, Communications & Authentication APIs</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Net2APP offers a complete CPaaS (Communications Platform as a Service) product suite including Conversation Memory for persistent customer interaction history, Conversation Orchestrator for cross-channel continuity, and Conversation Intelligence for real-time sentiment analysis. Our communications APIs cover SMS, WhatsApp Business, RCS, Voice, SIP Trunking, Email SMTP, Toll-Free numbers, IODLC, Short Codes, and Video APIs. Authentication services include Verify (OTP delivery via SMS, Voice, WhatsApp, Telegram) and Lookup (phone number intelligence, carrier detection, and line type validation across 220+ countries).
              </p>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-3">Global Coverage — Bangladesh, India, UAE, Middle East & Beyond</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Net2APP serves customers worldwide including Bangladesh, India, UAE, and the Middle East. Our Voice OTP engine supports 220+ countries with automatic MCC-based language detection. Partners include Reve SMS, 5GVision, LRS, Al Muqeet, Bangladesh Operators, and UAE Enterprises. Our Customer Data Platform (CDP) includes Connections for data source integration, customer data Warehousing, profile Unification, multi-channel Engagement, audience segmentation, and Journey automation. Whether you need an enterprise SMS server, cloud communications platform, or white-label CPaaS — deploy in 60 seconds with zero setup cost.
              </p>
            </div>
          </div>

          {/* SMPP Gateway Bangladesh */}
          <div className="mt-16 pt-12 border-t border-white/10">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">SMPP Gateway Bangladesh — Connect to Grameenphone, Robi, Banglalink & Teletalk</h2>
              <p className="text-blue-300 text-sm max-w-3xl mx-auto">The most reliable SMPP gateway for Bangladesh telecom operators with direct connectivity, local routing, and Bangla language SMS support</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-3">Bangladesh Operator Connectivity</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Net2APP SMPP gateway provides direct connectivity to all major Bangladesh mobile operators — Grameenphone (GP), Robi Axiata, Banglalink, and Teletalk. Our SMPP v3.4 server supports transmitter, receiver, and transceiver binds for A2P SMS and bulk SMS delivery across Bangladesh. With local routing optimization and automatic failover, we achieve 99%+ delivery rates for Bangladesh SMS traffic. Whether you&apos;re sending OTP verification codes, transactional alerts, or marketing campaigns to Bangladeshi mobile users, our SMPP gateway ensures reliable message delivery with real-time DLR (Delivery Receipt) tracking for every SMS sent to GP, Robi, Banglalink, and Teletalk networks.
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-3">Bangla SMS & Unicode Support</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Send Bangla SMS (বাংলা এসএমএস) messages using Unicode UCS-2 encoding through our SMPP gateway. Full support for Bengali script characters, mixed Bangla-English messages, and concatenated long SMS up to 918 characters. Our platform automatically handles encoding detection and message segmentation for Bangla language content. Ideal for Bangladeshi businesses sending promotional SMS, appointment reminders, banking alerts, ecommerce notifications, and government communications in Bengali language. Compatible with all Bangladesh mobile handsets — from basic feature phones to smartphones on GP, Robi, Banglalink, and Teletalk networks.
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-3">Bangladesh SMS Reseller Platform</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Start your own SMS reseller business in Bangladesh with Net2APP&apos;s white-label multi-tenant platform. Create unlimited sub-clients with individual SMPP binds, routing plans, and SMS rates for Grameenphone, Robi, Banglalink, and Teletalk. Each reseller gets an isolated PostgreSQL schema for complete data privacy. Set custom per-operator SMS pricing, manage client balances, and track delivery reports across all Bangladesh operators. Perfect for Bangladeshi IT companies, telecom startups, and SMS aggregators looking to offer bulk SMS services in Dhaka, Chittagong, Sylhet, and across Bangladesh without building their own SMPP infrastructure from scratch.
                </p>
              </div>
            </div>
            <div className="mt-6 bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-2">SMPP Gateway Bangladesh — Pricing & Features</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Net2APP SMPP gateway Bangladesh offers the most competitive pricing for bulk SMS in Bangladesh. Pay-as-you-go at just ${costPerSms.toFixed(5)}/SMS with zero setup fees and zero monthly minimums. Features include: direct SMPP v3.4 connectivity to GP, Robi, Banglalink, and Teletalk; automatic MCC-MNC based routing to Bangladeshi operators; Bangla Unicode SMS support; real-time DLR delivery reports; SMPP bind monitoring dashboard; ESME client management; throughput throttling (TPS control); and 24/7 technical support. Deploy your SMPP gateway for Bangladesh in under 60 seconds — no server setup required. Whether you need an SMPP gateway Dhaka, SMPP server Bangladesh, or white-label SMS platform for Bangladeshi operators, Net2APP delivers enterprise-grade reliability at a fraction of the cost of building your own infrastructure.
              </p>
            </div>
          </div>

          {/* Voice OTP Provider */}
          <div className="mt-16 pt-12 border-t border-white/10">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Voice OTP Provider — Automated Phone Call Verification for 220+ Countries</h2>
              <p className="text-blue-300 text-sm max-w-3xl mx-auto">Enterprise Voice OTP service with Asterisk AMI integration, automatic MCC-based language detection, and alphanumeric OTP delivery</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-3">How Voice OTP Verification Works</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Voice OTP (One-Time Password) delivers verification codes via automated phone calls instead of SMS. When your application requests a Voice OTP, our Asterisk AMI engine places a call to the user&apos;s phone number and reads the OTP code aloud using text-to-speech in the recipient&apos;s native language. Voice OTP achieves higher delivery rates than SMS OTP in regions with unreliable SMS delivery, making it ideal for banking, fintech, ecommerce, and government applications. Our Voice OTP service supports alphanumeric sender IDs, customizable call scripts, retry logic for busy/no-answer, and real-time call status webhooks. Perfect for two-factor authentication (2FA), password reset verification, transaction confirmation, and account registration.
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-3">220+ Country Language Detection</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Net2APP&apos;s Voice OTP engine automatically detects the recipient&apos;s country using MCC (Mobile Country Code) and delivers the OTP in the appropriate language. Supports 220+ countries and 50+ languages including English, Arabic, Bengali, Hindi, Urdu, Spanish, French, Portuguese, Russian, Chinese, Japanese, Korean, Turkish, German, Italian, Malay, Indonesian, Thai, Vietnamese, and more. Our intelligent language mapping ensures Bangladeshi users receive OTPs in Bangla (বাংলা), UAE users in Arabic (العربية), Indian users in Hindi or English based on region, and European users in their local languages. This dramatically improves OTP comprehension and conversion rates compared to English-only voice verification services.
                </p>
              </div>
            </div>
            <div className="mt-6 bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-2">Voice OTP vs SMS OTP — Which Is Right for Your Business?</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Voice OTP outperforms SMS OTP in markets with unreliable SMS infrastructure, high SMS filtering rates, or users without smartphones. Voice OTP achieves 95%+ delivery rates even in regions where SMS OTP delivery drops below 70%. It&apos;s also immune to SMS pumping fraud, SIM swap attacks, and SMS interception — making it more secure for high-value transactions. Use Voice OTP for: banking OTP verification, WhatsApp OTP alternatives, Telegram verification codes, ecommerce order confirmation, food delivery verification, ride-sharing authentication, and government ID verification. Net2APP&apos;s Voice OTP service integrates via REST API with simple JSON requests — no Asterisk expertise required. Get started with Voice OTP in minutes with our comprehensive API documentation and code examples for Node.js, Python, PHP, Java, and cURL.
              </p>
            </div>
          </div>

          {/* White-Label CPaaS Platform */}
          <div className="mt-16 pt-12 border-t border-white/10">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">White-Label CPaaS Platform — Launch Your Own SMS Gateway Business</h2>
              <p className="text-blue-300 text-sm max-w-3xl mx-auto">Fully white-label Communications Platform as a Service with custom branding, domain, and multi-tenant architecture for SMS resellers and telecom entrepreneurs</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-3">Complete White-Label Solution</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Launch your own branded SMS gateway platform with Net2APP&apos;s white-label CPaaS. Customize every aspect — your logo, domain name, color scheme, email templates, and pricing packages. Your clients will see your brand, not Net2APP. The white-label platform includes: fully branded tenant dashboard with your logo and colors, custom domain (e.g., sms.yourcompany.com), white-label API endpoints, branded email notifications (welcome emails, invoice emails, DLR alerts), customizable pricing packages (Starter, Professional, Enterprise), and branded invoice templates. Perfect for telecom operators, IT service providers, marketing agencies, and entrepreneurs looking to enter the $60+ billion CPaaS market with their own branded SMS platform.
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-3">Multi-Tenant SMS Reseller Architecture</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Net2APP&apos;s white-label CPaaS is built on a true multi-tenant architecture with PostgreSQL schema isolation. Each of your SMS reseller clients gets a completely isolated database schema — no data leakage, no cross-tenant visibility. Manage unlimited sub-clients with individual SMPP binds, HTTP API keys, routing plans, SMS rates, and balance management. Set custom per-client pricing for different operators and routes. Monitor client usage, track delivery reports, and generate detailed billing invoices automatically. The multi-tenant dashboard gives you complete visibility across all your SMS reseller clients with real-time analytics, delivery rate monitoring, revenue tracking, and profit margin analysis per client, per route, and per operator.
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-3">CPaaS Features for Resellers</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Your white-label CPaaS comes with everything your SMS reseller clients need: SMPP v3.4 gateway with transmitter/receiver/transceiver binds, RESTful HTTP SMS API with API key authentication, Voice OTP with Asterisk AMI and 220+ country language detection, 4-layer intelligent SMS routing (Route Plans → Routes → Trunks → Suppliers), WhatsApp Business API via Baileys, Telegram MTProto messaging, RCS Rich Communication Services, Flash SMS, DLR delivery reports with webhook callbacks, sub-client management with individual rates and routing, IP whitelisting for API security, automated billing and invoicing, and real-time analytics dashboard. All features are available to your reseller clients under your white-label brand — they see your platform, not Net2APP.
                </p>
              </div>
            </div>
            <div className="mt-6 grid md:grid-cols-2 gap-6">
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-3">SMS Reseller Business Model — How It Works</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Start an SMS reseller business with zero infrastructure investment. You buy SMS capacity at wholesale rates and resell to your clients at retail prices — keeping the profit margin. Net2APP handles all the technical infrastructure: SMPP servers, Asterisk voice servers, PostgreSQL databases, SMS routing engine, and DLR tracking. You focus on acquiring clients and growing your business. Set your own pricing: charge clients per SMS, offer monthly packages with included SMS bundles, or create custom enterprise plans. The platform automatically tracks usage, generates invoices, and manages client balances. With profit margins of 30-60% on SMS traffic, a single client sending 1 million SMS/month generates $100-$600 in monthly recurring revenue for your white-label SMS reseller business.
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-3">Who Uses White-Label CPaaS Platforms?</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  White-label CPaaS platforms are used by: telecom operators launching branded SMS services for enterprise clients; IT service companies adding SMS API services to their product portfolio; digital marketing agencies offering SMS marketing as a managed service; software companies embedding SMS notifications into their SaaS products; entrepreneurs starting SMS reseller businesses in Bangladesh, India, UAE, Pakistan, Nigeria, Kenya, and other high-growth markets; financial institutions building branded OTP verification systems; ecommerce platforms adding SMS order notifications; healthcare providers implementing appointment reminder systems; and government agencies deploying citizen notification platforms. Any business that wants to offer SMS, Voice OTP, or messaging APIs under their own brand can use Net2APP&apos;s white-label CPaaS to launch in days, not months.
                </p>
              </div>
            </div>
          </div>

          {/* Bulk SMS API & A2P SMS Gateway */}
          <div className="mt-16 pt-12 border-t border-white/10">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Bulk SMS API & A2P SMS Gateway — Send Thousands of Messages Per Second</h2>
              <p className="text-blue-300 text-sm max-w-3xl mx-auto">Enterprise-grade bulk SMS API for transactional, promotional, and OTP messaging with A2P SMS delivery to 220+ countries</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-3">HTTP Bulk SMS API</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Send bulk SMS programmatically via our RESTful HTTP API. Simple JSON POST requests with your API key — no SMPP expertise needed. Features include: bulk SMS sending (single API call for thousands of recipients), personalized message templates with variable substitution, scheduled SMS delivery, Unicode support for all languages, concatenated long SMS (up to 918 characters), customizable sender IDs (alphanumeric or numeric), real-time delivery status webhooks, message status query API, and comprehensive error codes. Our HTTP SMS API handles 10,000+ messages per second with &lt;100ms latency. SDKs available for Node.js, Python, PHP, Java, Ruby, Go, and .NET. Perfect for developers who need a simple, reliable way to integrate bulk SMS sending into their applications.
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-3">A2P SMS Gateway</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Application-to-Person (A2P) SMS gateway for sending automated messages from applications to mobile users. Use cases include: two-factor authentication (2FA) codes, one-time passwords (OTP), transaction alerts, account notifications, appointment reminders, delivery updates, password reset codes, welcome messages, verification codes, and security alerts. Our A2P SMS gateway routes messages through the most reliable operator connections for maximum deliverability. Features include: automatic route selection based on destination MCC-MNC, failover routing across multiple suppliers, real-time DLR tracking, delivery rate analytics by country and operator, sender ID registration and management, and compliance with local telecom regulations. Achieve 98%+ delivery rates for A2P SMS traffic with our intelligent routing engine.
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-3">Transactional & Promotional SMS</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Separate routing paths for transactional SMS (OTP, alerts, notifications) and promotional SMS (marketing, offers, campaigns). Transactional SMS gets priority routing through direct operator connections for guaranteed delivery. Promotional SMS routes through cost-optimized paths while maintaining high deliverability. Features include: automatic traffic classification (transactional vs promotional), separate sender ID pools, DND (Do Not Disturb) list management, opt-out keyword handling (STOP, UNSUBSCRIBE), campaign scheduling, delivery window configuration, and detailed analytics by message type. Our platform helps you comply with TRAI (India), BTRC (Bangladesh), TDRA (UAE), and other telecom regulations while maximizing delivery rates for both transactional and promotional SMS traffic.
                </p>
              </div>
            </div>
            <div className="mt-6 bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 text-center">
              <h3 className="text-white font-semibold mb-2">Start Sending Bulk SMS Today — ${costPerSms.toFixed(5)}/SMS with Zero Setup Fees</h3>
              <p className="text-slate-400 text-sm leading-relaxed max-w-3xl mx-auto">
                Get your bulk SMS API credentials in under 60 seconds. No contracts, no minimum commitments, no setup fees. Send test SMS messages immediately after registration. Our bulk SMS platform supports all major use cases: OTP SMS, transactional alerts, promotional campaigns, appointment reminders, delivery notifications, banking alerts, ecommerce confirmations, and more. With 220+ country coverage, 50+ language support, and 99%+ uptime SLA, Net2APP is the reliable choice for businesses sending bulk SMS at scale. Whether you need to send 1,000 or 10 million SMS per month, our platform scales with your business — automatically, with no infrastructure management required.
              </p>
            </div>
          </div>

          {/* Regional & Service Keywords */}
          <div className="mt-16 pt-12 border-t border-white/10">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">SMS Gateway Services by Region & Industry</h2>
              <p className="text-blue-300 text-sm">Enterprise SMS solutions tailored for Bangladesh, India, UAE, Middle East, Africa, and Asia-Pacific markets</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { title: "SMPP Gateway Bangladesh", desc: "GP, Robi, Banglalink, Teletalk connectivity with Bangla SMS support" },
                { title: "Bulk SMS Bangladesh", desc: "Cheapest bulk SMS rates for Dhaka, Chittagong, Sylhet businesses" },
                { title: "SMS API India", desc: "Transactional & promotional SMS for Indian businesses — TRAI compliant" },
                { title: "Voice OTP UAE", desc: "Arabic & English voice OTP for Dubai, Abu Dhabi banking & fintech" },
                { title: "SMS Gateway Dubai", desc: "Enterprise SMS gateway for UAE businesses with TDRA compliance" },
                { title: "CPaaS Middle East", desc: "White-label CPaaS for Middle East telecom operators & IT companies" },
                { title: "Bulk SMS Pakistan", desc: "SMPP connectivity to Jazz, Telenor, Zong, Ufone for Pakistani businesses" },
                { title: "SMS Gateway Nigeria", desc: "A2P SMS delivery to MTN, Glo, Airtel, 9mobile in Nigeria" },
                { title: "SMS Reseller Platform", desc: "Start your own SMS business with white-label multi-tenant platform" },
                { title: "OTP SMS Service", desc: "One-time password delivery via SMS, Voice, WhatsApp & Telegram" },
                { title: "WhatsApp Business API", desc: "Send WhatsApp messages via Baileys with device pairing & QR login" },
                { title: "SMS Marketing Platform", desc: "Bulk promotional SMS campaigns with analytics & DND management" },
                { title: "SMPP Server Hosting", desc: "Managed SMPP v3.4 server with ESME client management & monitoring" },
                { title: "A2P SMS Aggregator", desc: "Multi-operator A2P SMS routing with automatic failover & DLR tracking" },
                { title: "RCS Messaging", desc: "Rich Communication Services — next-generation SMS with images & buttons" },
                { title: "Flash SMS Provider", desc: "Priority screen flash messages for urgent alerts & emergency notifications" },
              ].map((item, i) => (
                <div key={i} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 hover:border-blue-500/40 transition group">
                  <h4 className="text-white text-sm font-semibold mb-1 group-hover:text-blue-300 transition">{item.title}</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Connection Types - Clean Design */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">SMS Gateway Connection Types</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {["SMPP", "HTTP API", "RCS", "Flash SMS", "Voice OTP", "OTT", "Business API", "Email"].map((t, i) => (
              <span key={i} className="bg-white border border-gray-200 px-5 py-2.5 rounded-xl text-gray-700 font-medium text-sm hover:border-blue-300 hover:text-blue-600 transition shadow-sm">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing - Clean Design */}
      {/* Promo Card above Pricing */}
      {promo?.active && (
        <div className="py-16 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50">
          <div className="max-w-4xl mx-auto px-6 lg:px-8">
            <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-lg overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-8 flex items-center justify-center">
                  <div className="text-center text-white">
                    <p className="text-5xl mb-2">🎉</p>
                  <p className="text-3xl font-extrabold">+{(promo?.bonusSms ?? 100000).toLocaleString()}</p>
                  <p className="text-lg font-semibold">Bonus SMS</p>
                  </div>
                </div>
                <div className="p-8 flex flex-col justify-center">
                  <p className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-2">{promo.title}</p>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{promo.text}</h3>
                  <p className="text-gray-600 mb-4">Make your first Starter payment of {(promo?.minAmount ?? 250000).toLocaleString()} or more and get {(promo?.bonusSms ?? 100000).toLocaleString()} bonus SMS added to your account. One-time offer for new tenants only.</p>
                  <button onClick={() => setMode("register")} className="self-start px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition font-semibold shadow-sm">Claim this offer →</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">SMS Gateway Pricing — $0 Setup, Pay-As-You-Go</h2>
            <p className="text-gray-500 text-lg">No setup fees • No hidden fees • Pay only for SMS sent • Bulk SMS rates from ${costPerSms.toFixed(5)}/SMS</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className={`bg-white border rounded-3xl p-8 shadow-sm hover:shadow-md transition ${promo?.active ? "border-amber-400 shadow-lg shadow-amber-100" : "border-gray-200"}`}>
              {promo?.active && (
                <div className="-mt-12 mb-4">
                  <span className="inline-block bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md">🔥 {promo.badge}</span>
                </div>
              )}
              <h3 className="text-2xl font-bold text-gray-900 mb-1">Starter</h3>
              <div className="mb-2"><span className="text-4xl font-bold text-gray-900">Free</span><span className="text-gray-500 ml-2 text-sm">platform access</span></div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 space-y-1">
                <p className="text-xs text-green-700 font-semibold">🎁 <strong>{promo?.signupBonus ?? 100} free SMS</strong> on signup</p>
                <p className="text-xs text-green-700 font-semibold">💰 <strong>+{(promo?.bonusSms ?? 100000).toLocaleString()} bonus SMS</strong> on first payment ≥ {(promo?.minAmount ?? 250000).toLocaleString()}</p>
              </div>
              <p className="text-gray-500 mb-6 text-sm font-medium">Pay-as-you-go • ${costPerSms.toFixed(5)}/SMS</p>
              <ul className="space-y-3 mb-8">
                {(starterPkg?.features || ["Isolated database","50 TPS","HTTP API","Basic routing","5 sub-clients","Email support"]).map((f: string, j: number) => (
                  <li key={j} className="flex items-center gap-2 text-gray-600 text-sm"><svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> {f}</li>
                ))}
              </ul>
              <button onClick={() => setMode("register")} className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition">Get Started Free</button>
            </div>

            {/* Professional */}
            <div className="bg-white border-2 border-blue-500 rounded-3xl p-8 shadow-lg scale-105 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">Most Popular</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">Professional</h3>
              <div className="mb-2"><span className="text-4xl font-bold text-gray-900">${proMonthly}</span><span className="text-gray-500 ml-2 text-sm">/month</span></div>
              <p className="text-gray-500 mb-6 text-sm font-medium">Dedicated server • 200 TPS • 10M SMS included</p>
              <ul className="space-y-3 mb-8">
                {(proPkg?.features || ["Everything in Starter","Dedicated server","200 TPS","10M SMS/month INCLUDED","NO per-SMS charge","SMPP & Voice OTP","Unlimited clients","Priority support"]).map((f: string, j: number) => (
                  <li key={j} className="flex items-center gap-2 text-gray-600 text-sm"><svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> {f}</li>
                ))}
              </ul>
              <button onClick={() => setMode("register")} className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition">Get Started</button>
            </div>

            {/* Enterprise */}
            <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm hover:shadow-md transition">
              <h3 className="text-2xl font-bold text-gray-900 mb-1">Enterprise</h3>
              <div className="mb-2"><span className="text-4xl font-bold text-gray-900">${entMonthly}</span><span className="text-gray-500 ml-2 text-sm">/month</span></div>
              <p className="text-gray-500 mb-6 text-sm font-medium">Unlimited everything • All services</p>
              <ul className="space-y-3 mb-8">
                {(entPkg?.features || ["Everything in Pro","Unlimited TPS","Unlimited volume","All connection types","RCS & OTT & WhatsApp","White-label","24/7 support","SLA guarantee"]).map((f: string, j: number) => (
                  <li key={j} className="flex items-center gap-2 text-gray-600 text-sm"><svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> {f}</li>
                ))}
              </ul>
              <button onClick={() => setMode("register")} className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition">Contact Sales</button>
            </div>
          </div>
          <div className="mt-12 bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
            <p className="text-blue-800 text-lg font-medium">💰 All plans: <strong className="text-blue-900">${costPerSms.toFixed(5)} per SMS</strong> • No setup fees • No monthly fees • No hidden fees</p>
            <p className="text-blue-600 text-sm mt-1">Rates and package prices updated dynamically from admin panel</p>
          </div>
        </div>
      </div>

      {/* CTA - Clean Design */}
      <div className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Deploy Your SMS Gateway Platform — Free, Instant Setup</h2>
          <p className="text-blue-100 text-lg mb-8">Get your isolated multi-tenant SMS platform running in under 60 seconds. SMPP, HTTP API, Voice OTP, RCS included. Completely free to start.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={() => setMode("register")} className="px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</button>
            <Link href="/contact" className="px-10 py-4 border-2 border-white/40 text-white rounded-xl hover:bg-white/10 transition font-semibold text-lg">Talk to Sales</Link>
          </div>
        </div>
      </div>

      {/* Footer - Clean Design */}
      <footer className="bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div>
                <span className="text-white font-semibold text-lg">Net2APP</span>
              </div>
              <p className="text-gray-400 text-sm max-w-md leading-relaxed">Enterprise SMS Gateway & Voice OTP Platform. Multi-tenant SaaS with SMPP, HTTP API, RCS, Voice OTP, and OTT messaging. No setup fees — pay only for what you use.</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Products</p>
              <div className="space-y-2.5">
                <Link href="/http-sms-api" className="block text-sm text-gray-400 hover:text-white transition">SMS API</Link>
                <Link href="/voice-otp" className="block text-sm text-gray-400 hover:text-white transition">Voice OTP</Link>
                <Link href="/whatsapp-telegram-api" className="block text-sm text-gray-400 hover:text-white transition">WhatsApp API</Link>
                <Link href="/sms-routing" className="block text-sm text-gray-400 hover:text-white transition">SMS Routing</Link>
                <Link href="/ip-whitelisting" className="block text-sm text-gray-400 hover:text-white transition">IP Whitelisting</Link>
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Resources</p>
              <div className="space-y-2.5">
                <Link href="/blog" className="block text-sm text-gray-400 hover:text-white transition">Blog</Link>
                <Link href="/case-studies" className="block text-sm text-gray-400 hover:text-white transition">Case Studies</Link>
                <Link href="/comparisons" className="block text-sm text-gray-400 hover:text-white transition">Comparisons</Link>
                <Link href="/resources" className="block text-sm text-gray-400 hover:text-white transition">Resources</Link>
                <Link href="/api-documentation" className="block text-sm text-gray-400 hover:text-white transition">API Docs</Link>
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Company</p>
              <div className="space-y-2.5">
                <Link href="/solutions" className="block text-sm text-gray-400 hover:text-white transition">Solutions</Link>
                <Link href="/pricing" className="block text-sm text-gray-400 hover:text-white transition">Pricing</Link>
                <Link href="/contact" className="block text-sm text-gray-400 hover:text-white transition">Contact</Link>
                <a href="/webmail" className="block text-sm text-gray-400 hover:text-white transition">Webmail</a>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pt-10 mt-10 border-t border-gray-800">
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Use Cases</p>
              <div className="space-y-2.5">
                <Link href="/solutions/use-cases/verification-and-identity" className="block text-sm text-gray-400 hover:text-white transition">Verification & Identity</Link>
                <Link href="/solutions/use-cases/fraud-prevention" className="block text-sm text-gray-400 hover:text-white transition">Fraud Prevention</Link>
                <Link href="/solutions/use-cases/sms-marketing" className="block text-sm text-gray-400 hover:text-white transition">SMS Marketing</Link>
                <Link href="/solutions/use-cases/mass-texting" className="block text-sm text-gray-400 hover:text-white transition">Mass Texting</Link>
                <Link href="/solutions/use-cases/alerts-and-notifications" className="block text-sm text-gray-400 hover:text-white transition">Alerts & Notifications</Link>
                <Link href="/solutions/use-cases/ai-agent-productivity" className="block text-sm text-gray-400 hover:text-white transition">AI Agent Productivity</Link>
                <Link href="/solutions/use-cases" className="block text-sm text-blue-400 hover:text-blue-300 transition font-medium mt-1">See all 15 use cases →</Link>
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">By Team</p>
              <div className="space-y-2.5">
                <Link href="/solutions/teams/developers" className="block text-sm text-gray-400 hover:text-white transition">Developer Tools</Link>
                <Link href="/solutions/teams/data-engineering" className="block text-sm text-gray-400 hover:text-white transition">Data Engineering</Link>
                <Link href="/solutions/teams/marketing" className="block text-sm text-gray-400 hover:text-white transition">Marketing Teams</Link>
                <Link href="/solutions/teams/product" className="block text-sm text-gray-400 hover:text-white transition">Product Teams</Link>
                <Link href="/solutions/teams/customer-experience" className="block text-sm text-gray-400 hover:text-white transition">Customer Experience</Link>
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">By Industry</p>
              <div className="space-y-2.5">
                <Link href="/solutions/industries/financial-services" className="block text-sm text-gray-400 hover:text-white transition">Financial Services</Link>
                <Link href="/solutions/industries/healthcare" className="block text-sm text-gray-400 hover:text-white transition">Healthcare</Link>
                <Link href="/solutions/industries/ecommerce" className="block text-sm text-gray-400 hover:text-white transition">Ecommerce</Link>
                <Link href="/solutions/industries/retail" className="block text-sm text-gray-400 hover:text-white transition">Retail</Link>
                <Link href="/solutions/industries/education" className="block text-sm text-gray-400 hover:text-white transition">Education</Link>
                <Link href="/solutions/industries/hospitality" className="block text-sm text-gray-400 hover:text-white transition">Hospitality</Link>
                <Link href="/solutions/industries" className="block text-sm text-blue-400 hover:text-blue-300 transition font-medium mt-1">See all 8 industries →</Link>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p>
            <div className="flex items-center gap-6">
              <StatusBadge />
              <div className="flex items-center gap-4">
                <Link href="/blog" className="text-gray-500 hover:text-gray-300 text-sm transition">Blog</Link>
                <Link href="/pricing" className="text-gray-500 hover:text-gray-300 text-sm transition">Pricing</Link>
                <Link href="/case-studies" className="text-gray-500 hover:text-gray-300 text-sm transition">Case Studies</Link>
                <Link href="/contact" className="text-gray-500 hover:text-gray-300 text-sm transition">Contact</Link>
                <a href="/super" className="text-gray-600 hover:text-gray-400 text-sm transition">Admin</a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Tawk.to Chat Script with message persistence ── */}
      {TAWKTO_ID && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();

// ── Hook into Tawk.to JS API to persist chat messages ──
var _tawkSave = function(data) {
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/public/tawk-chat', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(data));
  } catch(e) {}
};

Tawk_API.onChatStarted = function(chat) {
  _tawkSave({
    propertyId: '${TAWKTO_ID}',
    chatId: chat.id || '',
    senderType: 'visitor',
    senderName: (chat.visitor||{}).name || 'Visitor',
    message: 'Chat started',
    messageTimestamp: new Date().toISOString(),
    visitorName: (chat.visitor||{}).name || '',
    visitorEmail: (chat.visitor||{}).email || ''
  });
};

Tawk_API.onChatMessageVisitor = function(msg) {
  _tawkSave({
    propertyId: '${TAWKTO_ID}',
    chatId: msg.chatId || '',
    senderType: 'visitor',
    senderName: (msg.sender||{}).name || 'Visitor',
    message: msg.message || '',
    messageTimestamp: msg.time ? new Date(msg.time).toISOString() : new Date().toISOString()
  });
};

Tawk_API.onChatMessageAgent = function(msg) {
  _tawkSave({
    propertyId: '${TAWKTO_ID}',
    chatId: msg.chatId || '',
    senderType: 'agent',
    senderName: (msg.sender||{}).name || 'Agent',
    message: msg.message || '',
    messageTimestamp: msg.time ? new Date(msg.time).toISOString() : new Date().toISOString()
  });
};

// ── Load the widget ──
(function(){
  var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
  s1.async=true;
  s1.src='https://embed.tawk.to/${TAWKTO_ID}/default';
  s1.charset='UTF-8';
  s1.setAttribute('crossorigin','*');
  s0.parentNode.insertBefore(s1,s0);
})();
`,
          }}
        />
      )}
      <button
        onClick={() => {
          const Tawk = (window as any).Tawk_API;
          if (!Tawk) return;
          if (Tawk.maximize) { Tawk.maximize(); } else { Tawk.toggle?.(); }
        }}
        className="fixed bottom-24 right-6 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group hover:scale-110"
        aria-label="Open live chat"
        title="Chat with us"
      >
        <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
      </button>
    </div>
  );
}
