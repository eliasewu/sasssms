"use client";

import { useState, useEffect, useCallback } from "react";

interface MccMnc { id: number; mcc: string; mnc: string; countryCode: string; countryName: string; networkName: string; language: string; }

export default function MccMncSuperPage() {
  const [data, setData] = useState<MccMnc[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState({ mcc: "", mnc: "", countryCode: "", countryName: "", networkName: "", language: "English" });
  const [bulkCsv, setBulkCsv] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/mcc-mnc").then(r => r.json());
    setData(r.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter(d =>
    (d.countryName || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.mcc || "").includes(search) ||
    (d.networkName || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/mcc-mnc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false); setForm({ mcc: "", mnc: "", countryCode: "", countryName: "", networkName: "", language: "English" });
    load();
    setMsg("MCC/MNC entry added. Syncing to all tenants...");
    setTimeout(() => setMsg(""), 3000);
  };

  const handleBulkUpload = async () => {
    const lines = bulkCsv.trim().split("\n").filter(Boolean);
    let count = 0;
    for (const line of lines) {
      // Format: mcc,mnc,country_code,country_name,network_name,language
      const parts = line.split(",").map(s => s.trim());
      if (parts.length >= 4) {
        await fetch("/api/mcc-mnc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mcc: parts[0], mnc: parts[1] || "", countryCode: parts[2] || "", countryName: parts[3] || "",
            networkName: parts[4] || "", language: parts[5] || "English",
          }),
        });
        count++;
      }
    }
    setShowBulk(false); setBulkCsv("");
    load();
    setMsg(`${count} entries added to MCC/MNC database. Auto-synced to tenants.`);
    setTimeout(() => setMsg(""), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">MCC/MNC Database (Super Admin)</h2>
          <p className="text-sm text-slate-500">{data.length} entries • Auto-syncs to all tenant schemas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)} className="border px-4 py-2 rounded-lg text-sm hover:bg-slate-50">📤 Bulk Upload</button>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Entry</button>
        </div>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}

      {/* Bulk Upload Modal */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBulk(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">Bulk Upload MCC/MNC</h3>
            <p className="text-sm text-slate-500 mb-3">CSV format: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">mcc,mnc,country_code,country_name,network_name,language</code></p>
            <textarea value={bulkCsv} onChange={e => setBulkCsv(e.target.value)}
              rows={12} placeholder="404,01,+91,India,BSNL,Hindi&#10;405,02,+91,India,Airtel,Hindi&#10;310,410,+1,United States,AT&T,English"
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
            <div className="flex gap-2 mt-4">
              <button onClick={handleBulkUpload} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Upload {bulkCsv.trim().split("\n").filter(Boolean).length} entries</button>
              <button onClick={() => setShowBulk(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <form onSubmit={handleAdd} className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium mb-1">MCC *</label><input value={form.mcc} onChange={e => setForm({...form, mcc: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">MNC</label><input value={form.mnc} onChange={e => setForm({...form, mnc: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Country Code</label><input value={form.countryCode} onChange={e => setForm({...form, countryCode: e.target.value})} placeholder="+91" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Country Name *</label><input value={form.countryName} onChange={e => setForm({...form, countryName: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Network Name</label><input value={form.networkName} onChange={e => setForm({...form, networkName: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Language</label><input value={form.language} onChange={e => setForm({...form, language: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div className="col-span-3 flex gap-2"><button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Add</button><button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button></div>
          </form>
        </div>
      )}

      <div className="flex gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by country, MCC, network..." className="border rounded-lg px-4 py-2 text-sm flex-1 max-w-md" />
        <span className="text-sm text-slate-500 py-2">{filtered.length} results</span>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left px-5 py-3">MCC</th><th className="text-left px-5 py-3">MNC</th><th className="text-left px-5 py-3">Country</th><th className="text-left px-5 py-3">Code</th><th className="text-left px-5 py-3">Network</th><th className="text-left px-5 py-3">Language</th></tr></thead>
          <tbody>
            {filtered.slice(0, 200).map(d => (
              <tr key={d.id} className="border-b hover:bg-slate-50"><td className="px-5 py-3 font-mono">{d.mcc}</td><td className="px-5 py-3 font-mono">{d.mnc || "—"}</td><td className="px-5 py-3 font-medium">{d.countryName}</td><td className="px-5 py-3">{d.countryCode}</td><td className="px-5 py-3">{d.networkName || "—"}</td><td className="px-5 py-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{d.language}</span></td></tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No entries.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
