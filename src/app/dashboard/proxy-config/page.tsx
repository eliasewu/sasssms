"use client";

import { useState, useEffect, useCallback } from "react";
import { useConfirmModal } from "@/components/confirm-modal";
import TailscaleMeshPanel from "@/components/tailscale-mesh-panel";

interface ProxyConfig {
  id: number; name: string; proxy_type: string;
  host: string; port: number; protocol: string;
  username: string | null; password: string | null;
  is_active: boolean;
}

export default function ProxyConfigPage() {
  const [configs, setConfigs] = useState<ProxyConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<
    Record<number, { ok: boolean; egressIp: string | null; latencyMs: number | null; error: string | null }>
  >({});
  const [form, setForm] = useState({
    name: "", host: "", port: "1080", protocol: "socks5",
    proxyType: "residential", username: "", password: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/tenant/proxy-config").then(r => r.json());
    setConfigs(res.configs || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ name: "", host: "", port: "1080", protocol: "socks5", proxyType: "residential", username: "", password: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const portNum = parseInt(form.port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      alert("Port must be a number between 1 and 65535");
      return;
    }
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: form.name,
      proxyType: form.proxyType,
      host: form.host,
      port: portNum,
      username: form.username || null,
      protocol: form.protocol,
    };
    // Only include password if user actually entered one (prevents clearing stored password on edit)
    if (form.password) { payload.password = form.password; }

    let res: Response;
    if (editingId) {
      res = await fetch(`/api/tenant/proxy-config/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch("/api/tenant/proxy-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setSubmitting(false);
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || `Failed to ${editingId ? "update" : "create"} proxy`);
      return;
    }
    resetForm();
    load();
  };

  const startEdit = (c: ProxyConfig) => {
    setForm({
      name: c.name,
      host: c.host,
      port: String(c.port),
      protocol: c.protocol,
      proxyType: c.proxy_type,
      username: c.username || "",
      password: "",
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const toggleActive = async (id: number, currentActive: boolean) => {
    const newActive = !currentActive;
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, is_active: newActive } : c));
    const res = await fetch(`/api/tenant/proxy-config/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: newActive }),
    });
    if (!res.ok) load();
  };

  const { confirm: confirmDelete, modal: confirmModal } = useConfirmModal();
  const deleteConfig = async (id: number) => {
    if (!await confirmDelete("Delete this proxy configuration?")) return;
    await fetch(`/api/tenant/proxy-config/${id}`, { method: "DELETE" });
    load();
  };

  // Live connectivity test — the server connects THROUGH the proxy and
  // reports the egress IP, proving the 3proxy + Tailscale chain works.
  const testProxy = async (id: number) => {
    setTestingId(id);
    setTestResults((prev) => ({ ...prev, [id]: { ok: false, egressIp: null, latencyMs: null, error: "Testing…" } }));
    try {
      const res = await fetch("/api/tenant/proxy-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          ok: d.ok,
          egressIp: d.egressIp || null,
          latencyMs: d.latencyMs != null ? Number(d.latencyMs) : null,
          error: d.error || (res.ok ? null : `HTTP ${res.status}`),
        },
      }));
    } catch (e) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { ok: false, egressIp: null, latencyMs: null, error: (e as Error).message },
      }));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Proxy Configuration</h2>
          <p className="text-sm text-slate-500">
            Configure residential proxies (3proxy + Tailscale) for OTT WhatsApp/Telegram routing
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* File downloads served by an API route — <Link> is for page navigation */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/tenant/proxy-config/download?os=linux"
            className="inline-flex items-center gap-2 border border-emerald-300 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-50 transition"
            title="One-command installer for a Linux residential machine — pre-filled with your server IP and fresh credentials, auto-registers on completion"
          >
            ⬇ Linux Setup (.sh)
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/tenant/proxy-config/download?os=windows"
            className="inline-flex items-center gap-2 border border-blue-300 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition"
            title="One-click installer for a Windows home PC — installs Tailscale + 3proxy, runs as a service, auto-registers on completion"
          >
            ⬇ Windows Setup (.bat)
          </a>
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="border border-cyan-200 text-cyan-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-cyan-50 transition flex items-center gap-2"
          >
            <span>📖</span> {showGuide ? "Hide Guide" : "Setup Guide"}
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + Add Proxy
          </button>
        </div>
      </div>

      {/* ── Per-tenant installer callout ── */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-2xl">🚀</span>
        <div className="text-sm text-emerald-900">
          <p className="font-semibold mb-1">Your installer is personalized for this account</p>
          <p className="text-emerald-800">
            Download the script, run it once on the <strong>home PC</strong> (it installs Tailscale + 3proxy, starts the
            SOCKS5 proxy and opens a browser login for Tailscale), and it <strong>auto-registers</strong> a new row below —
            no manual entry needed. Every download mints fresh credentials and a one-time token that expires in 30 minutes.
            For a non-interactive Tailscale login, set <code className="bg-emerald-100 px-1 rounded">TAILSCALE_AUTHKEY</code>
            before running.
          </p>
        </div>
      </div>

      {/* ── Tailscale mesh connection panel ── */}
      <TailscaleMeshPanel />

      {/* ── 3proxy + Tailscale Setup Guide ── */}
      {showGuide && (
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-800 text-white px-6 py-4 flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <div>
              <h3 className="font-bold text-lg">3proxy + Tailscale Residential Proxy Setup Guide</h3>
              <p className="text-sm text-slate-300">Route OTT traffic through a residential IP for WhatsApp/Telegram pairing</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">1</div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-800 mb-2">Set Up the Residential Machine</h4>
                <p className="text-sm text-slate-600 mb-3">
                  You need a machine on a residential internet connection (home desktop, Raspberry Pi, old laptop).
                  This machine will run 3proxy and Tailscale.
                </p>
                <div className="bg-slate-900 text-green-300 rounded-lg p-4 font-mono text-xs leading-relaxed overflow-x-auto">
                  <div className="text-slate-400 mb-1"># Install Tailscale</div>
                  <div>curl -fsSL https://tailscale.com/install.sh | sh</div>
                  <div>sudo tailscale up --advertise-tags=tag:proxy</div>
                  <div className="text-slate-400 mt-3 mb-1"># Install 3proxy</div>
                  <div>sudo apt update && sudo apt install -y 3proxy</div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">2</div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-800 mb-2">Configure 3proxy</h4>
                <p className="text-sm text-slate-600 mb-3">
                  Create a 3proxy config with SOCKS5 authentication. Bind to the Tailscale IP so the proxy
                  is only accessible through the Tailscale mesh network.
                </p>
                <div className="bg-slate-900 text-green-300 rounded-lg p-4 font-mono text-xs leading-relaxed overflow-x-auto">
                  <div className="text-slate-400 mb-1"># Find your Tailscale IP</div>
                  <div>tailscale ip -4</div>
                  <div className="text-slate-500"># → e.g. 100.87.64.32</div>
                  <div className="text-slate-400 mt-3 mb-1"># /etc/3proxy/3proxy.cfg</div>
                  <div>nserver 8.8.8.8</div>
                  <div>nserver 1.1.1.1</div>
                  <div>nscache 65536</div>
                  <div>timeouts 1 5 30 60 180 1800 15 60</div>
                  <div>users myproxyuser:CL:strongpassword123</div>
                  <div className="mt-2 text-slate-400"># Bind to the Tailscale IP (use your actual IP from tailscale ip -4)</div>
                  <div>auth strong</div>
                  <div>allow myproxyuser</div>
                  <div>socks -p1080 -e100.87.64.32</div>
                  <div>flush</div>
                  <div className="text-slate-400 mt-3 mb-1"># Create systemd service (if not included)</div>
                  <div>sudo tee /etc/systemd/system/3proxy.service &lt;&lt;EOF</div>
                  <div>[Unit]</div>
                  <div>Description=3proxy Proxy Server</div>
                  <div>After=network.target</div>
                  <div>[Service]</div>
                  <div>ExecStart=/usr/bin/3proxy /etc/3proxy/3proxy.cfg</div>
                  <div>Restart=always</div>
                  <div>[Install]</div>
                  <div>WantedBy=multi-user.target</div>
                  <div>EOF</div>
                  <div className="text-slate-400 mt-2 mb-1"># Start and enable</div>
                  <div>sudo systemctl daemon-reload</div>
                  <div>sudo systemctl restart 3proxy</div>
                  <div>sudo systemctl enable 3proxy</div>
                </div>
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700">
                    <strong>🔒 Security:</strong> Binding to <code className="bg-amber-100 px-1 rounded">-eYOUR_TAILSCALE_IP</code>
                    ensures the proxy is only reachable through your Tailscale network — not exposed to the public internet.
                    The <code className="bg-amber-100 px-1 rounded">auth strong</code> directive adds SOCKS5 username/password authentication.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">3</div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-800 mb-2">Connect the SaaS Server to Tailscale</h4>
                <p className="text-sm text-slate-600 mb-3">
                  Install Tailscale on this SaaS server so it can reach the residential machine&apos;s 3proxy
                  through the Tailscale mesh network (WireGuard).
                </p>
                <div className="bg-slate-900 text-green-300 rounded-lg p-4 font-mono text-xs leading-relaxed overflow-x-auto">
                  <div className="text-slate-400 mb-1"># On the SaaS server</div>
                  <div>curl -fsSL https://tailscale.com/install.sh | sh</div>
                  <div>sudo tailscale up</div>
                  <div className="mt-2 text-slate-400"># Verify connectivity to residential machine</div>
                  <div>tailscale status</div>
                  <div>ping 100.87.64.32</div>
                  <div className="text-slate-400 mt-2"># Test the SOCKS5 proxy</div>
                  <div>curl --socks5 myproxyuser:strongpassword123@100.87.64.32:1080 https://ifconfig.me</div>
                  <div className="text-slate-500"># Should return the residential IP address</div>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">4</div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-800 mb-2">Add Proxy to This Dashboard</h4>
                <p className="text-sm text-slate-600 mb-3">
                  <strong>Easiest:</strong> use the <span className="text-emerald-700 font-medium">⬇ Linux / Windows Setup</span> button
                  above — the downloaded installer runs on the home PC and registers the proxy automatically.
                  <br /><br />
                  Manual option — use the form above to register the proxy. Use the Tailscale IP of the residential machine
                  and the 3proxy credentials printed at the end of the installer (or from step 2).
                </p>
                <div className="bg-white border rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div><strong>Name:</strong> <span className="text-slate-600">Home Residential Proxy</span></div>
                  <div><strong>Proxy Type:</strong> <span className="text-slate-600">residential</span></div>
                  <div><strong>Host:</strong> <span className="text-slate-600 font-mono">100.87.64.32</span> <span className="text-xs text-slate-400">(Tailscale IP)</span></div>
                  <div><strong>Port:</strong> <span className="text-slate-600">1080</span></div>
                  <div><strong>Protocol:</strong> <span className="text-slate-600">socks5</span></div>
                  <div><strong>Username:</strong> <span className="text-slate-600">myproxyuser</span></div>
                </div>
              </div>
            </div>

            {/* Architecture Diagram */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h4 className="font-semibold text-slate-800 mb-3">Architecture Overview</h4>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm font-mono text-slate-700">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center">
                  <div className="text-blue-600 font-bold mb-1">📱 WhatsApp</div>
                  <div className="text-slate-500">via baileys</div>
                </div>
                <span className="text-lg">→</span>
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-center">
                  <div className="text-green-600 font-bold mb-1">🔒 3proxy</div>
                  <div className="text-slate-500">SOCKS5:1080</div>
                </div>
                <span className="text-lg">→</span>
                <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-center">
                  <div className="text-purple-600 font-bold mb-1">🔄 Tailscale</div>
                  <div className="text-slate-500">WireGuard</div>
                </div>
                <span className="text-lg">→</span>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-center">
                  <div className="text-amber-600 font-bold mb-1">🏠 Home IP</div>
                  <div className="text-slate-500">Residential</div>
                </div>
                <span className="text-lg">→</span>
                <div className="bg-slate-100 border border-slate-300 rounded-lg px-4 py-3 text-center">
                  <div className="text-slate-600 font-bold mb-1">🌐 Internet</div>
                  <div className="text-slate-500">Meta/Telegram</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Proxy Form */}
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-4">{editingId ? "Edit Proxy Configuration" : "Add Proxy Configuration"}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Proxy Name *</label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required placeholder="e.g. Home Residential Proxy"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Proxy Type</label>
              <select
                value={form.proxyType}
                onChange={e => setForm({ ...form, proxyType: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="residential">Residential</option>
                <option value="datacenter">Datacenter</option>
                <option value="mobile">Mobile 4G/5G</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Host *</label>
              <input
                value={form.host}
                onChange={e => setForm({ ...form, host: e.target.value })}
                required placeholder="100.87.64.32 (Tailscale IP)"
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Port *</label>
              <input
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={e => setForm({ ...form, port: e.target.value })}
                required placeholder="1080"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Protocol</label>
              <select
                value={form.protocol}
                onChange={e => setForm({ ...form, protocol: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="socks5">SOCKS5</option>
                <option value="socks4">SOCKS4</option>
                <option value="http">HTTP</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                placeholder="myproxyuser"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password {editingId ? "(leave empty to keep current)" : ""}</label>
              <input
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                type="password"
                placeholder={editingId ? "Enter new password to change" : "Strong password"}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Saving..." : editingId ? "Update Proxy" : "Add Proxy"}
              </button>
              <button type="button" onClick={resetForm} className="border px-6 py-2 rounded-lg text-sm hover:bg-slate-50 transition">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Proxy List */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-slate-50">
          <h3 className="font-semibold text-slate-800">Configured Proxies</h3>
        </div>
        {configs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-3">🔌</div>
            <p>No proxy configurations yet.</p>
            <p className="text-sm mt-1">Add a 3proxy + Tailscale residential proxy to enable OTT devices.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Host</th>
                  <th className="px-6 py-3">Port</th>
                  <th className="px-6 py-3">Protocol</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {configs.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium">{c.name}</td>
                    <td className="px-6 py-4 font-mono text-xs">{c.host}</td>
                    <td className="px-6 py-4">{c.port}</td>
                    <td className="px-6 py-4"><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs uppercase">{c.protocol}</span></td>
                    <td className="px-6 py-4 capitalize">{c.proxy_type}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleActive(c.id, c.is_active)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition ${
                          c.is_active
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-red-100 text-red-700 hover:bg-red-200"
                        }`}
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {testResults[c.id] && (
                          <span
                            className={`text-xs font-mono px-2 py-1 rounded ${
                              testResults[c.id].ok
                                ? "bg-green-50 text-green-700"
                                : testResults[c.id].error === "Testing…"
                                  ? "bg-slate-100 text-slate-500"
                                  : "bg-red-50 text-red-600"
                            }`}
                            title={testResults[c.id].error || undefined}
                          >
                            {testResults[c.id].ok
                              ? `✅ ${testResults[c.id].egressIp} · ${testResults[c.id].latencyMs}ms`
                              : testResults[c.id].error === "Testing…"
                                ? "⏳ Testing…"
                                : "❌ Failed"}
                          </span>
                        )}
                        <button
                          onClick={() => testProxy(c.id)}
                          disabled={testingId !== null}
                          className="text-cyan-600 hover:text-cyan-800 text-xs font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Live connectivity test — verifies this proxy actually routes traffic"
                        >
                          {testingId === c.id ? "Testing…" : "🧪 Test"}
                        </button>
                        <button
                          onClick={() => startEdit(c)}
                          className="text-blue-500 hover:text-blue-700 text-xs font-medium hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteConfig(c.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {confirmModal}
    </div>
  );
}
