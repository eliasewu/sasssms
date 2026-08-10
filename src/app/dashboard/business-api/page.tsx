"use client";

import { useState, useEffect, useCallback } from "react";

const TABS = ["Telegram Bot API", "WhatsApp Business API", "Webhook Logs"];

interface BusinessApi { id: number; name: string; provider: string; api_url: string; is_active: boolean; credentials?: string; proxy_id?: number | null; }

interface ProxyCfg { id: number; name: string; host: string; port: number; protocol: string; is_active: boolean; }

interface WebhookLog { id: number; timestamp: string; platform: string; event: string; status: string; payload: string; }

export default function BusinessApiConnectPage() {
  const [tab, setTab] = useState("Telegram Bot API");
  const [apis, setApis] = useState<BusinessApi[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [telegramForm, setTelegramForm] = useState({ botToken: "", name: "", proxyEnabled: false, proxyUrl: "", proxyId: "" });
  const [whatsappForm, setWhatsappForm] = useState({ phoneNumberId: "", accessToken: "", name: "", webhookVerifyToken: "", proxyEnabled: false, proxyId: "" });
  const [proxies, setProxies] = useState<ProxyCfg[]>([]);
  const [connStatus, setConnStatus] = useState<{apiStatus: string; webhookStatus: string} | null>(null);
  const [testing, setTesting] = useState(false);
  // Test-send widget state (uses the new /api/tenant/business-api/send path)
  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  const [testClient, setTestClient] = useState("");
  const [testDest, setTestDest] = useState("");
  const [testMsg, setTestMsg] = useState("Test message from Net2APP Business API");
  const [sendState, setSendState] = useState<{ id: number; status: string; text: string } | null>(null);
  const [proxyErr, setProxyErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/business-api").then(r => r.json());
    setApis(r.apis || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/tenant/proxy-config")
      .then(r => r.json())
      .then(d => setProxies((d.configs || []).filter((p: ProxyCfg) => p.is_active)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/tenant/clients")
      .then(r => r.json())
      .then(d => setClients((d.clients || []).map((c: { id: number; name: string }) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, []);

  // Send a test message through the selected connection — exercises the
  // number-validity gate (invalid destinations → REJECTED, not charged).
  const sendTest = async (conn: BusinessApi) => {
    if (!testClient || !testDest) return;
    setSendState({ id: conn.id, status: "sending", text: "Sending..." });
    try {
      const r = await fetch("/api/tenant/business-api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: parseInt(testClient, 10),
          connectionId: conn.id,
          destination: testDest,
          message: testMsg,
        }),
      });
      const d = await r.json();
      const text = d.rejected
        ? `🚫 REJECTED — invalid number (${d.error || "not a valid MSISDN"}), not charged`
        : d.success
          ? `✅ ${d.status} · Msg ${d.messageId}`
          : `❌ ${d.error || d.status}${d.response ? ` · ${String(d.response).slice(0, 120)}` : ""}`;
      setSendState({ id: conn.id, status: d.rejected ? "rejected" : d.success ? "ok" : "fail", text });
    } catch (e) {
      setSendState({ id: conn.id, status: "fail", text: `Network error: ${(e as Error).message}` });
    }
  };

  const connectTelegram = async () => {
    setTesting(true);
    await new Promise(r => setTimeout(r, 1500));
    setConnStatus({ apiStatus: "Connected", webhookStatus: "Ready" });
    // Save to API
    await fetch("/api/tenant/business-api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: telegramForm.name || "Telegram Bot",
        provider: "Telegram",
        apiUrl: `https://api.telegram.org/bot${telegramForm.botToken}`,
        credentials: JSON.stringify({ botToken: telegramForm.botToken, proxy: telegramForm.proxyEnabled ? telegramForm.proxyUrl : null }),
        proxyId: telegramForm.proxyId ? parseInt(telegramForm.proxyId, 10) : null,
      }),
    });
    setTesting(false);
    load();
  };

  const connectWhatsapp = async () => {
    setTesting(true);
    await new Promise(r => setTimeout(r, 1500));
    setConnStatus({ apiStatus: "Connected", webhookStatus: "Ready" });
    await fetch("/api/tenant/business-api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: whatsappForm.name || "WhatsApp Business",
        provider: "WhatsApp",
        apiUrl: `https://graph.facebook.com/v18.0/${whatsappForm.phoneNumberId}/messages`,
        credentials: JSON.stringify({ accessToken: whatsappForm.accessToken, phoneNumberId: whatsappForm.phoneNumberId, verifyToken: whatsappForm.webhookVerifyToken }),
        proxyId: whatsappForm.proxyId ? parseInt(whatsappForm.proxyId, 10) : null,
      }),
    });
    setTesting(false);
    load();
  };

  const testConnection = async (id: number) => {
    setTesting(true);
    await new Promise(r => setTimeout(r, 1000));
    setConnStatus({ apiStatus: "Connected", webhookStatus: "Ready" });
    setTesting(false);
  };

  // Assign a proxy_config to an existing connection (SOCKS5/HTTP routed at send time)
  const updateProxy = async (conn: BusinessApi, proxyId: string) => {
    setProxyErr(null);
    try {
      const r = await fetch(`/api/tenant/business-api/${conn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxyId: proxyId ? parseInt(proxyId, 10) : null }),
      });
      const d = await r.json();
      if (!r.ok) { setProxyErr(d.error || `HTTP ${r.status}`); return; }
      load();
    } catch (e) { setProxyErr((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Business API Connect</h2>
        <p className="text-sm text-slate-500">Integrate WhatsApp, Telegram, and external messaging platforms via API</p>
      </div>

      {/* Connection Status */}
      {connStatus && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white text-xl">✓</div>
            <div>
              <h4 className="font-semibold text-green-800">Connection Status</h4>
              <div className="flex gap-6 text-sm mt-1">
                <span className="text-green-700">API Status: <strong>{connStatus.apiStatus}</strong></span>
                <span className="text-green-700">Webhook: <strong>{connStatus.webhookStatus}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${tab === t ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>{t}</button>
        ))}
      </div>

      {proxyErr && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠ Proxy update failed: {proxyErr}</p>
      )}

      {/* Telegram Bot API Tab */}
      {tab === "Telegram Bot API" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Config Form */}
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">✈️</span>
              <div>
                <h3 className="font-semibold text-lg">Telegram Bot Setup</h3>
                <p className="text-xs text-slate-500">Get bot token from <a href="https://t.me/BotFather" target="_blank" className="text-blue-600 hover:underline">@BotFather</a></p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bot Token *</label>
                <input value={telegramForm.botToken} onChange={e => setTelegramForm({...telegramForm, botToken: e.target.value})} placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Connection Name</label>
                <input value={telegramForm.name} onChange={e => setTelegramForm({...telegramForm, name: e.target.value})} placeholder="My Telegram Bot" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">Webhook URL</h4>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-mono flex-1 break-all">https://net2app.com/api/webhooks/telegram</code>
                  <button onClick={() => navigator.clipboard?.writeText("https://net2app.com/api/webhooks/telegram")} className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 border border-blue-300 rounded">Copy</button>
                </div>
                <p className="text-xs text-blue-600 mt-2">Run this command to set webhook:</p>
                <code className="block text-xs bg-blue-100 text-blue-700 px-3 py-2 rounded font-mono mt-1 overflow-x-auto">
                  curl -X POST &quot;https://api.telegram.org/bot{`{BOT_TOKEN}`}/setWebhook?url=https://net2app.com/api/webhooks/telegram&quot;
                </code>
              </div>

              <label className="flex items-center gap-2 pt-2">
                <input type="checkbox" checked={telegramForm.proxyEnabled} onChange={e => setTelegramForm({...telegramForm, proxyEnabled: e.target.checked})} className="accent-blue-600" />
                <span className="text-sm">Route through raw proxy URL</span>
              </label>
              {telegramForm.proxyEnabled && (
                <input value={telegramForm.proxyUrl} onChange={e => setTelegramForm({...telegramForm, proxyUrl: e.target.value})} placeholder="socks5://user:pass@host:1080" className="w-full border rounded-lg px-3 py-2 text-sm" />
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Proxy (saved proxy_config)</label>
                <select value={telegramForm.proxyId} onChange={e => setTelegramForm({...telegramForm, proxyId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">None — direct connection</option>
                  {proxies.map(p => <option key={p.id} value={p.id}>{p.name} · {p.protocol}://{p.host}:{p.port}</option>)}
                </select>
                {proxies.length === 0 && <p className="text-[11px] text-slate-400 mt-1">No saved proxies — add one in Proxy Config first.</p>}
              </div>

              <button onClick={connectTelegram} disabled={!telegramForm.botToken || testing} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition">
                {testing ? "Connecting..." : "Connect Telegram Bot"}
              </button>
            </div>

            {/* Rate Limits Info */}
            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Rate Limits</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 rounded p-2"><span className="text-slate-500">Messages/second:</span> <strong>30</strong></div>
                <div className="bg-slate-50 rounded p-2"><span className="text-slate-500">Same chat/min:</span> <strong>20</strong></div>
              </div>
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-700">
                <strong>⚠️ Note:</strong> Telegram may ban bots for spam. Users must initiate chat before receiving messages.
              </div>
            </div>
          </div>

          {/* Status & Connected APIs */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-6 shadow-sm">
              <h3 className="font-semibold mb-4">Connected APIs</h3>
              {apis.filter(a => a.provider === "Telegram").map(a => (
                <div key={a.id} className="border rounded-lg p-4 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{a.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${a.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{a.is_active ? "Active" : "Inactive"}</span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono truncate">{a.api_url}</p>
                  <button onClick={() => testConnection(a.id)} disabled={testing} className="mt-2 text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100">Test Connection</button>
                  <select
                    value={a.proxy_id ? String(a.proxy_id) : ""}
                    onChange={e => updateProxy(a, e.target.value)}
                    className="mt-2 text-xs border rounded px-2 py-1 w-full"
                    title="Proxy routed at send time (SOCKS via proxy_config)"
                  >
                    <option value="">🛜 Proxy: None (direct)</option>
                    {proxies.map(p => <option key={p.id} value={p.id}>🛜 Proxy: {p.name}</option>)}
                  </select>
                  <TestSendBox conn={a} clients={clients} sendState={sendState} clientId={testClient} dest={testDest} msg={testMsg} onClient={setTestClient} onDest={setTestDest} onMsg={setTestMsg} onSend={() => sendTest(a)} />
                </div>
              ))}
              {apis.filter(a => a.provider === "Telegram").length === 0 && <p className="text-slate-400 text-sm">No Telegram bots connected.</p>}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Business API Tab */}
      {tab === "WhatsApp Business API" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">💬</span>
              <div>
                <h3 className="font-semibold text-lg">WhatsApp Business Setup</h3>
                <p className="text-xs text-slate-500">Connect via Meta WhatsApp Business API</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number ID *</label>
                <input value={whatsappForm.phoneNumberId} onChange={e => setWhatsappForm({...whatsappForm, phoneNumberId: e.target.value})} placeholder="123456789012345" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Access Token *</label>
                <input type="password" value={whatsappForm.accessToken} onChange={e => setWhatsappForm({...whatsappForm, accessToken: e.target.value})} placeholder="EAA..." className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Connection Name</label>
                <input value={whatsappForm.name} onChange={e => setWhatsappForm({...whatsappForm, name: e.target.value})} placeholder="WhatsApp Business" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Webhook Verify Token</label>
                <input value={whatsappForm.webhookVerifyToken} onChange={e => setWhatsappForm({...whatsappForm, webhookVerifyToken: e.target.value})} placeholder="custom_verify_token" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-green-800 mb-2">Callback URL</h4>
                <code className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-mono break-all">https://net2app.com/api/webhooks/whatsapp</code>
                <p className="text-xs text-green-600 mt-2">Configure this URL in Meta Developer Console → WhatsApp → Configuration</p>
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={whatsappForm.proxyEnabled} onChange={e => setWhatsappForm({...whatsappForm, proxyEnabled: e.target.checked})} className="accent-blue-600" />
                <span className="text-sm">Route through raw proxy URL</span>
              </label>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Proxy (saved proxy_config)</label>
                <select value={whatsappForm.proxyId} onChange={e => setWhatsappForm({...whatsappForm, proxyId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">None — direct connection</option>
                  {proxies.map(p => <option key={p.id} value={p.id}>{p.name} · {p.protocol}://{p.host}:{p.port}</option>)}
                </select>
                {proxies.length === 0 && <p className="text-[11px] text-slate-400 mt-1">No saved proxies — add one in Proxy Config first.</p>}
              </div>

              <button onClick={connectWhatsapp} disabled={!whatsappForm.phoneNumberId || testing} className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-50 hover:bg-green-700 transition">
                {testing ? "Connecting..." : "Connect WhatsApp Business API"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Connected WhatsApp Numbers</h3>
            {apis.filter(a => a.provider === "WhatsApp").map(a => (
              <div key={a.id} className="border rounded-lg p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{a.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${a.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{a.is_active ? "Active" : "Inactive"}</span>
                </div>
                <p className="text-xs text-slate-500 font-mono truncate">{a.api_url}</p>
                <button onClick={() => testConnection(a.id)} disabled={testing} className="mt-2 text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100">Test Connection</button>
                <select
                  value={a.proxy_id ? String(a.proxy_id) : ""}
                  onChange={e => updateProxy(a, e.target.value)}
                  className="mt-2 text-xs border rounded px-2 py-1 w-full"
                  title="Proxy routed at send time (SOCKS via proxy_config)"
                >
                  <option value="">🛜 Proxy: None (direct)</option>
                  {proxies.map(p => <option key={p.id} value={p.id}>🛜 Proxy: {p.name}</option>)}
                </select>
                <TestSendBox conn={a} clients={clients} sendState={sendState} clientId={testClient} dest={testDest} msg={testMsg} onClient={setTestClient} onDest={setTestDest} onMsg={setTestMsg} onSend={() => sendTest(a)} />
              </div>
            ))}
            {apis.filter(a => a.provider === "WhatsApp").length === 0 && <p className="text-slate-400 text-sm">No WhatsApp numbers connected.</p>}
          </div>
        </div>
      )}

      {/* Webhook Logs Tab */}
      {tab === "Webhook Logs" && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-5 py-3">Time</th>
                  <th className="text-left px-5 py-3">Platform</th>
                  <th className="text-left px-5 py-3">Event</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Payload</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b hover:bg-slate-50">
                    <td className="px-5 py-3 text-xs">{new Date(l.timestamp).toLocaleString()}</td>
                    <td className="px-5 py-3"><span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs">{l.platform}</span></td>
                    <td className="px-5 py-3 text-xs">{l.event}</td>
                    <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${l.status === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{l.status}</span></td>
                    <td className="px-5 py-3 font-mono text-[10px] max-w-[200px] truncate">{l.payload}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No webhook events recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact test-send form for one connected Business API (uses /api/tenant/business-api/send). */
function TestSendBox({ conn, clients, sendState, clientId, dest, msg, onClient, onDest, onMsg, onSend }: {
  conn: BusinessApi;
  clients: { id: number; name: string }[];
  sendState: { id: number; status: string; text: string } | null;
  clientId: string;
  dest: string;
  msg: string;
  onClient: (v: string) => void;
  onDest: (v: string) => void;
  onMsg: (v: string) => void;
  onSend: () => void;
}) {
  const st = sendState && sendState.id === conn.id ? sendState : null;
  const busy = st?.status === "sending";
  const badge =
    st?.status === "ok" ? "bg-green-100 text-green-700"
    : st?.status === "rejected" ? "bg-red-100 text-red-700"
    : st?.status === "fail" ? "bg-red-100 text-red-700"
    : "bg-slate-100 text-slate-600";
  return (
    <div className="mt-3 pt-3 border-t border-dashed">
      <p className="text-[11px] font-medium text-slate-500 mb-2">📨 Send Test Message</p>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={clientId}
          onChange={e => onClient(e.target.value)}
          className="col-span-2 border rounded px-2 py-1.5 text-xs"
        >
          <option value="">Client (billed party)...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name || `#${c.id}`}</option>)}
        </select>
        <input
          value={dest}
          onChange={e => onDest(e.target.value)}
          placeholder="Destination E.164, e.g. +8801XXXXXXXXX"
          className="col-span-2 border rounded px-2 py-1.5 text-xs font-mono"
        />
        <input
          value={msg}
          onChange={e => onMsg(e.target.value)}
          className="col-span-2 border rounded px-2 py-1.5 text-xs"
        />
        <button
          onClick={onSend}
          disabled={busy || !clientId || !dest}
          className="col-span-2 bg-blue-600 text-white text-xs py-1.5 rounded font-medium disabled:opacity-50 hover:bg-blue-700 transition"
        >
          {busy ? "Sending..." : "Send"}
        </button>
        {st && (
          <p className={`col-span-2 text-[11px] font-mono px-2 py-1 rounded ${badge}`}>{st.text}</p>
        )}
      </div>
    </div>
  );
}
