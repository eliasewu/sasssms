"use client";

import { useState, useEffect, useCallback } from "react";

interface Route { id: number; name: string; trunk_id: number; trunk_name: string; supplier_name: string; country_code: string | null; prefix: string | null; priority: number; is_active: boolean; }
interface Trunk { id: number; name: string; supplier_name: string; supplier_id: number; capacity: number; is_active?: boolean; }
interface Supplier { id: number; name: string; connection_type: string; is_active?: boolean; }

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [trunks, setTrunks] = useState<Trunk[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Route | null>(null);
  const [form, setForm] = useState({ name: "", trunkId: "", countryCode: "", prefix: "", priority: "1" });
  const [showSupplierInfo, setShowSupplierInfo] = useState(false);

  const load = useCallback(async () => {
    const [rr, tr, sr] = await Promise.all([
      fetch("/api/tenant/routes").then(r => r.json()),
      fetch("/api/tenant/trunks").then(r => r.json()),
      fetch("/api/tenant/suppliers").then(r => r.json()),
    ]);
    setRoutes(rr.routes || []);
    setTrunks(tr.trunks || []);
    setSuppliers(sr.suppliers || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedTrunk = trunks.find(t => t.id === parseInt(form.trunkId));
    const payload = { name: form.name, trunkId: parseInt(form.trunkId), countryCode: form.countryCode || null, prefix: form.prefix || null, priority: parseInt(form.priority) };
    if (editing) await fetch(`/api/tenant/routes/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, isActive: editing.is_active }) });
    else await fetch("/api/tenant/routes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setShowForm(false); setEditing(null); setForm({ name: "", trunkId: "", countryCode: "", prefix: "", priority: "1" }); load();
  };

  const handleDelete = async (id: number) => { if (!confirm("Archive this route?")) return; await fetch(`/api/tenant/routes/${id}`, { method: "DELETE" }); load(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Routes</h2>
          <p className="text-sm text-slate-500">Routes → show all available Trunks → which show all Suppliers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSupplierInfo(!showSupplierInfo)} className="border px-4 py-2 rounded-lg text-sm hover:bg-slate-50">{showSupplierInfo ? "Hide" : "Show"} Supplier Info</button>
          <button onClick={() => { setShowForm(true); setEditing(null); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Route</button>
        </div>
      </div>

      {showSupplierInfo && (
        <div className="bg-white rounded-xl border p-5">
          <h4 className="font-semibold mb-3">All Available Suppliers</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {suppliers.filter(s => s.is_active !== false).map(s => (
              <div key={s.id} className="border rounded-lg p-3 text-sm">
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-slate-500">{s.connection_type}</p>
                <div className="mt-2 text-xs text-slate-400">
                  {trunks.filter(t => t.supplier_id === s.id).map(t => (<div key={t.id}>→ {t.name}</div>))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-4">{editing ? "Edit" : "Add"} Route</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium mb-1">Route Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div>
              <label className="block text-sm font-medium mb-1">Trunk * (showing all available)</label>
              <select value={form.trunkId} onChange={e => setForm({...form, trunkId: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select Trunk...</option>
                {trunks.filter(t => t.is_active !== false).map(t => (<option key={t.id} value={t.id}>{t.name} → {t.supplier_name}</option>))}
              </select>
            </div>
            <div><label className="block text-sm font-medium mb-1">Country Code</label><input value={form.countryCode} onChange={e => setForm({...form, countryCode: e.target.value})} placeholder="+91" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Prefix</label><input value={form.prefix} onChange={e => setForm({...form, prefix: e.target.value})} placeholder="91" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Priority</label><input type="number" min="1" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div className="col-span-full flex gap-2"><button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">{editing ? "Update" : "Create"}</button><button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button></div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-5 py-3 text-left">Route</th><th className="px-5 py-3 text-left">Trunk</th><th className="px-5 py-3 text-left">Supplier</th><th className="px-5 py-3 text-left">Country</th><th className="px-5 py-3 text-left">Priority</th><th className="px-5 py-3 text-left">Status</th><th className="px-5 py-3 text-left">Actions</th></tr></thead>
        <tbody>
          {routes.map(r => {
            const trunk = trunks.find(t => t.id === r.trunk_id);
            return (<tr key={r.id} className="border-b hover:bg-slate-50">
              <td className="px-5 py-3 font-medium">{r.name}</td>
              <td className="px-5 py-3">{r.trunk_name || trunk?.name || "—"}</td>
              <td className="px-5 py-3 text-xs">{r.supplier_name || trunk?.supplier_name || "—"}</td>
              <td className="px-5 py-3">{r.country_code || r.prefix || "Any"}</td>
              <td className="px-5 py-3">{r.priority}</td>
              <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${r.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.is_active ? "Active" : "Inactive"}</span></td>
              <td className="px-5 py-3"><button onClick={() => { setEditing(r); setForm({ name: r.name, trunkId: r.trunk_id.toString(), countryCode: r.country_code || "", prefix: r.prefix || "", priority: r.priority.toString() }); setShowForm(true); }} className="text-blue-600 hover:underline text-xs mr-2">Edit</button><button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-xs">Delete</button></td>
            </tr>);
          })}
        </tbody></table>
      </div>
    </div>
  );
}
