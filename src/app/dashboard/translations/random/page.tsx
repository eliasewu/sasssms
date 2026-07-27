"use client";

import { useState, useEffect, useCallback } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";

interface RandomRule {
  ruleId: number | null;
  name: string;
  matchPattern: string;
  poolItems: string[];
  scope: "client" | "supplier" | "both";
  entityId: number | null;
  priority: number;
  isActive: boolean;
  mcc: string;
  mnc: string;
}

interface ClientSupplier {
  id: number;
  name: string;
}

export default function RandomContentPage() {
  const { selection } = useMccMnc();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rules, setRules] = useState<RandomRule[]>([]);
  const [clients, setClients] = useState<ClientSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);

  // Drag state
  const [dragEntity, setDragEntity] = useState<{ type: "client" | "supplier"; id: number; name: string } | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [unassignedEntities, setUnassignedEntities] = useState<{ clients: ClientSupplier[]; suppliers: ClientSupplier[] }>({ clients: [], suppliers: [] });

  // Expanded rule for pool editing
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Preview
  const [sampleContent, setSampleContent] = useState("Your OTP code is 252525. Valid for 5 min.");

  useEffect(() => {
    fetch("/api/tenant/clients").then(r => r.json()).then(d => setClients(d.clients || [])).catch(() => {});
    fetch("/api/tenant/suppliers").then(r => r.json()).then(d => setSuppliers(d.suppliers || [])).catch(() => {});
  }, []);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selection.mcc) params.set("mcc", selection.mcc);
      if (selection.mnc) params.set("mnc", selection.mnc);
      params.set("category", "RANDOM_CONTENT");
      const res = await fetch(`/api/tenant/sms-translations?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const profiles = (data.profiles || []) as any[];

      const parsed: RandomRule[] = profiles.map((p: any) => {
        const a = (p.assignments || []).find((x: any) => x.isActive !== false);
        return {
          ruleId: p.id,
          name: p.name,
          matchPattern: p.match_pattern || p.matchPattern || ".*",
          poolItems: (p.pool_items || []).map((pi: any) => pi.replacementValue || pi.replacement_value || ""),
          scope: a?.clientId ? "client" : a?.supplierId ? "supplier" : "both",
          entityId: a?.clientId || a?.supplierId || null,
          priority: a?.priority || 1,
          isActive: p.is_active !== false,
          mcc: p.mcc || "",
          mnc: p.mnc || "",
        };
      });
      setRules(parsed);
    } catch (err) {
      setError("Failed to load rules. " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selection]);

  useEffect(() => { loadRules(); }, [loadRules]);

  useEffect(() => {
    const assignedClientIds = new Set(rules.filter(r => r.scope === "client" && r.entityId).map(r => r.entityId!));
    const assignedSupplierIds = new Set(rules.filter(r => r.scope === "supplier" && r.entityId).map(r => r.entityId!));
    setUnassignedEntities({
      clients: clients.filter(c => !assignedClientIds.has(c.id)),
      suppliers: suppliers.filter(s => !assignedSupplierIds.has(s.id)),
    });
  }, [rules, clients, suppliers]);

  const addRule = () => {
    setRules(prev => [...prev, {
      ruleId: null, name: `Random Rule ${prev.length + 1}`,
      matchPattern: ".*", poolItems: ["Your OTP code is {{OTP}}", "Verification: {{OTP}}"],
      scope: "both", entityId: null, priority: prev.length + 1,
      isActive: true, mcc: selection.mcc || "", mnc: selection.mnc || "",
    }]);
  };

  const deleteRule = async (idx: number) => {
    const rule = rules[idx];
    if (rule.ruleId) {
      await fetch(`/api/tenant/sms-translations/${rule.ruleId}`, { method: "DELETE" });
    }
    setRules(prev => prev.filter((_, i) => i !== idx));
    setMsg("Rule deleted");
    setTimeout(() => setMsg(""), 2000);
    loadRules();
  };

  const updateRule = (idx: number, field: string, value: any) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addPoolItem = (idx: number) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, poolItems: [...r.poolItems, ""] } : r));
  };

  const updatePoolItem = (idx: number, itemIdx: number, value: string) => {
    setRules(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const items = [...r.poolItems];
      items[itemIdx] = value;
      return { ...r, poolItems: items };
    }));
  };

  const removePoolItem = (idx: number, itemIdx: number) => {
    setRules(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      return { ...r, poolItems: r.poolItems.filter((_, j) => j !== itemIdx) };
    }));
  };

  const handleDrop = (idx: number, type: "client" | "supplier" | null, entityId: number | null, entityName: string | null) => {
    if (!type || !entityId) return;
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, scope: type, entityId } : r));
    setDropTargetIdx(null);
    setDragEntity(null);
    setMsg(`Assigned ${entityName} to "${rules[idx]?.name || "rule"}"`);
    setTimeout(() => setMsg(""), 2000);
  };

  const clearAssignment = (idx: number) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, scope: "both", entityId: null } : r));
  };

  const saveRuleToApi = async (rule: RandomRule): Promise<number | null> => {
    const poolText = rule.poolItems.filter(p => p.trim()).join("\n");
    if (rule.ruleId) {
      const res = await fetch(`/api/tenant/sms-translations/${rule.ruleId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rule.name, matchPattern: rule.matchPattern,
          mcc: rule.mcc || null, mnc: rule.mnc || null,
          scope: rule.scope, entityId: rule.entityId, priority: rule.priority,
          isActive: rule.isActive,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (poolText) {
        await fetch(`/api/tenant/sms-translations/${rule.ruleId}/upload`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-replace-all": "true" },
          body: JSON.stringify({ entries: poolText }),
        }).catch(() => {});
      }
      return rule.ruleId;
    } else {
      const res = await fetch("/api/tenant/sms-translations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rule.name, targetField: "BODY", category: "RANDOM_CONTENT", mode: "RANDOM",
          matchPattern: rule.matchPattern,
          mcc: rule.mcc || null, mnc: rule.mnc || null,
          scope: rule.scope, entityId: rule.entityId, priority: rule.priority,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      const newId = created.profile?.id || created.id;
      if (newId && poolText) {
        await fetch(`/api/tenant/sms-translations/${newId}/upload`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-replace-all": "true" },
          body: JSON.stringify({ entries: poolText }),
        }).catch(() => {});
      }
      return newId || null;
    }
  };

  const saveRule = async (idx: number) => {
    const rule = rules[idx];
    try {
      const newId = await saveRuleToApi(rule);
      if (newId && !rule.ruleId) updateRule(idx, "ruleId", newId);
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
    loadRules();
  };

  const handleDragOverRule = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDropTargetIdx(idx);
  };

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
          <h2 className="text-lg font-bold text-slate-800">Random Content Rules</h2>
          <p className="text-xs text-slate-400">Pick a random template from a pool when content matches — applied per client or supplier</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Scope: <strong>{selection.label}</strong></span>
          <button onClick={addRule}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
            + Add Rule
          </button>
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-6">
        <h4 className="text-sm font-semibold text-amber-800 mb-3">🎲 Random Content Preview</h4>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500 text-xs">Sample:</span>
          <input value={sampleContent} onChange={e => setSampleContent(e.target.value)}
            className="w-64 border rounded-lg px-3 py-2 font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white" />
          <span className="text-slate-400 text-xs">→ random pick from pool:</span>
          <button onClick={() => {
            const activeRules = rules.filter(r => r.isActive && r.poolItems.length > 0);
            if (activeRules.length === 0) return;
            const pick = activeRules[Math.floor(Math.random() * activeRules.length)];
            const tmpl = pick.poolItems[Math.floor(Math.random() * pick.poolItems.length)];
            setSampleContent(tmpl);
          }} className="bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-700 transition">
            🎲 Random Pick
          </button>
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
                <th className="text-left px-3 py-2.5 font-medium">Match Pattern</th>
                <th className="text-left px-3 py-2.5 font-medium">Pool (templates)</th>
                <th className="text-left px-3 py-2.5 font-medium w-48">Applies To</th>
                <th className="text-left px-3 py-2.5 font-medium w-16">Priority</th>
                <th className="text-center px-3 py-2.5 font-medium w-12">Active</th>
                <th className="text-right px-4 py-2.5 font-medium w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <p className="text-2xl mb-2">🎲</p>
                    <p className="text-sm">No random content rules yet</p>
                    <p className="text-xs mt-1">Click "+ Add Rule" to create your first rule</p>
                  </td>
                </tr>
              )}
              {rules.map((rule, idx) => (
                <tr key={idx}
                  className={`hover:bg-blue-50/40 transition-colors ${!rule.isActive ? "opacity-50" : ""} ${dropTargetIdx === idx ? "bg-indigo-50 ring-2 ring-indigo-200" : ""}`}
                  onDragOver={(e) => handleDragOverRule(e, idx)}
                  onDragLeave={() => setDropTargetIdx(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragEntity) handleDrop(idx, dragEntity.type, dragEntity.id, dragEntity.name);
                    setDropTargetIdx(null);
                  }}>
                  <td className="px-4 py-2 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <input value={rule.name} onChange={e => updateRule(idx, "name", e.target.value)}
                      className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 text-xs font-medium text-slate-800 focus:outline-none" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={rule.matchPattern} onChange={e => updateRule(idx, "matchPattern", e.target.value)}
                      placeholder=".*"
                      className="w-28 border rounded px-2 py-1 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                      className="text-blue-600 hover:text-blue-800 text-[10px] font-medium flex items-center gap-1">
                      {rule.poolItems.filter(p => p.trim()).length} templates {expandedIdx === idx ? "▲" : "▼"}
                    </button>
                    {expandedIdx === idx && (
                      <div className="mt-1.5 space-y-1">
                        {rule.poolItems.map((item, pi) => (
                          <div key={pi} className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 w-4">{pi + 1}.</span>
                            <input value={item} onChange={e => updatePoolItem(idx, pi, e.target.value)}
                              placeholder="Template with {{OTP}}"
                              className="flex-1 border rounded px-2 py-1 text-[10px] font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            {rule.poolItems.length > 1 && (
                              <button onClick={() => removePoolItem(idx, pi)}
                                className="text-red-400 hover:text-red-600 text-[10px] px-0.5">✕</button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => addPoolItem(idx)}
                          className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">+ Add template</button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <select value={rule.scope} onChange={e => {
                        const v = e.target.value as "client" | "supplier" | "both";
                        updateRule(idx, "scope", v);
                        if (v === "both") updateRule(idx, "entityId", null);
                        else if (v === "client" && clients.length > 0) updateRule(idx, "entityId", clients[0].id);
                        else if (v === "supplier" && suppliers.length > 0) updateRule(idx, "entityId", suppliers[0].id);
                      }} className="border rounded px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-blue-500 focus:outline-none">
                        <option value="both">Global</option>
                        <option value="client">Client</option>
                        <option value="supplier">Supplier</option>
                      </select>
                      {rule.scope === "client" && (
                        <select value={rule.entityId || ""} onChange={e => updateRule(idx, "entityId", e.target.value ? parseInt(e.target.value) : null)}
                          className="border rounded px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[90px]">
                          <option value="">Select...</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}
                      {rule.scope === "supplier" && (
                        <select value={rule.entityId || ""} onChange={e => updateRule(idx, "entityId", e.target.value ? parseInt(e.target.value) : null)}
                          className="border rounded px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[90px]">
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
                      className="w-12 border rounded px-1.5 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={rule.isActive} onChange={e => updateRule(idx, "isActive", e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5" />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => saveRule(idx)}
                        className="bg-green-600 text-white px-2.5 py-1 rounded text-[10px] font-medium hover:bg-green-700 transition">Save</button>
                      <button onClick={() => { if (confirm("Delete this rule?")) deleteRule(idx); }}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded text-[10px] font-medium transition">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 border-t bg-slate-50 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">{rules.filter(r => r.ruleId).length} saved — {rules.filter(r => !r.ruleId).length} draft</span>
          <div className="flex items-center gap-2">
            <button onClick={addRule} className="text-blue-600 hover:text-blue-800 text-[10px] font-medium transition">+ Add Rule</button>
            <button onClick={saveAll} disabled={saving}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </div>
      </div>

      {/* Help */}
      <div className="mt-4 bg-slate-50 border rounded-xl p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-2">💡 How Random Content Works</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Match Pattern:</strong> Regex to match incoming SMS content. Use <code className="bg-slate-200 px-1 rounded text-[10px]">.*</code> to match all.</li>
          <li><strong>Pool:</strong> Templates picked randomly when content matches. Use <code className="bg-slate-200 px-1 rounded text-[10px]">{`{{OTP}}`}</code> to auto-fill extracted OTP code.</li>
          <li><strong>Scope:</strong> Global applies to all. Client/Supplier applies only to messages from that entity.</li>
          <li><strong>Priority:</strong> Lower numbers run first. Drag clients/suppliers from the top bar.</li>
        </ul>
      </div>
    </div>
  );
}
