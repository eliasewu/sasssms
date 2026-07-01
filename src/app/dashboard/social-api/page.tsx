"use client";

import { useState, useEffect, useCallback } from "react";

interface SocialApi { id: number; platform: string; name: string; phone_number: string; is_active: boolean; }

export default function SocialApiPage() {
  const [configs, setConfigs] = useState<SocialApi[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ platform: "whatsapp", name: "", apiKey: "", phoneNumber: "", webhookUrl: "" });

  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/social-api").then((r) => r.json());
    setConfigs(r.configs || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/tenant/social-api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Social API Configuration</h2>
          <p className="text-sm text-slate-500">WhatsApp Business API & Telegram integrations</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Integration</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Platform</label>
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="whatsapp">WhatsApp Business</option>
                <option value="telegram">Telegram</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">API Key</label>
              <input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Webhook URL</label>
              <input value={form.webhookUrl} onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {configs.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{c.platform === "whatsapp" ? "💬" : "✈️"}</span>
              <div>
                <h4 className="font-semibold">{c.name}</h4>
                <p className="text-xs text-slate-500">{c.platform.toUpperCase()}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">{c.phone_number || "No number"}</p>
            <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs ${c.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{c.is_active ? "Active" : "Inactive"}</span>
          </div>
        ))}
        {configs.length === 0 && <div className="col-span-full text-center py-12 text-slate-400">No social API integrations.</div>}
      </div>
    </div>
  );
}
