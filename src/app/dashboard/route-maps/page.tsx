"use client";

import { useState, useEffect, useCallback } from "react";

interface RouteMap { id: number; name: string; description: string; rules: string; is_active: boolean; }

export default function RouteMapsPage() {
  const [maps, setMaps] = useState<RouteMap[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", rules: "" });

  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/route-maps").then((r) => r.json());
    setMaps(r.maps || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/tenant/route-maps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false);
    setForm({ name: "", description: "", rules: "" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Route Maps</h2>
          <p className="text-sm text-slate-500">Define complex routing rules and logic</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Route Map</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Route Map Name" className="border rounded-lg px-3 py-2 text-sm" />
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="border rounded-lg px-3 py-2 text-sm" />
            </div>
            <textarea value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} rows={4} placeholder='{"rules":[{"match":"prefix:91","action":"route:india"}]}' className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {maps.map((m) => (
          <div key={m.id} className="bg-white rounded-xl border p-5 shadow-sm">
            <h4 className="font-semibold mb-1">{m.name}</h4>
            <p className="text-sm text-slate-500 mb-3">{m.description || "No description"}</p>
            {m.rules && <pre className="text-xs bg-slate-50 p-3 rounded-lg overflow-x-auto">{m.rules}</pre>}
            <span className={`inline-block mt-3 px-2 py-0.5 rounded-full text-xs ${m.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{m.is_active ? "Active" : "Inactive"}</span>
          </div>
        ))}
        {maps.length === 0 && <div className="col-span-full text-center py-12 text-slate-400">No route maps defined.</div>}
      </div>
    </div>
  );
}
