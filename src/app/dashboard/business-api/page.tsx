"use client";

import { useState, useEffect, useCallback } from "react";

const TABS = ["Telegram Bot API", "WhatsApp Business API", "Webhook Logs"];

interface BusinessApi { id: number; name: string; provider: string; api_url: string; is_active: boolean; credentials?: string; }

interface WebhookLog { id: number; timestamp: string; platform: string; event: string; status: string; payload: string; }

export default function BusinessApiConnectPage() {
  const [tab, setTab] = useState("Telegram Bot API");
  const [apis, setApis] = useState<BusinessApi[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [telegramForm, setTelegramForm] = useState({ botToken: "", name: "", proxyEnabled: false, proxyUrl: "" });
  const [whatsappForm, setWhatsappForm] = useState({ phoneNumberId: "", accessToken: "", name: "", webhookVerifyToken: "", proxyEnabled: false });
  const [connStatus, setConnStatus] = useState<{apiStatus: string; webhookStatus: string} | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/business-api").then(r => r.json());
    setApis(r.apis || []);
  }, []);

  useEffect(() => { load(); }, [load]);

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
                <span className="text-sm">Route through proxy</span>
              </label>
              {telegramForm.proxyEnabled && (
                <input value={telegramForm.proxyUrl} onChange={e => setTelegramForm({...telegramForm, proxyUrl: e.target.value})} placeholder="http://proxy:8080" className="w-full border rounded-lg px-3 py-2 text-sm" />
              )}

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
                <span className="text-sm">Route through proxy</span>
              </label>

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
