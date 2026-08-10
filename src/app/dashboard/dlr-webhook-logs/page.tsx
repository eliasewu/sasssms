"use client";

import { useState, useEffect, useCallback } from "react";

interface DlrWebhookLog {
  id: number;
  message_id: string | null;
  dlr_status: string | null;
  pushed_to: string | null;
  http_status: number | null;
  response: string | null;
  success: boolean;
  error: string | null;
  created_at: string;
  client_name: string | null;
  client_id: number | null;
}

export default function DlrWebhookLogsPage() {
  const [logs, setLogs] = useState<DlrWebhookLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DlrWebhookLog | null>(null);
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<{ ok: boolean; text: string } | null>(null);
  const limit = 100;

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (search.trim()) params.set("messageId", search.trim());
      const r = await fetch(`/api/tenant/dlr-webhook-logs?${params}`).then(r => r.json());
      setLogs(r.logs || []);
      setTotal(r.total || 0);
    } catch {
      /* keep existing data on error */
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const i = setInterval(load, 10000); // auto-refresh every 10s
    return () => clearInterval(i);
  }, [load]);

  // Manually re-push the DLR webhook for a message (debug client integrations)
  const resend = async (messageId: string) => {
    if (!messageId) return;
    setResending(true);
    setResendResult(null);
    try {
      const res = await fetch("/api/tenant/dlr-webhook-logs/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResendResult({ ok: false, text: data.error || `HTTP ${res.status}` });
      } else {
        const log = data.log;
        const detail = log
          ? `HTTP ${log.http_status ?? "—"} · ${log.success ? "delivered" : "failed"}${log.response ? ` · ${log.response.slice(0, 200)}` : ""}${log.error ? ` · ${log.error}` : ""}`
          : "pushed (no log entry yet)";
        setResendResult({ ok: data.ok, text: detail });
        // Refresh the open detail panel so it shows the NEW attempt
        if (log) setSelected(prev => (prev ? { ...prev, ...log } : prev));
      }
      load(); // refresh the log list so the new attempt appears
    } catch {
      setResendResult({ ok: false, text: "Network error" });
    } finally {
      setResending(false);
    }
  };

  const successCount = logs.filter(l => l.success).length;
  const failedCount = logs.filter(l => !l.success).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">DLR Webhook Log</h2>
          <p className="text-sm text-slate-500">
            Verify every DLR pushed to external client webhooks — status, HTTP response, and timestamp
          </p>
        </div>
        <div className="flex gap-3">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setLoading(true); }}
            placeholder="Search message ID..."
            className="border rounded-lg px-3 py-2 text-sm w-56"
          />
          <button
            onClick={() => { setLoading(true); load(); }}
            className="border rounded-lg px-4 py-2 text-sm hover:bg-slate-50 transition"
          >
            ⟳ Refresh
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border p-3 text-center">
          <p className="text-lg font-bold text-slate-800">{total}</p>
          <p className="text-[10px] text-slate-500">Total Pushes</p>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <p className="text-lg font-bold text-green-600">{successCount}</p>
          <p className="text-[10px] text-slate-500">Delivered (2xx)</p>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <p className="text-lg font-bold text-red-600">{failedCount}</p>
          <p className="text-[10px] text-slate-500">Failed</p>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <p className="text-lg font-bold text-amber-600">
            {total > 0 ? Math.round((successCount / total) * 100) : 0}%
          </p>
          <p className="text-[10px] text-slate-500">Success Rate</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-slate-400">
          <p className="text-lg mb-2">⏳ Loading webhook log...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Time</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Msg ID</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Client</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">DLR Status</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Result</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">HTTP</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Pushed To</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr
                    key={l.id}
                    className="border-b hover:bg-blue-50/30 cursor-pointer"
                    onClick={() => { setSelected(selected?.id === l.id ? null : l); setResendResult(null); }}
                  >
                    <td className="px-3 py-2 text-[10px] whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] max-w-[140px] truncate" title={l.message_id || ""}>
                      {l.message_id || "—"}
                    </td>
                    <td className="px-3 py-2 text-[10px] max-w-[100px] truncate" title={l.client_name || ""}>
                      {l.client_name || (l.client_id ? `CL_${l.client_id}` : "—")}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          l.dlr_status === "DELIVERED"
                            ? "bg-green-100 text-green-700"
                            : l.dlr_status === "FAILED"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {l.dlr_status || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          l.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {l.success ? "OK" : "Failed"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px]">
                      <span
                        className={
                          l.http_status !== null && l.http_status >= 200 && l.http_status < 300
                            ? "text-green-600 font-bold"
                            : l.http_status !== null
                              ? "text-red-600 font-bold"
                              : "text-slate-400"
                        }
                      >
                        {l.http_status ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[10px] max-w-[220px] truncate" title={l.pushed_to || ""}>
                      {l.pushed_to || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {logs.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <p className="text-lg mb-2">📡 No DLR webhook pushes logged yet</p>
              <p className="text-sm">
                Entries appear here whenever a DLR is pushed to a client&apos;s webhook URL.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Detail panel with full response */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h3 className="font-semibold text-lg">Webhook Delivery - #{selected.id}</h3>
                <p className="text-xs text-slate-500 font-mono">{selected.message_id || "no message id"}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-lg p-4">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">DLR Status</p>
                  <p className="font-medium">{selected.dlr_status || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Delivery Result</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${selected.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {selected.success ? "Delivered (2xx)" : "Failed"}
                  </span>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">HTTP Status</p>
                  <p className="font-mono font-bold">{selected.http_status ?? "— (network error)"}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Timestamp</p>
                  <p>{new Date(selected.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="text-slate-500 text-xs mb-1">Pushed To</p>
                <p className="font-mono text-xs bg-slate-50 rounded-lg p-3 border break-all">{selected.pushed_to || "—"}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => resend(selected.message_id || "")}
                  disabled={resending || !selected.message_id}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
                  title="Re-send the DLR webhook to the client's callback URL (for debugging)"
                >
                  {resending ? "Re-sending..." : "🔁 Re-send Webhook"}
                </button>
                {resendResult && (
                  <span className={`text-xs font-mono ${resendResult.ok ? "text-green-600" : "text-red-600"}`}>
                    {resendResult.ok ? "✓ " : "✗ "}{resendResult.text}
                  </span>
                )}
              </div>

              {selected.error && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Error</p>
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3 border border-red-100">{selected.error}</p>
                </div>
              )}

              <div>
                <p className="text-slate-500 text-xs mb-1">Response Body</p>
                <pre className="text-xs bg-slate-50 rounded-lg p-3 border whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                  {selected.response || "— (no response body)"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
