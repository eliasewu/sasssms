"use client";

import { useEffect, useState, useCallback } from "react";

interface HistoryEntry {
  id: number;
  rate_type: string;
  entity_id: number;
  entity_name: string;
  country_code: string;
  country: string;
  mcc: string;
  mnc: string;
  operator_name: string;
  old_rate: string | null;
  new_rate: string;
  action: string;
  batch_count: number | null;
  changed_by: string;
  created_at: string;
}

export default function RateHistoryModal({
  open,
  onClose,
  type,
  entityId,
  entityName,
  onReverted,
}: {
  open: boolean;
  onClose: () => void;
  type?: "client" | "supplier";
  entityId?: number;
  entityName?: string;
  onReverted?: () => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (type) q.set("type", type);
      if (entityId) q.set("entityId", String(entityId));
      const r = await fetch(`/api/tenant/rate-history?${q.toString()}`);
      const d = await r.json();
      setEntries(d.history || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [type, entityId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open) return null;

  const revert = async (id: number) => {
    setReverting(id);
    try {
      const res = await fetch(`/api/tenant/rate-history/${id}/revert`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(data.error || "Revert failed");
      else {
        onReverted?.();
        await load();
      }
    } catch {
      alert("Revert failed");
    } finally {
      setReverting(null);
    }
  };

  const fmt = (v: string | null) => (v === null || v === undefined || v === "" ? "—" : parseFloat(v).toFixed(6));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-semibold text-lg">Rate Change History</h3>
            <p className="text-xs text-slate-500">
              {entityName ? entityName : type === "client" ? "All clients" : type === "supplier" ? "All suppliers" : "All rates"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-slate-400 text-sm">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-slate-400 text-sm">No rate changes recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Entity</th>
                  <th className="text-left px-3 py-2">Destination</th>
                  <th className="text-left px-3 py-2">Old → New</th>
                  <th className="text-left px-3 py-2">Action</th>
                  <th className="text-left px-3 py-2">When</th>
                  <th className="text-left px-3 py-2">Revert</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b hover:bg-slate-50 align-top">
                    <td className="px-3 py-2 text-xs">
                      <span className="font-medium">{e.entity_name}</span>
                      <br />
                      <span className="text-slate-400">{e.rate_type}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {e.country || e.country_code || "—"}
                      {e.action === "BULK_IMPORT" && e.batch_count ? (
                        <span className="text-purple-600 font-medium"> · {e.batch_count} networks</span>
                      ) : null}
                      <br />
                      <span className="text-slate-400 font-mono">
                        {e.action !== "BULK_IMPORT" && e.mcc ? `MCC:${e.mcc}` : ""}
                        {e.action !== "BULK_IMPORT" && e.mnc ? `/MNC:${e.mnc}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {fmt(e.old_rate)} → {fmt(e.new_rate)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        e.action === "REVERT" ? "bg-amber-100 text-amber-700" : e.action === "CREATE" ? "bg-green-100 text-green-700" : e.action === "BULK_IMPORT" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {e.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {new Date(e.created_at).toLocaleString()}
                      <br />
                      {e.changed_by || ""}
                    </td>
                    <td className="px-3 py-2">
                      {e.action !== "REVERT" && (
                        <button
                          onClick={() => revert(e.id)}
                          disabled={reverting === e.id}
                          className="text-blue-600 hover:underline text-xs disabled:opacity-50"
                        >
                          {reverting === e.id ? "Reverting…" : "↩ Revert"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-6 py-4 border-t flex justify-end">
          <button onClick={onClose} className="border px-4 py-2 rounded-lg text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}
