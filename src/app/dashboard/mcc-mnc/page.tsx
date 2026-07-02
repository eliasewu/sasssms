"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface MccMnc {
  id: number;
  mcc: string;
  mnc: string;
  countryCode: string;
  countryName: string;
  networkName: string;
  language: string;
}

interface Client {
  id: number;
  name: string;
}
interface Supplier {
  id: number;
  name: string;
}

export default function MccMncPage() {
  const [data, setData] = useState<MccMnc[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState("");

  // Modals
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Add form
  const [form, setForm] = useState({ mcc: "", mnc: "", countryCode: "", countryName: "", networkName: "", language: "English" });

  // Import form
  const [importTarget, setImportTarget] = useState<"client_rates" | "supplier_rates">("client_rates");
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [importEntityId, setImportEntityId] = useState("");
  const [importRate, setImportRate] = useState("0.00025");
  const [importing, setImporting] = useState(false);

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const flash = (text: string, err = false) => {
    if (err) { setMsgError(text); setTimeout(() => setMsgError(""), 4000); }
    else { setMsg(text); setTimeout(() => setMsg(""), 4000); }
  };

  const load = useCallback(async (searchTerm = "") => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      params.set("limit", "1000");
      const r = await fetch(`/api/tenant/mcc-mnc?${params}`);
      if (!r.ok) throw new Error("Failed to load");
      const j = await r.json();
      setData(j.data || []);
      setTotal(j.total || 0);
      setError("");
    } catch {
      setError("Failed to load MCC/MNC database.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClientsSuppliers = useCallback(async () => {
    const [cr, sr] = await Promise.all([
      fetch("/api/tenant/clients").then(r => r.json()).catch(() => ({ clients: [] })),
      fetch("/api/tenant/suppliers").then(r => r.json()).catch(() => ({ suppliers: [] })),
    ]);
    setClients(cr.clients || []);
    setSuppliers(sr.suppliers || []);
  }, []);

  useEffect(() => { load(); loadClientsSuppliers(); }, [load, loadClientsSuppliers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search) load(search);
      else load();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filtered = data;

  const countries = [...new Set(filtered.map(d => d.countryName))].sort();
  const languages = [...new Set(filtered.map(d => d.language))].sort();

  // ── Add Single Entry ──
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.mcc || !form.countryName) {
      flash("MCC and Country Name are required", true);
      return;
    }
    try {
      const r = await fetch("/api/tenant/mcc-mnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (j.error) { flash(j.error, true); return; }
      flash(j.message || "Entry added");
      setShowAddForm(false);
      setForm({ mcc: "", mnc: "", countryCode: "", countryName: "", networkName: "", language: "English" });
      load(search);
    } catch {
      flash("Failed to add entry", true);
    }
  };

  // ── Import All to Rates ──
  const handleImport = async () => {
    if (!importEntityId || !importRate) {
      flash("Select entity and enter default rate", true);
      return;
    }
    setImporting(true);
    try {
      const r = await fetch("/api/tenant/mcc-mnc/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetTable: importTarget,
          entityId: parseInt(importEntityId),
          defaultRate: importRate,
        }),
      });
      const j = await r.json();
      if (j.error) { flash(j.error, true); return; }
      flash(j.message);
      setShowImportModal(false);
    } catch {
      flash("Import failed", true);
    } finally {
      setImporting(false);
    }
  };

  // ── Upload CSV ──
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await fetch("/api/tenant/mcc-mnc/upload", {
        method: "POST",
        body: formData,
      });
      const j = await r.json();
      if (j.error) { flash(j.error, true); return; }
      flash(j.message);
      setShowUploadModal(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      load(search);
    } catch {
      flash("Upload failed", true);
    } finally {
      setUploading(false);
    }
  };

  // ── Download CSV ──
  const handleDownload = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("format", "csv");
      const r = await fetch(`/api/tenant/mcc-mnc/download?${params}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mcc_mnc_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      flash("Download failed", true);
    }
  };

  if (loading && data.length === 0) {
    return <div className="p-8 text-center text-slate-400">Loading MCC/MNC database...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">MCC/MNC Database</h2>
          <p className="text-sm text-slate-500">{total.toLocaleString()} entries across {countries.length} countries • {languages.length} languages</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleDownload} className="border border-green-300 text-green-700 px-3 py-2 rounded-lg text-sm hover:bg-green-50 transition font-medium">
            📥 Download CSV
          </button>
          <button onClick={() => setShowUploadModal(true)} className="border border-blue-300 text-blue-700 px-3 py-2 rounded-lg text-sm hover:bg-blue-50 transition font-medium">
            📤 Upload CSV
          </button>
          <button onClick={() => setShowImportModal(true)} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 transition font-medium">
            📋 Import to Rates
          </button>
          <button onClick={() => setShowAddForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition font-medium">
            + Add Entry
          </button>
        </div>
      </div>

      {/* Messages */}
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}
      {msgError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{msgError}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* ── Add Single Entry Form ── */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddForm(false)}>
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">Add MCC/MNC Entry</h3>
            <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">MCC *</label>
                <input value={form.mcc} onChange={e => setForm({...form, mcc: e.target.value})} required placeholder="404" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">MNC</label>
                <input value={form.mnc} onChange={e => setForm({...form, mnc: e.target.value})} placeholder="01" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Country Code</label>
                <input value={form.countryCode} onChange={e => setForm({...form, countryCode: e.target.value})} placeholder="+91" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Country Name *</label>
                <input value={form.countryName} onChange={e => setForm({...form, countryName: e.target.value})} required placeholder="India" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Network Name</label>
                <input value={form.networkName} onChange={e => setForm({...form, networkName: e.target.value})} placeholder="BSNL" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Language</label>
                <input value={form.language} onChange={e => setForm({...form, language: e.target.value})} placeholder="Hindi" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2 flex gap-2">
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Add Entry</button>
                <button type="button" onClick={() => setShowAddForm(false)} className="border px-6 py-2 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Import to Rates Modal ── */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowImportModal(false)}>
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2">Import MCC/MNC to Rate Tables</h3>
            <p className="text-sm text-slate-500 mb-4">
              Copy all {total.toLocaleString()} entries from the global MCC/MNC database into this tenant&apos;s rate table.
              Only new entries are added — existing ones are skipped.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Target Table</label>
                <div className="flex gap-3">
                  <label className={`flex-1 border rounded-xl p-3 cursor-pointer text-center transition ${importTarget === "client_rates" ? "border-blue-500 bg-blue-50" : "hover:bg-slate-50"}`}>
                    <input type="radio" name="target" value="client_rates" checked={importTarget === "client_rates"} onChange={() => setImportTarget("client_rates")} className="sr-only" />
                    <span className="text-sm font-medium">👥 Client Rates</span>
                  </label>
                  <label className={`flex-1 border rounded-xl p-3 cursor-pointer text-center transition ${importTarget === "supplier_rates" ? "border-blue-500 bg-blue-50" : "hover:bg-slate-50"}`}>
                    <input type="radio" name="target" value="supplier_rates" checked={importTarget === "supplier_rates"} onChange={() => setImportTarget("supplier_rates")} className="sr-only" />
                    <span className="text-sm font-medium">🏭 Supplier Rates</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{importTarget === "client_rates" ? "Client" : "Supplier"} *</label>
                <select value={importEntityId} onChange={e => setImportEntityId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select {importTarget === "client_rates" ? "client" : "supplier"}...</option>
                  {(importTarget === "client_rates" ? clients : suppliers).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Default {importTarget === "client_rates" ? "Rate" : "Cost"} ($/SMS)</label>
                <input type="number" step="0.000001" value={importRate} onChange={e => setImportRate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              </div>

              <div className="flex gap-2">
                <button onClick={handleImport} disabled={importing} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
                  {importing ? "Importing..." : `Import ${total} entries`}
                </button>
                <button onClick={() => setShowImportModal(false)} className="border px-6 py-2.5 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload CSV Modal ── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowUploadModal(false)}>
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2">Upload MCC/MNC via CSV</h3>
            <p className="text-sm text-slate-500 mb-4">
              Upload a CSV file with MCC/MNC entries. Duplicates are automatically skipped.
            </p>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-500 transition">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-slate-600 mb-2">Select a CSV file to upload</p>
              <input
                type="file"
                accept=".csv,.txt"
                ref={fileInputRef}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
                id="mcc-csv-upload"
              />
              <label htmlFor="mcc-csv-upload" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition text-sm font-medium">
                {uploading ? "Uploading..." : "Select File"}
              </label>
            </div>

            <div className="mt-4">
              <h4 className="font-medium text-sm mb-1">CSV Format:</h4>
              <div className="bg-slate-50 rounded-lg p-3 font-mono text-xs">
                mcc,mnc,country_code,country_name,network_name,language<br />
                404,01,+91,India,BSNL,Hindi<br />
                310,410,+1,United States,AT&amp;T,English
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowUploadModal(false)} className="border px-6 py-2 rounded-lg text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by country, MCC, network..."
            className="border rounded-lg pl-9 pr-4 py-2 text-sm w-full"
          />
        </div>
        <span className="text-sm text-slate-500">{filtered.length} of {total} results</span>
        <select
          onChange={e => {
            if (e.target.value) setSearch(e.target.value);
          }}
          className="border rounded-lg px-3 py-2 text-sm"
          value=""
        >
          <option value="">All countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          onChange={e => {
            if (e.target.value) setSearch(e.target.value);
          }}
          className="border rounded-lg px-3 py-2 text-sm"
          value=""
        >
          <option value="">All languages</option>
          {languages.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[700px]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">MCC</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">MNC</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Country</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Code</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Network</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Language</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map(d => (
                <tr key={d.id} className="border-b hover:bg-slate-50 transition">
                  <td className="px-5 py-3 font-mono text-xs font-medium">{d.mcc}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{d.mnc || "—"}</td>
                  <td className="px-5 py-3 font-medium">{d.countryName}</td>
                  <td className="px-5 py-3 text-slate-600">{d.countryCode}</td>
                  <td className="px-5 py-3 text-xs text-slate-500 max-w-[200px] truncate" title={d.networkName || ""}>{d.networkName || "—"}</td>
                  <td className="px-5 py-3">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{d.language}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={async () => {
                        const code = prompt("Enter country code (e.g., +91):", d.countryCode);
                        if (!code) return;
                        const rate = prompt("Enter default rate (e.g., 0.00025):", "0.00025");
                        if (!rate) return;
                        try {
                          await fetch("/api/tenant/client-rates", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              clientId: clients[0]?.id || 0,
                              countryCode: code,
                              mcc: d.mcc,
                              mnc: d.mnc,
                              rate: rate,
                            }),
                          });
                          flash(`Rate added for ${d.mcc} (${d.networkName || d.countryName})`);
                        } catch {
                          flash("Failed to add rate", true);
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      title="Quick add to client rates"
                    >
                      ➕ Rate
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <div className="text-2xl mb-2">🔍</div>
                    No results found. Try a different search or add new entries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && (
          <div className="px-5 py-3 bg-slate-50 text-xs text-slate-500 border-t">
            Showing 500 of {filtered.length} results. Refine search for more specific results.
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-slate-800">{total.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">Total Entries</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-slate-800">{countries.length}</div>
          <div className="text-xs text-slate-500 mt-1">Countries</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-slate-800">{languages.length}</div>
          <div className="text-xs text-slate-500 mt-1">Languages</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-slate-800">
            {clients.length + suppliers.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Clients + Suppliers</div>
        </div>
      </div>
    </div>
  );
}
