"use client";

import { useState, useEffect } from "react";

interface DashboardData {
  stats: { totalClients: number; totalSuppliers: number; totalMessages: number; totalRevenue: number; messagesByStatus: Record<string, number> };
  recentMessages: Array<{ id: number; client_name: string; sender: string; destination: string; status: string; connection_type: string; cost: string; created_at: string; }>;
}

interface TenantInfo {
  companyName: string; email: string; packageType: string;
  smsCounter: number; smsLimit: number; smsValidUntil: string | null;
  packageExpiresAt: string | null;
  costPerSms: string; monthlyFee?: string;
  smppServerIp: string; smppServerPort: number; balance: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [platformRate, setPlatformRate] = useState<string>("0.00010");

  useEffect(() => {
    // Get platform rate from public settings
    fetch("/api/public/settings").then(r => r.json()).then(d => {
      if (d.costPerSms) setPlatformRate(d.costPerSms);
    }).catch(() => {});

    // Get tenant data
    fetch("/api/tenant/dashboard").then(r => r.json()).then(setData);
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.tenant) {
        const t = d.tenant;
        setTenant({
          companyName: t.companyName, email: t.email,
          packageType: t.packageType || "starter",
          smsCounter: t.smsCounter || 0, smsLimit: t.smsLimit || 0,
          smsValidUntil: t.smsValidUntil || null,
          packageExpiresAt: t.packageExpiresAt || null,
          costPerSms: t.costPerSms || platformRate,
          monthlyFee: t.monthlyFee || (t.packageType === "professional" ? "150" : t.packageType === "enterprise" ? "400" : "0"),
          smppServerIp: t.smppServerIp || "0.0.0.0",
          smppServerPort: t.smppServerPort || 2775,
          balance: t.balance || "0",
        });
      }
    });
  }, [platformRate]);

  if (!data || !tenant) return (
    <div className="animate-pulse p-8 space-y-4">
      <div className="h-20 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-4 gap-4"><div className="h-24 bg-slate-200 rounded-xl" /><div className="h-24 bg-slate-200 rounded-xl" /><div className="h-24 bg-slate-200 rounded-xl" /><div className="h-24 bg-slate-200 rounded-xl" /></div>
    </div>
  );

  const isStarter = tenant.packageType === "starter";
  const isPro = tenant.packageType === "professional";
  const isEnt = tenant.packageType === "enterprise";
  const hasLimit = tenant.smsLimit > 0;
  const remaining = hasLimit ? Math.max(0, tenant.smsLimit - tenant.smsCounter) : 0;
  const usedPct = hasLimit ? Math.min(100, (tenant.smsCounter / tenant.smsLimit) * 100) : 0;
  // eslint-disable-next-line react-hooks/purity
  const daysLeft = tenant.smsValidUntil ? Math.max(0, Math.ceil((new Date(tenant.smsValidUntil).getTime() - Date.now()) / 86400000)) : 0;
  const isProOrEnt = isPro || isEnt;
  const pkgDaysLeft = tenant.packageExpiresAt ? Math.max(0, Math.ceil((new Date(tenant.packageExpiresAt).getTime() - Date.now()) / 86400000)) : 0;
  const isPkgExpiringSoon = isProOrEnt && pkgDaysLeft <= 7 && pkgDaysLeft > 3;
  const isPkgExpired = isProOrEnt && pkgDaysLeft <= 0 && tenant.packageExpiresAt !== null;
  const isPkgCriticalExpiry = isProOrEnt && pkgDaysLeft <= 3 && pkgDaysLeft > 0;
  const tenantRate = parseFloat(tenant.costPerSms);
  const currentPlatformRate = parseFloat(platformRate);

  const statCards = [
    { label: "Total Clients", value: data.stats.totalClients, icon: "👥", color: "bg-blue-500" },
    { label: "Total Suppliers", value: data.stats.totalSuppliers, icon: "🏭", color: "bg-purple-500" },
    { label: "Messages", value: data.stats.totalMessages, icon: "💬", color: "bg-green-500" },
    { label: "Revenue", value: `$${data.stats.totalRevenue.toFixed(4)}`, icon: "💰", color: "bg-amber-500" },
  ];

  const statusColors: Record<string, string> = {
    QUEUED: "bg-slate-100 text-slate-700", SENT: "bg-blue-100 text-blue-700",
    DELIVERED: "bg-green-100 text-green-700", FAILED: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      {/* SMPP Connection Info */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-lg">🔌 SMPP Server Connection</h3>
            <p className="text-slate-300 text-sm">SMPP v3.4 • Connect via SMPP or HTTP REST API</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center"><p className="text-slate-400 text-xs">Server IP</p><p className="font-mono text-lg font-bold">{tenant.smppServerIp}</p></div>
            <div className="w-px h-10 bg-slate-600" />
            <div className="text-center"><p className="text-slate-400 text-xs">Port</p><p className="font-mono text-lg font-bold">{tenant.smppServerPort}</p></div>
            <div className="w-px h-10 bg-slate-600" />
            <div className="text-center">
              <p className="text-slate-400 text-xs">Your Rate</p>
              <p className="font-mono text-lg font-bold text-green-400">${tenantRate.toFixed(5)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Package Expiry Alert Banner (3-day warning) ── */}
      {isPkgCriticalExpiry && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3 animate-pulse">
          <span className="text-2xl">⏰</span>
          <div className="flex-1">
            <p className="font-bold text-amber-800 text-sm">
              Your {tenant.packageType === "professional" ? "Professional" : "Enterprise"} plan expires in <span className="text-red-600">{pkgDaysLeft} day{pkgDaysLeft > 1 ? "s" : ""}</span>!
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Renew now to avoid service interruption on {tenant.packageExpiresAt ? new Date(tenant.packageExpiresAt).toLocaleDateString() : ""}.
            </p>
            <a href="/dashboard/billing" className="inline-block mt-2 bg-amber-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-700 transition">
              Renew Plan →
            </a>
          </div>
        </div>
      )}

      {isPkgExpired && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">🚫</span>
          <div className="flex-1">
            <p className="font-bold text-red-800 text-sm">
              Your {tenant.packageType === "professional" ? "Professional" : "Enterprise"} plan has <span className="underline">expired</span>!
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              SMS sending is paused. Your data is preserved — renew to reactivate immediately.
            </p>
            <a href="/dashboard/billing" className="inline-block mt-2 bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 transition">
              Renew Now →
            </a>
          </div>
        </div>
      )}

      {/* Rate Information */}
      {tenantRate !== currentPlatformRate && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-xl">ℹ️</span>
          <div className="text-sm text-amber-700">
            <p className="font-medium">Rate Update Available</p>
            <p>Your locked rate: <strong>${tenantRate.toFixed(5)}/SMS</strong>. Current platform rate: <strong>${currentPlatformRate.toFixed(5)}/SMS</strong>.</p>
            <p className="text-xs mt-1">Your existing balance stays at ${tenantRate.toFixed(5)}. New top-ups will use the current platform rate of ${currentPlatformRate.toFixed(5)}/SMS.</p>
          </div>
        </div>
      )}

      {/* SMS Usage Counter */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">
              📊 {isPro ? "Professional" : isEnt ? "Enterprise" : "Starter"} SMS Usage
            </h3>
            <div className="flex flex-wrap items-center gap-6 mt-2">
              <div>
                <p className="text-sm text-slate-500">SMS Sent (Used)</p>
                <p className="text-3xl font-bold text-slate-800">{tenant.smsCounter.toLocaleString()}</p>
              </div>
{isStarter && hasLimit && (
                <div style={{display:"contents"}}>
                  <span className="text-slate-300 text-2xl">/</span>
                  <div><p className="text-sm text-slate-500">Total Credits</p><p className="text-3xl font-bold text-slate-800">{tenant.smsLimit.toLocaleString()}</p></div>
                  <div className="w-px h-12 bg-slate-200" />
                  <div><p className="text-sm text-slate-500">Remaining</p><p className="text-3xl font-bold text-green-600">{remaining.toLocaleString()}</p></div>
                  <div className="w-px h-12 bg-slate-200" />
                  <div><p className="text-sm text-slate-500">Used %</p><p className="text-3xl font-bold text-amber-600">{usedPct.toFixed(1)}%</p></div>
                </div>
              )}
              {isStarter && !hasLimit && (
                <div><p className="text-sm text-slate-500">Your SMS Rate</p><p className="text-3xl font-bold text-blue-600">${tenantRate.toFixed(5)}</p></div>
              )}
              {!isStarter && (
                <div><p className="text-sm text-slate-500">Monthly Fee</p><p className="text-3xl font-bold text-blue-600">${tenant.monthlyFee}/mo</p></div>
              )}
              <div className="w-px h-12 bg-slate-200" />
              {isProOrEnt ? (
                <div>
                  <p className="text-sm text-slate-500">Subscription</p>
                  <p className={`text-3xl font-bold ${isPkgExpired ? "text-red-600" : isPkgExpiringSoon ? "text-amber-600" : "text-green-600"}`}>
                    {tenant.packageExpiresAt ? `${pkgDaysLeft}d` : "Active"}
                  </p>
                  {tenant.packageExpiresAt && (
                    <p className="text-xs text-slate-400">
                      {isPkgExpired ? "Expired — Renew now" : `Renews: ${new Date(tenant.packageExpiresAt).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-500">Validity</p>
                  <p className={`text-3xl font-bold ${daysLeft <= 30 ? "text-red-600" : "text-green-600"}`}>{tenant.smsValidUntil ? `${daysLeft}d` : "N/A"}</p>
                  {tenant.smsValidUntil && <p className="text-xs text-slate-400">Expires: {new Date(tenant.smsValidUntil).toLocaleDateString()}</p>}
                </div>
              )}
            </div>
          </div>

          {isStarter && hasLimit && (
            <div className="lg:w-64">
              <div className="w-full bg-slate-200 rounded-full h-4">
                <div className={`h-4 rounded-full transition-all ${usedPct > 80 ? "bg-red-500" : usedPct > 50 ? "bg-amber-500" : "bg-blue-500"}`}
                  style={{width: `${usedPct}%`}} />
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-slate-500">{tenant.smsCounter.toLocaleString()} used</span>
                <span className="text-green-600 font-medium">{remaining.toLocaleString()} left</span>
              </div>
            </div>
          )}

          {(isPro || isEnt) && (
            <div className="lg:w-64">
              <div className={`border rounded-lg p-3 text-center ${isPkgExpired ? "bg-red-50 border-red-200" : isPkgExpiringSoon ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
                <p className={`text-sm font-medium ${isPkgExpired ? "text-red-700" : isPkgExpiringSoon ? "text-amber-700" : "text-blue-700"}`}>
                  {isPro ? "10M SMS included/mo" : "Unlimited SMS"}
                </p>
                <p className={`text-xs mt-1 ${isPkgExpired ? "text-red-600" : isPkgExpiringSoon ? "text-amber-600" : "text-blue-600"}`}>
                  {isPkgExpired ? "⚠️ Subscription expired — Renew" : isPkgExpiringSoon ? `⚠️ Renews in ${pkgDaysLeft} days` : "Monthly fee covers all SMS"}
                </p>
                {tenant.packageExpiresAt && (
                  <p className={`text-xs mt-1 font-medium ${isPkgExpired ? "text-red-500" : "text-slate-500"}`}>
                    Next billing: {new Date(tenant.packageExpiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-4 pt-4 border-t">
          <a href="/dashboard/billing" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            💳 {isStarter ? "Top-Up SMS" : "Manage Billing"}
          </a>
          <a href="/dashboard/send-sms" className="border border-slate-300 px-5 py-2 rounded-lg text-sm hover:bg-slate-50 transition">
            📱 Send SMS
          </a>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-xl p-5 border shadow-sm">
            <div className="flex items-center justify-between mb-3"><span className="text-3xl">{s.icon}</span><span className={`w-3 h-3 rounded-full ${s.color}`} /></div>
            <p className="text-2xl font-bold text-slate-800">{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Message Status</h3>
          <div className="space-y-3">
            {Object.entries(data.stats.messagesByStatus).map(([st, ct]) => (
              <div key={st} className="flex items-center justify-between">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[st] || ""}`}>{st}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-slate-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${st === "DELIVERED" ? "bg-green-500" : st === "FAILED" ? "bg-red-500" : "bg-blue-500"}`}
                      style={{width: `${data.stats.totalMessages > 0 ? (ct / data.stats.totalMessages) * 100 : 0}%`}} />
                  </div>
                  <span className="text-sm font-medium w-10 text-right">{ct}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SMS Flow + Database Flow */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-3">SMS Flow</h3>
          <div className="flex flex-wrap items-center gap-1 text-xs mb-4">
            {["ESME Client","->","Route Plan","->","Routes","->","Trunks","->","Suppliers","->","Mobile"].map((s,i)=>{
              if (s==="->") return <span key={i} className="text-blue-400 font-bold">→</span>;
              return <span key={i} className="bg-blue-600 text-white px-2 py-1 rounded">{s}</span>;
            })}
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700 mb-4">
            <strong>DLR Flow:</strong> Mobile → Supplier → Trunk → Route → Client (push via SMPP + HTTP)
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-700 mb-1">DB Schema Flow:</p>
            <p>public → tenants (per‑tenant schema)</p>
            <p>tenant_X → clients → route_plan → routes → trunks → suppliers → messages</p>
            <p>All tables: 27 per tenant, fully isolated</p>
          </div>
        </div>
      </div>

      {/* Recent Messages */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b"><h3 className="font-semibold">Recent Messages</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr><th className="text-left px-6 py-3">ID</th><th className="text-left px-6 py-3">Client</th><th className="text-left px-6 py-3">Sender</th><th className="text-left px-6 py-3">Dest</th><th className="text-left px-6 py-3">Type</th><th className="text-left px-6 py-3">Status</th><th className="text-left px-6 py-3">Cost</th><th className="text-left px-6 py-3">Time</th></tr>
            </thead>
            <tbody>
              {data.recentMessages.map(msg => (
                <tr key={msg.id} className="border-b hover:bg-slate-50">
                  <td className="px-6 py-3 font-mono text-xs">{msg.id}</td>
                  <td className="px-6 py-3">{msg.client_name}</td>
                  <td className="px-6 py-3">{msg.sender}</td>
                  <td className="px-6 py-3">{msg.destination}</td>
                  <td className="px-6 py-3"><span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs">{msg.connection_type || "—"}</span></td>
                  <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[msg.status] || ""}`}>{msg.status}</span></td>
                  <td className="px-6 py-3 font-mono text-xs">${parseFloat(msg.cost || "0").toFixed(6)}</td>
                  <td className="px-6 py-3 text-xs text-slate-500">{new Date(msg.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {data.recentMessages.length === 0 && <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400">No messages yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
