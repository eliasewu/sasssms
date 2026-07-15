"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface MccMnc { id: number; mcc: string; mnc: string; countryCode: string; countryName: string; networkName: string; }

export default function MccMncSuperPage() {
  const [data, setData] = useState<MccMnc[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ mcc: "", mnc: "", countryCode: "", countryName: "", networkName: "" });
  const [form, setForm] = useState({ mcc: "", mnc: "", countryCode: "", countryName: "", networkName: "" });
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [tenants, setTenants] = useState<{id:number; companyName:string; schemaName:string; email:string}[]>([]);
  const [selectedTenantIds, setSelectedTenantIds] = useState<Set<number>>(new Set());
  const [tenantSearch, setTenantSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const flash = (text: string, err = false) => {
    if (err) { setMsgError(text); setTimeout(() => setMsgError(""), 5000); }
    else { setMsg(text); setTimeout(() => setMsg(""), 5000); }
  };

  const load = useCallback(async () => {
    const r = await fetch("/api/mcc-mnc").then(r => r.json());
    setData(r.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter(d =>
    (d.countryName || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.mcc || "").includes(search) ||
    (d.networkName || "").toLowerCase().includes(search.toLowerCase())
  );

  const countries = [...new Set(filtered.map(d => d.countryName))].sort();
  const networks = [...new Set(filtered.map(d => d.networkName).filter(Boolean))].length;

  // ── Add ──
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/mcc-mnc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false); setForm({ mcc: "", mnc: "", countryCode: "", countryName: "", networkName: "" });
    load();
    flash("MCC/MNC entry added");
  };

  // ── Inline Edit ──
  const startEdit = (d: MccMnc) => {
    setEditingId(d.id);
    setEditValues({ mcc: d.mcc, mnc: d.mnc || "", countryCode: d.countryCode, countryName: d.countryName, networkName: d.networkName || "" });
  };

  const cancelEdit = () => { setEditingId(null); };

  const saveEdit = async (id: number) => {
    if (!editValues.mcc || !editValues.countryName) {
      flash("MCC and Country Name are required", true);
      return;
    }
    await fetch(`/api/mcc-mnc/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editValues),
    });
    setEditingId(null);
    load();
    flash("Entry updated");
  };

  // ── Delete ──
  const handleDelete = async (id: number) => {
    if (!confirm("Delete this MCC/MNC entry?")) return;
    await fetch(`/api/mcc-mnc/${id}`, { method: "DELETE" });
    load();
    flash("Entry deleted");
  };

  // ── CSV File Upload ──
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.trim().split("\n").filter(Boolean);
      if (lines.length < 2) { flash("File is empty or has no data rows", true); return; }

      const header = lines[0].toLowerCase();
      const hasHeader = header.includes("country") || header.includes("mcc");
      const startIdx = hasHeader ? 1 : 0;

      const sampleParts = lines[startIdx].split(",");
      const isMccmncFormat = sampleParts.length >= 7;
      const isStandardFormat = header.includes("mcc,mnc,country_code");

      let inserted = 0, skipped = 0;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const ch of line) {
          if (ch === '"') { inQuotes = !inQuotes; }
          else if (ch === "," && !inQuotes) { parts.push(current.trim()); current = ""; }
          else { current += ch; }
        }
        parts.push(current.trim());

        let mcc = "", mnc = "", countryCode = "", countryName = "", networkName = "";

        if (isMccmncFormat && parts.length >= 5) {
          countryName = parts[0]; countryCode = parts[1]; mcc = parts[2]; mnc = parts[3]; networkName = parts[4];
        } else if (isStandardFormat && parts.length >= 4) {
          mcc = parts[0]; mnc = parts[1] || ""; countryCode = parts[2] || ""; countryName = parts[3] || ""; networkName = parts[4] || "";
        } else if (parts.length >= 4) {
          mcc = parts[0]; mnc = parts[1] || ""; countryCode = parts[2] || ""; countryName = parts[3] || ""; networkName = parts[4] || "";
        } else {
          continue;
        }

        if (!mcc || !countryName) continue;

        try {
          const r = await fetch("/api/mcc-mnc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mcc, mnc: mnc || undefined, countryCode, countryName, networkName: networkName || undefined }),
          });
          const j = await r.json();
          if (j.message === "Already exists") skipped++;
          else inserted++;
        } catch { /* skip */ }
      }

      flash(`Uploaded ${inserted} entries (${skipped} duplicates skipped) from ${file.name}`);
      setShowUpload(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      load();
    } catch {
      flash("Upload failed — check file format", true);
    } finally {
      setUploading(false);
    }
  };

  // ── Push Modal ──
  const openPushModal = async () => {
    setShowPushModal(true);
    setSelectedTenantIds(new Set());
    setTenantSearch("");
    try {
      const r = await fetch("/api/super/tenants").then(res => res.json());
      setTenants(r.tenants || []);
    } catch {
      flash("Failed to load tenant list", true);
    }
  };

  const toggleTenant = (id: number) => {
    setSelectedTenantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllTenants = () => {
    const ft = filteredTenants;
    if (selectedTenantIds.size === ft.length && ft.length > 0) {
      setSelectedTenantIds(new Set());
    } else {
      setSelectedTenantIds(new Set(ft.map(t => t.id)));
    }
  };

  const filteredTenants = tenants.filter(t =>
    !tenantSearch ||
    (t.companyName || "").toLowerCase().includes(tenantSearch.toLowerCase()) ||
    (t.email || "").toLowerCase().includes(tenantSearch.toLowerCase()) ||
    (t.schemaName || "").toLowerCase().includes(tenantSearch.toLowerCase())
  );

  const handlePushToTenants = async (targetAll: boolean) => {
    const count = targetAll ? tenants.length : selectedTenantIds.size;
    if (count === 0) { flash("No tenants selected", true); return; }
    if (!confirm(targetAll
      ? `Push all ${data.length} MCC/MNC entries to ALL ${count} tenants? This may take a moment.`
      : `Push all ${data.length} MCC/MNC entries to ${count} selected tenants?`
    )) return;

    setPushing(true);
    try {
      const body: Record<string, unknown> = {};
      if (!targetAll) body.tenantIds = [...selectedTenantIds];
      const r = await fetch("/api/super/mcc-mnc/push-to-tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.error) { flash(j.error, true); return; }
      flash(`Pushed to ${j.tenantCount} tenants (${j.inserted} new entries, ${j.skipped} skipped)`);
      setShowPushModal(false);
    } catch {
      flash("Push failed", true);
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">MCC/MNC Database (Super Admin)</h2>
          <p className="text-sm text-slate-500">{data.length.toLocaleString()} entries • {countries.length} countries</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowUpload(true)} className="border border-green-300 text-green-700 px-4 py-2 rounded-lg text-sm hover:bg-green-50 font-medium">
            📤 Upload CSV
          </button>
          <button onClick={openPushModal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
            📋 Push to Tenants
          </button>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Entry</button>
        </div>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}
      {msgError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{msgError}</div>}

      {/* CSV Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowUpload(false)}>
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2">Upload MCC/MNC CSV</h3>
            <p className="text-sm text-slate-500 mb-4">
              Supports both formats: <code className="bg-slate-100 px-1 rounded">country,country_code,mcc,mnc,operator,...</code> and <code className="bg-slate-100 px-1 rounded">mcc,mnc,country_code,country_name,...</code>
            </p>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-green-400 transition">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-slate-600 mb-2">Select a CSV file to upload</p>
              <input type="file" accept=".csv,.txt" ref={fileInputRef} onChange={e => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); }} className="hidden" id="super-mcc-csv" />
              <label htmlFor="super-mcc-csv" className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-green-700 transition text-sm font-medium">
                {uploading ? "Uploading..." : "Select File"}
              </label>
            </div>
            <p className="text-xs text-slate-400 mt-3">Duplicates are automatically detected and skipped. Current DB: {data.length.toLocaleString()} entries.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowUpload(false)} className="border px-6 py-2 rounded-lg text-sm w-full">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Push to Tenants Modal */}
      {showPushModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPushModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Select Tenants</h3>
                <p className="text-sm text-slate-500">Push {data.length.toLocaleString()} MCC/MNC entries to target tenants</p>
              </div>
              <button onClick={() => setShowPushModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input value={tenantSearch} onChange={e => setTenantSearch(e.target.value)} placeholder="Filter tenants..." className="border rounded-lg px-3 py-1.5 text-sm flex-1 outline-none" />
              <button onClick={toggleAllTenants} className="text-xs text-indigo-600 hover:underline whitespace-nowrap font-medium">
                {selectedTenantIds.size === filteredTenants.length && filteredTenants.length > 0 ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="border rounded-xl overflow-y-auto flex-1 mb-4">
              {filteredTenants.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-400 text-sm">
                  {tenants.length === 0 ? "Loading tenants..." : "No tenants match the filter"}
                </div>
              ) : (
                filteredTenants.map(t => (
                  <label key={t.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition border-b border-slate-100 last:border-b-0 ${selectedTenantIds.has(t.id) ? "bg-indigo-50" : ""}`}>
                    <input type="checkbox" checked={selectedTenantIds.has(t.id)} onChange={() => toggleTenant(t.id)} className="accent-indigo-600 w-4 h-4" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{t.companyName || "Unnamed"}</div>
                      <div className="text-xs text-slate-400 truncate">{t.email} · {t.schemaName}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{selectedTenantIds.size} of {tenants.length} tenant{tenants.length !== 1 ? "s" : ""} selected</span>
              <div className="flex gap-2">
                <button onClick={() => handlePushToTenants(false)} disabled={pushing || selectedTenantIds.size === 0} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
                  {pushing ? "⏳ Pushing..." : `Push to Selected (${selectedTenantIds.size})`}
                </button>
                <button onClick={() => handlePushToTenants(true)} disabled={pushing} className="border border-indigo-200 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50 disabled:opacity-50 transition">
                  Push to All ({tenants.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">MCC *</label><input value={form.mcc} onChange={e => setForm({...form, mcc: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">MNC</label><input value={form.mnc} onChange={e => setForm({...form, mnc: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Country Code</label><input value={form.countryCode} onChange={e => setForm({...form, countryCode: e.target.value})} placeholder="+91" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Country Name *</label><input value={form.countryName} onChange={e => setForm({...form, countryName: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div className="col-span-2"><label className="block text-sm font-medium mb-1">Network Name</label><input value={form.networkName} onChange={e => setForm({...form, networkName: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div className="col-span-2 flex gap-2"><button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Add</button><button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button></div>
          </form>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex gap-3 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by country, MCC, network..." className="border rounded-lg px-4 py-2 text-sm flex-1 max-w-md" />
        <span className="text-sm text-slate-500">{filtered.length} of {data.length} results</span>
        <select onChange={e => setSearch(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" value="">
          <option value="">All countries ({countries.length})</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-5 py-3">MCC</th>
              <th className="text-left px-5 py-3">MNC</th>
              <th className="text-left px-5 py-3">Country</th>
              <th className="text-left px-5 py-3">Code</th>
              <th className="text-left px-5 py-3">Network</th>
              <th className="text-left px-5 py-3 w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 300).map(d => {
              const isEditing = editingId === d.id;
              return (
                <tr key={d.id} className={`border-b hover:bg-slate-50 ${isEditing ? "bg-blue-50" : ""}`}>
                  <td className="px-5 py-3 font-mono">
                    {isEditing
                      ? <input value={editValues.mcc} onChange={e => setEditValues({...editValues, mcc: e.target.value})} className="w-16 border border-blue-300 rounded px-1.5 py-0.5 text-xs font-mono" />
                      : d.mcc}
                  </td>
                  <td className="px-5 py-3 font-mono">
                    {isEditing
                      ? <input value={editValues.mnc} onChange={e => setEditValues({...editValues, mnc: e.target.value})} className="w-16 border border-blue-300 rounded px-1.5 py-0.5 text-xs font-mono" />
                      : (d.mnc || "—")}
                  </td>
                  <td className="px-5 py-3 font-medium">
                    {isEditing
                      ? <input value={editValues.countryName} onChange={e => setEditValues({...editValues, countryName: e.target.value})} className="w-32 border border-blue-300 rounded px-1.5 py-0.5 text-xs" />
                      : d.countryName}
                  </td>
                  <td className="px-5 py-3">
                    {isEditing
                      ? <input value={editValues.countryCode} onChange={e => setEditValues({...editValues, countryCode: e.target.value})} className="w-16 border border-blue-300 rounded px-1.5 py-0.5 text-xs" />
                      : d.countryCode}
                  </td>
                  <td className="px-5 py-3 text-xs max-w-[200px] truncate" title={d.networkName || ""}>
                    {isEditing
                      ? <input value={editValues.networkName} onChange={e => setEditValues({...editValues, networkName: e.target.value})} className="w-36 border border-blue-300 rounded px-1.5 py-0.5 text-xs" />
                      : (d.networkName || "—")}
                  </td>
                  <td className="px-5 py-3">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button onClick={() => saveEdit(d.id)} className="text-green-600 hover:underline text-xs font-medium">✓ Save</button>
                        <button onClick={cancelEdit} className="text-slate-400 hover:underline text-xs">✕</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(d)} className="text-blue-600 hover:underline text-xs">Edit</button>
                        <button onClick={() => handleDelete(d.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No entries found.</td></tr>}
          </tbody>
        </table>
        {filtered.length > 300 && <div className="px-5 py-3 bg-slate-50 text-xs text-slate-500">Showing 300 of {filtered.length} results. Refine search for more.</div>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4 text-center"><div className="text-2xl font-bold text-slate-800">{data.length.toLocaleString()}</div><div className="text-xs text-slate-500 mt-1">Total Entries</div></div>
        <div className="bg-white rounded-xl border p-4 text-center"><div className="text-2xl font-bold text-slate-800">{countries.length}</div><div className="text-xs text-slate-500 mt-1">Countries</div></div>
        <div className="bg-white rounded-xl border p-4 text-center"><div className="text-2xl font-bold text-slate-800">{networks.toLocaleString()}</div><div className="text-xs text-slate-500 mt-1">Networks</div></div>
        <div className="bg-white rounded-xl border p-4 text-center"><div className="text-2xl font-bold text-slate-800 text-green-600">✅ Active</div><div className="text-xs text-slate-500 mt-1">Database Status</div></div>
      </div>
    </div>
  );
}
