"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useColumnFilters, FilterRow, FilterToggle, type ColumnFilterDef } from "@/components/column-filters";

interface IpEntry { id: number; ip_address: string; description: string; is_active: boolean; }

export default function IpListPage() {
  const [ips, setIps] = useState<IpEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ipAddress: "", description: "" });

  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/ip-whitelist").then((r) => r.json());
    setIps(r.ips || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/tenant/ip-whitelist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false);
    setForm({ ipAddress: "", description: "" });
    load();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/tenant/ip-whitelist/${id}`, { method: "DELETE" });
    load();
  };

  const ipFilters: ColumnFilterDef[] = useMemo(() => [
    { key: "ip_address", placeholder: "IP Address..." },
    { key: "description", placeholder: "Description..." },
    { key: "is_active", placeholder: "Active / Inactive..." },
  ], []);
  const { values, set, toggle, showFilters, hasActive, filterData } = useColumnFilters(ipFilters);
  const activeFilterCount = useMemo(() => Object.values(values).filter(v => v.trim()).length, [values]);
  const filteredIps = useMemo(() => filterData(ips), [ips, filterData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">IP Whitelist</h2>
          <p className="text-sm text-slate-500">Manage allowed IP addresses for API access</p>
        </div>
        <div className="flex items-center gap-3">
          <FilterToggle showFilters={showFilters} hasActive={hasActive} activeCount={activeFilterCount} onClick={toggle} />
          <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add IP</button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="flex gap-4">
            <input value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} required placeholder="IP Address (e.g., 192.168.1.1)" className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono" />
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Add</button>
            <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2 rounded-lg text-sm">Cancel</button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-5 py-3">IP Address</th>
              <th className="text-left px-5 py-3">Description</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-left px-5 py-3">Actions</th>
            </tr>
            {showFilters && <FilterRow filters={ipFilters} values={values} onChange={set} colSpan={1} />}
          </thead>
          <tbody>
            {filteredIps.map((ip) => (
              <tr key={ip.id} className="border-b hover:bg-slate-50">
                <td className="px-5 py-3 font-mono">{ip.ip_address}</td>
                <td className="px-5 py-3">{ip.description || "—"}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${ip.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{ip.is_active ? "Active" : "Inactive"}</span></td>
                <td className="px-5 py-3"><button onClick={() => handleDelete(ip.id)} className="text-red-600 hover:underline text-xs">Remove</button></td>
              </tr>
            ))}
            {filteredIps.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">{hasActive ? "No IPs match your filters." : "No IPs whitelisted."}</td></tr>}
          </tbody>
        </table>
        {hasActive && <div className="px-4 py-2 border-t bg-slate-50 text-xs text-slate-500">Showing {filteredIps.length} of {ips.length} IPs</div>}
      </div>
    </div>
  );
}
