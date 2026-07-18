"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useColumnFilters, FilterRow, FilterToggle, type ColumnFilterDef } from "@/components/column-filters";

interface User { id: number; name: string; email: string; role_id: number; is_active: boolean; last_login: string; }
interface Role { id: number; name: string; }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: "" });

  const load = useCallback(async () => {
    const [ur, rr] = await Promise.all([
      fetch("/api/tenant/users").then((r) => r.json()),
      fetch("/api/tenant/roles").then((r) => r.json()),
    ]);
    setUsers(ur.users || []);
    setRoles(rr.roles || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/tenant/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false);
    setForm({ name: "", email: "", password: "", roleId: "" });
    load();
  };

  const userFilters: ColumnFilterDef[] = useMemo(() => [
    { key: "name", placeholder: "Name..." },
    { key: "email", placeholder: "Email..." },
    { key: "role_id", placeholder: "Role..." },
    { key: "is_active", placeholder: "Active / Inactive..." },
  ], []);
  const { values, set, toggle, showFilters, hasActive, filterData } = useColumnFilters(userFilters);
  const activeFilterCount = useMemo(() => Object.values(values).filter(v => v.trim()).length, [values]);
  const filteredUsers = useMemo(() => filterData(users), [users, filterData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">User Management</h2>
          <p className="text-sm text-slate-500">Manage tenant users and their access</p>
        </div>
        <div className="flex items-center gap-3">
          <FilterToggle showFilters={showFilters} hasActive={hasActive} activeCount={activeFilterCount} onClick={toggle} />
          <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add User</button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Full Name" className="border rounded-lg px-3 py-2 text-sm" />
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="Email" className="border rounded-lg px-3 py-2 text-sm" />
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="Password" className="border rounded-lg px-3 py-2 text-sm" />
            <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">Select Role</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Create</button>
              <button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-5 py-3">Name</th>
              <th className="text-left px-5 py-3">Email</th>
              <th className="text-left px-5 py-3">Role</th>
              <th className="text-left px-5 py-3">Last Login</th>
              <th className="text-left px-5 py-3">Status</th>
            </tr>
            {showFilters && <FilterRow filters={userFilters} values={values} onChange={set} />}
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.id} className="border-b hover:bg-slate-50">
                <td className="px-5 py-3 font-medium">{u.name}</td>
                <td className="px-5 py-3">{u.email}</td>
                <td className="px-5 py-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{roles.find((r) => r.id === u.role_id)?.name || "—"}</span></td>
                <td className="px-5 py-3 text-xs text-slate-500">{u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{u.is_active ? "Active" : "Inactive"}</span></td>
              </tr>
            ))}
            {filteredUsers.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">{hasActive ? "No users match your filters." : "No users created."}</td></tr>}
          </tbody>
        </table>
        {hasActive && <div className="px-4 py-2 border-t bg-slate-50 text-xs text-slate-500">Showing {filteredUsers.length} of {users.length} users</div>}
      </div>
    </div>
  );
}
