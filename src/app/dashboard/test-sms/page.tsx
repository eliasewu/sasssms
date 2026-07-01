"use client";

import { useState, useEffect, useCallback } from "react";

interface Client { id: number; name: string; connection_type: string; route_plan_id: number; }
interface Route { id: number; name: string; trunk_name: string; country_code: string; prefix: string; is_active?: boolean; }
interface TestResult { message?: Record<string,unknown>; routing?: { route: string; trunk: string; supplier: string; connectionType: string }; cost?: number; error?: string; freeCredits?: { before: number; after: number; total: number; usedTotal: number } }
interface FreeCredits { freeCredits: number; totalCredits: number; usedCredits: number; packageType: string }

export default function RouteBasedTestSmsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [credits, setCredits] = useState<FreeCredits | null>(null);
  const [form, setForm] = useState({ clientId: "", routeId: "", sender: "TEST", destination: "", content: "Test SMS" });
  const [result, setResult] = useState<TestResult | null>(null);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Array<{ time: string; destination: string; status: string; route: string; free: boolean }>>([]);

  const load = useCallback(async () => {
    const [cr, rr, tr] = await Promise.all([
      fetch("/api/tenant/clients").then(r => r.json()),
      fetch("/api/tenant/routes").then(r => r.json()),
      fetch("/api/tenant/test-sms").then(r => r.json()),
    ]);
    setClients(cr.clients || []);
    setRoutes(rr.routes || []);
    setCredits(tr);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedClient = clients.find(c => c.id === parseInt(form.clientId));

  const sendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/tenant/test-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: parseInt(form.clientId),
          sender: form.sender,
          destination: form.destination,
          content: form.content,
          testRouteId: form.routeId ? parseInt(form.routeId) : undefined,
        }),
      });
      const data = await res.json();

      // Refresh credits
      const cr = await fetch("/api/tenant/test-sms").then(r => r.json());
      setCredits(cr);

      setResult(data);
      setHistory(prev => [{
        time: new Date().toLocaleString(),
        destination: form.destination,
        status: res.ok ? "Success" : "Failed",
        route: data.routing?.route || form.routeId,
        free: res.ok,
      }, ...prev].slice(0, 30));
    } catch {
      setResult({ error: "Connection error" });
    }
    setSending(false);
  };

  const pctUsed = credits ? Math.min(100, Math.round((credits.usedCredits / Math.max(1, credits.totalCredits)) * 100)) : 0;
  const creditsColor = credits && credits.freeCredits > 5 ? "bg-green-500" : credits && credits.freeCredits > 0 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Test SMS (Route-Based)</h2>
        <p className="text-sm text-slate-500">Select a specific route to test message delivery with free credits</p>
      </div>

      {/* Free Credits Card */}
      {credits && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-semibold text-slate-800">🧪 Free Test SMS Credits</h4>
              <p className="text-xs text-slate-500">Pay-as-you-go testing allowance — does not deduct from client balance</p>
            </div>
            <div className="text-right">
              <p className={`text-4xl font-bold ${credits.freeCredits > 0 ? "text-green-600" : "text-red-500"}`}>
                {credits.freeCredits}
              </p>
              <p className="text-xs text-slate-500">of {credits.totalCredits} free</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${creditsColor}`}
              style={{ width: `${pctUsed}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-slate-400">
            <span>{credits.usedCredits} used</span>
            <span>{credits.freeCredits} remaining</span>
          </div>

          {credits.freeCredits === 0 && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
              No free test SMS remaining. <a href="/dashboard/billing" className="underline font-medium">Top up now</a> to continue testing.
            </div>
          )}
        </div>
      )}

      {/* SMS Flow Visualization */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
        <h4 className="font-semibold text-blue-800 mb-3">SMS Flow: ESME → Route Plan → Routes → Trunks → Suppliers → Mobile</h4>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {["ESME", "→", "Route Plan", "→", "Routes", "→", "Trunks", "→", "Suppliers", "→", "Mobile"].map((s, i) =>
            s === "→" ? <span key={i} className="text-blue-400 font-bold">→</span> :
            <span key={i} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium">{s}</span>
          )}
        </div>
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-700">
          <strong>DLR Flow (Reverse):</strong> Mobile → Supplier → Trunks → Routes → Route Plan → Client (HTTP/ESME Push)
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Send Route-Specific Test</h3>
          <form onSubmit={sendTest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Client *</label>
              <select value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select Client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.connection_type || "SMPP"})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Test Specific Route</label>
              <select value={form.routeId} onChange={e => setForm({...form, routeId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Auto (use route plan)</option>
                {routes.filter(r => r.is_active !== false).map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} → {r.trunk_name} {r.country_code ? `(${r.country_code})` : ""} {r.prefix || ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Select a specific route to test, or leave empty for auto-routing</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Sender ID</label>
                <input value={form.sender} onChange={e => setForm({...form, sender: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Destination *</label>
                <input value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} required placeholder="+254755424815" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={3} required className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>

            {selectedClient && (
              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                <p><span className="text-slate-500">Client Type:</span> <strong>{selectedClient.connection_type || "SMPP"}</strong></p>
                <p><span className="text-slate-500">Route Plan:</span> <strong>{selectedClient.route_plan_id ? `#${selectedClient.route_plan_id}` : "None"}</strong></p>
              </div>
            )}

            {credits && credits.freeCredits <= 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                ⚠️ All {credits.totalCredits} free test SMS used. Visit <strong>Billing</strong> to top up.
              </div>
            )}

            <button
              disabled={sending || !form.clientId || (credits !== null && credits.freeCredits <= 0)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition"
            >
              {sending ? "Sending..." : credits === null ? "Loading credits..." : credits.freeCredits === 0 ? "No Free Credits Left" : `Send Free Test SMS (${credits.freeCredits} left)`}
            </button>
          </form>

          {result && (
            <div className={`mt-4 rounded-lg p-4 border ${result.error ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"}`}>
              {result.error ? (
                <p className="text-sm">{result.error}</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-base">✓ Test Message Sent</p>
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">FREE</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">Route: {result.routing?.route}</span>
                    <span>→</span>
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">Trunk: {result.routing?.trunk}</span>
                    <span>→</span>
                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">Supplier: {result.routing?.supplier}</span>
                  </div>
                  <p>Connection: {result.routing?.connectionType} | Cost: <span className="font-bold text-green-600">$0.00 (Free)</span></p>
                  {result.freeCredits && (
                    <div className="bg-blue-50 rounded-lg p-2 text-xs">
                      <span className="text-slate-500">Credits:</span> {result.freeCredits.before} → <strong>{result.freeCredits.after}</strong> ({result.freeCredits.usedTotal} / {result.freeCredits.total} used)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Test History with credits tracking */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Test History</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between border-b pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono">{h.destination}</p>
                    {h.free && <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-medium">FREE</span>}
                  </div>
                  <p className="text-xs text-slate-500">{h.time} • Route: {h.route}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${h.status === "Success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{h.status}</span>
              </div>
            ))}
            {history.length === 0 && <p className="text-slate-400 text-sm py-8 text-center">No tests sent yet. Use your 20 free credits!</p>}
          </div>
        </div>
      </div>

      {/* Available Routes Quick Reference */}
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <h4 className="font-semibold mb-3">All Available Routes</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {routes.filter(r => r.is_active !== false).map(r => (
            <div key={r.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-slate-500">→ {r.trunk_name} {r.country_code ? `(${r.country_code})` : ""}</p>
              </div>
              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{r.prefix || "Any"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
