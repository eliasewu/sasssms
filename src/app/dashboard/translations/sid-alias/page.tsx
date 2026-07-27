"use client";

import { useState, useEffect, useCallback } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";

interface AliasRule {
  ruleId: number | null;
  aliasName: string;
  matchPattern: string;
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

export default function SidAliasPage() {
  const { selection } = useMccMnc();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rules, setRules] = useState<AliasRule[]>([]);
  const [originalRules, setOriginalRules] = useState<AliasRule[]>([]);
  const [clients, setClients] = useState<ClientSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);

  // Drag state
  const [dragEntity, setDragEntity] = useState<{ type: "client" | "supplier"; id: number; name: string } | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [unassignedEntities, setUnassignedEntities] = useState<{ clients: ClientSupplier[]; suppliers: ClientSupplier[] }>({ clients: [], suppliers: [] });

  // Quick Test
  const [quickTestSender, setQuickTestSender] = useState("Borno_TriAngle");
  const [quickTestResult, setQuickTestResult] = useState<{ matchedAlias: string | null; aliasName: string | null } | null>(null);

  const loadRules = useCallback(async (loadedClients: ClientSupplier[], loadedSuppliers: ClientSupplier[]) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selection.mcc) params.set("mcc", selection.mcc);
      if (selection.mnc) params.set("mnc", selection.mnc);
      params.set("category", "SID_ALIAS");
      const res = await fetch(`/api/tenant/sms-translations?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const profiles = (data.profiles || []) as any[];

      const parsed: AliasRule[] = profiles.map((p: any) => {
        const a = (p.assignments || []).find((x: any) => x.isActive !== false);
        return {
          ruleId: p.id,
          aliasName: p.name,
          matchPattern: p.match_pattern || p.matchPattern || ".*",
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
      setError("Failed to load aliases. " + (err as Error).message);
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

  const addRule = () => {
    const newRule: AliasRule = {
      ruleId: null, aliasName: `Alias ${rules.length + 1}`,
      matchPattern: ".*", scope: "both", entityId: null, entityName: null,
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
    setMsg("Alias deleted");
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
    setMsg(`Reverted "${orig.aliasName}"`);
    setTimeout(() => setMsg(""), 2000);
  };

  const handleDrop = (idx: number, type: "client" | "supplier" | null, entityId: number | null, entityName: string | null) => {
    if (!type || !entityId) return;
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, scope: type, entityId, entityName } : r));
    setDropTargetIdx(null);
    setDragEntity(null);
    setMsg(`Assigned ${entityName} to alias "${rules[idx]?.aliasName || "alias"}"`);
    setTimeout(() => setMsg(""), 2000);
  };

  const clearAssignment = (idx: number) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, scope: "both", entityId: null, entityName: null } : r));
  };

  const handleDragOverRule = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDropTargetIdx(idx);
  };

  const previewTransform = (input: string, match: string, replace: string): string => {
    try { return input.replace(new RegExp(match, "g"), replace); }
    catch { return input; }
  };

  const saveRuleToApi = async (rule: AliasRule): Promise<number | null> => {
    if (rule.ruleId) {
      const res = await fetch(`/api/tenant/sms-translations/${rule.ruleId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rule.aliasName, matchPattern: rule.matchPattern, replacementFixed: rule.aliasName,
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
          name: rule.aliasName, targetField: "SENDER", category: "SID_ALIAS", mode: "FIXED",
          matchPattern: rule.matchPattern, replacementFixed: rule.aliasName,
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
      setMsg(`Alias "${rule.aliasName}" saved!`);
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
    setMsg(failed > 0 ? `Saved ${saved}/${rules.length} (${failed} failed)` : `All ${saved} aliases saved!`);
    setTimeout(() => setMsg(""), 3000);
    loadRules(clients, suppliers);
  };

  // Quick test: runs all active rules, first match wins
  const runQuickTest = () => {
    const active = rules.filter(r => r.isActive);
    for (const rule of active) {
      try {
        if (new RegExp(rule.matchPattern).test(quickTestSender)) {
          setQuickTestResult({ matchedAlias: rule.aliasName, aliasName: rule.aliasName });
          return;
        }
      } catch { /* skip */ }
    }
    setQuickTestResult({ matchedAlias: null, aliasName: null });
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
          <h2 className="text-lg font-bold text-slate-800">SID Alias</h2>
          <p className="text-xs text-slate-400">Create friendly aliases for sender IDs — when a sender matches the pattern, it&apos;s replaced with the alias name</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Scope: <strong>{selection.label}</strong></span>
          <button onClick={addRule}
            className="bg-violet-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-violet-700 transition">
            + Add Alias
          </button>
        </div>
      </div>

      {/* Quick Alias Test */}
      <div className="bg-gradient-to-br from-slate-800 via-violet-950 to-slate-900 border border-slate-700 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🏷️</span>
          <div>
            <h3 className="text-lg font-bold text-white">Sender ID</h3>
            <p className="text-xs text-slate-400">transformed</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 block">Enter sender ID to test</label>
            <div className="flex items-center gap-3">
              <input value={quickTestSender} onChange={e => { setQuickTestSender(e.target.value); setQuickTestResult(null); }}
                onKeyDown={e => { if (e.key === "Enter") runQuickTest(); }}
                className="flex-1 bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none transition" />
              <button onClick={runQuickTest} disabled={!quickTestSender.trim()}
                className="bg-violet-600 hover:bg-violet-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-semibold transition shadow-lg shadow-violet-600/25">
                🔍 Transform
              </button>
            </div>
          </div>
          {quickTestResult && (
            <div className={`rounded-xl border p-4 ${quickTestResult.matchedAlias !== null ? "bg-emerald-900/30 border-emerald-700/50" : "bg-red-900/20 border-red-700/50"}`}>
              {quickTestResult.matchedAlias !== null ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <span className="text-[10px] font-medium text-red-300 uppercase tracking-wider block mb-1">BEFORE</span>
                      <code className="text-sm font-mono text-slate-300 break-all">{quickTestSender}</code>
                    </div>
                    <div className="bg-emerald-900/40 rounded-lg p-3">
                      <span className="text-[10px] font-medium text-emerald-300 uppercase tracking-wider block mb-1">AFTER</span>
                      <code className="text-xl font-mono font-bold text-emerald-200 tracking-wider">{quickTestResult.matchedAlias}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] font-medium text-emerald-300 uppercase tracking-wider">Sender ID matched</span>
                    <code className="text-lg font-mono font-bold text-emerald-200 bg-emerald-900/50 px-3 py-1 rounded-lg tracking-wider">
                      {quickTestResult.matchedAlias}
                    </code>
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    The sender ID will be replaced with this alias when SMS is received from this sender.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-lg">❌</span>
                  <div>
                    <p className="text-sm font-semibold text-red-300">No alias matched</p>
                    <p className="text-[10px] text-red-400/70">
                      {rules.filter(r => r.isActive).length === 0
                        ? "No active aliases configured."
                        : `None of the ${rules.filter(r => r.isActive).length} active aliases matched "${quickTestSender}".`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span>{rules.filter(r => r.isActive).length} active aliases</span>
            <span>•</span>
            <span>First match wins</span>
          </div>
        </div>
      </div>

      {/* Unassigned Clients/Suppliers */}
      {(unassignedEntities.clients.length > 0 || unassignedEntities.suppliers.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-xs font-medium text-amber-700 mb-2">Drag clients/suppliers onto aliases to assign:</p>
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

      {/* Aliases Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
                <th className="text-left px-3 py-2.5 font-medium">Alias Name</th>
                <th className="text-left px-3 py-2.5 font-medium">Match Pattern (Regex)</th>
                <th className="text-left px-3 py-2.5 font-medium w-48">Applies To</th>
                <th className="text-left px-3 py-2.5 font-medium w-16">Priority</th>
                <th className="text-center px-3 py-2.5 font-medium w-12">Active</th>
                <th className="text-center px-3 py-2.5 font-medium">Preview</th>
                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <p className="text-2xl mb-2">🏷️</p>
                    <p className="text-sm">No SID aliases yet</p>
                    <p className="text-xs mt-1">Click &quot;+ Add Alias&quot; to create your first alias</p>
                  </td>
                </tr>
              )}
              {rules.map((rule, idx) => {
                const preview = rule.isActive && rule.matchPattern
                  ? previewTransform("Borno_TriAngle", rule.matchPattern, rule.aliasName)
                  : "—";
                const isDirty = originalRules[idx]
                  ? JSON.stringify(rule) !== JSON.stringify(originalRules[idx])
                  : false;
                const matched = rule.isActive && (() => { try { return new RegExp(rule.matchPattern).test("Borno_TriAngle"); } catch { return false; } })();
                return (
                  <tr key={idx}
                    className={`hover:bg-violet-50/40 transition-colors ${!rule.isActive ? "opacity-50" : ""} ${dropTargetIdx === idx ? "bg-violet-50 ring-2 ring-violet-200" : ""} ${isDirty ? "bg-yellow-50/30" : ""}`}
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
                      <input value={rule.aliasName} onChange={e => updateRule(idx, "aliasName", e.target.value)}
                        className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-violet-300 rounded px-1 py-0.5 text-xs font-medium text-slate-800 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={rule.matchPattern} onChange={e => updateRule(idx, "matchPattern", e.target.value)}
                        placeholder=".*"
                        className="w-40 border rounded px-2 py-1 font-mono text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <select value={rule.scope} onChange={e => {
                          const v = e.target.value as "client" | "supplier" | "both";
                          updateRule(idx, "scope", v);
                          if (v === "both") { updateRule(idx, "entityId", null); updateRule(idx, "entityName", null); }
                          else if (v === "client" && clients.length > 0) { updateRule(idx, "entityId", clients[0].id); updateRule(idx, "entityName", clients[0].name); }
                          else if (v === "supplier" && suppliers.length > 0) { updateRule(idx, "entityId", suppliers[0].id); updateRule(idx, "entityName", suppliers[0].name); }
                        }} className="border rounded px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-violet-500 focus:outline-none">
                          <option value="both">Global</option>
                          <option value="client">Client</option>
                          <option value="supplier">Supplier</option>
                        </select>
                        {rule.scope === "client" && (
                          <select value={rule.entityId || ""} onChange={e => {
                            const cid = e.target.value ? parseInt(e.target.value) : null;
                            updateRule(idx, "entityId", cid);
                            updateRule(idx, "entityName", cid ? clients.find(c => c.id === cid)?.name || null : null);
                          }} className="border rounded px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-violet-500 focus:outline-none min-w-[90px]">
                            <option value="">Select...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        )}
                        {rule.scope === "supplier" && (
                          <select value={rule.entityId || ""} onChange={e => {
                            const sid = e.target.value ? parseInt(e.target.value) : null;
                            updateRule(idx, "entityId", sid);
                            updateRule(idx, "entityName", sid ? suppliers.find(s => s.id === sid)?.name || null : null);
                          }} className="border rounded px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-violet-500 focus:outline-none min-w-[90px]">
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
                        className="w-12 border rounded px-1.5 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={rule.isActive} onChange={e => updateRule(idx, "isActive", e.target.checked)}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 h-3.5 w-3.5" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <code className="text-[10px] text-slate-400 font-mono">Borno</code>
                        <span className="text-slate-300">→</span>
                        <code className={`text-[10px] font-mono font-semibold ${matched ? "text-violet-700" : "text-slate-400"}`}>{preview}</code>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <button onClick={() => {
                          try {
                            if (new RegExp(rule.matchPattern).test(quickTestSender)) {
                              setQuickTestResult({ matchedAlias: rule.aliasName, aliasName: rule.aliasName });
                            } else {
                              setQuickTestResult({ matchedAlias: null, aliasName: null });
                            }
                          } catch { setMsg("Invalid regex pattern"); setTimeout(() => setMsg(""), 2000); }
                        }}
                          className="bg-slate-600 text-white px-2 py-1 rounded text-[10px] font-medium hover:bg-slate-700 transition" title="Test this alias">▶️ Test</button>
                        <button onClick={() => saveRule(idx)}
                          className="bg-violet-600 text-white px-2.5 py-1 rounded text-[10px] font-medium hover:bg-violet-700 transition">Update</button>
                        <button onClick={() => cancelRule(idx)}
                          disabled={!isDirty}
                          className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 px-2 py-1 rounded text-[10px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Revert unsaved changes">Cancel</button>
                        <button onClick={() => { if (confirm("Delete this alias?")) deleteRule(idx); }}
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
            <button onClick={addRule} className="text-violet-600 hover:text-violet-800 text-[10px] font-medium transition">+ Add Alias</button>
            <button onClick={saveAll} disabled={saving}
              className="bg-violet-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 transition">
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </div>
      </div>

      {/* Applies To Table */}
      {assignedRules.length > 0 && (
        <div className="mt-4 bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-4 py-2 border-b">
            <h3 className="text-xs font-semibold text-slate-800">📋 Applies To — Client/Supplier Assignments</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2 font-medium">Alias</th>
                <th className="text-left px-3 py-2 font-medium">Scope</th>
                <th className="text-left px-3 py-2 font-medium">Entity</th>
                <th className="text-left px-3 py-2 font-medium">Priority</th>
                <th className="text-left px-3 py-2 font-medium">Match Pattern</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignedRules.map((rule, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-700">{rule.aliasName}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${rule.scope === "client" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>
                      {rule.scope === "client" ? "Client" : "Supplier"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-600">{rule.entityName || `#${rule.entityId}`}</td>
                  <td className="px-3 py-2 text-slate-500">{rule.priority}</td>
                  <td className="px-3 py-2 text-slate-500 font-mono text-[10px]">
                    {rule.matchPattern}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Help */}
      <div className="mt-4 bg-slate-50 border rounded-xl p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-2">💡 How SID Aliases Work</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Alias Name:</strong> A friendly, human-readable name like &quot;Borno Support&quot; or &quot;OTP Service&quot;.</li>
          <li><strong>Match Pattern:</strong> Regex pattern to match incoming sender IDs. When a sender ID matches, it&apos;s replaced with the alias name.</li>
          <li><strong>Quick Transform:</strong> Type a sender ID at the top and click Transform to see the BEFORE/AFTER result.</li>
          <li><strong>Update / Cancel:</strong> Save or revert changes per alias.</li>
          <li><strong>Scope:</strong> Drag clients/suppliers from the top bar to assign aliases. Check the Applies To table.</li>
          <li><strong>Priority:</strong> Lower numbers run first.</li>
        </ul>
      </div>
    </div>
  );
}
