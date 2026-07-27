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
  sids: string[];
  originalSids: string[];  // for Cancel
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
  const [ruleName, setRuleName] = useState("Random SID Rule");
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

      // Load MCC/MNC tree, clients, suppliers, and existing profile in parallel
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
            mcc: op.mcc,
            mnc: op.mnc,
            mccmnc: op.mccmnc,
            countryName: country.countryName,
            networkName: op.networkName,
          });
        }
      }

      // Load existing RANDOM_SID profile with pool items
      let sidsByMccmnc = new Map<string, string[]>();
      let existingScope: "client" | "supplier" | "both" = "both";
      let existingEntityId: number | null = null;
      let existingPriority = 1;
      let existingName = "Random SID Rule";

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
              const key = item.mccmnc || (item.mcc && item.mnc ? item.mcc + item.mnc : "global");
              if (!sidsByMccmnc.has(key)) sidsByMccmnc.set(key, []);
              const val = item.replacementValue || item.replacement_value || "";
              if (val) sidsByMccmnc.get(key)!.push(val);
            }
          }
        }
      } catch { /* no profile yet */ }

      setRuleName(existingName);
      setScope(existingScope);
      setEntityId(existingEntityId);
      setPriority(existingPriority);

      // Merge: each operator gets its SID pool (or empty)
      const merged: McmcOperator[] = flat.map(op => {
        const key = op.mccmnc;
        const sids = sidsByMccmnc.get(key) || [];
        sidsByMccmnc.delete(key); // mark as consumed
        return { ...op, sids: sids.length > 0 ? sids : [""], originalSids: [...sids] };
      });

      // Add any unmapped pool items (no matching operator)
      for (const [key, sids] of sidsByMccmnc) {
        if (sids.length > 0) {
          merged.push({
            mcc: key.slice(0, 3), mnc: key.slice(3), mccmnc: key,
            countryName: "Unknown", networkName: "Unknown",
            sids, originalSids: [...sids],
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

  // Per-operator SID pool management
  const addSid = (opIdx: number) => {
    setOperators(prev => prev.map((op, i) =>
      i === opIdx ? { ...op, sids: [...op.sids, ""] } : op
    ));
  };

  const updateSid = (opIdx: number, sidIdx: number, value: string) => {
    setOperators(prev => prev.map((op, i) => {
      if (i !== opIdx) return op;
      const sids = [...op.sids];
      sids[sidIdx] = value;
      return { ...op, sids };
    }));
  };

  const removeSid = (opIdx: number, sidIdx: number) => {
    setOperators(prev => prev.map((op, i) => {
      if (i !== opIdx) return op;
      return { ...op, sids: op.sids.filter((_, j) => j !== sidIdx) };
    }));
  };

  const cancelOperator = (opIdx: number) => {
    const op = operators[opIdx];
    setOperators(prev => prev.map((o, i) =>
      i === opIdx ? { ...o, sids: op.originalSids.length > 0 ? [...op.originalSids] : [""] } : o
    ));
    setMsg(`Reverted ${op.countryName} / ${op.networkName}`);
    setTimeout(() => setMsg(""), 2000);
  };

  const isDirty = (opIdx: number) => {
    const op = operators[opIdx];
    const orig = op.originalSids.filter(s => s.trim());
    const curr = op.sids.filter(s => s.trim());
    if (orig.length !== curr.length) return true;
    return !orig.every((s, i) => s === curr[i]);
  };

  const totalSids = operators.reduce((sum, op) => sum + op.sids.filter(s => s.trim()).length, 0);
  const dirtyCount = operators.filter((_, i) => isDirty(i)).length;

  // Save all
  const saveAll = async () => {
    try {
      setSaving(true); setError(null);

      // Delete old profile
      if (activeProfileId) {
        await fetch(`/api/tenant/sms-translations/${activeProfileId}`, { method: "DELETE" });
      }

      // Create new profile
      const name = ruleName || `RANDOM_SID_${selection.label.replace(/[^a-zA-Z0-9]/g, "_")}`;
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

      // Upload pool entries
      const entries: string[] = [];
      for (const op of operators) {
        for (const sid of op.sids.filter(s => s.trim())) {
          entries.push(op.mccmnc ? `${op.mccmnc}:${sid.trim()}` : sid.trim());
        }
      }
      if (entries.length > 0) {
        const uploadRes = await fetch(`/api/tenant/sms-translations/${profileId}/upload`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-replace-all": "true" },
          body: JSON.stringify({ entries }),
        });
        if (!uploadRes.ok) throw new Error(`Upload failed: HTTP ${uploadRes.status}`);
      }

      setMsg(`Saved ${entries.length} SID mappings across ${operators.filter(op => op.sids.some(s => s.trim())).length} operators!`);
      setTimeout(() => setMsg(""), 3000);
      loadAll();
    } catch (err) {
      setError("Failed to save. " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Quick test
  const runQuickTest = () => {
    const match = operators.find(op => op.mccmnc === quickTestMccmnc && op.sids.some(s => s.trim()));
    if (match) {
      const valid = match.sids.filter(s => s.trim());
      const random = valid[Math.floor(Math.random() * valid.length)];
      setQuickTestResult(random);
    } else {
      setQuickTestResult("(no SIDs for this MCC/MNC)");
    }
  };

  // Filter
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

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Random SID — MCC/MNC → SID Mapping</h2>
          <p className="text-xs text-slate-400">Assign random sender IDs per operator. Each MCC/MNC gets its own SID pool.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{operators.length} operators</span>
          <button onClick={saveAll} disabled={saving}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
            {saving ? "Saving..." : "Save All"}
          </button>
        </div>
      </div>

      {/* Quick Test */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-violet-950 border border-slate-700 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🎲</span>
          <div>
            <h3 className="text-lg font-bold text-white">Quick Random SID Test</h3>
            <p className="text-xs text-slate-400">Enter an MCC/MNC to see what random SID would be picked</p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <input value={quickTestMccmnc} onChange={e => { setQuickTestMccmnc(e.target.value); setQuickTestResult(null); }}
            onKeyDown={e => { if (e.key === "Enter") runQuickTest(); }}
            placeholder="MCCMNC (e.g. 47001)"
            className="bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none w-36" />
          <button onClick={runQuickTest} disabled={!quickTestMccmnc.trim()}
            className="bg-violet-600 hover:bg-violet-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-semibold transition shadow-lg shadow-violet-600/25">
            🎲 Random Pick
          </button>
          {quickTestResult !== null && (
            <code className={`text-lg font-mono font-bold px-4 py-2 rounded-lg ${quickTestResult.startsWith("(no") ? "bg-red-900/30 text-red-300" : "bg-emerald-900/50 text-emerald-200"}`}>
              {quickTestResult}
            </code>
          )}
        </div>
      </div>

      {/* Scope & Rule Settings */}
      <div className="bg-white border rounded-xl p-4 shadow-sm mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
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
                className="w-full border rounded px-2 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none">
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
              className="w-20 border rounded px-2 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <button onClick={saveAll} disabled={saving}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </div>
      </div>

      {/* Search + Stats */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by country, network, or MCCMNC..."
            className="border rounded-lg px-3 py-2 text-xs w-64 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          <span className="text-[10px] text-slate-400">{filtered.length} of {operators.length} shown</span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-slate-400">{totalSids} total SIDs</span>
          <span className="text-slate-400">{operators.filter(op => op.sids.some(s => s.trim())).length} operators with pools</span>
          {dirtyCount > 0 && <span className="text-amber-600 font-medium">{dirtyCount} unsaved</span>}
        </div>
      </div>

      {/* MCC/MNC → SID Mapping Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">Country</th>
                <th className="text-left px-3 py-2.5 font-medium">Network</th>
                <th className="text-left px-3 py-2.5 font-medium w-24">MCCMNC</th>
                <th className="text-left px-3 py-2.5 font-medium">SID Pool</th>
                <th className="text-center px-3 py-2.5 font-medium w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    <p className="text-2xl mb-2">📱</p>
                    <p className="text-sm">No operators found</p>
                    <p className="text-xs mt-1">Try a different search or sync MCC/MNC data</p>
                  </td>
                </tr>
              )}
              {filtered.map((op, idx) => {
                // Find real index in operators array
                const realIdx = operators.findIndex(o => o.mccmnc === op.mccmnc && o.countryName === op.countryName && o.networkName === op.networkName);
                const dirty = isDirty(realIdx);
                const hasSids = op.sids.some(s => s.trim());
                return (
                  <tr key={`${op.mccmnc}-${op.countryName}-${op.networkName}`}
                    className={`hover:bg-blue-50/30 transition-colors ${dirty ? "bg-yellow-50/30" : ""}`}>
                    <td className="px-4 py-2">
                      <span className="text-slate-700 font-medium">{op.countryName}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-slate-600">{op.networkName}</span>
                    </td>
                    <td className="px-3 py-2">
                      <code className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${hasSids ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-400"}`}>
                        {op.mccmnc}
                      </code>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {op.sids.map((sid, si) => (
                          <div key={si} className="flex items-center gap-0.5">
                            <input value={sid} onChange={e => updateSid(realIdx, si, e.target.value)}
                              placeholder="SID..."
                              className="w-28 border rounded px-1.5 py-1 text-[10px] font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" />
                            {op.sids.length > 1 && (
                              <button onClick={() => removeSid(realIdx, si)}
                                className="text-red-400 hover:text-red-600 text-[10px] px-0.5">✕</button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => addSid(realIdx)}
                          className={`text-[10px] font-medium transition ml-1 ${hasSids ? "text-blue-500 hover:text-blue-700" : "text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded"}`}>
                          + Add
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => cancelOperator(realIdx)}
                          disabled={!dirty}
                          className="text-[10px] text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed px-1"
                          title="Revert">Cancel</button>
                        {dirty && <span className="text-[8px] text-amber-500">●</span>}
                        {hasSids && (
                          <span className="text-[10px] text-slate-400">
                            {op.sids.filter(s => s.trim()).length} SIDs
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 border-t bg-slate-50 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            {totalSids} SIDs across {operators.filter(op => op.sids.some(s => s.trim())).length} operators
          </span>
          <button onClick={saveAll} disabled={saving}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
            {saving ? "Saving..." : `Save ${dirtyCount > 0 ? `(${dirtyCount} changes)` : "All"}`}
          </button>
        </div>
      </div>

      {/* Help */}
      <div className="mt-4 bg-slate-50 border rounded-xl p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-2">💡 How Random SID Mapping Works</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>MCC/MNC:</strong> Each operator gets its own pool of Sender IDs. When a message routes through that operator, one SID is randomly picked.</li>
          <li><strong>Add SIDs:</strong> Click <strong>+ Add</strong> next to any operator to add sender IDs to their pool.</li>
          <li><strong>Quick Test:</strong> Enter an MCC/MNC code at the top to simulate which SID would be randomly selected.</li>
          <li><strong>Cancel:</strong> Per-operator Cancel reverts unsaved SID changes. Click <strong>Save All</strong> to persist.</li>
          <li><strong>Scope:</strong> Controls which client or supplier this entire SID mapping applies to.</li>
        </ul>
      </div>
    </div>
  );
}
