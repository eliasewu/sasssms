"use client";

import { useState, useEffect, useCallback } from "react";

interface ProxyConfig { id: number; name: string; proxy_type: string; host: string; port: number; username: string; protocol: string; is_active: boolean; }
interface Alert { id: number; type: string; title: string; message: string; severity: string; is_read: boolean; created_at: string; }

export default function NotificationsPage() {
  const [tab, setTab] = useState<"alerts" | "proxy" | "integrations">("alerts");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [proxies, setProxies] = useState<ProxyConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", proxyType: "residential", host: "", port: "1080", username: "", password: "", protocol: "socks5" });

  const load = useCallback(async () => {
    const [ar, pr] = await Promise.all([
      fetch("/api/tenant/alerts").then(r => r.json()).catch(() => ({ alerts: [] })),
      fetch("/api/tenant/proxy-config").then(r => r.json()).catch(() => ({ configs: [] })),
    ]);
    setAlerts(ar.alerts || []);
    setProxies(pr.configs || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addProxy = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/tenant/proxy-config", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, port: parseInt(form.port) }),
    });
    setShowForm(false);
    setForm({ name: "", proxyType: "residential", host: "", port: "1080", username: "", password: "", protocol: "socks5" });
    load();
  };

  const deleteProxy = async (id: number) => {
    await fetch(`/api/tenant/proxy-config/${id}`, { method: "DELETE" });
    load();
  };

  const severityColors: Record<string, string> = {
    info: "bg-blue-100 text-blue-700", warning: "bg-amber-100 text-amber-700",
    error: "bg-red-100 text-red-700", success: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Notifications & Proxy Config</h2>
        <p className="text-sm text-slate-500">System alerts, residential proxy (Tailscale/3proxy), and integrations</p>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {["alerts", "proxy", "integrations"].map(t => (
          <button key={t} onClick={() => setTab(t as "alerts"|"proxy"|"integrations")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition capitalize ${tab === t ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>{t}</button>
        ))}
      </div>

      {tab === "proxy" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold">Residential Proxy Configuration</h3>
              <p className="text-sm text-slate-500">Configure Tailscale/3proxy for WhatsApp & Telegram OTT devices</p>
            </div>
            <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Proxy</button>
          </div>

          {/* Setup Guide */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
            <h4 className="font-semibold text-blue-800 mb-2">🔧 Proxy Setup (Tailscale / 3proxy)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-blue-700">Tailscale Configuration:</p>
                <ol className="list-decimal pl-4 space-y-1 text-blue-600 mt-1">
                  <li>Install: <code className="bg-blue-100 px-1 rounded">curl -fsSL https://tailscale.com/install.sh | sh</code></li>
                  <li>Authenticate: <code className="bg-blue-100 px-1 rounded">tailscale up --authkey=YOUR_KEY</code></li>
                  <li>Enable exit node: <code className="bg-blue-100 px-1 rounded">tailscale set --exit-node=YOUR_NODE</code></li>
                  <li>Add SOCKS5 proxy on port 1080</li>
                </ol>
              </div>
              <div>
                <p className="font-medium text-blue-700">3proxy Configuration (<code>/etc/3proxy/3proxy.cfg</code>):</p>
                <ol className="list-decimal pl-4 space-y-1 text-blue-600 mt-1">
                  <li>Install: <code className="bg-blue-100 px-1 rounded">apt-get install 3proxy</code></li>
                  <li>Configure <code>auth strong</code> for user/pass</li>
                  <li>Set <code>socks</code> parent proxy for residential IP rotation</li>
                  <li>Bind to internal IP on port 1080</li>
                </ol>
              </div>
            </div>
            <p className="mt-3 text-xs text-blue-500">
              <strong>Mandatory for:</strong> WhatsApp OTT, Telegram OTT, Business API connections
            </p>
          </div>

          {showForm && (
            <div className="bg-white rounded-xl border p-6 shadow-sm">
              <form onSubmit={addProxy} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium mb-1">Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div>
                  <label className="block text-sm font-medium mb-1">Proxy Type</label>
                  <select value={form.proxyType} onChange={e => setForm({...form, proxyType: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="residential">Residential</option>
                    <option value="datacenter">Datacenter</option>
                    <option value="mobile">Mobile</option>
                    <option value="tailscale">Tailscale</option>
                    <option value="3proxy">3proxy</option>
                  </select>
                </div>
                <div><label className="block text-sm font-medium mb-1">Protocol</label><select value={form.protocol} onChange={e => setForm({...form, protocol: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="socks5">SOCKS5</option><option value="http">HTTP</option><option value="https">HTTPS</option></select></div>
                <div><label className="block text-sm font-medium mb-1">Host *</label><input value={form.host} onChange={e => setForm({...form, host: e.target.value})} required placeholder="127.0.0.1" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" /></div>
                <div><label className="block text-sm font-medium mb-1">Port *</label><input type="number" value={form.port} onChange={e => setForm({...form, port: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium mb-1">Username</label><input value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium mb-1">Password</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div className="flex items-end gap-2">
                  <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Save</button>
                  <button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {proxies.map(p => (
              <div key={p.id} className="bg-white rounded-xl border p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{p.name}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${p.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{p.is_active ? "Active" : "Inactive"}</span>
                </div>
                <div className="text-sm font-mono text-slate-600 space-y-0.5">
                  <p>{p.protocol}://{p.host}:{p.port}</p>
                  <p className="text-xs"><span className="text-slate-400">Type:</span> {p.proxy_type} {p.username ? `• Auth: ${p.username}` : ""}</p>
                </div>
                <button onClick={() => deleteProxy(p.id)} className="mt-3 text-red-600 hover:underline text-xs">Remove</button>
              </div>
            ))}
            {proxies.length === 0 && <p className="col-span-2 text-center py-8 text-slate-400 bg-white rounded-xl border">No proxies configured. Add one for OTT devices.</p>}
          </div>
        </div>
      )}

      {tab === "alerts" && (
        <div className="bg-white rounded-xl border shadow-sm divide-y">
          {alerts.map(a => (
            <div key={a.id} className={`p-4 ${!a.is_read ? "bg-blue-50/30" : ""}`}>
              <div className="flex items-start gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[a.severity] || severityColors.info}`}>{a.severity}</span>
                <div className="flex-1">
                  <h4 className="font-medium">{a.title}</h4>
                  <p className="text-sm text-slate-600 mt-1">{a.message}</p>
                  <p className="text-xs text-slate-400 mt-2">{new Date(a.created_at).toLocaleString()} • {a.type}</p>
                </div>
              </div>
            </div>
          ))}
          {alerts.length === 0 && <div className="p-8 text-center text-slate-400">No alerts</div>}
        </div>
      )}

      {tab === "integrations" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <a href="/dashboard/business-api" className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition group">
            <div className="text-3xl mb-3">🔗</div>
            <h3 className="font-semibold group-hover:text-blue-600">Business API</h3>
            <p className="text-sm text-slate-500">WhatsApp & Telegram API integration</p>
          </a>
          <a href="/dashboard/social-api" className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition group">
            <div className="text-3xl mb-3">💬</div>
            <h3 className="font-semibold group-hover:text-blue-600">Social API</h3>
            <p className="text-sm text-slate-500">Telegram & WhatsApp social connectors</p>
          </a>
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="text-3xl mb-3">🔔</div>
            <h3 className="font-semibold">Email Templates</h3>
            <p className="text-sm text-slate-500">Invoice, alert, and welcome emails</p>
          </div>
        </div>
      )}
    </div>
  );
}
