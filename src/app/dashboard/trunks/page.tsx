"use client";

import { useState, useEffect, useCallback } from "react";
import { useConfirmModal } from "@/components/confirm-modal";

interface Trunk { id: number; name: string; supplier_id: number; supplier_name: string; connection_type: string; connector_id: number; capacity: number; is_active: boolean; }
interface Supplier { id: number; name: string; connection_type: string; is_active?: boolean; }
interface Connector { id: number; name: string; type: string; is_active?: boolean; }

export default function TrunksPage() {
  const [trunks, setTrunks] = useState<Trunk[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Trunk | null>(null);
  const [form, setForm] = useState({ name: "", supplierId: "", connectorId: "", capacity: "100" });

  const load = useCallback(async () => {
    const [tr, sr, cr] = await Promise.all([
      fetch("/api/tenant/trunks").then(r => r.json()),
      fetch("/api/tenant/suppliers").then(r => r.json()),
      fetch("/api/tenant/connectors").then(r => r.json().catch(()=>({connectors:[]}))),
    ]);
    setTrunks(tr.trunks || []);
    setSuppliers(sr.suppliers || []);
    setConnectors(cr.connectors || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name: form.name, supplierId: parseInt(form.supplierId), connectorId: form.connectorId ? parseInt(form.connectorId) : null, capacity: parseInt(form.capacity) };
    if (editing) await fetch(`/api/tenant/trunks/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, isActive: editing.is_active }) });
    else await fetch("/api/tenant/trunks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setShowForm(false); setEditing(null); load();
  };

  const { confirm: confirmDelete, modal: confirmModal } = useConfirmModal();

  const handleDelete = async (id: number) => { if (!await confirmDelete("Delete this trunk?")) return; await fetch(`/api/tenant/trunks/${id}`, { method: "DELETE" }); load(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-slate-800">Trunks</h2><p className="text-sm text-slate-500">Trunks connect to suppliers. {suppliers.length} suppliers available.</p></div>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ name: "", supplierId: "", connectorId: "", capacity: "100" }); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Trunk</button>
      </div>

      {/* Available Suppliers Reference */}
      <div className="bg-white rounded-xl border p-4">
        <h4 className="text-sm font-semibold mb-2">Available Suppliers</h4>
        <div className="flex flex-wrap gap-2">
          {suppliers.filter(s => s.is_active !== false).map(s => (
            <span key={s.id} className="bg-slate-100 px-3 py-1 rounded-lg text-xs">{s.name} <span className="text-slate-400">({s.connection_type})</span></span>
          ))}
          {suppliers.length === 0 && <span className="text-slate-400 text-xs">No suppliers configured. Add suppliers first.</span>}
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-4">{editing ? "Edit" : "Add"} Trunk</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Trunk Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div>
              <label className="block text-sm font-medium mb-1">Supplier *</label>
              <select value={form.supplierId} onChange={e => setForm({...form, supplierId: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select Supplier...</option>
                {suppliers.filter(s => s.is_active !== false).map(s => <option key={s.id} value={s.id}>{s.name} ({s.connection_type})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">API Connector (optional)</label>
              <select value={form.connectorId} onChange={e => setForm({...form, connectorId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">None</option>
                {connectors.filter(c => c.is_active !== false).map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium mb-1">Capacity (TPS)</label><input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div className="col-span-2 flex gap-2"><button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">{editing ? "Update" : "Create"}</button><button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button></div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left px-5 py-3">Trunk</th><th className="text-left px-5 py-3">Supplier</th><th className="text-left px-5 py-3">Connector</th><th className="text-left px-5 py-3">Capacity</th><th className="text-left px-5 py-3">Status</th><th className="text-left px-5 py-3">Actions</th></tr></thead>
          <tbody>
            {trunks.map(t => (
              <tr key={t.id} className="border-b hover:bg-slate-50">
                <td className="px-5 py-3 font-medium">{t.name}</td>
                <td className="px-5 py-3">{t.supplier_name} <span className="text-xs text-slate-400">{t.connection_type}</span></td>
                <td className="px-5 py-3 text-xs">{t.connector_id ? connectors.find(c => c.id === t.connector_id)?.name || `#${t.connector_id}` : "—"}</td>
                <td className="px-5 py-3">{t.capacity} TPS</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${t.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{t.is_active ? "Active" : "Inactive"}</span></td>
                <td className="px-5 py-3"><button onClick={() => { setEditing(t); setForm({ name: t.name, supplierId: t.supplier_id.toString(), connectorId: (t.connector_id||"").toString(), capacity: t.capacity.toString() }); setShowForm(true); }} className="text-blue-600 hover:underline text-xs mr-2">Edit</button><button onClick={() => handleDelete(t.id)} className="text-red-600 hover:underline text-xs">Delete</button></td>
              </tr>
            ))}
            {trunks.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No trunks configured.</td></tr>}
          </tbody>
        </table>
      </div>
      {confirmModal}
    </div>
  );
}
