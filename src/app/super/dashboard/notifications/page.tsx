"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface ServiceStatus {
  tenantId: number; tenantName: string; tenantEmail: string;
  services: {
    smppBinds: { total: number; bound: number; unbound: number };
    suppliers: { total: number; active: number; unbound: number };
    ottDevices: { total: number; online: number; offline: number };
    smsLastHour: number;
    isActive: boolean;
  };
}

interface Alert {
  id: number; type: string; title: string; message: string;
  severity: string; isRead: boolean; createdAt: string;
}

export default function SuperNotificationsPage() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tab, setTab] = useState<"alerts" | "status">("alerts");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [statuses, setStatuses] = useState<ServiceStatus[]>([]);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [expandedTenant, setExpandedTenant] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/super/alerts").then(r => r.json()).catch(() => ({}));
    setAlerts(r.alerts || []);
    setUnreadCount(r.unreadCount || 0);
    if (r.statuses) setStatuses(r.statuses);
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  const runCheck = async () => {
    setChecking(true);
    // Fire-and-forget trigger, then poll for results after a delay
    await fetch("/api/super/alerts?action=health-check").then(r => r.json()).catch(() => ({}));
    setLastCheck(new Date().toLocaleTimeString());
    // Clear any previous poll timer to prevent rapid-click pile-up
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const r = await fetch("/api/super/alerts").then(r => r.json()).catch(() => ({}));
      if (r.statuses) setStatuses(r.statuses);
      setAlerts(r.alerts || []);
      setUnreadCount(r.unreadCount || 0);
      setChecking(false);
    }, 3000);
  };

  // Cleanup polling timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const markRead = async (alertId: number) => {
    await fetch("/api/super/alerts", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId }),
    });
    load();
  };

  const markAllRead = async () => {
    await fetch("/api/super/alerts", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    load();
  };

  const severityColors: Record<string, string> = {
    info: "bg-blue-100 text-blue-700",
    warning: "bg-amber-100 text-amber-700",
    error: "bg-red-100 text-red-700",
    success: "bg-green-100 text-green-700",
  };

  const totalStats = statuses.reduce((acc, s) => {
    if (!s.services.isActive) return acc;
    acc.smppBinds += s.services.smppBinds.total;
    acc.smppBound += s.services.smppBinds.bound;
    acc.suppliers += s.services.suppliers.total;
    acc.supplierActive += s.services.suppliers.active;
    acc.ottDevices += s.services.ottDevices.total;
    acc.ottOnline += s.services.ottDevices.online;
    acc.smsLastHour += s.services.smsLastHour;
    return acc;
  }, { smppBinds: 0, smppBound: 0, suppliers: 0, supplierActive: 0, ottDevices: 0, ottOnline: 0, smsLastHour: 0 });

  const problemTenants = statuses.filter(s =>
    s.services.isActive && (
      (s.services.smppBinds.total > 0 && s.services.smppBinds.bound === 0) ||
      (s.services.suppliers.total > 0 && s.services.suppliers.active === 0) ||
      (s.services.ottDevices.total > 0 && s.services.ottDevices.online === 0)
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Service Monitor & Alerts</h2>
          <p className="text-sm text-slate-500">Monitor tenant service health and system alerts</p>
        </div>
        <div className="flex items-center gap-3">
          {lastCheck && <span className="text-xs text-slate-500">Last check: {lastCheck}</span>}
          <button onClick={runCheck} disabled={checking}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition">
            {checking ? "Checking..." : "Run Health Check"}
          </button>
        </div>
      </div>

      {/* Alert count badge */}
      {unreadCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-red-700 font-medium">{unreadCount} unread alert{unreadCount > 1 ? "s" : ""}</span>
          <button onClick={markAllRead} className="text-xs text-red-600 hover:underline">Mark all as read</button>
        </div>
      )}

      {/* Platform-wide stats */}
      {statuses.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-white rounded-lg border p-3 text-center">
            <p className="text-lg font-bold text-slate-800">{statuses.filter(s => s.services.isActive).length}</p>
            <p className="text-[10px] text-slate-500">Active Tenants</p>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <p className="text-lg font-bold text-blue-600">{totalStats.smppBinds}</p>
            <p className="text-[10px] text-slate-500">SMPP Clients</p>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <p className="text-lg font-bold text-green-600">{totalStats.smppBound}</p>
            <p className="text-[10px] text-slate-500">SMPP Bound</p>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <p className="text-lg font-bold text-purple-600">{totalStats.suppliers}</p>
            <p className="text-[10px] text-slate-500">Suppliers</p>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <p className="text-lg font-bold text-amber-600">{totalStats.ottDevices}</p>
            <p className="text-[10px] text-slate-500">OTT Devices</p>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <p className="text-lg font-bold text-slate-800">{totalStats.smsLastHour.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500">SMS (1h)</p>
          </div>
        </div>
      )}

      {/* Problem tenants warning */}
      {problemTenants.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 text-sm mb-2">Tenants with Service Issues ({problemTenants.length})</h3>
          <div className="space-y-1">
            {problemTenants.map(s => (
              <div key={s.tenantId} className="text-xs text-red-700">
                <strong>{s.tenantName}</strong>: {
                  [
                    s.services.smppBinds.bound === 0 && s.services.smppBinds.total > 0 && "All SMPP clients unbound",
                    s.services.suppliers.active === 0 && s.services.suppliers.total > 0 && "All suppliers disconnected",
                    s.services.ottDevices.online === 0 && s.services.ottDevices.total > 0 && "All OTT devices offline",
                  ].filter(Boolean).join("; ")
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {["alerts", "status"].map(t => (
          <button key={t} onClick={() => setTab(t as "alerts" | "status")}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${tab === t ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>
            {t === "alerts" ? `Alerts (${alerts.length})` : `Service Status (${statuses.length})`}
          </button>
        ))}
      </div>

      {/* Alerts Tab */}
      {tab === "alerts" && (
        <div className="bg-white rounded-xl border shadow-sm divide-y">
          {alerts.map(a => (
            <div key={a.id} className={`p-4 ${!a.isRead ? "bg-red-50/30" : ""}`}>
              <div className="flex items-start gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${severityColors[a.severity] || severityColors.info}`}>
                  {a.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm">{a.title}</h4>
                    {!a.isRead && <button onClick={() => markRead(a.id)} className="text-xs text-blue-600 hover:underline whitespace-nowrap shrink-0">Mark read</button>}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{a.message}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleString()}</p>
                    <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{a.type}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <p className="text-lg mb-1">No alerts</p>
              <p className="text-sm">All systems operational. Run a health check to verify.</p>
            </div>
          )}
        </div>
      )}

      {/* Service Status Tab */}
      {tab === "status" && (
        <div className="space-y-3">
          {statuses.filter(s => s.services.isActive).map(s => (
            <div key={s.tenantId} className="bg-white rounded-xl border shadow-sm">
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
                onClick={() => setExpandedTenant(expandedTenant === s.tenantId ? null : s.tenantId)}>
                <div>
                  <h4 className="font-medium text-sm">{s.tenantName}</h4>
                  <p className="text-xs text-slate-500">{s.tenantEmail}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2 text-xs">
                    <span className={s.services.smppBinds.bound > 0 || s.services.smppBinds.total === 0 ? "text-green-600" : "text-red-600"}>
                      {s.services.smppBinds.bound}/{s.services.smppBinds.total} SMPP
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className={s.services.suppliers.active > 0 || s.services.suppliers.total === 0 ? "text-green-600" : "text-red-600"}>
                      {s.services.suppliers.active}/{s.services.suppliers.total} Supp
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-600">{s.services.smsLastHour} SMS/h</span>
                  </div>
                  <span className="text-slate-400 text-xs">{expandedTenant === s.tenantId ? "▲" : "▼"}</span>
                </div>
              </div>
              {expandedTenant === s.tenantId && (
                <div className="border-t p-4 bg-slate-50 rounded-b-xl">
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="font-medium text-slate-500 mb-1">SMPP Clients</p>
                      <p>Total: <strong>{s.services.smppBinds.total}</strong></p>
                      <p className="text-green-600">Bound: <strong>{s.services.smppBinds.bound}</strong></p>
                      <p className={s.services.smppBinds.unbound > 0 ? "text-red-600" : "text-slate-600"}>
                        Unbound: <strong>{s.services.smppBinds.unbound}</strong>
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-500 mb-1">Suppliers</p>
                      <p>Total: <strong>{s.services.suppliers.total}</strong></p>
                      <p className="text-green-600">Active: <strong>{s.services.suppliers.active}</strong></p>
                      <p className={s.services.suppliers.unbound > 0 ? "text-red-600" : "text-slate-600"}>
                        Unbound: <strong>{s.services.suppliers.unbound}</strong>
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-500 mb-1">OTT Devices</p>
                      <p>Total: <strong>{s.services.ottDevices.total}</strong></p>
                      <p className="text-green-600">Online: <strong>{s.services.ottDevices.online}</strong></p>
                      <p className={s.services.ottDevices.offline > 0 ? "text-red-600" : "text-slate-600"}>
                        Offline: <strong>{s.services.ottDevices.offline}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {statuses.filter(s => s.services.isActive).length === 0 && (
            <div className="bg-white rounded-xl border p-8 text-center text-slate-400">
              <p className="text-lg mb-1">No status data</p>
              <p className="text-sm">Run a health check to populate service status.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
