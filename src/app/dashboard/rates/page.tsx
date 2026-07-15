"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useMccMncLookups } from "@/hooks/useMccMncLookups";
import type { MccMncEntry } from "@/hooks/useMccMncLookups";

interface Rate { id: number; client_id?: number; supplier_id?: number; country_code: string; mcc: string; mnc: string; operator_name: string; rate: string; cost?: string; is_active?: boolean; updated_at?: string; }
interface Client { id: number; name: string; }
interface Supplier { id: number; name: string; }

export default function BulkRatesPage() {
  const [tab, setTab] = useState<"client" | "supplier">("client");
  const [destinations, setDestinations] = useState<MccMncEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [clientRates, setClientRates] = useState<Rate[]>([]);
  const [supplierRates, setSupplierRates] = useState<Rate[]>([]);
  const [selectedDest, setSelectedDest] = useState(""); // now countryName
  const [selectedEntity, setSelectedEntity] = useState("");
  const [operators, setOperators] = useState<MccMncEntry[]>([]);
  const [rateValue, setRateValue] = useState("");
  const [msg, setMsg] = useState("");
  const [downloadPct, setDownloadPct] = useState("10");
  const [selectAllOps, setSelectAllOps] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRate, setEditRate] = useState("");
  const [flashFailId, setFlashFailId] = useState<number | null>(null);
  const [bulkMsg, setBulkMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const load = useCallback(async () => {
    const [mr, cr, sr, clr, spr] = await Promise.all([
      fetch("/api/mcc-mnc").then(r => r.json()),
      fetch("/api/tenant/clients").then(r => r.json()),
      fetch("/api/tenant/suppliers").then(r => r.json()),
      fetch("/api/tenant/client-rates").then(r => r.json()).catch(() => ({ rates: [] })),
      fetch("/api/tenant/supplier-rates").then(r => r.json()).catch(() => ({ rates: [] })),
    ]);
    const mccData = mr.data || [];
    setDestinations(mccData);
    setClients(cr.clients || []);
    setSuppliers(sr.suppliers || []);
    // Enrich rates with operator name — prefer DB-stored value, fall back to MCC/MNC lookup
    setClientRates((clr.rates || []).map((r: Rate) => {
      const match = mccData.find((d: MccMncEntry) => d.mcc === r.mcc);
      return { ...r, operator_name: r.operator_name || match?.networkName || "" };
    }));
    setSupplierRates((spr.rates || []).map((r: Rate) => {
      const match = mccData.find((d: MccMncEntry) => d.mcc === r.mcc);
      return { ...r, operator_name: r.operator_name || match?.networkName || "" };
    }));
  }, []);

  useEffect(() => { load(); }, [load]);

  const { countryNameMap, networkNameMap } = useMccMncLookups(destinations);

  // Build country list grouped by unique country name (not country code)
  const countryList = useMemo(() => {
    const seen = new Set<string>();
    return destinations
      .filter(d => { const key = d.countryName; if (seen.has(key)) return false; seen.add(key); return true; })
      .sort((a, b) => a.countryName.localeCompare(b.countryName));
  }, [destinations]);

  const handleDestSelect = (countryName: string) => {
    setSelectedDest(countryName);
    const ops = destinations.filter(d => d.countryName === countryName);
    setOperators(ops);
  };

  const addRate = async () => {
    if (!selectedEntity || !selectedDest) return alert("Select entity and destination");
    const endpoint = tab === "client" ? "/api/tenant/client-rates" : "/api/tenant/supplier-rates";
    const entityKey = tab === "client" ? "clientId" : "supplierId";
    const valueField = tab === "client" ? "rate" : "cost";

    // If operators selected, add rate for each
    const selectedOps = selectAllOps
      ? operators
      : operators.filter(o => (document.getElementById(`op_${o.id}`) as HTMLInputElement)?.checked);

    if (selectedOps.length === 0) return alert("Select at least one operator");

    for (const op of selectedOps) {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [entityKey]: parseInt(selectedEntity),
          countryCode: op.countryCode,
          mcc: op.mcc,
          mnc: op.mnc,
          [valueField]: rateValue,
          operator_name: op.networkName,
        }),
      });
    }
    setMsg(`${selectedOps.length} rate(s) added for ${selectedDest}`);
    setTimeout(() => setMsg(""), 3000);
    load();
  };

  const bulkImportAll = async () => {
    if (!selectedEntity || !selectedDest || operators.length === 0) return;
    if (!rateValue) return alert("Enter a rate before bulk importing");
    const endpoint = tab === "client" ? "/api/tenant/client-rates" : "/api/tenant/supplier-rates";
    const entityKey = tab === "client" ? "clientId" : "supplierId";
    const valueField = tab === "client" ? "rate" : "cost";

    setMsg(`Importing ${operators.length} operators for ${selectedDest}...`);
    for (const op of operators) {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [entityKey]: parseInt(selectedEntity),
          countryCode: op.countryCode,
          mcc: op.mcc,
          mnc: op.mnc,
          [valueField]: rateValue,
          operator_name: op.networkName,
        }),
      });
    }
    setMsg(`✅ Imported all ${operators.length} operators for ${selectedDest}`);
    setTimeout(() => setMsg(""), 4000);
    load();
  };

  const currentRates = tab === "client" ? clientRates : supplierRates;
  const filteredRates = statusFilter === "all" ? currentRates : currentRates.filter(r => statusFilter === "active" ? r.is_active !== false : r.is_active === false);
  const allActive = filteredRates.length > 0 && filteredRates.every(r => r.is_active !== false);

  const bulkToggleActive = async () => {
    const activate = !allActive;
    const prev = [...filteredRates];
    const updateFn = (prevList: Rate[]) => prevList.map(r => {
      const inFilter = prev.some(fr => fr.id === r.id);
      return inFilter ? { ...r, is_active: activate } : r;
    });
    if (tab === "client") setClientRates(updateFn);
    else setSupplierRates(updateFn);

    setBulkMsg(activate ? "Activating all..." : "Deactivating all...");
    try {
      const endpoint = tab === "client" ? "/api/tenant/client-rates" : "/api/tenant/supplier-rates";
      const results = await Promise.all(
        prev.map(r =>
          fetch(`${endpoint}/${r.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: activate }),
          }).then(res => res.ok)
        )
      );
      if (results.some(ok => !ok)) throw new Error("Some toggles failed");
      setBulkMsg(activate ? `✅ Activated all ${prev.length} rates` : `☐ Deactivated all ${prev.length} rates`);
    } catch {
      if (tab === "client") setClientRates(clientRates);
      else setSupplierRates(supplierRates);
      setBulkMsg("❌ Bulk toggle failed — reverted");
    }
    setTimeout(() => setBulkMsg(""), 2500);
  };

  const toggleActive = async (rateId: number, currentActive: boolean) => {
    const revertFn = (prev: Rate[]) => prev.map(r => r.id === rateId ? { ...r, is_active: !currentActive } : r);
    const undoFn = (prev: Rate[]) => prev.map(r => r.id === rateId ? { ...r, is_active: currentActive } : r);
    if (tab === "client") setClientRates(revertFn);
    else setSupplierRates(revertFn);
    try {
      const endpoint = tab === "client"
        ? `/api/tenant/client-rates/${rateId}`
        : `/api/tenant/supplier-rates/${rateId}`;
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (!res.ok) throw new Error("Toggle failed");
    } catch {
      if (tab === "client") setClientRates(undoFn);
      else setSupplierRates(undoFn);
      setFlashFailId(rateId);
      setTimeout(() => setFlashFailId(null), 700);
    }
  };

  const handleDelete = async (rateId: number) => {
    if (!confirm("Delete this rate?")) return;
    const endpoint = tab === "client"
      ? `/api/tenant/client-rates/${rateId}`
      : `/api/tenant/supplier-rates/${rateId}`;
    await fetch(endpoint, { method: "DELETE" });
    setMsg("Rate deleted");
    setTimeout(() => setMsg(""), 2000);
    load();
  };

  // Reset editing state when switching tabs
  useEffect(() => {
    setEditingId(null);
    setEditRate("");
    setFlashFailId(null);
    setStatusFilter("all");
  }, [tab]);

  const startEdit = (rateId: number, currentRate: string) => {
    setEditingId(rateId);
    setEditRate(currentRate);
  };

  const saveEdit = async (rateId: number) => {
    const endpoint = tab === "client"
      ? `/api/tenant/client-rates/${rateId}`
      : `/api/tenant/supplier-rates/${rateId}`;
    const body = tab === "client" ? { rate: editRate } : { cost: editRate };
    await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditingId(null);
    setEditRate("");
    setMsg("Rate updated");
    setTimeout(() => setMsg(""), 2000);
    load();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRate("");
  };

  const generatePdfRates = () => {
    const rates = tab === "client" ? clientRates : supplierRates;
    const pct = parseFloat(downloadPct) / 100;
    const adjusted = rates.map(r => {
      const base = parseFloat(r.rate).toFixed(6);
      const markedUp = (parseFloat(r.rate) * (1 + pct)).toFixed(6);
      return { ...r, rate: markedUp, baseRate: base };
    });

    const csv = "Country,Operator,MCC,MNC,Base Rate,Marked Up (" + downloadPct + "%)\n" + adjusted.map(r => `${r.country_code},${r.operator_name},${r.mcc},${r.mnc || ""},$${r.baseRate},$${r.rate}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${tab}_rates_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Bulk Rate Management</h2>
        <p className="text-sm text-slate-500">Set rates per destination with operator selection • Download CSV with % markup</p>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}

      {/* Tab */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button onClick={() => setTab("client")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium ${tab === "client" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>👥 Client Rates</button>
        <button onClick={() => setTab("supplier")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium ${tab === "supplier" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>🏭 Supplier Rates</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rate Form */}
        <div className="lg:col-span-1 bg-white rounded-xl border p-5 shadow-sm space-y-4">
          <h4 className="font-semibold">Add Rate</h4>
          <div>
            <label className="block text-sm font-medium mb-1">{tab === "client" ? "Client" : "Supplier"} *</label>
            <select value={selectedEntity} onChange={e => setSelectedEntity(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select...</option>
              {(tab === "client" ? clients : suppliers).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Destination Country *</label>
            <select value={selectedDest} onChange={e => handleDestSelect(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Select Country...</option>
              {countryList.map(c => (
                <option key={c.countryName} value={c.countryName}>
                  {c.countryName} ({c.countryCode})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">{countryList.length} countries available from MCC/MNC database</p>
          </div>
          {operators.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Operators ({operators.length})</label>
                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                  <input type="checkbox" checked={selectAllOps} onChange={e => setSelectAllOps(e.target.checked)} className="accent-blue-600" />
                  Select All
                </label>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                {operators.map(op => (
                  <label key={op.id} className={`flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 text-sm ${selectAllOps ? "opacity-70" : ""}`}>
                    <input type="checkbox" id={`op_${op.id}`} defaultChecked disabled={selectAllOps} className="accent-blue-600" />
                    <span>{op.networkName} <span className="text-xs text-slate-400">MCC:{op.mcc}/{op.mnc || "—"}</span></span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Rate ($/SMS)</label>
            <input type="number" step="0.000001" value={rateValue} onChange={e => setRateValue(e.target.value)} placeholder="0.00025" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
          <button onClick={addRate} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Add Rate(s)</button>
          {operators.length > 0 && (
            <button onClick={bulkImportAll} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:from-purple-700 hover:to-indigo-700 transition">
              ⚡ Bulk Import All {operators.length} Operators
            </button>
          )}
        </div>

        {/* Rate List */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm">
          {bulkMsg && <div className={`px-5 py-2 text-xs font-medium text-center ${bulkMsg.startsWith("❌") ? "bg-red-50 text-red-600" : bulkMsg.startsWith("✅") || bulkMsg.startsWith("☐") ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-600"}`}>{bulkMsg}</div>}
          <div className="px-5 py-4 border-b flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h4 className="font-semibold">{tab === "client" ? "Client" : "Supplier"} Rates ({filteredRates.length}{statusFilter !== "all" ? ` / ${currentRates.length}` : ""})</h4>
              <div className="flex items-center gap-1 ml-1">
                {(["all","active","inactive"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                      statusFilter === f
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {f === "all" ? "All" : f === "active" ? "Active" : "Inactive"}
                  </button>
                ))}
              </div>
              {filteredRates.length > 0 && (
                <button
                  onClick={bulkToggleActive}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition border ${
                    allActive
                      ? "bg-green-50 border-green-200 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700"
                      : "bg-red-50 border-red-200 text-red-700 hover:bg-green-50 hover:border-green-200 hover:text-green-700"
                  }`}
                  title={allActive ? "Deactivate all visible rates" : "Activate all visible rates"}
                >
                  {allActive ? "☑ Activate All" : "☐ Deactivate All"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" step="1" value={downloadPct} onChange={e => setDownloadPct(e.target.value)} className="w-16 border rounded px-2 py-1 text-sm text-center" />
              <span className="text-xs text-slate-500">% markup</span>
              <button onClick={generatePdfRates} className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-green-700">📥 Download CSV</button>
            </div>
          </div>
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0"><tr><th className="text-left px-4 py-3">Country</th><th className="text-left px-4 py-3">Operator</th><th className="text-left px-4 py-3">MCC</th><th className="text-left px-4 py-3">MNC</th><th className="text-left px-4 py-3">Rate</th><th className="text-left px-4 py-3">Marked Up ({downloadPct}%)</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3 w-28">Actions</th></tr></thead>
              <tbody>
                {filteredRates.map((r, i) => {
                  const rateVal = tab === "client" ? r.rate : (r.cost || r.rate);
                  const adjusted = (parseFloat(rateVal || "0") * (1 + parseFloat(downloadPct) / 100)).toFixed(6);
                  const isEditing = editingId === r.id;
                  return (
                    <tr key={i} className={`border-b hover:bg-slate-50 ${isEditing ? "bg-blue-50" : ""}`}>
                      <td className="px-4 py-2 font-medium">{countryNameMap.get(r.country_code) || r.country_code}</td>
                      <td className="px-4 py-2 text-xs">{r.operator_name}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.mcc}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.mnc || "—"}</td>
                      <td className="px-4 py-2 font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.000001"
                            value={editRate}
                            onChange={e => setEditRate(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && saveEdit(r.id)}
                            className="w-24 border border-blue-300 rounded px-2 py-0.5 text-xs font-mono"
                            autoFocus
                          />
                        ) : (
                          <>${parseFloat(rateVal || "0").toFixed(6)}</>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-green-600 font-medium">${adjusted}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => toggleActive(r.id, r.is_active || false)}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition hover:ring-2 hover:ring-offset-1 ${
                            flashFailId === r.id
                              ? "bg-red-500 text-white animate-pulse"
                              : (r.is_active !== false) ? "bg-green-100 text-green-700 hover:ring-green-300" : "bg-red-100 text-red-700 hover:ring-red-300"
                          }`}
                          title={`Click to ${r.is_active !== false ? "deactivate" : "activate"}`}
                        >
                          {flashFailId === r.id ? "Failed!" : r.is_active !== false ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(r.id)} className="text-green-600 hover:underline text-xs font-medium">✓ Save</button>
                            <button onClick={cancelEdit} className="text-slate-400 hover:underline text-xs">✕</button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => startEdit(r.id, rateVal || "0")} className="text-blue-600 hover:underline text-xs">Edit</button>
                            <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredRates.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{currentRates.length === 0 ? "No rates set. Use the form on the left to add rates per country &amp; operator from the MCC/MNC database." : `No ${statusFilter} rates match the current filter.`}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
