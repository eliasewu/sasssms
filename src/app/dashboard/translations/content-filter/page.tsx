"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";
import { buildRegex } from "@/lib/regex-utils";

interface FilterRule {
  ruleId: number | null;
  name: string;
  matchPattern: string;
  filterMode: "blacklist" | "whitelist";
  scope: "client" | "supplier" | "both";
  entityId: number | null;
  entityName: string | null;
  priority: number;
  isActive: boolean;
  mcc: string;
  mnc: string;
}

interface ClientSupplier {
  id: number;
  name: string;
}

export default function ContentFilterPage() {
  const { selection } = useMccMnc();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rules, setRules] = useState<FilterRule[]>([]);
  const [originalRules, setOriginalRules] = useState<FilterRule[]>([]);
  const [clients, setClients] = useState<ClientSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);

  const [dragEntity, setDragEntity] = useState<{ type: "client" | "supplier"; id: number; name: string } | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [unassignedEntities, setUnassignedEntities] = useState<{ clients: ClientSupplier[]; suppliers: ClientSupplier[] }>({ clients: [], suppliers: [] });

  // Per-rule block stats (24h)
  const [blockStats, setBlockStats] = useState<Record<string, number>>({});
  const [totalBlocks, setTotalBlocks] = useState(0);

  // Quick Test
  const [quickTestContent, setQuickTestContent] = useState("Your OTP code is 252525");
  const [quickTestResult, setQuickTestResult] = useState<{ action: "blocked" | "allowed" | "none"; matchedRule: string | null } | null>(null);

  const loadRules = useCallback(async (loadedClients: ClientSupplier[], loadedSuppliers: ClientSupplier[]) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selection.mcc) params.set("mcc", selection.mcc);
      if (selection.mnc) params.set("mnc", selection.mnc);
      params.set("category", "CONTENT_FILTER");
      const res = await fetch(`/api/tenant/sms-translations?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const profiles = (data.profiles || []) as any[];

      const parsed: FilterRule[] = profiles.map((p: any) => {
        const a = (p.assignments || []).find((x: any) => x.isActive !== false);
        // Read filterMode from replacement_fixed (stores "blacklist" or "whitelist")
        const rawMode = p.replacement_fixed || "";
        const filterMode: "blacklist" | "whitelist" = rawMode === "whitelist" ? "whitelist" : "blacklist";
        return {
          ruleId: p.id,
          name: p.name,
          matchPattern: p.match_pattern || p.matchPattern || ".*",
          filterMode,
          scope: a?.clientId ? "client" : a?.supplierId ? "supplier" : "both",
          entityId: a?.clientId || a?.supplierId || null,
          entityName: a?.clientId ? loadedClients.find((c: ClientSupplier) => c.id === a.clientId)?.name || `Client #${a.clientId}` : a?.supplierId ? loadedSuppliers.find((s: ClientSupplier) => s.id === a.supplierId)?.name || `Supplier #${a.supplierId}` : null,
          priority: a?.priority || 1,
          isActive: p.is_active !== false,
          mcc: p.mcc || "",
          mnc: p.mnc || "",
        };
      });
      setRules(parsed);
      setOriginalRules(JSON.parse(JSON.stringify(parsed)));
    } catch (err) {
      setError("Failed to load filter rules. " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selection]);

  useEffect(() => {
    Promise.all([
      fetch("/api/tenant/clients").then(r => r.json()).catch(() => ({ clients: [] })),
      fetch("/api/tenant/suppliers").then(r => r.json()).catch(() => ({ suppliers: [] })),
    ]).then(([cData, sData]) => {
      const cls = cData.clients || [];
      const sups = sData.suppliers || [];
      setClients(cls);
      setSuppliers(sups);
      loadRules(cls, sups);
    }).catch(() => loadRules([], []));
  }, [loadRules]);

  useEffect(() => {
    const assignedClientIds = new Set(rules.filter(r => r.scope === "client" && r.entityId).map(r => r.entityId!));
    const assignedSupplierIds = new Set(rules.filter(r => r.scope === "supplier" && r.entityId).map(r => r.entityId!));
    setUnassignedEntities({
      clients: clients.filter(c => !assignedClientIds.has(c.id)),
      suppliers: suppliers.filter(s => !assignedSupplierIds.has(s.id)),
    });
  }, [rules, clients, suppliers]);

  // Fetch block stats (only once on initial load)
  const statsLoaded = useRef(false);
  useEffect(() => {
    if (statsLoaded.current) return;
    fetch("/api/tenant/sms-translations/stats?category=CONTENT_FILTER")
      .then(r => r.json())
      .then(data => {
        const map: Record<string, number> = {};
        for (const s of data.stats || []) {
          map[s.rule_name] = s.block_count;
        }
        setBlockStats(map);
        setTotalBlocks(data.total || 0);
        statsLoaded.current = true;
      })
      .catch(() => {});
  }, []);

  const addRule = () => {
    const newRule: FilterRule = {
      ruleId: null, name: `Filter ${rules.length + 1}`,
      matchPattern: "(?i)(spam|scam|fraud)", filterMode: "blacklist",
      scope: "both", entityId: null, entityName: null,
      priority: rules.length + 1, isActive: true, mcc: selection.mcc || "", mnc: selection.mnc || "",
    };
    setRules(prev => [...prev, newRule]);
    setOriginalRules(prev => [...prev, JSON.parse(JSON.stringify(newRule))]);
  };

  const deleteRule = async (idx: number) => {
    const rule = rules[idx];
    if (rule.ruleId) {
      await fetch(`/api/tenant/sms-translations/${rule.ruleId}`, { method: "DELETE" });
    }
    setRules(prev => prev.filter((_, i) => i !== idx));
    setOriginalRules(prev => prev.filter((_, i) => i !== idx));
    setMsg("Filter rule deleted");
    setTimeout(() => setMsg(""), 2000);
    loadRules(clients, suppliers);
  };

  const updateRule = (idx: number, field: string, value: any) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const cancelRule = (idx: number) => {
    const orig = originalRules[idx];
    if (!orig) return;
    setRules(prev => prev.map((r, i) => i === idx ? JSON.parse(JSON.stringify(orig)) : r));
    setMsg(`Reverted "${orig.name}"`);
    setTimeout(() => setMsg(""), 2000);
  };

  const handleDrop = (idx: number, type: "client" | "supplier" | null, entityId: number | null, entityName: string | null) => {
    if (!type || !entityId) return;
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, scope: type, entityId, entityName } : r));
    setDropTargetIdx(null);
    setDragEntity(null);
    setMsg(`Assigned ${entityName} to "${rules[idx]?.name || "rule"}"`);
    setTimeout(() => setMsg(""), 2000);
  };

  const clearAssignment = (idx: number) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, scope: "both", entityId: null, entityName: null } : r));
  };

  const handleDragOverRule = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDropTargetIdx(idx);
  };

  const saveRuleToApi = async (rule: FilterRule): Promise<number | null> => {
    if (rule.ruleId) {
      const res = await fetch(`/api/tenant/sms-translations/${rule.ruleId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rule.name, matchPattern: rule.matchPattern, replacementFixed: rule.filterMode,
          mcc: rule.mcc || null, mnc: rule.mnc || null,
          scope: rule.scope, entityId: rule.entityId, priority: rule.priority,
          isActive: rule.isActive,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return rule.ruleId;
    } else {
      const res = await fetch("/api/tenant/sms-translations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rule.name, targetField: "BODY", category: "CONTENT_FILTER", mode: "FIXED",
          matchPattern: rule.matchPattern, replacementFixed: rule.filterMode,
          mcc: rule.mcc || null, mnc: rule.mnc || null,
          scope: rule.scope, entityId: rule.entityId, priority: rule.priority,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      return created.profile?.id || created.id || null;
    }
  };

  const saveRule = async (idx: number) => {
    const rule = rules[idx];
    try {
      const newId = await saveRuleToApi(rule);
      if (newId && !rule.ruleId) {
        updateRule(idx, "ruleId", newId);
        setOriginalRules(prev => prev.map((r, i) => i === idx ? { ...r, ruleId: newId } : r));
      } else {
        setOriginalRules(prev => prev.map((r, i) => i === idx ? JSON.parse(JSON.stringify(rule)) : r));
      }
      setMsg(`"${rule.name}" saved!`);
      setTimeout(() => setMsg(""), 2000);
    } catch (err) {
      setError(`Failed to save: ${(err as Error).message}`);
    }
  };

  const saveAll = async () => {
    setSaving(true); setError(null);
    let saved = 0; let failed = 0;
    for (const rule of rules) {
      try { await saveRuleToApi(rule); saved++; } catch { failed++; }
    }
    setSaving(false);
    setMsg(failed > 0 ? `Saved ${saved}/${rules.length} (${failed} failed)` : `All ${saved} rules saved!`);
    setTimeout(() => setMsg(""), 3000);
    loadRules(clients, suppliers);
  };

  // Quick test: check content against all active filter rules
  const runQuickTest = () => {
    // Check blacklist rules first (blocking takes priority)
    const blacklist = rules.filter(r => r.isActive && r.filterMode === "blacklist");
    for (const rule of blacklist) {
      try {
        if (buildRegex(rule.matchPattern).test(quickTestContent)) {
          setQuickTestResult({ action: "blocked", matchedRule: rule.name });
          return;
        }
      } catch { /* skip */ }
    }
    // Then check whitelist rules
    const whitelist = rules.filter(r => r.isActive && r.filterMode === "whitelist");
    if (whitelist.length > 0) {
      let anyMatch = false;
      for (const rule of whitelist) {
        try {
          if (buildRegex(rule.matchPattern).test(quickTestContent)) {
            setQuickTestResult({ action: "allowed", matchedRule: rule.name });
            return;
          }
        } catch { /* skip */ }
      }
      // Content didn't match any whitelist → blocked by whitelist
      setQuickTestResult({ action: "blocked", matchedRule: "whitelist (no match)" });
      return;
    }
    setQuickTestResult({ action: "none", matchedRule: null });
  };

  const assignedRules = rules.filter(r => r.scope !== "both" && r.entityId);

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
          <h2 className="text-lg font-bold text-slate-800">Content Filter — Blacklist / Whitelist</h2>
          <p className="text-xs text-slate-400">Block or allow SMS based on content matching — applied per client or supplier</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Scope: <strong>{selection.label}</strong></span>
          <button onClick={addRule}
            className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-700 transition">
            + Add Filter
          </button>
        </div>
      </div>

      {/* Quick Filter Test */}
      <div className="bg-gradient-to-br from-slate-800 via-orange-950 to-slate-900 border border-slate-700 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🛡️</span>
          <div>
            <h3 className="text-lg font-bold text-white">Quick Content Filter Test</h3>
            <p className="text-xs text-slate-400">Paste message content and see if it gets blocked or allowed</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 block">Message Content</label>
            <div className="flex items-center gap-3">
              <input value={quickTestContent} onChange={e => { setQuickTestContent(e.target.value); setQuickTestResult(null); }}
                onKeyDown={e => { if (e.key === "Enter") runQuickTest(); }}
                className="flex-1 bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-slate-500 focus:ring-2 focus:ring-orange-500 focus:outline-none transition" />
              <button onClick={runQuickTest} disabled={!quickTestContent.trim()}
                className="bg-orange-600 hover:bg-orange-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-semibold transition shadow-lg shadow-orange-600/25">
                🛡️ Check
              </button>
            </div>
          </div>
          {quickTestResult && (
            <div className={`rounded-xl border p-4 ${quickTestResult.action === "blocked" ? "bg-red-900/30 border-red-700/50" : quickTestResult.action === "allowed" ? "bg-emerald-900/30 border-emerald-700/50" : "bg-slate-800/30 border-slate-600/50"}`}>
              {quickTestResult.action === "blocked" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <span className="text-[10px] font-medium text-red-300 uppercase tracking-wider block mb-1">Content</span>
                      <code className="text-xs font-mono text-slate-300 break-all">{quickTestContent}</code>
                    </div>
                    <div className="bg-red-900/40 rounded-lg p-3">
                      <span className="text-[10px] font-medium text-red-300 uppercase tracking-wider block mb-1">Status</span>
                      <code className="text-lg font-bold text-red-200 tracking-wider">BLOCKED 🚫</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-red-300 uppercase tracking-wider">Blocked by</span>
                    <code className="text-sm font-mono font-bold text-red-200 bg-red-900/50 px-3 py-1 rounded-lg">
                      {quickTestResult.matchedRule}
                    </code>
                  </div>
                  <p className="text-[10px] text-slate-500 italic">SMS with this content will be rejected.</p>
                </div>
              ) : quickTestResult.action === "allowed" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <span className="text-[10px] font-medium text-emerald-300 uppercase tracking-wider block mb-1">Content</span>
                      <code className="text-xs font-mono text-slate-300 break-all">{quickTestContent}</code>
                    </div>
                    <div className="bg-emerald-900/40 rounded-lg p-3">
                      <span className="text-[10px] font-medium text-emerald-300 uppercase tracking-wider block mb-1">Status</span>
                      <code className="text-lg font-bold text-emerald-200 tracking-wider">ALLOWED ✅</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-emerald-300 uppercase tracking-wider">Allowed by</span>
                    <code className="text-sm font-mono font-bold text-emerald-200 bg-emerald-900/50 px-3 py-1 rounded-lg">
                      {quickTestResult.matchedRule}
                    </code>
                  </div>
                  <p className="text-[10px] text-slate-500 italic">Content matched a whitelist rule — SMS will be delivered.</p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-lg">ℹ️</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-300">No filter rules matched</p>
                    <p className="text-[10px] text-slate-400/70">SMS will be delivered normally (no blocking or whitelisting applies).</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span>{rules.filter(r => r.isActive).length} active filters</span>
            <span>•</span>
            <span>{rules.filter(r => r.isActive && r.filterMode === "blacklist").length} blacklist</span>
            <span>•</span>
            <span>{rules.filter(r => r.isActive && r.filterMode === "whitelist").length} whitelist</span>
            <span>•</span>
            <span>🚫 {totalBlocks} blocked (24h)</span>
            <span>•</span>
            <span>Blacklist checked first</span>
          </div>
        </div>
      </div>

      {/* Unassigned */}
      {(unassignedEntities.clients.length > 0 || unassignedEntities.suppliers.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-xs font-medium text-amber-700 mb-2">Drag clients/suppliers onto rules to assign:</p>
          <div className="flex flex-wrap gap-1.5">
            {unassignedEntities.clients.map(c => (
              <span key={`c-${c.id}`} draggable
                onDragStart={() => setDragEntity({ type: "client", id: c.id, name: c.name })}
                onDragEnd={() => { setDragEntity(null); setDropTargetIdx(null); }}
                className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-[10px] font-medium cursor-grab active:cursor-grabbing hover:bg-purple-200 transition">
                👤 {c.name}
              </span>
            ))}
            {unassignedEntities.suppliers.map(s => (
              <span key={`s-${s.id}`} draggable
                onDragStart={() => setDragEntity({ type: "supplier", id: s.id, name: s.name })}
                onDragEnd={() => { setDragEntity(null); setDropTargetIdx(null); }}
                className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-medium cursor-grab active:cursor-grabbing hover:bg-amber-200 transition">
                📦 {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rules Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
                <th className="text-left px-3 py-2.5 font-medium">Rule Name</th>
                <th className="text-left px-3 py-2.5 font-medium">Match Content</th>
                <th className="text-left px-3 py-2.5 font-medium w-24">Mode</th>
                <th className="text-center px-3 py-2.5 font-medium w-20">Blocks (24h)</th>
                <th className="text-left px-3 py-2.5 font-medium w-48">Applies To</th>
                <th className="text-left px-3 py-2.5 font-medium w-16">Priority</th>
                <th className="text-center px-3 py-2.5 font-medium w-12">Active</th>
                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <p className="text-2xl mb-2">🛡️</p>
                    <p className="text-sm">No content filter rules yet</p>
                    <p className="text-xs mt-1">Click "+ Add Filter" to create blacklist or whitelist rules</p>
                  </td>
                </tr>
              )}
              {rules.map((rule, idx) => {
                const isDirty = originalRules[idx]
                  ? JSON.stringify(rule) !== JSON.stringify(originalRules[idx])
                  : false;
                return (
                  <tr key={idx}
                    className={`hover:bg-orange-50/40 transition-colors ${!rule.isActive ? "opacity-50" : ""} ${dropTargetIdx === idx ? "bg-orange-50 ring-2 ring-orange-200" : ""} ${isDirty ? "bg-yellow-50/30" : ""}`}
                    onDragOver={(e) => handleDragOverRule(e, idx)}
                    onDragLeave={() => setDropTargetIdx(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragEntity) handleDrop(idx, dragEntity.type, dragEntity.id, dragEntity.name);
                      setDropTargetIdx(null);
                    }}>
                    <td className="px-4 py-2 text-slate-400 font-mono">
                      {idx + 1}
                      {isDirty && <span className="ml-1 text-[8px] text-amber-500 align-top">•</span>}
                    </td>
                    <td className="px-3 py-2">
                      <input value={rule.name} onChange={e => updateRule(idx, "name", e.target.value)}
                        className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-orange-300 rounded px-1 py-0.5 text-xs font-medium text-slate-800 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={rule.matchPattern} onChange={e => updateRule(idx, "matchPattern", e.target.value)}
                        placeholder="(?i)(spam|scam|fraud)"
                        className="w-44 border rounded px-2 py-1 font-mono text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {blockStats[rule.name] ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">
                          🚫 {blockStats[rule.name]}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select value={rule.filterMode} onChange={e => updateRule(idx, "filterMode", e.target.value)}
                        className={`border rounded px-1.5 py-1 text-[10px] font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none ${rule.filterMode === "blacklist" ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                        <option value="blacklist">🚫 Blacklist</option>
                        <option value="whitelist">✅ Whitelist</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <select value={rule.scope} onChange={e => {
                          const v = e.target.value as "client" | "supplier" | "both";
                          updateRule(idx, "scope", v);
                          if (v === "both") { updateRule(idx, "entityId", null); updateRule(idx, "entityName", null); }
                          else if (v === "client" && clients.length > 0) { updateRule(idx, "entityId", clients[0].id); updateRule(idx, "entityName", clients[0].name); }
                          else if (v === "supplier" && suppliers.length > 0) { updateRule(idx, "entityId", suppliers[0].id); updateRule(idx, "entityName", suppliers[0].name); }
                        }} className="border rounded px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-orange-500 focus:outline-none">
                          <option value="both">Global</option>
                          <option value="client">Client</option>
                          <option value="supplier">Supplier</option>
                        </select>
                        {rule.scope === "client" && (
                          <select value={rule.entityId || ""} onChange={e => {
                            const cid = e.target.value ? parseInt(e.target.value) : null;
                            updateRule(idx, "entityId", cid);
                            updateRule(idx, "entityName", cid ? clients.find(c => c.id === cid)?.name || null : null);
                          }} className="border rounded px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-orange-500 focus:outline-none min-w-[90px]">
                            <option value="">Select...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        )}
                        {rule.scope === "supplier" && (
                          <select value={rule.entityId || ""} onChange={e => {
                            const sid = e.target.value ? parseInt(e.target.value) : null;
                            updateRule(idx, "entityId", sid);
                            updateRule(idx, "entityName", sid ? suppliers.find(s => s.id === sid)?.name || null : null);
                          }} className="border rounded px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-orange-500 focus:outline-none min-w-[90px]">
                            <option value="">Select...</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        )}
                        {rule.entityId && rule.scope !== "both" && (
                          <button onClick={() => clearAssignment(idx)} className="text-red-400 hover:text-red-600 text-[10px] px-0.5" title="Clear">✕</button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min={1} max={99} value={rule.priority} onChange={e => updateRule(idx, "priority", parseInt(e.target.value) || 1)}
                        className="w-12 border rounded px-1.5 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={rule.isActive} onChange={e => updateRule(idx, "isActive", e.target.checked)}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 h-3.5 w-3.5" />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <button onClick={() => {
                          try {
                            if (rule.filterMode === "blacklist") {
                              if (buildRegex(rule.matchPattern).test(quickTestContent)) {
                                setQuickTestResult({ action: "blocked", matchedRule: rule.name });
                              } else {
                                setQuickTestResult({ action: "none", matchedRule: null });
                              }
                            } else {
                              if (buildRegex(rule.matchPattern).test(quickTestContent)) {
                                setQuickTestResult({ action: "allowed", matchedRule: rule.name });
                              } else {
                                setQuickTestResult({ action: "blocked", matchedRule: "whitelist (no match)" });
                              }
                            }
                          } catch { setMsg("Invalid regex pattern"); setTimeout(() => setMsg(""), 2000); }
                        }}
                          className="bg-slate-600 text-white px-2 py-1 rounded text-[10px] font-medium hover:bg-slate-700 transition" title="Test this filter rule">▶️ Test</button>
                        <button onClick={() => saveRule(idx)}
                          className="bg-green-600 text-white px-2.5 py-1 rounded text-[10px] font-medium hover:bg-green-700 transition">Update</button>
                        <button onClick={() => cancelRule(idx)}
                          disabled={!isDirty}
                          className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 px-2 py-1 rounded text-[10px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Revert unsaved changes">Cancel</button>
                        <button onClick={() => { if (confirm("Delete this filter?")) deleteRule(idx); }}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded text-[10px] font-medium transition">Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 border-t bg-slate-50 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">{rules.filter(r => r.ruleId).length} saved — {rules.filter(r => !r.ruleId).length} draft</span>
          <div className="flex items-center gap-2">
            <button onClick={addRule} className="text-orange-600 hover:text-orange-800 text-[10px] font-medium transition">+ Add Filter</button>
            <button onClick={saveAll} disabled={saving}
              className="bg-orange-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-700 disabled:opacity-50 transition">
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </div>
      </div>

      {/* Applies To Table */}
      {assignedRules.length > 0 && (
        <div className="mt-4 bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-2 border-b">
            <h3 className="text-xs font-semibold text-slate-800">📋 Applies To — Client/Supplier Assignments</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2 font-medium">Rule</th>
                <th className="text-left px-3 py-2 font-medium">Mode</th>
                <th className="text-left px-3 py-2 font-medium">Scope</th>
                <th className="text-left px-3 py-2 font-medium">Entity</th>
                <th className="text-left px-3 py-2 font-medium">Match Pattern</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignedRules.map((rule, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-700">{rule.name}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${rule.filterMode === "blacklist" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {rule.filterMode === "blacklist" ? "Blacklist" : "Whitelist"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${rule.scope === "client" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>
                      {rule.scope === "client" ? "Client" : "Supplier"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-600">{rule.entityName || `#${rule.entityId}`}</td>
                  <td className="px-3 py-2 text-slate-500 font-mono text-[10px]">{rule.matchPattern}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Help */}
      <div className="mt-4 bg-slate-50 border rounded-xl p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-2">💡 How Content Filter Works</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Blacklist:</strong> Block SMS whose content matches the pattern. Useful for filtering spam, fraud, or forbidden keywords.</li>
          <li><strong>Whitelist:</strong> Only allow SMS whose content matches the pattern. Everything else gets blocked.</li>
          <li><strong>Priority:</strong> Blacklist rules are checked first (lower numbers run first). If no blacklist matches, whitelist rules are checked.</li>
          <li><strong>Quick Test:</strong> Paste message content and click Check to see if it gets blocked or allowed.</li>
          <li><strong>Update / Cancel:</strong> Save or revert changes per rule.</li>
          <li><strong>Scope:</strong> Drag clients/suppliers from the top bar. Check the Applies To table.</li>
        </ul>
      </div>
    </div>
  );
}
