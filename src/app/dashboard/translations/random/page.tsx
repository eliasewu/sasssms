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

export default function RandomContentPage() {
  const { selection } = useMccMnc();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rules, setRules] = useState<RandomRule[]>([]);
  const [originalRules, setOriginalRules] = useState<RandomRule[]>([]);
  const [clients, setClients] = useState<ClientSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);

  // Drag state
  const [dragEntity, setDragEntity] = useState<{ type: "client" | "supplier"; id: number; name: string } | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [unassignedEntities, setUnassignedEntities] = useState<{ clients: ClientSupplier[]; suppliers: ClientSupplier[] }>({ clients: [], suppliers: [] });

  // Quick Test
  const [quickTestMessage, setQuickTestMessage] = useState("Your OTP code is 252525");
  const [quickTestResult, setQuickTestResult] = useState<string | null>(null);
  const [sampleOtp, setSampleOtp] = useState("252525");

  const loadRules = useCallback(async (loadedClients: ClientSupplier[], loadedSuppliers: ClientSupplier[]) => {
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
      setError("Failed to load rules. " + (err as Error).message);
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
    const newRule: RandomRule = {
      ruleId: null, name: `Random Rule ${rules.length + 1}`,
      matchPattern: ".*", poolItems: [
        "Your OTP code is {{OTP}}. Valid for 5 min.",
        "Verification code: {{OTP}}",
        "{{OTP}} is your one-time password",
        "OTP: {{OTP}}. Do not share.",
      ],
      scope: "both", entityId: null, entityName: null, priority: rules.length + 1,
      isActive: true, mcc: selection.mcc || "", mnc: selection.mnc || "",
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
    setMsg("Rule deleted");
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

  // Bulk upload templates from .txt or .csv file
  const handleBulkUpload = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'txt' && ext !== 'csv') {
      setError("Only .txt or .csv files are supported");
      setTimeout(() => setError(null), 3000);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      if (lines.length === 0) { setMsg("No templates found in file"); setTimeout(() => setMsg(""), 2000); return; }
      // For CSV, take first column if comma-separated
      const templates = lines.map(l => l.includes(',') ? l.split(',')[0].trim() : l.trim());
      setRules(prev => prev.map((r, i) => i === idx ? { ...r, poolItems: templates } : r));
      setMsg(`Loaded ${templates.length} templates from ${file.name}`);
      setTimeout(() => setMsg(""), 2500);
    };
    reader.readAsText(file);
    e.target.value = ''; // reset so same file can be re-uploaded
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

  // Quick test: pick random template and fill OTP from the test message
  const runQuickTest = () => {
    const activeRules = rules.filter(r => r.isActive && r.poolItems.some(p => p.trim()));
    if (activeRules.length === 0) {
      setQuickTestResult("(no active rules)");
      return;
    }
    const pick = activeRules[Math.floor(Math.random() * activeRules.length)];
    const tmpl = pick.poolItems.filter(p => p.trim());
    const random = tmpl[Math.floor(Math.random() * tmpl.length)];
    const otp = quickTestMessage.match(/\b(\d{4,8})\b/)?.[1] || sampleOtp;
    setQuickTestResult(random.replace(/\{\{OTP\}\}/g, otp));
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
          <h2 className="text-lg font-bold text-slate-800">Random Content Rules</h2>
          <p className="text-xs text-slate-400">Pick a random template from a pool when content matches — assigned per client or supplier</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Scope: <strong>{selection.label}</strong></span>
          <button onClick={addRule}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
            + Add Rule
          </button>
        </div>
      </div>

      {/* Quick Random Test */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-amber-950 border border-slate-700 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🎲</span>
          <div>
            <h3 className="text-lg font-bold text-white">Quick Random Pick Test</h3>
            <p className="text-xs text-slate-400">Extract OTP from original message and fill into random template</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-medium text-slate-400 mb-1 block">Original Message (with OTP)</label>
              <input value={quickTestMessage} onChange={e => { setQuickTestMessage(e.target.value); setQuickTestResult(null); }}
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 focus:outline-none" />
            </div>
            <button onClick={runQuickTest}
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-lg shadow-amber-600/25 shrink-0">
              🎲 Random Pick
            </button>
          </div>
          {quickTestResult !== null && (
            <div className={`rounded-xl border p-4 ${quickTestResult.startsWith("(no") ? "bg-red-900/20 border-red-700/50" : "bg-emerald-900/30 border-emerald-700/50"}`}>
              {quickTestResult.startsWith("(no") ? (
                <div className="flex items-center gap-3">
                  <span className="text-lg">❌</span>
                  <p className="text-sm font-semibold text-red-300">{quickTestResult === "(no active rules)" ? "No active rules with templates configured" : "No match"}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <span className="text-[10px] font-medium text-red-300 uppercase tracking-wider block mb-1">Message</span>
                      <code className="text-xs font-mono text-slate-300 break-all">{quickTestMessage}</code>
                    </div>
                    <div className="bg-emerald-900/40 rounded-lg p-3">
                      <span className="text-[10px] font-medium text-emerald-300 uppercase tracking-wider block mb-1">Random Template</span>
                      <code className="text-sm font-mono font-bold text-emerald-200 break-all">{quickTestResult}</code>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 italic">The OTP is extracted from the original message and filled into the template via {"{{OTP}}"} placeholder.</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500">
          <span>{rules.filter(r => r.isActive).length} active rules</span>
          <span>•</span>
          <span>{rules.reduce((s, r) => s + r.poolItems.filter(p => p.trim()).length, 0)} total templates</span>
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
                <th className="text-left px-3 py-2.5 font-medium">Templates</th>
                <th className="text-center px-3 py-2.5 font-medium w-44">Preview (sample OTP: <input value={sampleOtp} onChange={e => setSampleOtp(e.target.value)} className="w-12 border rounded px-1 py-0.5 text-center font-mono text-[10px] focus:ring-2 focus:ring-amber-500 focus:outline-none" /></th>
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
                    <p className="text-2xl mb-2">🎲</p>
                    <p className="text-sm">No random content rules yet</p>
                    <p className="text-xs mt-1">Click "+ Add Rule" to create your first rule</p>
                  </td>
                </tr>
              )}
              {rules.map((rule, idx) => {
                const isDirty = originalRules[idx]
                  ? JSON.stringify(rule) !== JSON.stringify(originalRules[idx])
                  : false;
                return (
                  <tr key={idx}
                    className={`hover:bg-blue-50/40 transition-colors ${!rule.isActive ? "opacity-50" : ""} ${dropTargetIdx === idx ? "bg-indigo-50 ring-2 ring-indigo-200" : ""} ${isDirty ? "bg-yellow-50/30" : ""}`}
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
                        className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 text-xs font-medium text-slate-800 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={rule.matchPattern} onChange={e => updateRule(idx, "matchPattern", e.target.value)}
                        placeholder=".*"
                        className="w-28 border rounded px-2 py-1 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2 min-w-[220px]">
                      <div className="space-y-1">
                        {rule.poolItems.map((item, pi) => (
                          <div key={pi} className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 w-4 shrink-0">{pi + 1}.</span>
                            <input value={item} onChange={e => updatePoolItem(idx, pi, e.target.value)}
                              placeholder="Template {{OTP}}"
                              className="flex-1 border rounded px-2 py-1 text-[10px] font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                            {rule.poolItems.length > 1 && (
                              <button onClick={() => removePoolItem(idx, pi)}
                                className="text-red-400 hover:text-red-600 text-[10px] px-0.5 shrink-0">✕</button>
                            )}
                          </div>
                        ))}
                        <div className="flex items-center gap-2 mt-1">
                          <button onClick={() => addPoolItem(idx)}
                            className="text-[10px] text-amber-600 hover:text-amber-800 font-medium">+ Add template</button>
                          <button onClick={() => document.getElementById(`bulk-${idx}`)?.click()}
                            className="text-[10px] text-amber-600 hover:text-amber-800 font-medium">📁 Bulk upload</button>
                          <input id={`bulk-${idx}`} type="file" accept=".txt,.csv" onChange={(e) => handleBulkUpload(idx, e)}
                            className="hidden" />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-1 max-h-20 overflow-y-auto">
                        {rule.poolItems.filter(p => p.trim()).map((item, pi) => {
                          const filled = item.replace(/\{\{OTP\}\}/g, sampleOtp);
                          return (
                            <code key={pi} className={`text-[10px] font-mono block truncate max-w-[160px] ${filled !== item ? "text-emerald-700" : "text-slate-400"}`}>
                              {filled}
                            </code>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <select value={rule.scope} onChange={e => {
                          const v = e.target.value as "client" | "supplier" | "both";
                          updateRule(idx, "scope", v);
                          if (v === "both") { updateRule(idx, "entityId", null); updateRule(idx, "entityName", null); }
                          else if (v === "client" && clients.length > 0) { updateRule(idx, "entityId", clients[0].id); updateRule(idx, "entityName", clients[0].name); }
                          else if (v === "supplier" && suppliers.length > 0) { updateRule(idx, "entityId", suppliers[0].id); updateRule(idx, "entityName", suppliers[0].name); }
                        }} className="border rounded px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-blue-500 focus:outline-none">
                          <option value="both">Global</option>
                          <option value="client">Client</option>
                          <option value="supplier">Supplier</option>
                        </select>
                        {rule.scope === "client" && (
                          <select value={rule.entityId || ""} onChange={e => {
                            const cid = e.target.value ? parseInt(e.target.value) : null;
                            updateRule(idx, "entityId", cid);
                            updateRule(idx, "entityName", cid ? clients.find(c => c.id === cid)?.name || null : null);
                          }} className="border rounded px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[90px]">
                            <option value="">Select...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        )}
                        {rule.scope === "supplier" && (
                          <select value={rule.entityId || ""} onChange={e => {
                            const sid = e.target.value ? parseInt(e.target.value) : null;
                            updateRule(idx, "entityId", sid);
                            updateRule(idx, "entityName", sid ? suppliers.find(s => s.id === sid)?.name || null : null);
                          }} className="border rounded px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[90px]">
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
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <button onClick={() => {
                          const active = rule.poolItems.filter(p => p.trim());
                          if (active.length === 0) { setMsg("No templates to test"); setTimeout(() => setMsg(""), 2000); return; }
                          const pick = active[Math.floor(Math.random() * active.length)];
                          const otp = quickTestMessage.match(/\b(\d{4,8})\b/)?.[1] || sampleOtp;
                          setQuickTestResult(pick.replace(/\{\{OTP\}\}/g, otp));
                        }}
                          className="bg-purple-600 text-white px-2 py-1 rounded text-[10px] font-medium hover:bg-purple-700 transition">Test</button>
                        <button onClick={() => saveRule(idx)}
                          className="bg-green-600 text-white px-2.5 py-1 rounded text-[10px] font-medium hover:bg-green-700 transition">Update</button>
                        <button onClick={() => cancelRule(idx)}
                          disabled={!isDirty}
                          className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 px-2 py-1 rounded text-[10px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Revert unsaved changes">Cancel</button>
                        <button onClick={() => { if (confirm("Delete this rule?")) deleteRule(idx); }}
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
            <button onClick={addRule} className="text-blue-600 hover:text-blue-800 text-[10px] font-medium transition">+ Add Rule</button>
            <button onClick={saveAll} disabled={saving}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </div>
      </div>

      {/* Applies To Table */}
      {assignedRules.length > 0 && (
        <div className="mt-4 bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-2 border-b">
            <h3 className="text-xs font-semibold text-slate-800">📋 Applies To — Client/Supplier Assignments</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2 font-medium">Rule</th>
                <th className="text-left px-3 py-2 font-medium">Scope</th>
                <th className="text-left px-3 py-2 font-medium">Entity</th>
                <th className="text-left px-3 py-2 font-medium">Priority</th>
                <th className="text-left px-3 py-2 font-medium">Templates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignedRules.map((rule, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-700">{rule.name}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${rule.scope === "client" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>
                      {rule.scope === "client" ? "Client" : "Supplier"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-600">{rule.entityName || `#${rule.entityId}`}</td>
                  <td className="px-3 py-2 text-slate-500">{rule.priority}</td>
                  <td className="px-3 py-2 text-slate-500">{rule.poolItems.filter(p => p.trim()).length} templates</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Help */}
      <div className="mt-4 bg-slate-50 border rounded-xl p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-2">💡 How Random Content Works</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Match Pattern:</strong> Regex to match incoming SMS content. Use <code className="bg-slate-200 px-1 rounded text-[10px]">.*</code> to match all.</li>
          <li><strong>Templates:</strong> Each line is one template. Use <code className="bg-slate-200 px-1 rounded text-[10px]">{"{{OTP}}"}</code> as placeholder — the OTP is extracted from the original message and substituted.</li>
          <li><strong>Bulk Upload:</strong> Click 📁 to load templates from a .txt or .csv file (one template per line).</li>
          <li><strong>Preview:</strong> See how each template renders with the sample OTP at the top of the column.</li>
          <li><strong>Test:</strong> Per-row Test button picks a random template and fills the OTP from the Quick Test message.</li>
          <li><strong>Update / Cancel:</strong> Save or revert changes per rule.</li>
          <li><strong>Scope:</strong> Drag clients/suppliers from the top bar. Check the Applies To table.</li>
        </ul>
      </div>
    </div>
  );
}
