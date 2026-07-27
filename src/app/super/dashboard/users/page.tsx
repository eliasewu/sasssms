"use client";

import { useState, useEffect, useCallback } from "react";

interface TenantUser {
  id: number;
  companyName: string;
  email: string;
  phone: string;
  schemaName: string;
  isActive: boolean;
  status: string;
  packageType: string;
  smsCounter: number;
  smsLimit: number;
  balance: string;
  serverLocation: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [packageFilter, setPackageFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<keyof TenantUser>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/super/users").then((r) => r.json());
    setUsers(r.tenants || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSort = (field: keyof TenantUser) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Filter and sort
  const filtered = users
    .filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        u.companyName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        u.schemaName.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || u.status === statusFilter;

      const matchesPackage =
        packageFilter === "all" || u.packageType === packageFilter;

      return matchesSearch && matchesStatus && matchesPackage;
    })
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        return sortDir === "asc"
          ? Number(aVal) - Number(bVal)
          : Number(bVal) - Number(aVal);
      }
      return 0;
    });

  // Package breakdown for summary badges
  const activeCount = users.filter((u) => u.isActive && u.status === "active").length;
  const suspendedCount = users.filter((u) => u.status === "suspended").length;
  const inactiveCount = users.filter((u) => !u.isActive && u.status !== "suspended").length;
  const starterCount = users.filter((u) => u.packageType === "starter").length;
  const proCount = users.filter((u) => u.packageType === "professional").length;
  const enterpriseCount = users.filter((u) => u.packageType === "enterprise").length;

  const SortIcon = ({ field }: { field: keyof TenantUser }) => {
    if (sortField !== field)
      return <span className="text-slate-300 ml-1">↕</span>;
    return (
      <span className="text-blue-600 ml-1">
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">User Accounts</h2>
        <p className="text-sm text-slate-500">
          {users.length} tenant accounts registered — all phone numbers &amp;
          emails at a glance
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-slate-800">
            {users.length}
          </div>
          <div className="text-xs text-slate-500">Total</div>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-green-700">
            {activeCount}
          </div>
          <div className="text-xs text-green-600">Active</div>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-amber-700">
            {suspendedCount}
          </div>
          <div className="text-xs text-amber-600">Suspended</div>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-red-700">
            {inactiveCount}
          </div>
          <div className="text-xs text-red-600">Inactive</div>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-blue-700">{proCount}</div>
          <div className="text-xs text-blue-600">Professional</div>
        </div>
        <div className="bg-white rounded-xl border border-purple-200 p-3 text-center shadow-sm">
          <div className="text-2xl font-bold text-purple-700">
            {enterpriseCount}
          </div>
          <div className="text-xs text-purple-600">Enterprise</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search by name, email, phone, or schema..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-xl px-3 py-2.5 text-sm bg-white shadow-sm"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={packageFilter}
          onChange={(e) => setPackageFilter(e.target.value)}
          className="border rounded-xl px-3 py-2.5 text-sm bg-white shadow-sm"
        >
          <option value="all">All Packages</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <button
          onClick={load}
          className="border rounded-xl px-3 py-2.5 text-sm bg-white shadow-sm hover:bg-slate-50 transition text-slate-600"
          title="Refresh"
        >
          🔄
        </button>
        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length} of {users.length} shown
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border p-16 text-center shadow-sm">
          <div className="inline-block w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-slate-500 text-sm">Loading tenant users...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                  onClick={() => toggleSort("id")}
                >
                  ID <SortIcon field="id" />
                </th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => toggleSort("companyName")}
                >
                  Company <SortIcon field="companyName" />
                </th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => toggleSort("email")}
                >
                  Email <SortIcon field="email" />
                </th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => toggleSort("phone")}
                >
                  Phone <SortIcon field="phone" />
                </th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => toggleSort("packageType")}
                >
                  Package <SortIcon field="packageType" />
                </th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => toggleSort("status")}
                >
                  Status <SortIcon field="status" />
                </th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => toggleSort("smsCounter")}
                >
                  SMS Used <SortIcon field="smsCounter" />
                </th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => toggleSort("serverLocation")}
                >
                  Server <SortIcon field="serverLocation" />
                </th>
                <th
                  className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => toggleSort("createdAt")}
                >
                  Joined <SortIcon field="createdAt" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    <div className="text-4xl mb-2">📭</div>
                    <p>No users match your filters</p>
                    <p className="text-xs mt-1">
                      Try adjusting the search or filter criteria
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const isSuspended = u.status === "suspended";
                  const isInactive = !u.isActive && !isSuspended;
                  const statusLabel = isSuspended
                    ? "Suspended"
                    : u.isActive
                      ? "Active"
                      : "Inactive";
                  const statusColor = isSuspended
                    ? "bg-amber-100 text-amber-700"
                    : u.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700";

                  const pkgColor =
                    u.packageType === "enterprise"
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : u.packageType === "professional"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-slate-100 text-slate-600 border-slate-200";

                  return (
                    <tr
                      key={u.id}
                      className="border-b hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {u.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {u.companyName}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {u.schemaName}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-700 text-xs">
                            {u.email}
                          </span>
                          {u.emailVerified && (
                            <span
                              className="text-green-500 text-xs"
                              title="Email verified"
                            >
                              ✓
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-700 font-mono text-xs">
                            {u.phone}
                          </span>
                          {u.phoneVerified && (
                            <span
                              className="text-green-500 text-xs"
                              title="Phone verified"
                            >
                              ✓
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs border capitalize ${pkgColor}`}
                        >
                          {u.packageType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${statusColor}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {u.smsCounter.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {u.serverLocation ? (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {u.serverLocation}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick Stats Footer */}
      <div className="text-xs text-slate-400 text-right">
        <span className="inline-flex items-center gap-1 mr-4">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          {activeCount} active
        </span>
        <span className="inline-flex items-center gap-1 mr-4">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          {suspendedCount} suspended
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
          {inactiveCount} inactive
        </span>
      </div>
    </div>
  );
}
