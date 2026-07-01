"use client";

import { useState, useEffect, useCallback } from "react";

interface ClientRate {
  id: number;
  client_id: number;
  client_name?: string;
  country_code: string;
  mcc: string;
  mnc: string;
  rate: string;
  is_active: boolean;
}

interface Client {
  id: number;
  name: string;
}

export default function ClientRatesPage() {
  const [rates, setRates] = useState<ClientRate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ clientId: "", countryCode: "", mcc: "", mnc: "", rate: "0.0004" });

  const load = useCallback(async () => {
    const [rr, cr] = await Promise.all([
      fetch("/api/tenant/client-rates").then((r) => r.json()),
      fetch("/api/tenant/clients").then((r) => r.json()),
    ]);
    setRates(rr.rates || []);
    setClients(cr.clients || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/tenant/client-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ clientId: "", countryCode: "", mcc: "", mnc: "", rate: "0.0004" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Client Rates</h2>
          <p className="text-sm text-slate-500">Manage per-country/MCC rates for clients</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          + Add Rate
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
              <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">Select</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Country Code</label>
              <input value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} required placeholder="+91" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">MCC</label>
              <input value={form.mcc} onChange={(e) => setForm({ ...form, mcc: e.target.value })} placeholder="404" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rate</label>
              <input type="number" step="0.000001" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-5 py-3 text-slate-500 font-medium">Client</th>
              <th className="text-left px-5 py-3 text-slate-500 font-medium">Country</th>
              <th className="text-left px-5 py-3 text-slate-500 font-medium">MCC</th>
              <th className="text-left px-5 py-3 text-slate-500 font-medium">MNC</th>
              <th className="text-left px-5 py-3 text-slate-500 font-medium">Rate</th>
              <th className="text-left px-5 py-3 text-slate-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-5 py-3">{clients.find((c) => c.id === r.client_id)?.name || r.client_id}</td>
                <td className="px-5 py-3">{r.country_code}</td>
                <td className="px-5 py-3 font-mono">{r.mcc || "—"}</td>
                <td className="px-5 py-3 font-mono">{r.mnc || "—"}</td>
                <td className="px-5 py-3 font-mono">${r.rate}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${r.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
            {rates.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No custom rates configured.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
