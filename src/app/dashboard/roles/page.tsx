"use client";

import { useState, useEffect, useCallback } from "react";

interface Role { id: number; name: string; permissions: string; }

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);

  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/roles").then((r) => r.json());
    setRoles(r.roles || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Roles & Permissions</h2>
        <p className="text-sm text-slate-500">Manage user roles and access control</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {roles.map((r) => {
          const perms = JSON.parse(r.permissions || "[]");
          return (
            <div key={r.id} className="bg-white rounded-xl border p-5 shadow-sm">
              <h4 className="font-semibold text-lg mb-3">{r.name}</h4>
              <div className="flex flex-wrap gap-2">
                {perms.map((p: string, i: number) => (
                  <span key={i} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">{p}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-50 rounded-xl p-6 border">
        <h3 className="font-semibold mb-3">Available Permissions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {["clients", "suppliers", "trunks", "routes", "route_plans", "messages", "campaigns", "invoices", "payments", "reports", "users", "settings"].map((p) => (
            <div key={p} className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              <span>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
