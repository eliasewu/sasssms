"use client";

import { useState, useEffect, useCallback } from "react";

interface BindEntity {
  id: number; name: string; type: "client" | "supplier";
  systemType: string; host: string; port: number;
  bindStatus: string; lastBindTime: string | null;
  connectionType: string; smppUsername: string; smppAllowedIp: string;
  connectionMode?: string;
}

export default function BindStatusPage() {
  const [clients, setClients] = useState<BindEntity[]>([]);
  const [suppliers, setSuppliers] = useState<BindEntity[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const loadRealStatus = useCallback(async (entityType: string) => {
    try {
      const res = await fetch(`/api/tenant/bind-control?entityType=${entityType}`);
      const data = await res.json();
      if (data.entities) {
        return data.entities as Array<{ id: number; name: string; dbStatus: string; realStatus: string }>;
      }
    } catch {}
    return [];
  }, []);

  const load = useCallback(async () => {
    const [cr, sr, clientReal, supplierReal] = await Promise.all([
      fetch("/api/tenant/clients").then(r => r.json()),
      fetch("/api/tenant/suppliers").then(r => r.json()),
      loadRealStatus("clients"),
      loadRealStatus("suppliers"),
    ]);

    // Build client map from real status API
    const clientRealMap = new Map<number, string>();
    for (const e of clientReal) {
      clientRealMap.set(e.id, e.realStatus);
    }

    const supplierRealMap = new Map<number, string>();
    for (const e of supplierReal) {
      supplierRealMap.set(e.id, e.realStatus);
    }

    setClients((cr.clients || []).map((c: Record<string,unknown>) => {
      const realStatus = clientRealMap.get(c.id as number) || "UNBOUND";
      return {
        id: c.id as number, name: c.name as string, type: "client" as const,
        systemType: (c.smpp_system_type as string) || "ESME",
        host: (c.smpp_allowed_ip as string) || (c.ip as string) || "0.0.0.0",
        port: 2775,
        bindStatus: realStatus, // Use REAL status from active sessions
        lastBindTime: (c.last_bind_time as string) || null,
        connectionType: (c.connection_type as string) || "SMPP",
        smppUsername: (c.smpp_username as string) || "—",
        smppAllowedIp: (c.smpp_allowed_ip as string) || "—",
      };
    }));

    setSuppliers((sr.suppliers || []).map((s: Record<string,unknown>) => {
      const realStatus = supplierRealMap.get(s.id as number) || "UNBOUND";
      return {
        id: s.id as number, name: s.name as string, type: "supplier" as const,
        systemType: (s.connection_mode as string) === "SERVER" ? "SMSC" : "ESME",
        host: (s.host as string) || "—",
        port: (s.port as number) || 2775,
        bindStatus: realStatus, // Use REAL status from active connections
        lastBindTime: (s.last_bind_time as string) || null,
        connectionType: (s.connection_type as string) || "SMPP",
        smppUsername: (s.username as string) || (s.system_id as string) || "—",
        smppAllowedIp: "—",
        connectionMode: (s.connection_mode as string) || "CLIENT",
      };
    }));

    setLastSyncTime(new Date().toLocaleTimeString());
  }, [loadRealStatus]);

  useEffect(() => { load(); if (autoRefresh) { const i = setInterval(load, 10000); return () => clearInterval(i); } }, [load, autoRefresh]);

  const handleBind = async (entityType: string, entityId: number) => {
    await fetch("/api/tenant/bind-control", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, action: "BIND" }),
    });
    load();
  };

  const handleUnbind = async (entityType: string, entityId: number) => {
    await fetch("/api/tenant/bind-control", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, action: "UNBIND" }),
    });
    load();
  };

  const statusColors: Record<string, string> = {
    BOUND: "bg-green-100 text-green-700 border-green-300",
    BINDING: "bg-blue-100 text-blue-700 border-blue-300",
    UNBOUND: "bg-slate-100 text-slate-600 border-slate-300",
    ERROR: "bg-red-100 text-red-700 border-red-300",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">SMPP Bind Status</h2>
          <p className="text-sm text-slate-500">Real-time SMPP v3.4 bind monitoring for clients and suppliers</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="accent-blue-600" />Auto-refresh 10s</label>
          <button onClick={load} className="border px-4 py-2 rounded-lg text-sm">🔄 Refresh</button>
        </div>
      </div>

      {/* Clients */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">👥 Client Binds (ESME → SMSC at 0.0.0.0:2775)</h3>
          <span className="text-xs text-slate-500">{clients.filter(c => c.bindStatus === "BOUND").length}/{clients.length} bound</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr><th className="text-left px-5 py-3">Client</th><th className="text-left px-5 py-3">Username</th><th className="text-left px-5 py-3">Client IP</th><th className="text-left px-5 py-3">SMSC Host:Port</th><th className="text-left px-5 py-3">Type</th><th className="text-left px-5 py-3">Bind</th><th className="text-left px-5 py-3">Last Bind</th><th className="text-left px-5 py-3">Actions</th></tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="border-b hover:bg-slate-50">
                <td className="px-5 py-3 font-medium">{c.name}</td>
                <td className="px-5 py-3 font-mono text-xs">{c.smppUsername}</td>
                <td className="px-5 py-3 font-mono text-xs">{c.smppAllowedIp}</td>
                <td className="px-5 py-3 font-mono text-xs">0.0.0.0:2775</td>
                <td className="px-5 py-3 text-xs">{c.systemType}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[c.bindStatus] || statusColors.UNBOUND}`}>{c.bindStatus}</span></td>
                <td className="px-5 py-3 text-xs text-slate-500">{c.lastBindTime ? new Date(c.lastBindTime).toLocaleString() : "Never"}</td>
                <td className="px-5 py-3">
                  {c.bindStatus !== "BOUND" ? (
                    <button onClick={() => handleBind("clients", c.id)} className="bg-green-50 text-green-700 px-3 py-1 rounded text-xs hover:bg-green-100">Bind</button>
                  ) : (
                    <button onClick={() => handleUnbind("clients", c.id)} className="bg-red-50 text-red-700 px-3 py-1 rounded text-xs hover:bg-red-100">Unbind</button>
                  )}
                </td>
              </tr>
            ))}
            {clients.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">No SMPP clients configured.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Suppliers */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">🏭 Supplier Binds (ESME/SMSC → External Gateway)</h3>
          <span className="text-xs text-slate-500">{suppliers.filter(s => s.bindStatus === "BOUND").length}/{suppliers.length} bound</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr><th className="text-left px-5 py-3">Supplier</th><th className="text-left px-5 py-3">Username</th><th className="text-left px-5 py-3">Remote IP:Port</th><th className="text-left px-5 py-3">Mode</th><th className="text-left px-5 py-3">Bind</th><th className="text-left px-5 py-3">Last Bind</th><th className="text-left px-5 py-3">Actions</th></tr>
          </thead>
          <tbody>
            {suppliers.map(s => (
              <tr key={s.id} className="border-b hover:bg-slate-50">
                <td className="px-5 py-3 font-medium">{s.name}</td>
                <td className="px-5 py-3 font-mono text-xs">{s.smppUsername}</td>
                <td className="px-5 py-3 font-mono text-xs">{s.host !== "—" ? `${s.host}:${s.port}` : "API"}</td>
                <td className="px-5 py-3 text-xs"><span className={s.connectionMode === "SERVER" ? "bg-purple-50 text-purple-700 px-2 py-0.5 rounded" : "bg-blue-50 text-blue-700 px-2 py-0.5 rounded"}>{s.connectionMode === "SERVER" ? "SMSC (Server)" : "ESME (Client)"}</span></td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[s.bindStatus] || statusColors.UNBOUND}`}>{s.bindStatus}</span></td>
                <td className="px-5 py-3 text-xs text-slate-500">{s.lastBindTime ? new Date(s.lastBindTime).toLocaleString() : "Never"}</td>
                <td className="px-5 py-3">
                  {s.bindStatus !== "BOUND" ? (
                    <button onClick={() => handleBind("suppliers", s.id)} className="bg-green-50 text-green-700 px-3 py-1 rounded text-xs hover:bg-green-100">Bind</button>
                  ) : (
                    <button onClick={() => handleUnbind("suppliers", s.id)} className="bg-red-50 text-red-700 px-3 py-1 rounded text-xs hover:bg-red-100">Unbind</button>
                  )}
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">No suppliers configured.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
