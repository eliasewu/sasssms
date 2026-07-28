"use client";

import { useState, useEffect, useCallback } from "react";

interface TenantAudit {
  id: number;
  companyName: string;
  email: string;
  schemaName: string;
  smsLimit: number;
  smsCounter: number;
  actualCount: number;
  diff: number;
  status: "SYNC" | "MISMATCH" | "ERROR";
  lastMessageAt: string | null;
}

interface AuditSummary {
  total: number;
  synced: number;
  mismatched: number;
  errorCount: number;
  totalMismatch: number;
  refreshedAt: string;
}

export default function SmsCounterAuditPage() {
  const [data, setData] = useState<TenantAudit[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/super/sms-counter-audit");
      if (!res.ok) throw new Error("Failed to load audit data");
      const json = await res.json();
      setData(json.tenants || []);
      setSummary(json.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Filters
  const filtered = data.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.companyName.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.schemaName.toLowerCase().includes(q) ||
      String(t.id).includes(q)
    );
  });

  // Sort: mismatched first, then by diff descending
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === "MISMATCH" && b.status !== "MISMATCH") return -1;
    if (a.status !== "MISMATCH" && b.status === "MISMATCH") return 1;
    return Math.abs(b.diff) - Math.abs(a.diff);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">SMS Credit Audit</h2>
          <p className="text-sm text-slate-500">
            Compare sms_counter vs actual message count per tenant
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
        >
          {refreshing ? "⏳ Refreshing..." : "🔄 Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-slate-800">{summary.total}</div>
            <div className="text-xs text-slate-500 mt-1">Total Tenants</div>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-600">{summary.synced}</div>
            <div className="text-xs text-green-600 mt-1">✅ In Sync</div>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-red-600">{summary.mismatched}</div>
            <div className="text-xs text-red-600 mt-1">❌ Mismatched</div>
          </div>
          <div className="bg-white rounded-xl border border-orange-200 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-orange-600">
              {summary.totalMismatch > 999
                ? (summary.totalMismatch / 1000).toFixed(1) + "k"
                : summary.totalMismatch}
            </div>
            <div className="text-xs text-orange-600 mt-1">Total Diff</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-slate-800">
              {summary.errorCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">⚠️ Errors</div>
          </div>
          {summary.refreshedAt && (
            <div className="col-span-full text-xs text-slate-400 text-right">
              Last refreshed: {new Date(summary.refreshedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by company, email, schema, ID..."
          className="border rounded-lg px-4 py-2 text-sm flex-1 min-w-[200px] max-w-md outline-none focus:ring-2 focus:ring-blue-200"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="all">All ({data.length})</option>
          <option value="SYNC">✅ In Sync ({data.filter((t) => t.status === "SYNC").length})</option>
          <option value="MISMATCH">❌ Mismatched ({data.filter((t) => t.status === "MISMATCH").length})</option>
          <option value="ERROR">⚠️ Error ({data.filter((t) => t.status === "ERROR").length})</option>
        </select>
        <span className="text-sm text-slate-500">
          {sorted.length} of {data.length} results
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-slate-400">
            <div className="text-3xl mb-2">🔢</div>
            <p className="text-sm">Loading audit data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-5 py-3 whitespace-nowrap">ID</th>
                  <th className="text-left px-5 py-3 whitespace-nowrap">Company</th>
                  <th className="text-left px-5 py-3 whitespace-nowrap">Schema</th>
                  <th className="text-right px-5 py-3 whitespace-nowrap">SMS Limit</th>
                  <th className="text-right px-5 py-3 whitespace-nowrap">Counter</th>
                  <th className="text-right px-5 py-3 whitespace-nowrap">Actual msgs</th>
                  <th className="text-right px-5 py-3 whitespace-nowrap">Diff</th>
                  <th className="text-center px-5 py-3 whitespace-nowrap">Status</th>
                  <th className="text-left px-5 py-3 whitespace-nowrap">Last Message</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  const isMismatch = t.status === "MISMATCH";
                  const isError = t.status === "ERROR";
                  return (
                    <tr
                      key={t.id}
                      className={`border-b hover:bg-slate-50 transition ${
                        isMismatch ? "bg-red-50/50" : ""
                      } ${isError ? "bg-orange-50/50" : ""}`}
                    >
                      <td className="px-5 py-3 font-mono text-xs">{t.id}</td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-800 truncate max-w-[200px]" title={t.companyName}>
                          {t.companyName}
                        </div>
                        {t.email && (
                          <div className="text-xs text-slate-400 truncate max-w-[200px]">
                            {t.email}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500 truncate max-w-[140px]" title={t.schemaName}>
                        {t.schemaName}
                      </td>
                      <td className="px-5 py-3 text-right font-mono">
                        {t.smsLimit.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-mono">{t.smsCounter.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right font-mono">
                        {t.actualCount === -1 ? (
                          <span className="text-orange-400">N/A</span>
                        ) : (
                          t.actualCount.toLocaleString()
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold">
                        {isError ? (
                          <span className="text-orange-500">—</span>
                        ) : isMismatch ? (
                          <span className={t.diff > 0 ? "text-red-600" : "text-amber-600"}>
                            {t.diff > 0 ? "+" : ""}
                            {t.diff.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-green-600">0</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {isError ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                            ⚠️ Error
                          </span>
                        ) : isMismatch ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                            ❌ Mismatch
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            ✅ Sync
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {t.lastMessageAt
                          ? new Date(t.lastMessageAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                      {search || statusFilter !== "all"
                        ? "No tenants match the filter."
                        : "No tenant data available."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Quick Actions</h3>
        <div className="flex gap-3 flex-wrap items-center">
          <button
            onClick={() => {
              const csv = [
                ["ID", "Company", "Email", "Schema", "Limit", "Counter", "Actual", "Diff", "Status"],
                ...sorted.map((t) => [
                  t.id,
                  t.companyName,
                  t.email,
                  t.schemaName,
                  t.smsLimit,
                  t.smsCounter,
                  t.actualCount,
                  t.diff,
                  t.status,
                ]),
              ]
                .map((r) => r.join(","))
                .join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `sms-counter-audit-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="border border-green-300 text-green-700 px-4 py-2 rounded-lg text-sm hover:bg-green-50 font-medium transition"
          >
            📥 Export CSV
          </button>
          <div className="text-xs text-slate-400 border-l border-slate-200 pl-4 ml-1">
            To fix mismatched counters, run via SSH:
            <code className="mx-1 px-1.5 py-0.5 bg-slate-100 rounded text-[11px] font-mono text-slate-700">
              /opt/net2app/recount-sms-counter.sh
            </code>
            <span className="block mt-0.5 text-slate-400">
              ⏰ Auto-runs nightly at 2:00 AM
            </span>
          </div>
        </div>
      </div>

      {/* Summary section */}
      {summary && summary.totalMismatch > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-amber-800">
                {summary.mismatched} tenant(s) out of sync
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                Total discrepancy of <strong>{summary.totalMismatch.toLocaleString()}</strong> SMS.
                The nightly recount cron at 2:00 AM will fix this automatically.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
