"use client";

import { useState, useEffect, useCallback } from "react";

interface Rate { id: number; client_id?: number; supplier_id?: number; country_code: string; mcc: string; operator_name: string; rate: string; cost?: string; updated_at?: string; }
interface MccMnc { id: number; mcc: string; mnc: string; countryCode: string; countryName: string; networkName: string; }
interface Client { id: number; name: string; }
interface Supplier { id: number; name: string; }

export default function BulkRatesPage() {
  const [tab, setTab] = useState<"client" | "supplier">("client");
  const [destinations, setDestinations] = useState<MccMnc[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [clientRates, setClientRates] = useState<Rate[]>([]);
  const [supplierRates, setSupplierRates] = useState<Rate[]>([]);
  const [selectedDest, setSelectedDest] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [operators, setOperators] = useState<MccMnc[]>([]);
  const [rateValue, setRateValue] = useState("");
  const [msg, setMsg] = useState("");
  const [downloadPct, setDownloadPct] = useState("10");
  const [rateHistory, setRateHistory] = useState<Rate[]>([]);

  const load = useCallback(async () => {
    const [mr, cr, sr, clr, spr] = await Promise.all([
      fetch("/api/mcc-mnc").then(r => r.json()),
      fetch("/api/tenant/clients").then(r => r.json()),
      fetch("/api/tenant/suppliers").then(r => r.json()),
      fetch("/api/tenant/client-rates").then(r => r.json()).catch(() => ({ rates: [] })),
      fetch("/api/tenant/supplier-rates").then(r => r.json()).catch(() => ({ rates: [] })),
    ]);
    setDestinations(mr.data || []);
    setClients(cr.clients || []);
    setSuppliers(sr.suppliers || []);
    setClientRates((clr.rates || []).map((r: Rate) => ({...r, operator_name: (mr.data || []).find((d: MccMnc) => d.mcc === r.mcc)?.networkName || r.country_code})));
    setSupplierRates((spr.rates || []).map((r: Rate) => ({...r, operator_name: (mr.data || []).find((d: MccMnc) => d.mcc === r.mcc)?.networkName || r.country_code})));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDestSelect = (countryCode: string) => {
    setSelectedDest(countryCode);
    const ops = destinations.filter(d => d.countryCode === countryCode);
    setOperators(ops);
  };

  const addRate = async () => {
    if (!selectedEntity || !selectedDest) return alert("Select entity and destination");
    const endpoint = tab === "client" ? "/api/tenant/client-rates" : "/api/tenant/supplier-rates";
    const entityKey = tab === "client" ? "clientId" : "supplierId";
    
    // If operators selected, add rate for each
    const selectedOps = operators.filter(o => (document.getElementById(`op_${o.id}`) as HTMLInputElement)?.checked);
    if (selectedOps.length === 0) selectedOps.push(...operators);
    
    for (const op of selectedOps) {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [entityKey]: parseInt(selectedEntity),
          countryCode: selectedDest,
          mcc: op.mcc,
          mnc: op.mnc,
          rate: rateValue,
          operator_name: op.networkName,
        }),
      });
    }
    setMsg(`${selectedOps.length} rate(s) added for ${selectedDest}`);
    setTimeout(() => setMsg(""), 3000);
    load();
  };

  const generatePdfRates = () => {
    const rates = tab === "client" ? clientRates : supplierRates;
    const pct = parseFloat(downloadPct) / 100;
    const adjusted = rates.map(r => ({...r, rate: (parseFloat(r.rate) * (1 + pct)).toFixed(6)}));
    
    const csv = "Country,Operator,MCC,Rate\n" + adjusted.map(r => `${r.country_code},${r.operator_name},${r.mcc},$${r.rate}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${tab}_rates_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueCountries = [...new Set(destinations.map(d => d.countryCode))].sort();

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
              {uniqueCountries.map(cc => <option key={cc} value={cc}>{cc} ({destinations.find(d => d.countryCode === cc)?.countryName})</option>)}
            </select>
          </div>
          {operators.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Select Operators</label>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                {operators.map(op => (
                  <label key={op.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 text-sm">
                    <input type="checkbox" id={`op_${op.id}`} defaultChecked className="accent-blue-600" />
                    <span>{op.networkName} <span className="text-xs text-slate-400">MCC:{op.mcc}/{op.mnc}</span></span>
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
        </div>

        {/* Rate List */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm">
          <div className="px-5 py-4 border-b flex justify-between items-center">
            <h4 className="font-semibold">{tab === "client" ? "Client" : "Supplier"} Rates ({tab === "client" ? clientRates.length : supplierRates.length})</h4>
            <div className="flex items-center gap-2">
              <input type="number" step="1" value={downloadPct} onChange={e => setDownloadPct(e.target.value)} className="w-16 border rounded px-2 py-1 text-sm text-center" />
              <span className="text-xs text-slate-500">% markup</span>
              <button onClick={generatePdfRates} className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-green-700">📥 Download CSV</button>
            </div>
          </div>
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0"><tr><th className="text-left px-4 py-3">Country</th><th className="text-left px-4 py-3">Operator</th><th className="text-left px-4 py-3">MCC</th><th className="text-left px-4 py-3">Rate</th><th className="text-left px-4 py-3">Marked Up ({downloadPct}%)</th></tr></thead>
              <tbody>
                {(tab === "client" ? clientRates : supplierRates).map((r, i) => {
                  const adjusted = (parseFloat(r.rate) * (1 + parseFloat(downloadPct)/100)).toFixed(6);
                  return (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-2">{r.country_code}</td>
                      <td className="px-4 py-2 text-xs">{r.operator_name}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.mcc}</td>
                      <td className="px-4 py-2 font-mono">${parseFloat(r.rate).toFixed(6)}</td>
                      <td className="px-4 py-2 font-mono text-green-600 font-medium">${adjusted}</td>
                    </tr>
                  );
                })}
                {(tab === "client" ? clientRates : supplierRates).length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No rates set.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
