"use client";

import { useState, useEffect, useCallback } from "react";

interface DashboardData {
  stats: {
    totalTenants: number;
    activeTenants: number;
    suspendedTenants: number;
    inactiveTenants: number;
    packageCounts: Array<{ packageType: string; count: number }>;
  };
  recentTenants: Array<{
    id: number;
    companyName: string;
    email: string;
    isActive: boolean;
    packageType: string;
    createdAt: string;
  }>;
  packages: Array<{ id: number; name: string; price: string }>;
}

export default function SuperDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/super/dashboard").then((r) => r.json());
    setData(r);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="animate-pulse text-slate-400 p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        <div className="bg-white rounded-xl p-5 border shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Total Tenants</p>
          <p className="text-3xl font-bold text-slate-800">{data.stats.totalTenants}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border shadow-sm border-green-200">
          <p className="text-sm text-slate-500 mb-1">Active</p>
          <p className="text-3xl font-bold text-green-600">{data.stats.activeTenants}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border shadow-sm border-amber-200">
          <p className="text-sm text-slate-500 mb-1">Suspended</p>
          <p className="text-3xl font-bold text-amber-600">{data.stats.suspendedTenants}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border shadow-sm border-red-200">
          <p className="text-sm text-slate-500 mb-1">Inactive</p>
          <p className="text-3xl font-bold text-red-600">{data.stats.inactiveTenants}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Packages</p>
          <p className="text-3xl font-bold text-blue-600">{data.packages.length}</p>
        </div>
      </div>

      {/* Package Distribution */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4">Tenant Distribution by Package</h3>
        <div className="grid grid-cols-3 gap-4">
          {data.stats.packageCounts.map((p, i) => (
            <div key={i} className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{p.count}</p>
              <p className="text-sm text-slate-500 capitalize">{p.packageType || "starter"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Tenants */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-slate-800">Recent Tenants</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Company</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Email</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Package</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-slate-500 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTenants.map((t) => (
                <tr key={t.id} className="border-b hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium">{t.companyName}</td>
                  <td className="px-6 py-3 text-slate-600">{t.email}</td>
                  <td className="px-6 py-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs capitalize">{t.packageType || "starter"}</span></td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${t.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-500 text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {data.recentTenants.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No tenants yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
