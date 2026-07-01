"use client";

import { useState, useEffect, useCallback } from "react";

interface Admin {
  id: number;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/super/auth/admins", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      const data = await r.json();
      setAdmins(data.admins || []);
    } catch (error) {
      console.error("Load admins error:", error);
      setMsg("Failed to load admins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.name) {
      setMsg("All fields are required");
      setTimeout(() => setMsg(""), 4000);
      return;
    }
    if (form.password.length < 6) {
      setMsg("Password must be at least 6 characters");
      setTimeout(() => setMsg(""), 4000);
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/super/auth/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg(data.error || "Failed to create admin");
        setTimeout(() => setMsg(""), 4000);
        setSubmitting(false);
        return;
      }
      setMsg(`Admin "${data.admin.name}" created successfully`);
      setTimeout(() => setMsg(""), 4000);
      setShowCreate(false);
      setForm({ email: "", password: "", name: "" });
      load();
    } catch (error) {
      console.error("Create admin error:", error);
      setMsg("Network error");
      setTimeout(() => setMsg(""), 4000);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-32 bg-slate-200 rounded" />
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-12">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-slate-500">Loading admins...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Super Administrators</h2>
          <p className="text-sm text-slate-500">{admins.length} admin{admins.length !== 1 ? "s" : ""} registered</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
        >
          <span className="text-lg">＋</span>
          Add Admin
        </button>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm ${
          msg.includes("successfully") || msg.includes("created")
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {msg}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-lg">Add Super Administrator</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g. Operations Admin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="admin@net2app.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Min 6 characters"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1"
                >
                  {submitting ? "Creating..." : "Create Admin"}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="border border-slate-300 hover:bg-slate-50 px-6 py-2.5 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admins Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Created</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">ID</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id} className="border-b hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm">
                      {admin.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-800">{admin.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">{admin.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    admin.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {admin.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {new Date(admin.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs font-mono">#{admin.id}</td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  <div className="text-3xl mb-2">🔐</div>
                  <p>No super admins found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
