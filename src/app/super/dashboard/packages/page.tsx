"use client";

import { useState, useEffect, useCallback } from "react";

interface Pkg { id: number; name: string; description: string; price: string; monthlyFee: string; smsCredits: number; freeSmsPerMonth: boolean; requiresLicense: boolean; isActive: boolean; features: string; }

export default function PackagesPage() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/super/packages").then(r => r.json());
    setPackages(r.packages || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await fetch(`/api/super/packages/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setEditing(null);
    setMsg(`Package "${editing.name}" updated! Landing page will reflect changes.`);
    setTimeout(() => setMsg(""), 4000);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Package Management</h2>
        <p className="text-sm text-slate-500">Edit pricing - changes auto-sync to landing page</p>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-lg">Edit: {editing.name}</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Package Name</label>
                  <input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input value={editing.description || ""} onChange={e => setEditing({...editing, description: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">One-Time Price ($)</label>
                  <input type="number" step="0.01" value={editing.price} onChange={e => setEditing({...editing, price: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Monthly Fee ($) *</label>
                  <input type="number" step="0.01" value={editing.monthlyFee} onChange={e => setEditing({...editing, monthlyFee: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono font-bold" />
                  <p className="text-xs text-slate-400 mt-1">This syncs to landing page automatically</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">SMS Credits Included</label>
                  <input type="number" value={editing.smsCredits} onChange={e => setEditing({...editing, smsCredits: parseInt(e.target.value)})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editing.freeSmsPerMonth} onChange={e => setEditing({...editing, freeSmsPerMonth: e.target.checked})} className="accent-blue-600" /><span className="text-sm">Free SMS per month</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editing.requiresLicense} onChange={e => setEditing({...editing, requiresLicense: e.target.checked})} className="accent-blue-600" /><span className="text-sm">Requires License</span></label>
                </div>
                <label className="flex items-center gap-2"><input type="checkbox" checked={editing.isActive} onChange={e => setEditing({...editing, isActive: e.target.checked})} className="accent-blue-600" /><span className="text-sm font-medium">Active (visible on landing page)</span></label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Features (JSON array)</label>
                <textarea value={editing.features || "[]"} onChange={e => setEditing({...editing, features: e.target.value})} rows={4} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700">Save & Sync to Landing Page</button>
                <button type="button" onClick={() => setEditing(null)} className="border px-6 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {packages.map(p => {
          let features: string[] = [];
          try { features = JSON.parse(p.features || "[]"); } catch {}
          return (
            <div key={p.id} className={`bg-white rounded-xl border p-6 shadow-sm ${!p.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">{p.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs ${p.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{p.isActive ? "Active" : "Hidden"}</span>
              </div>
              <p className="text-sm text-slate-500 mb-3">{p.description}</p>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between"><span className="text-slate-500 text-sm">Monthly Fee:</span><span className="font-bold text-lg">${p.monthlyFee}</span></div>
                {p.smsCredits > 0 && <div className="flex justify-between"><span className="text-slate-500 text-sm">SMS Credits:</span><span className="font-medium">{p.smsCredits.toLocaleString()}</span></div>}
                <div className="flex gap-2 text-xs">
                  {p.freeSmsPerMonth && <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">Free SMS/mo</span>}
                  {p.requiresLicense && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">License Required</span>}
                </div>
              </div>
              <ul className="space-y-1 mb-4">
                {features.map((f: string, i: number) => (
                  <li key={i} className="text-xs text-slate-600 flex items-center gap-1"><span className="text-green-500">✓</span> {f}</li>
                ))}
              </ul>
              <button onClick={() => setEditing(p)} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Edit Package</button>
            </div>
          );
        })}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <p className="text-sm text-amber-800"><strong>⚠️ Important:</strong> Package price changes auto-sync to the landing page at <code className="bg-amber-100 px-2 py-1 rounded text-xs">/api/public/settings</code>. The landing page fetches dynamically - no rebuild needed.</p>
      </div>
    </div>
  );
}
