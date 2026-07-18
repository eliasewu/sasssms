"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useConfirmModal } from "@/components/confirm-modal";
import { useColumnFilters, FilterRow, FilterToggle, type ColumnFilterDef } from "@/components/column-filters";

interface Connector {
  id: number; name: string; provider: string; type: string; region: string;
  api_url: string; auth_method: string; status: string; is_active: boolean;
}

const CONNECTOR_TYPES = ["ALL", "HTTP_API", "RCS", "FLASH_SMS"];
const AUTH_METHODS = ["API_KEY", "BEARER", "BASIC"];

export default function FullConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Connector | null>(null);
  const [filter, setFilter] = useState({ type: "ALL", search: "", region: "" });
  const [form, setForm] = useState({
    name: "", provider: "", type: "HTTP_API", region: "global",
    apiUrl: "", apiKey: "", authMethod: "API_KEY", endpoints: "",
  });

  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/connectors").then(r => r.json());
    setConnectors(r.connectors || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await fetch(`/api/tenant/connectors/${editing.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, isActive: editing.is_active }),
      });
    } else {
      await fetch("/api/tenant/connectors", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setShowForm(false); setEditing(null); load();
  };

  const { confirm: confirmDelete, modal: confirmModal } = useConfirmModal();

  const connFilters: ColumnFilterDef[] = useMemo(() => [
    { key: "name", placeholder: "Name / Provider..." },
    { key: "type", placeholder: "HTTP API / RCS..." },
    { key: "region", placeholder: "Region..." },
    { key: "auth_method", placeholder: "API_KEY / BASIC..." },
    { key: "status", placeholder: "Active / Connected..." },
  ], []);
  const { values, set, toggle, showFilters, hasActive, filterData } = useColumnFilters(connFilters);
  const activeFilterCount = useMemo(() => Object.values(values).filter(v => v.trim()).length, [values]);

  const handleDelete = async (id: number) => {
    if (!await confirmDelete("Delete this connector?")) return;
    await fetch(`/api/tenant/connectors/${id}`, { method: "DELETE" });
    load();
  };

  const filtered = connectors.filter(c => {
    if (filter.type !== "ALL" && c.type !== filter.type) return false;
    if (filter.search && !c.name.toLowerCase().includes(filter.search.toLowerCase()) && !(c.provider || "").toLowerCase().includes(filter.search.toLowerCase())) return false;
    if (filter.region && c.region !== filter.region) return false;
    return true;
  });

  const typeCounts = {
    ALL: connectors.length,
    HTTP_API: connectors.filter(c => c.type === "HTTP_API").length,
    RCS: connectors.filter(c => c.type === "RCS").length,
    FLASH_SMS: connectors.filter(c => c.type === "FLASH_SMS").length,
  };

  const activeConnected = connectors.filter(c => c.status === "connected" && c.is_active).length;

  const displayConnectors = useMemo(() => {
    return showFilters ? filterData(filtered) : filtered;
  }, [showFilters, filterData, filtered]);

  const authMethodColors: Record<string, string> = {
    API_KEY: "bg-blue-50 text-blue-700", BEARER: "bg-purple-50 text-purple-700", BASIC: "bg-slate-50 text-slate-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">API Connectors</h2>
        <p className="text-sm text-slate-500">Central repository for managing third-party messaging integrations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-2xl font-bold text-slate-800">{connectors.length}</p>
          <p className="text-xs text-slate-500">Total Connectors</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-2xl font-bold text-green-600">{typeCounts.HTTP_API}</p>
          <p className="text-xs text-slate-500">HTTP API</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-2xl font-bold text-purple-600">{typeCounts.RCS}</p>
          <p className="text-xs text-slate-500">RCS</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-2xl font-bold text-amber-600">{typeCounts.FLASH_SMS}</p>
          <p className="text-xs text-slate-500">Flash SMS</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-2xl font-bold text-blue-600">{activeConnected}</p>
          <p className="text-xs text-slate-500">Connected</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {CONNECTOR_TYPES.map(t => (
          <button key={t} onClick={() => setFilter({...filter, type: t})}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter.type === t ? "bg-blue-600 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"}`}>
            {t === "ALL" ? "All" : t.replace("_", " ")} ({typeCounts[t as keyof typeof typeCounts]})
          </button>
        ))}
        <div className="flex-1" />
        <FilterToggle showFilters={showFilters} hasActive={hasActive} activeCount={activeFilterCount} onClick={toggle} />
        <input value={filter.search} onChange={e => setFilter({...filter, search: e.target.value})}
          placeholder="Search connectors..." className="border rounded-lg px-4 py-2 text-sm w-64" />
        <button onClick={() => { setShowForm(true); setEditing(null); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Add Connector
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-lg">
          <h3 className="font-semibold mb-4">{editing ? "Edit Connector" : "Add New Connector"}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Provider</label><input value={form.provider} onChange={e => setForm({...form, provider: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Type *</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="HTTP_API">HTTP API</option><option value="RCS">RCS</option><option value="FLASH_SMS">Flash SMS</option></select></div>
            <div><label className="block text-sm font-medium mb-1">Region</label><input value={form.region} onChange={e => setForm({...form, region: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">API URL</label><input value={form.apiUrl} onChange={e => setForm({...form, apiUrl: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Auth Method</label><select value={form.authMethod} onChange={e => setForm({...form, authMethod: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">{AUTH_METHODS.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
            <div><label className="block text-sm font-medium mb-1">API Key</label><input value={form.apiKey} onChange={e => setForm({...form, apiKey: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Endpoints (JSON)</label><textarea value={form.endpoints} onChange={e => setForm({...form, endpoints: e.target.value})} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" /></div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">{editing ? "Update" : "Create"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Connectors Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-5 py-3">Name / Provider</th>
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-left px-5 py-3">Region</th>
                <th className="text-left px-5 py-3">Auth Method</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Actions</th>
              </tr>
              {showFilters && <FilterRow filters={connFilters} values={values} onChange={set} colSpan={1} />}
            </thead>
            <tbody>
              {displayConnectors.map(c => (
                <tr key={c.id} className="border-b hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <p className="font-medium">{c.name}</p>
                    {c.provider && <p className="text-xs text-slate-500">{c.provider}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.type === "HTTP_API" ? "bg-green-100 text-green-700" : c.type === "RCS" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>{c.type.replace("_", " ")}</span>
                  </td>
                  <td className="px-5 py-3 text-xs">{c.region}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${authMethodColors[c.auth_method] || "bg-slate-50"}`}>{c.auth_method}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === "active" ? "bg-green-100 text-green-700" : c.status === "connected" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{c.status}</span>
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => { setEditing(c); setForm({ name: c.name, provider: c.provider || "", type: c.type, region: c.region, apiUrl: c.api_url || "", apiKey: "", authMethod: c.auth_method, endpoints: "" }); setShowForm(true); }} className="text-blue-600 hover:underline text-xs mr-2">Edit</button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {displayConnectors.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No connectors found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {confirmModal}
    </div>
  );
}
