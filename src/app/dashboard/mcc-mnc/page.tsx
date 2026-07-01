"use client";

import { useState, useEffect, useCallback } from "react";

interface MccMnc { id: number; mcc: string; mnc: string; countryCode: string; countryName: string; networkName: string; language: string; }

export default function MccMncPage() {
  const [data, setData] = useState<MccMnc[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/mcc-mnc");
      if (!r.ok) throw new Error("Failed to load");
      const j = await r.json();
      setData(j.data || []);
      setError("");
    } catch {
      setError("Failed to load MCC/MNC database. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter(d =>
    (d.countryName || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.mcc || "").includes(search) ||
    (d.networkName || "").toLowerCase().includes(search.toLowerCase())
  );

  const countries = [...new Set(data.map(d => d.countryName))].sort();

  if (loading) return <div className="p-8 text-center text-slate-400">Loading MCC/MNC database...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">MCC/MNC Database</h2>
          <p className="text-sm text-slate-500">{data.length} entries across {countries.length} countries</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search country, MCC, network..." className="border rounded-lg px-4 py-2 text-sm w-72" />
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr><th className="text-left px-5 py-3">MCC</th><th className="text-left px-5 py-3">MNC</th><th className="text-left px-5 py-3">Country</th><th className="text-left px-5 py-3">Code</th><th className="text-left px-5 py-3">Network</th><th className="text-left px-5 py-3">Language</th></tr>
          </thead>
          <tbody>
            {filtered.slice(0, 500).map(d => (
              <tr key={d.id} className="border-b hover:bg-slate-50">
                <td className="px-5 py-3 font-mono">{d.mcc}</td>
                <td className="px-5 py-3 font-mono">{d.mnc || "—"}</td>
                <td className="px-5 py-3 font-medium">{d.countryName}</td>
                <td className="px-5 py-3">{d.countryCode}</td>
                <td className="px-5 py-3">{d.networkName || "—"}</td>
                <td className="px-5 py-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{d.language}</span></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No results. Try a different search.</td></tr>}
          </tbody>
        </table>
        {filtered.length > 500 && <div className="px-5 py-3 bg-slate-50 text-xs text-slate-500">Showing 500 of {filtered.length}. Refine search to see more.</div>}
      </div>
    </div>
  );
}
