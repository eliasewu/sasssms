"use client";

import { useState, useEffect, useCallback } from "react";

interface SupplierRate {
  id: number;
  supplier_id: number;
  country_code: string;
  mcc: string;
  mnc: string;
  cost: string;
  is_active: boolean;
}

interface Supplier { id: number; name: string; }

export default function SupplierRatesPage() {
  const [rates, setRates] = useState<SupplierRate[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ supplierId: "", countryCode: "", mcc: "", mnc: "", cost: "0" });

  const load = useCallback(async () => {
    const [rr, sr] = await Promise.all([
      fetch("/api/tenant/supplier-rates").then((r) => r.json()),
      fetch("/api/tenant/suppliers").then((r) => r.json()),
    ]);
    setRates(rr.rates || []);
    setSuppliers(sr.suppliers || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/tenant/supplier-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Supplier Rates</h2>
          <p className="text-sm text-slate-500">Cost rates from suppliers per country/MCC</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Rate</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="grid grid-cols-5 gap-4">
            <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required className="border rounded-lg px-3 py-2 text-sm">
              <option value="">Supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} required placeholder="+91" className="border rounded-lg px-3 py-2 text-sm" />
            <input value={form.mcc} onChange={(e) => setForm({ ...form, mcc: e.target.value })} placeholder="MCC" className="border rounded-lg px-3 py-2 text-sm" />
            <input type="number" step="0.000001" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2">
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
              <th className="text-left px-5 py-3">Supplier</th>
              <th className="text-left px-5 py-3">Country</th>
              <th className="text-left px-5 py-3">MCC</th>
              <th className="text-left px-5 py-3">Cost</th>
              <th className="text-left px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-5 py-3">{suppliers.find((s) => s.id === r.supplier_id)?.name}</td>
                <td className="px-5 py-3">{r.country_code}</td>
                <td className="px-5 py-3 font-mono">{r.mcc || "—"}</td>
                <td className="px-5 py-3 font-mono">${r.cost}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${r.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.is_active ? "Active" : "Inactive"}</span></td>
              </tr>
            ))}
            {rates.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No supplier rates.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
