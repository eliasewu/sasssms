"use client";

import { useState, useEffect, useCallback } from "react";

interface DlrOverview {
  total_profit: string;
  total_revenue: string;
  total_cost: string;
  total_messages: number;
  delivered: number;
  failed: number;
  pending: number;
}

interface DlrSummary {
  status: string;
  count: number;
  total_cost: string;
  total_profit: string;
}

interface SupplierDlr {
  supplierId: number;
  supplierName: string;
  host: string;
  connectionType: string;
  bindStatus: string;
  delivered: number;
  pending: number;
  failed: number;
  revenue: number;
  cost: number;
  profit: number;
}

interface RecentMessage {
  id: number;
  message_id: string;
  supplier_message_id: string | null;
  sender: string;
  destination: string;
  content: string;
  status: string;
  dlr_status: string | null;
  dlr_timestamp: string | null;
  cost: string;
  supplier_cost: string;
  profit: string;
  supplier_id: number;
  supplier_name: string | null;
  client_name: string | null;
  connection_type: string;
  created_at: string;
}

interface HourlyTrend {
  hour: string;
  delivered: number;
  failed: number;
  pending: number;
  total: number;
}

interface DlrStats {
  overview: DlrOverview;
  dlrSummary: DlrSummary[];
  suppliers: SupplierDlr[];
  recentMessages: RecentMessage[];
  hourlyTrend: HourlyTrend[];
  periodHours: number;
}

const statusBadge = (status: string | null) => {
  const s = (status || "PENDING").toUpperCase();
  if (s === "DELIVERED") return { bg: "bg-green-100", text: "text-green-700", icon: "✅", label: "DELIVERED" };
  if (s === "FAILED") return { bg: "bg-red-100", text: "text-red-700", icon: "❌", label: "FAILED" };
  return { bg: "bg-amber-100", text: "text-amber-700", icon: "⏳", label: "PENDING" };
};

export default function DlrStatusPage() {
  const [stats, setStats] = useState<DlrStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState(24);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/tenant/dlr-stats?hours=${hours}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setStats(data);
    } catch (e) {
      console.error("Failed to load DLR stats:", e);
      setError("Failed to load DLR statistics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const i = setInterval(load, 30000); // auto-refresh every 30s
    return () => clearInterval(i);
  }, [load]);

  const fmtMoney = (v: string | number) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return `$${n.toFixed(4)}`;
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 animate-pulse">D</div>
          <p className="text-slate-500">Loading DLR statistics...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-4xl mb-4">📬</div>
          <p className="text-red-500 font-medium mb-2">{error}</p>
          <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filteredMessages = selectedSupplier
    ? (stats?.recentMessages || []).filter(m => m.supplier_id === selectedSupplier)
    : (stats?.recentMessages || []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">DLR Status</h2>
          <p className="text-sm text-slate-500">Delivery receipt tracking — monitor message delivery in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={hours}
            onChange={e => setHours(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value={1}>Last hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={12}>Last 12 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={72}>Last 3 days</option>
            <option value={168}>Last 7 days</option>
          </select>
          <button onClick={load} className="px-3 py-2 text-sm border rounded-lg hover:bg-slate-50 transition bg-white">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-slate-800">{stats?.overview.total_messages || 0}</p>
          <p className="text-xs text-slate-500 mt-1">Total Messages</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center shadow-sm ring-2 ring-green-200">
          <p className="text-2xl font-bold text-green-600">{stats?.overview.delivered || 0}</p>
          <p className="text-xs text-slate-500 mt-1">✅ Delivered</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center shadow-sm ring-2 ring-amber-200">
          <p className="text-2xl font-bold text-amber-600">{stats?.overview.pending || 0}</p>
          <p className="text-xs text-slate-500 mt-1">⏳ Pending</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center shadow-sm ring-2 ring-red-200">
          <p className="text-2xl font-bold text-red-600">{stats?.overview.failed || 0}</p>
          <p className="text-xs text-slate-500 mt-1">❌ Failed</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-blue-600">{fmtMoney(stats?.overview.total_revenue || 0)}</p>
          <p className="text-xs text-slate-500 mt-1">Revenue</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-slate-600">{fmtMoney(stats?.overview.total_cost || 0)}</p>
          <p className="text-xs text-slate-500 mt-1">Cost</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center shadow-sm">
          <p className={`text-2xl font-bold ${(parseFloat(stats?.overview.total_profit || "0")) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {fmtMoney(stats?.overview.total_profit || 0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Profit</p>
        </div>
      </div>

      {/* Supplier DLR Breakdown */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-slate-50">
          <h3 className="font-semibold text-slate-800">Supplier DLR Breakdown</h3>
          <p className="text-xs text-slate-500">Delivery status per supplier — click a supplier to filter messages below</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">Supplier</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">Host</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">Bind</th>
                <th className="text-center px-4 py-2.5 font-medium text-green-600 text-xs">Delivered</th>
                <th className="text-center px-4 py-2.5 font-medium text-amber-600 text-xs">Pending</th>
                <th className="text-center px-4 py-2.5 font-medium text-red-600 text-xs">Failed</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs">Revenue</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs">Cost</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs">Profit</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.suppliers || []).map(s => (
                <tr
                  key={s.supplierId}
                  onClick={() => setSelectedSupplier(selectedSupplier === s.supplierId ? null : s.supplierId)}
                  className={`border-b cursor-pointer transition-colors ${
                    selectedSupplier === s.supplierId
                      ? "bg-blue-50 hover:bg-blue-100"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-800">{s.supplierName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.host}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">{s.connectionType}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      s.bindStatus === "BOUND" ? "bg-green-100 text-green-700" :
                      s.bindStatus === "N/A" ? "bg-slate-100 text-slate-500" :
                      "bg-red-100 text-red-700"
                    }`}>{s.bindStatus}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-green-600">{s.delivered}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-amber-600">{s.pending}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-red-600">{s.failed}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{fmtMoney(s.revenue)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{fmtMoney(s.cost)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-medium">
                    <span className={s.profit >= 0 ? "text-emerald-600" : "text-red-600"}>{fmtMoney(s.profit)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(stats?.suppliers || []).length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm">No DLR data for selected period</div>
        )}
      </div>

      {/* Hourly DLR Trend Chart (text-based bar chart) */}
      {(stats?.hourlyTrend || []).length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-slate-50">
            <h3 className="font-semibold text-slate-800">DLR Trend (Last {hours}h)</h3>
            <p className="text-xs text-slate-500">Hourly delivery receipt activity</p>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {stats!.hourlyTrend.map((h) => {
                const max = Math.max(h.total, 1);
                const delPct = (h.delivered / max) * 100;
                const failPct = (h.failed / max) * 100;
                const pendPct = (h.pending / max) * 100;
                return (
                  <div key={h.hour} className="flex items-center gap-3 text-xs">
                    <span className="w-16 text-right font-mono text-slate-500 shrink-0">
                      {new Date(h.hour).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden flex">
                      {delPct > 0 && (
                        <div className="bg-green-400 h-full transition-all" style={{ width: `${delPct}%` }} title={`Delivered: ${h.delivered}`} />
                      )}
                      {failPct > 0 && (
                        <div className="bg-red-400 h-full transition-all" style={{ width: `${failPct}%` }} title={`Failed: ${h.failed}`} />
                      )}
                      {pendPct > 0 && (
                        <div className="bg-amber-300 h-full transition-all" style={{ width: `${pendPct}%` }} title={`Pending: ${h.pending}`} />
                      )}
                    </div>
                    <span className="w-8 text-right font-mono text-slate-500">{h.total}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 justify-center text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400" /> Delivered</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> Failed</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-300" /> Pending</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Messages with DLR */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-slate-800">
              Recent Messages {selectedSupplier ? `— ${stats?.suppliers.find(s => s.supplierId === selectedSupplier)?.supplierName || ""}` : ""}
            </h3>
            <p className="text-xs text-slate-500">Latest 50 messages with DLR status</p>
          </div>
          {selectedSupplier && (
            <button
              onClick={() => setSelectedSupplier(null)}
              className="text-xs px-2 py-1 bg-slate-100 rounded hover:bg-slate-200 transition"
            >
              ✕ Clear filter
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Message ID</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Destination</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Supplier</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Send</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">DLR</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Cost</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Profit</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">DLR Time</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredMessages.map(m => {
                const sendBadge = m.status === "SENT" || m.status === "DELIVERED"
                  ? { bg: "bg-green-100", text: "text-green-700" }
                  : m.status === "FAILED"
                    ? { bg: "bg-red-100", text: "text-red-700" }
                    : { bg: "bg-slate-100", text: "text-slate-600" };
                const dlrBadge = statusBadge(m.dlr_status);
                return (
                  <tr key={m.id} className="border-b hover:bg-blue-50/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-[11px] text-blue-600 max-w-[160px] truncate" title={m.message_id}>
                      {m.message_id}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">{m.destination}</td>
                    <td className="px-3 py-2">
                      <span className="text-[11px]">{m.supplier_name || `S#${m.supplier_id}`}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sendBadge.bg} ${sendBadge.text}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${dlrBadge.bg} ${dlrBadge.text}`}>
                        {dlrBadge.icon} {dlrBadge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px]">{fmtMoney(m.cost)}</td>
                    <td className="px-3 py-2 text-right font-mono text-[11px]">
                      <span className={parseFloat(m.profit || "0") >= 0 ? "text-emerald-600" : "text-red-600"}>
                        {fmtMoney(m.profit)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[10px] whitespace-nowrap text-slate-500">
                      {m.dlr_timestamp ? new Date(m.dlr_timestamp).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-[10px] whitespace-nowrap text-slate-500">
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredMessages.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm">
            📝 No messages found for the selected period{selectedSupplier ? " and supplier" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
