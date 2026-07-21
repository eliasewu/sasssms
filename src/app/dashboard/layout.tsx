"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface Tenant {
  id: number;
  companyName: string;
  email: string;
  balance: string;
  smppServerIp?: string;
  serverLocation?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "📊" },
      { href: "/dashboard/guide", label: "Getting Started Guide", icon: "📘" },
    ],
  },
  {
    title: "Clients",
    items: [
      { href: "/dashboard/clients", label: "All Clients", icon: "👥" },
      { href: "/dashboard/clients/rates", label: "Client Rates", icon: "💵" },
    ],
  },
  {
    title: "Suppliers",
    items: [
      { href: "/dashboard/suppliers", label: "All Suppliers", icon: "🏭" },
      { href: "/dashboard/suppliers/rates", label: "Supplier Rates", icon: "💰" },
      { href: "/dashboard/connectors", label: "API Connectors", icon: "🔌" },
      { href: "/dashboard/custom-api", label: "Custom API", icon: "⚡" },
      { href: "/dashboard/ott-devices", label: "OTT Devices", icon: "📲" },
      { href: "/dashboard/proxy-config", label: "Proxy Config", icon: "🔌" },
      { href: "/dashboard/voice-otp", label: "Voice OTP", icon: "📞" },
      { href: "/dashboard/social-api", label: "Social API", icon: "💬" },
      { href: "/dashboard/business-api", label: "Business API", icon: "🔗" },
    ],
  },
  {
    title: "Routing",
    items: [
      { href: "/dashboard/trunks", label: "Trunks", icon: "🔗" },      { href: "/dashboard/routes", label: "Routes", icon: "🔀" },
      { href: "/dashboard/route-plans", label: "Route Plans", icon: "📋" },
    ],
  },
  {
    title: "Translations",
    items: [
      { href: "/dashboard/translations/sid", label: "SID Translation", icon: "📱" },
      { href: "/dashboard/translations/number", label: "Number Translation", icon: "🔢" },
      { href: "/dashboard/translations/content", label: "Content Translation", icon: "📝" },
      { href: "/dashboard/translations/otp-extract", label: "OTP Extract & Forward", icon: "🔐" },
      { href: "/dashboard/translations/random", label: "Random Content", icon: "🎲" },
    ],
  },
  {
    title: "Rates",
    items: [
      { href: "/dashboard/rates", label: "Bulk Rate Management", icon: "💲" },
      { href: "/dashboard/clients/rates", label: "Client Rates", icon: "💵" },
      { href: "/dashboard/suppliers/rates", label: "Supplier Rates", icon: "💰" },
      { href: "/dashboard/mcc-mnc", label: "MCC/MNC Database", icon: "🌍" },
    ],
  },
  {
    title: "Billing",
    items: [
      { href: "/dashboard/billing", label: "Overview", icon: "💳" },
      { href: "/dashboard/invoices", label: "Invoices", icon: "📄" },
      { href: "/dashboard/payments", label: "Payments", icon: "💵" },
    ],
  },
  {
    title: "Messaging",
    items: [
      { href: "/dashboard/send-sms", label: "Send SMS", icon: "📱" },
      { href: "/dashboard/messages", label: "SMS Logs", icon: "📝" },
      { href: "/dashboard/inbox", label: "SMS Inbox (MO)", icon: "📥" },
      { href: "/dashboard/campaigns", label: "Campaigns", icon: "📢" },
    ],
  },
  {
    title: "Tools",
    items: [
      { href: "/dashboard/bind-status", label: "Bind Status", icon: "🔌" },
      { href: "/dashboard/dlr-status", label: "DLR Status", icon: "📬" },
      { href: "/dashboard/number-validation", label: "Number Validation", icon: "✅" },
      { href: "/dashboard/ip-list", label: "IP Whitelist", icon: "🛡️" },
      { href: "/dashboard/reports", label: "Reports", icon: "📈" },
    ],
  },
  {
    title: "Testing",
    items: [
      { href: "/dashboard/test-sms", label: "Test SMS", icon: "🧪" },
      { href: "/dashboard/test-smpp", label: "Test SMPP", icon: "🔬" },
      { href: "/dashboard/test-http", label: "Test HTTP", icon: "🌐" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/dashboard/users", label: "Users", icon: "👤" },
      { href: "/dashboard/roles", label: "Roles", icon: "🔐" },
      { href: "/dashboard/api-settings", label: "API Settings", icon: "📡" },
      { href: "/dashboard/support-tickets", label: "Support Tickets", icon: "🎫" },
      { href: "/dashboard/notifications", label: "Notifications", icon: "🔔" },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [freeCredits, setFreeCredits] = useState(0);
  const [pendingPayments, setPendingPayments] = useState<{ hasPending: boolean; count: number; latest: { id: number; amount: string; status: string; packageType: string | null; smsAmount: number; createdAt: string; } | null }>({ hasPending: false, count: 0, latest: null });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState<string[]>(["Overview", "Messaging"]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchTenant = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        router.push("/");
        return;
      }
      const data = await res.json();
      setTenant(data.tenant);
    } catch {
      router.push("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  // Fetch free test SMS credits
  useEffect(() => {
    const fetchCredits = () => {
      fetch("/api/tenant/test-sms").then(r => r.json()).then(d => {
        if (d.freeCredits !== undefined) setFreeCredits(d.freeCredits);
      }).catch(() => {});
    };
    fetchCredits();
    const interval = setInterval(fetchCredits, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Fetch pending payments for notification banner
  useEffect(() => {
    const fetchPending = () => {
      fetch("/api/tenant/pending-payments").then(r => r.json()).then(d => {
        setPendingPayments(d);
      }).catch(() => {});
    };
    fetchPending();
    const interval = setInterval(fetchPending, 60000); // poll every 60s
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/");
  };

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 animate-pulse">N</div>
          <p className="text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-64" : "w-16"} bg-slate-900 text-white transition-all duration-300 flex flex-col min-h-screen fixed left-0 top-0 bottom-0 z-30 overflow-hidden`}>
        <div className="p-4 flex items-center gap-3 border-b border-white/10 shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 shadow">N</div>
          {sidebarOpen && <span className="font-bold text-sm truncate">Net2APP</span>}
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.title} className="mb-1">
              {sidebarOpen && (
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200"
                >
                  <span>{section.title}</span>
                  <span className="text-[10px]">{expandedSections.includes(section.title) ? "▼" : "▶"}</span>
                </button>
              )}
              {(expandedSections.includes(section.title) || !sidebarOpen) && (
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm transition-colors ${
                        pathname === item.href
                          ? "bg-blue-600 text-white"
                          : "text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="text-base shrink-0">{item.icon}</span>
                      {sidebarOpen && <span className="truncate">{item.label}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 shrink-0">
          {sidebarOpen && (
            <div className="mb-3">
              <p className="text-xs text-slate-400 truncate font-medium">{tenant.companyName}</p>
              <p className="text-xs text-slate-500 truncate">{tenant.email}</p>
            </div>
          )}
          <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition w-full">
            <span>🚪</span>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>

        {sidebarOpen && (
          <div className="p-4 border-t border-white/10 shrink-0">
            <p className="text-[10px] text-slate-500 text-center">
              © {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC
            </p>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className={`flex-1 ${sidebarOpen ? "ml-64" : "ml-16"} transition-all duration-300`}>
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-500 hover:text-slate-700 text-xl">
              ☰
            </button>
            <div>
              <h1 className="font-semibold text-slate-800">
                {navSections.flatMap((s) => s.items).find((n) => n.href === pathname)?.label || "Dashboard"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-full font-medium border border-green-200">
              Balance: ${parseFloat(tenant.balance).toFixed(4)}
            </span>
            {tenant.smppServerIp && tenant.smppServerIp !== "0.0.0.0" && (
              <span className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full font-medium border border-indigo-200" title={`Server: ${tenant.serverLocation || "Unknown"}`}>
                🖥️ {tenant.smppServerIp}{tenant.serverLocation ? ` (${tenant.serverLocation})` : ""}
              </span>
            )}
            {freeCredits > 0 && (
              <span className="text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium border border-blue-200">
                🧪 Free SMS: {freeCredits}
              </span>
            )}
            <span className="text-sm text-slate-500 hidden md:block">{tenant.companyName}</span>
          </div>
        </header>

        <main className="p-6">
          {/* ── Pending Payment Notification Banner ── */}
          {pendingPayments.hasPending && pendingPayments.latest && (
            <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3 shadow-sm">
              <span className="text-2xl mt-0.5">⏳</span>
              <div className="flex-1">
                <p className="font-bold text-amber-800 text-sm">
                  {pendingPayments.count === 1
                    ? "You have 1 pending payment awaiting approval"
                    : `You have ${pendingPayments.count} pending payments awaiting approval`}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Latest: <strong>${parseFloat(pendingPayments.latest.amount).toFixed(2)}</strong> ({pendingPayments.latest.smsAmount?.toLocaleString() || "0"} SMS)
                  {pendingPayments.latest.packageType && <span className="capitalize"> — {pendingPayments.latest.packageType}</span>}
                  {" · "}{pendingPayments.latest.status === "PENDING_CONFIRMATION" ? "Awaiting admin review" : "Processing"}
                </p>
                <a href="/dashboard/billing" className="inline-block mt-2 bg-amber-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-700 transition">
                  View Payments →
                </a>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
