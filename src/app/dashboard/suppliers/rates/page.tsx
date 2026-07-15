"use client";

import { useState, useEffect, useCallback } from "react";
import { useMccMncLookups } from "@/hooks/useMccMncLookups";
import type { MccMncEntry } from "@/hooks/useMccMncLookups";

interface SupplierRate {
  id: number;
  supplier_id: number;
  country_code: string;
  mcc: string;
  mnc: string;
  operator_name: string;
  cost: string;
  is_active: boolean;
}

interface Supplier { id: number; name: string; }

export default function SupplierRatesPage() {
  const [rates, setRates] = useState<SupplierRate[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [mccMncList, setMccMncList] = useState<MccMncEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ supplierId: "", countryCode: "", mcc: "", mnc: "", operatorName: "", cost: "0.00025" });
  const [selectedCountry, setSelectedCountry] = useState("");
  const [filteredOperators, setFilteredOperators] = useState<MccMncEntry[]>([]);

  const load = useCallback(async () => {
    const [rr, sr, mr] = await Promise.all([
      fetch("/api/tenant/supplier-rates").then((r) => r.json()),
      fetch("/api/tenant/suppliers").then((r) => r.json()),
      fetch("/api/mcc-mnc").then((r) => r.json()),
    ]);
    setRates(rr.rates || []);
    setSuppliers(sr.suppliers || []);
    setMccMncList(mr.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const { countryNameMap, networkNameMap, countries } = useMccMncLookups(mccMncList);

  const handleCountryChange = (countryName: string) => {
    setSelectedCountry(countryName);
    const ops = mccMncList.filter(d => d.countryName === countryName);
    setFilteredOperators(ops);
    if (ops.length > 0) {
      setForm({ ...form, countryCode: ops[0].countryCode, mcc: "", mnc: "", operatorName: "" });
    }
  };

  const handleOperatorSelect = (mcc: string, mnc: string, operatorName: string) => {
    setForm({ ...form, mcc, mnc, operatorName });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await fetch(`/api/tenant/supplier-rates/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/tenant/supplier-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setShowForm(false);
    setEditingId(null);
    setSelectedCountry("");
    setFilteredOperators([]);
    setForm({ supplierId: "", countryCode: "", mcc: "", mnc: "", operatorName: "", cost: "0.00025" });
    load();
  };

  const bulkImportAll = async () => {
    if (!form.supplierId || !selectedCountry || filteredOperators.length === 0) return;
    if (!form.cost) return alert("Enter a cost before bulk importing");
    let count = 0;
    for (const op of filteredOperators) {
      await fetch("/api/tenant/supplier-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: parseInt(form.supplierId),
          countryCode: op.countryCode,
          mcc: op.mcc,
          mnc: op.mnc,
          operatorName: op.networkName,
          cost: form.cost,
        }),
      });
      count++;
    }
    setShowForm(false);
    setEditingId(null);
    setSelectedCountry("");
    setFilteredOperators([]);
    setForm({ supplierId: "", countryCode: "", mcc: "", mnc: "", operatorName: "", cost: "0.00025" });
    alert(`✅ Imported ${count} operators for ${selectedCountry}`);
    load();
  };

  const handleEdit = (r: SupplierRate) => {
    setEditingId(r.id);
    setForm({
      supplierId: r.supplier_id.toString(),
      countryCode: r.country_code,
      mcc: r.mcc,
      mnc: r.mnc || "",
      operatorName: r.operator_name || "",
      cost: r.cost,
    });
    const countryName = mccMncList.find(d => d.countryCode === r.country_code)?.countryName || "";
    setSelectedCountry(countryName);
    if (countryName) {
      setFilteredOperators(mccMncList.filter(d => d.countryName === countryName));
    }
    setShowForm(true);
  };

  const handleDelete = async (rateId: number) => {
    if (!confirm("Delete this supplier rate?")) return;
    await fetch(`/api/tenant/supplier-rates/${rateId}`, { method: "DELETE" });
    load();
  };

  const [flashFailId, setFlashFailId] = useState<number | null>(null);
  const [bulkMsg, setBulkMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const filteredRates = statusFilter === "all" ? rates : rates.filter(r => statusFilter === "active" ? r.is_active : !r.is_active);
  const allActive = filteredRates.length > 0 && filteredRates.every(r => r.is_active);

  const bulkToggleActive = async () => {
    const activate = !allActive;
    const prev = [...filteredRates];
    setRates(prev2 => prev2.map(r => {
      const inFilter = prev.some(fr => fr.id === r.id);
      return inFilter ? { ...r, is_active: activate } : r;
    }));
    setBulkMsg(activate ? "Activating all..." : "Deactivating all...");
    try {
      const results = await Promise.all(
        prev.map(r =>
          fetch(`/api/tenant/supplier-rates/${r.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: activate }),
          }).then(res => res.ok)
        )
      );
      if (results.some(ok => !ok)) throw new Error("Some toggles failed");
      setBulkMsg(activate ? `✅ Activated all ${prev.length} rates` : `☐ Deactivated all ${prev.length} rates`);
    } catch {
      setRates(rates);
      setBulkMsg("❌ Bulk toggle failed — reverted");
    }
    setTimeout(() => setBulkMsg(""), 2500);
  };

  const toggleActive = async (rateId: number, currentActive: boolean) => {
    setRates(prev => prev.map(r => r.id === rateId ? { ...r, is_active: !currentActive } : r));
    try {
      const res = await fetch(`/api/tenant/supplier-rates/${rateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (!res.ok) throw new Error("Toggle failed");
    } catch {
      setRates(prev => prev.map(r => r.id === rateId ? { ...r, is_active: currentActive } : r));
      setFlashFailId(rateId);
      setTimeout(() => setFlashFailId(null), 700);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Supplier Rates</h2>
          <p className="text-sm text-slate-500">Cost rates from suppliers per country/MCC using the MCC/MNC database</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Rate</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Supplier *</label>
                <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Country *</label>
                <select value={selectedCountry} onChange={(e) => handleCountryChange(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select country...</option>
                  {countries.map(cn => {
                    const cc = mccMncList.find(d => d.countryName === cn)?.countryCode || "";
                    return <option key={cn} value={cn}>{cn} ({cc})</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cost ($/SMS) *</label>
                <input type="number" step="0.000001" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} required className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            {filteredOperators.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">Select Operator (MCC/MNC)</label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {filteredOperators.map(op => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => handleOperatorSelect(op.mcc, op.mnc || "", op.networkName || "")}
                      className={`text-left p-2 rounded-lg border text-xs transition ${
                        form.mcc === op.mcc && form.mnc === (op.mnc || "")
                          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="font-medium text-slate-700">{op.networkName || op.mcc}</div>
                      <div className="text-slate-400 font-mono">MCC:{op.mcc} {op.mnc ? `/ ${op.mnc}` : ""}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium">
                {editingId ? "Update Rate" : "Save Rate"}
              </button>
              {!editingId && filteredOperators.length > 0 && (
                <button type="button" onClick={bulkImportAll} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:from-purple-700 hover:to-indigo-700 transition">
                  ⚡ Bulk Import All {filteredOperators.length} Operators
                </button>
              )}
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setSelectedCountry(""); setFilteredOperators([]); }} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 font-medium">Show:</span>
        {(["all","active","inactive"] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              statusFilter === f
                ? "bg-blue-600 text-white shadow"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f === "all" ? `All (${rates.length})` : f === "active" ? `Active (${rates.filter(r => r.is_active).length})` : `Inactive (${rates.filter(r => !r.is_active).length})`}
          </button>
        ))}
      </div>

      {bulkMsg && <div className={`px-5 py-2 text-xs font-medium text-center ${bulkMsg.startsWith("❌") ? "bg-red-50 text-red-600" : bulkMsg.startsWith("✅") || bulkMsg.startsWith("☐") ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-600"}`}>{bulkMsg}</div>}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-5 py-3">Supplier</th>
              <th className="text-left px-5 py-3">Country</th>
              <th className="text-left px-5 py-3">Operator</th>
              <th className="text-left px-5 py-3">MCC</th>
              <th className="text-left px-5 py-3">MNC</th>
              <th className="text-left px-5 py-3">Cost</th>
              <th className="text-left px-5 py-3">
                Status
                {filteredRates.length > 0 && (
                  <button
                    onClick={bulkToggleActive}
                    className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold transition border ${
                      allActive
                        ? "bg-green-50 border-green-200 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700"
                        : "bg-red-50 border-red-200 text-red-700 hover:bg-green-50 hover:border-green-200 hover:text-green-700"
                    }`}
                    title={allActive ? "Deactivate all visible rates" : "Activate all visible rates"}
                  >
                    {allActive ? "☑ All" : "☐ All"}
                  </button>
                )}
              </th>
              <th className="text-left px-5 py-3 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRates.map((r) => (
              <tr key={r.id} className="border-b hover:bg-slate-50">
                <td className="px-5 py-3 font-medium">{suppliers.find((s) => s.id === r.supplier_id)?.name || r.supplier_id}</td>
                <td className="px-5 py-3">
                  <span className="font-medium">{countryNameMap.get(r.country_code) || r.country_code}</span>
                  <span className="text-xs text-slate-400 ml-1">({r.country_code})</span>
                </td>
                <td className="px-5 py-3">
                  <span className="font-medium">{r.operator_name || networkNameMap.get(r.mcc) || "—"}</span>
                </td>
                <td className="px-5 py-3 font-mono text-xs">{r.mcc}</td>
                <td className="px-5 py-3 font-mono text-xs">{r.mnc || "—"}</td>
                <td className="px-5 py-3 font-mono font-medium">${parseFloat(r.cost).toFixed(6)}</td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => toggleActive(r.id, r.is_active)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition hover:ring-2 hover:ring-offset-1 ${
                      flashFailId === r.id
                        ? "bg-red-500 text-white animate-pulse"
                        : r.is_active ? "bg-green-100 text-green-700 hover:ring-green-300" : "bg-red-100 text-red-700 hover:ring-red-300"
                    }`}
                    title={`Click to ${r.is_active ? "deactivate" : "activate"}`}
                  >
                    {flashFailId === r.id ? "Failed!" : r.is_active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(r)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredRates.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">{rates.length === 0 ? "No supplier rates. Use the form to add cost rates per country & operator from the MCC/MNC database." : `No ${statusFilter} rates match the current filter.`}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
