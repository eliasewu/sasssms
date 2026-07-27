"use client";

import { useState, useEffect, useCallback } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";

interface McmcOperator {
  mcc: string;
  mnc: string;
  mccmnc: string;
  countryName: string;
  networkName: string;
  sid: string;            // single SID — one per operator
  originalSid: string;    // for Cancel
}

interface ClientSupplier {
  id: number;
  name: string;
}

export default function RandomSidTranslationPage() {
  const { selection } = useMccMnc();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [operators, setOperators] = useState<McmcOperator[]>([]);
  const [clients, setClients] = useState<ClientSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);

  // Scope
  const [scope, setScope] = useState<"client" | "supplier" | "both">("both");
  const [entityId, setEntityId] = useState<number | null>(null);
  const [priority, setPriority] = useState(1);
  const [ruleName, setRuleName] = useState("SID Mapping Rule");
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);

  // Quick Test
  const [quickTestMccmnc, setQuickTestMccmnc] = useState("47001");
  const [quickTestResult, setQuickTestResult] = useState<string | null>(null);

  // Search / filter
  const [search, setSearch] = useState("");

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [mccRes, cRes, sRes] = await Promise.all([
        fetch("/api/tenant/mccmnc").then(r => r.json()).catch(() => ({ countries: [] })),
        fetch("/api/tenant/clients").then(r => r.json()).catch(() => ({ clients: [] })),
        fetch("/api/tenant/suppliers").then(r => r.json()).catch(() => ({ suppliers: [] })),
      ]);

      setClients(cRes.clients || []);
      setSuppliers(sRes.suppliers || []);

      // Flatten MCC/MNC tree
      const flat: { mcc: string; mnc: string; mccmnc: string; countryName: string; networkName: string; }[] = [];
      for (const country of (mccRes.countries || [])) {
        for (const op of (country.operators || [])) {
          flat.push({
            mcc: op.mcc, mnc: op.mnc, mccmnc: op.mccmnc,
            countryName: country.countryName, networkName: op.networkName,
          });
        }
      }

      // Load existing profile
      let sidByMccmnc = new Map<string, string>();
      let existingScope: "client" | "supplier" | "both" = "both";
      let existingEntityId: number | null = null;
      let existingPriority = 1;
      let existingName = "SID Mapping Rule";

      try {
        const params = new URLSearchParams();
        params.set("category", "RANDOM_SID");
        const profileRes = await fetch(`/api/tenant/sms-translations?${params}`);
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          const profiles = (profileData.profiles || []) as any[];
          if (profiles.length > 0) {
            const first = profiles[0];
            setActiveProfileId(first.id);
            existingName = first.name;
            const a = (first.assignments || []).find((x: any) => x.isActive !== false);
            existingPriority = a?.priority || 1;
            if (a?.clientId) { existingScope = "client"; existingEntityId = a.clientId; }
            else if (a?.supplierId) { existingScope = "supplier"; existingEntityId = a.supplierId; }

            const pool = (first.pool_items || first.poolItems || []) as any[];
            for (const item of pool) {
              const key = item.mccmnc || (item.mcc && item.mnc ? item.mcc + item.mnc : "");
              const val = item.replacementValue || item.replacement_value || "";
              if (key && val) sidByMccmnc.set(key, val); // only one SID per MCCMNC
            }
          }
        }
      } catch { /* no profile */ }

      setRuleName(existingName);
      setScope(existingScope);
      setEntityId(existingEntityId);
      setPriority(existingPriority);

      // Merge
      const merged: McmcOperator[] = flat.map(op => {
        const sid = sidByMccmnc.get(op.mccmnc) || "";
        sidByMccmnc.delete(op.mccmnc);
        return { ...op, sid, originalSid: sid };
      });

      // Any leftover mappings
      for (const [key, sid] of sidByMccmnc) {
        if (sid) {
          merged.push({
            mcc: key.slice(0, 3), mnc: key.slice(3), mccmnc: key,
            countryName: "Unknown", networkName: "Unknown",
            sid, originalSid: sid,
          });
        }
      }

      setOperators(merged);
    } catch (err) {
      setError("Failed to load. " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const updateSid = (opIdx: number, value: string) => {
    setOperators(prev => prev.map((op, i) =>
      i === opIdx ? { ...op, sid: value } : op
    ));
  };

  const cancelOperator = (opIdx: number) => {
    const op = operators[opIdx];
    setOperators(prev => prev.map((o, i) =>
      i === opIdx ? { ...o, sid: op.originalSid } : o
    ));
    setMsg(`Reverted ${op.countryName} / ${op.networkName}`);
    setTimeout(() => setMsg(""), 2000);
  };

  const isDirty = (opIdx: number) => {
    const op = operators[opIdx];
    return op.sid !== op.originalSid;
  };

  const mappedCount = operators.filter(op => op.sid.trim()).length;
  const totalCount = operators.length;
  const dirtyCount = operators.filter((_, i) => isDirty(i)).length;

  const saveAll = async () => {
    try {
      setSaving(true); setError(null);

      if (activeProfileId) {
        await fetch(`/api/tenant/sms-translations/${activeProfileId}`, { method: "DELETE" });
      }

      const name = ruleName || "SID_Mapping";
      const createRes = await fetch("/api/tenant/sms-translations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, targetField: "SENDER", category: "RANDOM_SID", mode: "RANDOM",
          matchPattern: ".*", scope, entityId, priority,
        }),
      });
      if (!createRes.ok) throw new Error(`Create failed: HTTP ${createRes.status}`);
      const createData = await createRes.json();
      const profileId = createData.profile?.id;
      if (!profileId) throw new Error("No profile ID returned");
      setActiveProfileId(profileId);

      const entries: string[] = [];
      for (const op of operators) {
        if (op.sid.trim()) {
          entries.push(`${op.mccmnc}:${op.sid.trim()}`);
        }
      }
      if (entries.length > 0) {
        await fetch(`/api/tenant/sms-translations/${profileId}/upload`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-replace-all": "true" },
          body: JSON.stringify({ entries }),
        });
      }

      setMsg(`Saved ${entries.length} SID mappings! ${mappedCount} of ${totalCount} operators mapped.`);
      setTimeout(() => setMsg(""), 3000);
      loadAll();
    } catch (err) {
      setError("Failed to save. " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const runQuickTest = () => {
    const match = operators.find(op => op.mccmnc === quickTestMccmnc && op.sid.trim());
    if (match) {
      setQuickTestResult(match.sid.trim());
    } else {
      setQuickTestResult("(no SID for this MCC/MNC)");
    }
  };

  const filtered = operators.filter(op => {
    if (!search) return true;
    const q = search.toLowerCase();
    return op.mccmnc.includes(q) || op.countryName.toLowerCase().includes(q) || op.networkName.toLowerCase().includes(q);
  });

  if (loading) return <Spinner />;

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">X</button>
        </div>
      )}
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">{msg}</div>}

      {/* Header + How it works */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">SID Mapping — MCC/MNC → Sender ID</h2>
            <p className="text-xs text-slate-400">Assign a specific sender ID to each MCCMNC destination</p>
          </div>
          <button onClick={saveAll} disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
            {saving ? "Saving..." : "Save All Mappings"}
          </button>
        </div>

        {/* How it works + progress */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">💡 How it works</h4>
              <p className="text-xs text-blue-600 leading-relaxed">
                Find a country/operator below, type the sender ID you want to use, and click <strong>Save All Mappings</strong>. 
                The platform will automatically use that SID for SMS sent to that destination.
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Assign a specific sender ID to each MCCMNC. When an SMS is sent to a destination matching that MCCMNC, the assigned SID is used.
              </p>
            </div>
            <div className="shrink-0 text-center bg-white rounded-xl px-5 py-3 border border-blue-100 shadow-sm">
              <div className="text-3xl font-bold text-blue-700">{mappedCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">of {totalCount} mapped</div>
              <div className="mt-1 w-full bg-slate-200 rounded-full h-1.5">
                <div className="bg-blue-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${totalCount > 0 ? (mappedCount / totalCount) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Test */}
      <div className="flex items-center gap-3 mb-4 bg-white border rounded-xl px-4 py-3 shadow-sm">
        <span className="text-xs font-medium text-slate-600 shrink-0">Quick Test:</span>
        <input value={quickTestMccmnc} onChange={e => { setQuickTestMccmnc(e.target.value); setQuickTestResult(null); }}
          onKeyDown={e => { if (e.key === "Enter") runQuickTest(); }}
          placeholder="MCCMNC"
          className="w-28 border rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        <button onClick={runQuickTest}
          className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-medium hover:bg-slate-800 transition">
          Lookup SID
        </button>
        {quickTestResult !== null && (
          <code className={`text-sm font-mono font-bold px-3 py-1 rounded ${quickTestResult.startsWith("(no") ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
            {quickTestResult}
          </code>
        )}
      </div>

      {/* Scope */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end mb-3">
        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Rule Name</label>
          <input value={ruleName} onChange={e => setRuleName(e.target.value)}
            className="w-full border rounded px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Scope</label>
          <div className="flex gap-1">
            {(["both", "client", "supplier"] as const).map(s => (
              <button key={s} type="button" onClick={() => { setScope(s); setEntityId(null); }}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition ${scope === s ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {s === "both" ? "Global" : s === "client" ? "Client" : "Supplier"}
              </button>
            ))}
          </div>
        </div>
        {scope !== "both" && (
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">{scope === "client" ? "Client" : "Supplier"}</label>
            <select value={entityId || ""} onChange={e => setEntityId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full border rounded px-2 py-2 text-xs">
              <option value="">Select...</option>
              {(scope === "client" ? clients : suppliers).map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Priority</label>
          <input type="number" min={1} max={99} value={priority} onChange={e => setPriority(parseInt(e.target.value) || 1)}
            className="w-20 border rounded px-2 py-2 text-xs" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">{dirtyCount > 0 ? `${dirtyCount} unsaved` : ""}</span>
        </div>
      </div>

      {/* Search + Filter summary */}
      <div className="flex items-center justify-between mb-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by country, network, or MCCMNC..."
          className="border rounded-lg px-3 py-2 text-xs w-64 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        <span className="text-[10px] text-slate-400">
          Showing {filtered.length} of {totalCount} operators
          {search && (
            <button onClick={() => setSearch("")} className="ml-2 text-blue-500 hover:text-blue-700">clear</button>
          )}
        </span>
      </div>

      {/* MCC/MNC → SID Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider">
                <th className="text-left px-3 py-2.5 font-medium w-8">#</th>
                <th className="text-left px-3 py-2.5 font-medium">Country</th>
                <th className="text-left px-3 py-2.5 font-medium">Operator</th>
                <th className="text-left px-3 py-2.5 font-medium w-24">MCCMNC</th>
                <th className="text-left px-3 py-2.5 font-medium">Assigned SID</th>
                <th className="text-left px-3 py-2.5 font-medium w-20">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    <p className="text-2xl mb-2">📱</p>
                    <p className="text-sm">No operators found</p>
                  </td>
                </tr>
              )}
              {filtered.map((op) => {
                const realIdx = operators.findIndex(o => o.mccmnc === op.mccmnc && o.countryName === op.countryName && o.networkName === op.networkName);
                const dirty = isDirty(realIdx);
                const hasSid = op.sid.trim().length > 0;
                return (
                  <tr key={`${op.mccmnc}-${op.countryName}-${op.networkName}`}
                    className={`hover:bg-blue-50/30 transition-colors ${dirty ? "bg-yellow-50/30" : ""}`}>
                    <td className="px-3 py-2 text-slate-400 text-[10px] font-mono">{realIdx + 1}</td>
                    <td className="px-3 py-2">
                      <span className="text-slate-700 font-medium text-[11px]">{op.countryName}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-slate-600 text-[11px]">{op.networkName}</span>
                    </td>
                    <td className="px-3 py-2">
                      <code className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded ${hasSid ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}>
                        {op.mccmnc}
                      </code>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={op.sid}
                          onChange={e => updateSid(realIdx, e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); } }}
                          placeholder="Type sender ID..."
                          className={`border rounded-lg px-3 py-2 text-[11px] font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-56 ${hasSid ? "bg-blue-50/30 border-blue-200" : "bg-white"}`}
                        />
                        {hasSid && (
                          <button onClick={() => { updateSid(realIdx, ""); }}
                            className="text-red-400 hover:text-red-600 text-[10px] px-1" title="Clear">✕</button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {dirty ? (
                        <button onClick={() => cancelOperator(realIdx)}
                          className="text-[10px] text-amber-600 hover:text-amber-800 font-medium">
                          Cancel
                        </button>
                      ) : hasSid ? (
                        <span className="text-[10px] text-emerald-600 font-medium">Mapped</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 border-t bg-slate-50 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            {mappedCount} of {totalCount} operators mapped
          </span>
          <div className="flex items-center gap-2">
            {dirtyCount > 0 && (
              <span className="text-[10px] text-amber-600 font-medium">{dirtyCount} unsaved change{dirtyCount > 1 ? "s" : ""}</span>
            )}
            <button onClick={saveAll} disabled={saving}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? "Saving..." : "Save All Mappings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
