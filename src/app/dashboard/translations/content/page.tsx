"use client";

import { useState, useEffect, useCallback } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";

interface ContentRule {
  ruleId: number | null;
  name: string;
  matchPattern: string;
  replacementFixed: string;
  otpMinLength: number;
  otpMaxLength: number;
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

export default function ContentTranslationPage() {
  const { selection } = useMccMnc();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rules, setRules] = useState<ContentRule[]>([]);
  const [clients, setClients] = useState<ClientSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);

  // Drag state
  const [dragEntity, setDragEntity] = useState<{ type: "client" | "supplier"; id: number; name: string } | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [unassignedEntities, setUnassignedEntities] = useState<{ clients: ClientSupplier[]; suppliers: ClientSupplier[] }>({ clients: [], suppliers: [] });

  // Preview
  const [sampleContent, setSampleContent] = useState("Your OTP code is 252525. Valid for 5 min.");
  const [sampleMatch, setSampleMatch] = useState("facebook|FB|OTP");
  const [sampleReplace, setSampleReplace] = useState("Your verification code is {{OTP}}");
  const [sampleMinOtp, setSampleMinOtp] = useState(4);
  const [sampleMaxOtp, setSampleMaxOtp] = useState(8);
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [extractedOtp, setExtractedOtp] = useState<string | null>(null);

  const loadRules = useCallback(async (loadedClients: ClientSupplier[], loadedSuppliers: ClientSupplier[]) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selection.mcc) params.set("mcc", selection.mcc);
      if (selection.mnc) params.set("mnc", selection.mnc);
      params.set("category", "CONTENT");
      const res = await fetch(`/api/tenant/sms-translations?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const profiles = (data.profiles || []) as any[];

      const parsed: ContentRule[] = profiles.map((p: any) => {
        const a = (p.assignments || []).find((x: any) => x.isActive !== false);
        // Parse replacement JSON from stored value
        let replacement = "";
        let otpMin = 4, otpMax = 8;
        const raw = p.replacement_fixed || "";
        if (raw.startsWith("{")) {
          try {
            const meta = JSON.parse(raw);
            if (meta.replacement) replacement = meta.replacement;
            if (meta.otpMinLength) otpMin = meta.otpMinLength;
            if (meta.otpMaxLength) otpMax = meta.otpMaxLength;
          } catch { replacement = raw; }
        } else {
          replacement = raw;
        }
        return {
          ruleId: p.id,
          name: p.name,
          matchPattern: p.match_pattern || ".*",
          replacementFixed: replacement,
          otpMinLength: otpMin,
          otpMaxLength: otpMax,
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
    } catch (err) {
      setError("Failed to load rules. " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selection]);

  // Load clients/suppliers first, then load rules with them
  useEffect(() => {
    Promise.all([
      fetch("/api/tenant/clients").then(r => r.json()),
      fetch("/api/tenant/suppliers").then(r => r.json()),
    ]).then(([cData, sData]) => {
      const cls = cData.clients || [];
      const sups = sData.suppliers || [];
      setClients(cls);
      setSuppliers(sups);
      loadRules(cls, sups);
    }).catch(() => {
      loadRules([], []);
    });
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
    setRules(prev => [...prev, {
      ruleId: null, name: `OTP Forward ${prev.length + 1}`,
      matchPattern: "facebook|FB|OTP", replacementFixed: "Your verification code is {{OTP}}",
      otpMinLength: 4, otpMaxLength: 8,
      scope: "both", entityId: null, entityName: null,
      priority: prev.length + 1,
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
    loadRules(clients, suppliers);
  };

  const updateRule = (idx: number, field: string, value: any) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
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

  const buildReplacementJson = (rule: ContentRule): string => {
    return JSON.stringify({
      replacement: rule.replacementFixed,
      otpMinLength: rule.otpMinLength,
      otpMaxLength: rule.otpMaxLength,
    });
  };

  const saveRuleToApi = async (rule: ContentRule): Promise<number | null> => {
    const jsonReplacement = buildReplacementJson(rule);
    const otpRegex = `(\\\\d{${rule.otpMinLength},${rule.otpMaxLength}})`;
    if (rule.ruleId) {
      const res = await fetch(`/api/tenant/sms-translations/${rule.ruleId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rule.name,
          matchPattern: rule.matchPattern || otpRegex,
          replacementFixed: jsonReplacement,
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
          name: rule.name, targetField: "BODY", category: "CONTENT", mode: "FIXED",
          matchPattern: rule.matchPattern || otpRegex,
          replacementFixed: jsonReplacement,
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
    loadRules(clients, suppliers);
  };

  const extractOtp = (content: string, minLen: number, maxLen: number): string | null => {
    const regex = new RegExp(`\\b(\\d{${minLen},${maxLen}})\\b`);
    const m = content.match(regex);
    return m ? m[1] : null;
  };

  const runPreview = () => {
    const otp = extractOtp(sampleContent, sampleMinOtp, sampleMaxOtp);
    setExtractedOtp(otp);
    let result = sampleContent;
    try {
      result = result.replace(new RegExp(sampleMatch, "gm"), sampleReplace);
      if (otp) result = result.replace(/\{\{OTP\}\}/g, otp);
    } catch { /* skip */ }
    setPreviewResult(result);
  };

  const previewTransform = (content: string, match: string, replace: string, minOtp: number, maxOtp: number): string => {
    try {
      let result = content.replace(new RegExp(match, "gm"), replace);
      const otp = extractOtp(content, minOtp, maxOtp);
      if (otp) result = result.replace(/\{\{OTP\}\}/g, otp);
      return result;
    } catch { return content; }
  };

  const handleDragOverRule = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDropTargetIdx(idx);
  };

  // Rules that have a client/supplier assigned
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
          <h2 className="text-lg font-bold text-slate-800">Content Translation — OTP Forward</h2>
          <p className="text-xs text-slate-400">Match keywords, replace with OTP templates — applied per client or supplier</p>
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
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-4 mb-6">
        <h4 className="text-sm font-semibold text-teal-800 mb-3">🔬 Content Translation + OTP Extraction Preview</h4>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs text-slate-500 w-16">Sample:</span>
            <input value={sampleContent} onChange={e => setSampleContent(e.target.value)}
              className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 font-mono text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs text-slate-500 w-16">Match:</span>
            <input value={sampleMatch} onChange={e => setSampleMatch(e.target.value)}
              className="w-40 border rounded-lg px-2 py-2 font-mono text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white" />
            <span className="text-slate-400">→</span>
            <span className="text-xs text-slate-500">Replace:</span>
            <input value={sampleReplace} onChange={e => setSampleReplace(e.target.value)}
              className="w-56 border rounded-lg px-2 py-2 font-mono text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white" />
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-mono">{"{{OTP}}"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs text-slate-500 w-16">OTP:</span>
            <span className="text-xs text-slate-400">Min</span>
            <input type="number" min={2} max={20} value={sampleMinOtp} onChange={e => setSampleMinOtp(parseInt(e.target.value) || 4)}
              className="w-14 border rounded px-1.5 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white" />
            <span className="text-xs text-slate-400">digits → Max</span>
            <input type="number" min={2} max={20} value={sampleMaxOtp} onChange={e => setSampleMaxOtp(parseInt(e.target.value) || 8)}
              className="w-14 border rounded px-1.5 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white" />
            <span className="text-xs text-slate-400">digits</span>
            <button onClick={runPreview}
              className="bg-teal-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-teal-700 transition">
              Preview
            </button>
          </div>
          {(previewResult !== null || extractedOtp !== null) && (
            <div className="bg-white rounded-lg p-3 border border-teal-100 space-y-1">
              {extractedOtp !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">OTP:</span>
                  <code className={`text-xs font-mono font-bold ${extractedOtp ? "text-amber-700 bg-amber-50" : "text-red-500 bg-red-50"} px-2 py-0.5 rounded`}>
                    {extractedOtp || "not found"}
                  </code>
                  <span className="text-[10px] text-slate-400">
                    (looking for {sampleMinOtp}-{sampleMaxOtp} digits)
                  </span>
                </div>
              )}
              {previewResult !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">Result:</span>
                  <code className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded flex-1">{previewResult}</code>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unassigned Clients/Suppliers — drag onto rules */}
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
                <th className="text-left px-3 py-2.5 font-medium">Replace With</th>
                <th className="text-left px-3 py-2.5 font-medium w-24">OTP Length</th>
                <th className="text-left px-3 py-2.5 font-medium w-48">Applies To</th>
                <th className="text-left px-3 py-2.5 font-medium w-16">Priority</th>
                <th className="text-center px-3 py-2.5 font-medium w-12">Active</th>
                <th className="text-center px-3 py-2.5 font-medium">Preview</th>
                <th className="text-right px-4 py-2.5 font-medium w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    <p className="text-2xl mb-2">📝</p>
                    <p className="text-sm">No content translation rules yet</p>
                    <p className="text-xs mt-1">Click "+ Add Rule" to create your first OTP Forward rule</p>
                  </td>
                </tr>
              )}
              {rules.map((rule, idx) => {
                const preview = rule.isActive
                  ? previewTransform("Your OTP code is 252525", rule.matchPattern, rule.replacementFixed, rule.otpMinLength, rule.otpMaxLength)
                  : "—";
                return (
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
                        placeholder="OTP Forward"
                        className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 text-xs font-medium text-slate-800 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={rule.matchPattern} onChange={e => updateRule(idx, "matchPattern", e.target.value)}
                        placeholder="facebook|FB|OTP"
                        className="w-36 border rounded px-2 py-1 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input value={rule.replacementFixed} onChange={e => updateRule(idx, "replacementFixed", e.target.value)}
                          placeholder="Your code is {{OTP}}"
                          className="w-40 border rounded px-2 py-1 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        {rule.replacementFixed.includes("{{OTP}}") && (
                          <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded font-mono">OTP</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input type="number" min={2} max={20} value={rule.otpMinLength}
                          onChange={e => updateRule(idx, "otpMinLength", parseInt(e.target.value) || 4)}
                          className="w-10 border rounded px-1 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        <span className="text-[9px] text-slate-400">-</span>
                        <input type="number" min={2} max={20} value={rule.otpMaxLength}
                          onChange={e => updateRule(idx, "otpMaxLength", parseInt(e.target.value) || 8)}
                          className="w-10 border rounded px-1 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        <span className="text-[9px] text-slate-400">dig</span>
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
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 max-w-[180px]">
                        <code className="text-[9px] text-slate-400 font-mono truncate">"Your OTP..."</code>
                        <span className="text-slate-300 shrink-0">→</span>
                        <code className={`text-[9px] font-mono font-semibold truncate ${rule.isActive ? "text-teal-700" : "text-slate-400"}`}>{preview}</code>
                      </div>
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
                <th className="text-left px-3 py-2 font-medium">OTP Range</th>
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
                  <td className="px-3 py-2 font-mono text-slate-500">{rule.otpMinLength}-{rule.otpMaxLength} digits</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Help */}
      <div className="mt-4 bg-slate-50 border rounded-xl p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-2">💡 How Content Translation Works</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Match Content:</strong> Regex pattern to find keywords in the SMS body (e.g., <code className="bg-slate-200 px-1 rounded text-[10px]">facebook|FB|OTP</code>)</li>
          <li><strong>Replace With:</strong> The new message template. Use <code className="bg-slate-200 px-1 rounded text-[10px]">{`{{OTP}}`}</code> to auto-fill the extracted code.</li>
          <li><strong>OTP Length:</strong> Extracts digits between Min and Max length. Default: 4-8 digits. The extracted OTP fills the <code className="bg-slate-200 px-1 rounded text-[10px]">{`{{OTP}}`}</code> placeholder.</li>
          <li><strong>Scope:</strong> Drag clients/suppliers from the top bar to assign them to specific rules.</li>
          <li><strong>Priority:</strong> Lower numbers run first. Check the Applies To table to see all assignments.</li>
        </ul>
      </div>
    </div>
  );
}
