"use client";

import { useState, useEffect, useCallback } from "react";

interface Crash {
  id: number;
  device_id: string | null;
  username: string | null;
  device_model: string | null;
  android_version: string | null;
  app_version: string | null;
  process: string | null;
  crash_type: string | null;
  message: string | null;
  stack_trace: string | null;
  logcat: string | null;
  js_log: string | null;
  app_state: string | null;
  created_at: string;
}

export default function SuperCrashesPage() {
  const [crashes, setCrashes] = useState<Crash[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Crash | null>(null);
  const [error, setError] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("");

  const load = useCallback(async (deviceId?: string) => {
    const q = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : "";
    const r = await fetch(`/api/super/crashes${q}`).then((res) => res.json());
    if (r.error) { setError(r.error); setCrashes([]); return; }
    setCrashes(r.crashes || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: number) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    const r = await fetch(`/api/super/crashes/${id}`).then((res) => res.json());
    if (!r.error) { setDetail(r.crash); setOpenId(id); }
  };

  const remove = async (id: number) => {
    await fetch(`/api/super/crashes?id=${id}`, { method: "DELETE" });
    load();
    setDetail(null); setOpenId(null);
  };

  const clearAll = async () => {
    if (!confirm("Delete ALL crash reports?")) return;
    await fetch("/api/super/crashes?clear=1", { method: "DELETE" });
    load();
  };

  const colorFor = (t: string | null) => {
    const type = (t || "").toLowerCase();
    if (type.includes("native")) return "bg-red-100 text-red-700";
    if (type.includes("fatal")) return "bg-red-100 text-red-700";
    if (type.includes("boundary")) return "bg-amber-100 text-amber-700";
    return "bg-orange-100 text-orange-700";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Android Gateway Crash Reports</h1>
          <p className="text-sm text-slate-500">
            JS exceptions + native crashes + logcat tails uploaded by the Net2APP APK.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            placeholder="Filter by device id"
            className="border rounded-lg px-3 py-1.5 text-sm w-56"
            onKeyDown={(e) => { if (e.key === "Enter") load(deviceFilter || undefined); }}
          />
          <button onClick={() => load(deviceFilter || undefined)} className="bg-slate-800 text-white text-sm rounded-lg px-4 py-1.5 hover:bg-slate-700">
            Filter
          </button>
          <button onClick={() => { setDeviceFilter(""); load(); }} className="border text-sm rounded-lg px-3 py-1.5 hover:bg-slate-50">
            Reset
          </button>
          <button onClick={clearAll} className="bg-red-50 text-red-600 border border-red-200 text-sm rounded-lg px-3 py-1.5 hover:bg-red-100">
            Clear all
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!crashes && <p className="text-slate-400 text-sm p-6 animate-pulse">Loading…</p>}

      {crashes && crashes.length === 0 && (
        <div className="bg-white rounded-xl border p-10 text-center">
          <p className="text-3xl mb-2">📱</p>
          <p className="text-slate-500 font-medium">No crash reports yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Reports appear here when an installed gateway APK hits an error.
          </p>
        </div>
      )}

      {crashes && crashes.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b bg-slate-50">
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Device</th>
                  <th className="px-4 py-2.5">Android</th>
                  <th className="px-4 py-2.5">Supplier</th>
                  <th className="px-4 py-2.5">Process</th>
                  <th className="px-4 py-2.5">Message</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {crashes.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => openDetail(c.id)}>
                    <td className="px-4 py-2.5 text-slate-400">{c.id}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                      {new Date(c.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colorFor(c.crash_type)}`}>
                        {c.crash_type || "js"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{c.device_model || "?"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.android_version || "?"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.username || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded ${c.process === "headless" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
                        {c.process || "ui"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 max-w-[280px] truncate text-slate-700">{c.message || ""}</td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => remove(c.id)} className="text-xs text-red-500 hover:text-red-700 px-2">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Crash #{detail.id} — {detail.message}</h3>
            <div className="flex gap-2">
              <button onClick={() => remove(detail.id)} className="text-xs text-red-500 hover:text-red-700 px-2">Delete</button>
              <button onClick={() => { setDetail(null); setOpenId(null); }} className="text-xs text-slate-500 hover:text-slate-700 px-2">Close</button>
            </div>
          </div>
          <div className="p-5 grid gap-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-slate-400">Device ID</p><p className="font-mono text-xs text-slate-700">{detail.device_id || "—"}</p></div>
              <div><p className="text-xs text-slate-400">Model</p><p className="text-slate-700">{detail.device_model || "—"}</p></div>
              <div><p className="text-xs text-slate-400">Android</p><p className="text-slate-700">{detail.android_version || "—"}</p></div>
              <div><p className="text-xs text-slate-400">App version</p><p className="text-slate-700">{detail.app_version || "—"}</p></div>
            </div>

            {detail.stack_trace && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Stack trace</p>
                <pre className="bg-slate-950 text-emerald-300 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{detail.stack_trace}</pre>
              </div>
            )}
            {detail.js_log && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">App JS log (last lines)</p>
                <pre className="bg-slate-950 text-slate-300 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{detail.js_log}</pre>
              </div>
            )}
            {detail.logcat && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Logcat</p>
                <pre className="bg-slate-950 text-amber-200 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{detail.logcat}</pre>
              </div>
            )}
            {detail.app_state && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">App state</p>
                <pre className="bg-slate-50 border rounded-lg p-3 text-xs text-slate-600 whitespace-pre-wrap">{detail.app_state}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
