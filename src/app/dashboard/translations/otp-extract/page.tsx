"use client";

import { useState, useEffect, useCallback } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";

interface OtpExtractRule {
  ruleId: number | null;
  name: string;
  regexPattern: string;           // the regex for extraction
  otpMinLength: number;           // used when no customRegex
  otpMaxLength: number;
  customRegex: string;            // optional — overrides min/max with capture groups
  showCustomRegex: boolean;
  otpGroupIndex: number;          // which capture group has the OTP
  forwardSupplierId: number | null;
  forwardSupplierName: string | null;
  forwardSender: string;
  forwardTemplate: string;
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

export default function OtpExtractPage() {
  const { selection } = useMccMnc();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rules, setRules] = useState<OtpExtractRule[]>([]);
  const [originalRules, setOriginalRules] = useState<OtpExtractRule[]>([]);
  const [clients, setClients] = useState<ClientSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);

  // Drag state
  const [dragEntity, setDragEntity] = useState<{ type: "client" | "supplier"; id: number; name: string } | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [unassignedEntities, setUnassignedEntities] = useState<{ clients: ClientSupplier[]; suppliers: ClientSupplier[] }>({ clients: [], suppliers: [] });

  // Quick OTP Extraction Test
  const [quickTestMessage, setQuickTestMessage] = useState("");
  const [quickTestResult, setQuickTestResult] = useState<{ otp: string | null; matchedRule: string | null; template: string | null } | null>(null);

  // Per-row test state
  const [testRowIdx, setTestRowIdx] = useState<number | null>(null);
  const [testSample, setTestSample] = useState("");
  const [testResult, setTestResult] = useState<{ otp: string | null; template: string } | null>(null);

  const loadRules = useCallback(async (loadedSuppliers: ClientSupplier[]) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selection.mcc) params.set("mcc", selection.mcc);
      if (selection.mnc) params.set("mnc", selection.mnc);
      const res = await fetch(`/api/tenant/otp-extract-rules?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const profiles = (data.data || data.rules || []) as any[];

      const parsed: OtpExtractRule[] = profiles.map((p: any) => {
        // Try parsing regex to figure out min/max lengths
        let otpMin = 4, otpMax = 8;
        let customRegex = "";
        const rawRegex = p.regex_pattern || p.regexPattern || "";
        const lenMatch = rawRegex.match(/\\d\{(\d+),(\d+)\}/);
        if (lenMatch) {
          otpMin = parseInt(lenMatch[1]) || 4;
          otpMax = parseInt(lenMatch[2]) || 8;
        } else if (rawRegex && rawRegex !== `(\\d{4,8})`) {
          // Non-standard regex — treat as custom
          customRegex = rawRegex;
        }

        const supplierName = p.forward_supplier_id
          ? loadedSuppliers.find((s: ClientSupplier) => s.id === p.forward_supplier_id)?.name || `Supplier #${p.forward_supplier_id}`
          : null;

        return {
          ruleId: p.id,
          name: p.name || `OTP ${p.mcc || ""}${p.mnc || ""}`,
          regexPattern: customRegex ? customRegex : rawRegex || `(\\d{${otpMin},${otpMax}})`,
          otpMinLength: otpMin,
          otpMaxLength: otpMax,
          customRegex,
          showCustomRegex: !!customRegex,
          otpGroupIndex: p.otp_group_index || p.otpGroupIndex || 1,
          forwardSupplierId: p.forward_supplier_id || p.forwardSupplierId || null,
          forwardSupplierName: supplierName,
          forwardSender: p.forward_sender || p.forwardSender || "",
          forwardTemplate: p.forward_template || p.forwardTemplate || "Your OTP code is {otp}",
          scope: "both",
          entityId: null,
          entityName: null,
          priority: p.sort_order || p.sortOrder || 1,
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
      loadRules(sups);
    }).catch(() => loadRules([]));
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
    const newRule: OtpExtractRule = {
      ruleId: null, name: `OTP Extract ${rules.length + 1}`,
      regexPattern: "(\\d{4,8})", otpMinLength: 4, otpMaxLength: 8,
      customRegex: "", showCustomRegex: false, otpGroupIndex: 1,
      forwardSupplierId: suppliers.length > 0 ? suppliers[0].id : null,
      forwardSupplierName: suppliers.length > 0 ? suppliers[0].name : null,
      forwardSender: "", forwardTemplate: "Your OTP code is {otp}",
      scope: "both", entityId: null, entityName: null,
      priority: rules.length + 1,
      isActive: true, mcc: selection.mcc || "", mnc: selection.mnc || "",
    };
    setRules(prev => [...prev, newRule]);
    setOriginalRules(prev => [...prev, JSON.parse(JSON.stringify(newRule))]);
  };

  const deleteRule = async (idx: number) => {
    const rule = rules[idx];
    if (rule.ruleId) {
      await fetch(`/api/tenant/otp-extract-rules/${rule.ruleId}`, { method: "DELETE" });
    }
    setRules(prev => prev.filter((_, i) => i !== idx));
    setOriginalRules(prev => prev.filter((_, i) => i !== idx));
    setMsg("Rule deleted");
    setTimeout(() => setMsg(""), 2000);
    loadRules(suppliers);
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

  // Build the effective regex from min/max or custom
  const buildEffectiveRegex = (rule: OtpExtractRule): string => {
    if (rule.customRegex) return rule.customRegex;
    return `(\\d{${rule.otpMinLength},${rule.otpMaxLength}})`;
  };

  const saveRuleToApi = async (rule: OtpExtractRule): Promise<number | null> => {
    const effectiveRegex = buildEffectiveRegex(rule);
    const payload: any = {
      name: rule.name,
      regex_pattern: rule.customRegex || effectiveRegex,
      otp_group_index: rule.otpGroupIndex,
      forward_supplier_id: rule.forwardSupplierId,
      forward_sender: rule.forwardSender || null,
      forward_template: rule.forwardTemplate,
      mcc: rule.mcc || null,
      mnc: rule.mnc || null,
      sort_order: rule.priority,
      is_active: rule.isActive,
      scope: rule.scope,
      entity_id: rule.entityId,
    };
    if (rule.ruleId) {
      const res = await fetch(`/api/tenant/otp-extract-rules/${rule.ruleId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return rule.ruleId;
    } else {
      const res = await fetch("/api/tenant/otp-extract-rules", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      return created.id || created.rule?.id || null;
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
    loadRules(suppliers);
  };

  // Extract OTP using effective regex
  const extractOtp = (content: string, regexStr: string, groupIdx: number): string | null => {
    try {
      const re = new RegExp(regexStr, "gm");
      const m = re.exec(content);
      if (m) {
        // If there are capture groups, use the specified one; otherwise use full match
        if (m.length > 1 && m[groupIdx]) return m[groupIdx];
        return m[0];
      }
    } catch { /* skip */ }
    return null;
  };

  // Quick OTP Extraction Test — runs all active rules and returns first match
  const runQuickTest = () => {
    const msg = quickTestMessage.trim();
    if (!msg) { setMsg("Paste a message first"); setTimeout(() => setMsg(""), 2000); return; }
    setQuickTestLoading(true);
    for (const rule of rules) {
      if (!rule.isActive) continue;
      const effectiveRegex = buildEffectiveRegex(rule);
      const otp = extractOtp(msg, effectiveRegex, rule.otpGroupIndex);
      if (otp) {
        const applied = (rule.forwardTemplate || "{otp}").replace(/\{otp\}/g, otp);
        setQuickTestResult({ otp, matchedRule: rule.name, template: applied });
        setQuickTestLoading(false);
        return;
      }
    }
    setQuickTestResult({ otp: null, matchedRule: null, template: null });
    setQuickTestLoading(false);
  };

  // Per-row test
  const testRule = (idx: number) => {
    const rule = rules[idx];
    if (!rule.isActive) {
      setMsg("Rule is inactive — activate it first");
      setTimeout(() => setMsg(""), 2000);
      return;
    }
    const sample = testSample || "Your OTP code is 252525. Valid for 5 min.";
    const effectiveRegex = buildEffectiveRegex(rule);
    const otp = extractOtp(sample, effectiveRegex, rule.otpGroupIndex);
    const template = otp ? (rule.forwardTemplate || "{otp}").replace(/\{otp\}/g, otp) : "(no match)";
    setTestRowIdx(idx);
    setTestSample(sample);
    setTestResult({ otp, template });
  };

  const closeTest = () => {
    setTestRowIdx(null);
    setTestResult(null);
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
          <h2 className="text-lg font-bold text-slate-800">OTP Extract & Forward</h2>
          <p className="text-xs text-slate-400">Extract OTP from SMS, apply template, forward to supplier — assigned per client/supplier</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Scope: <strong>{selection.label}</strong></span>
          <button onClick={addRule}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
            + Add Rule
          </button>
        </div>
      </div>

      {/* Quick OTP Extraction Test — BIG standalone tool */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 border border-slate-700 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">⚡</span>
          <div>
            <h3 className="text-lg font-bold text-white">Quick OTP Extraction Test</h3>
            <p className="text-xs text-slate-400">Paste any message with an OTP and see what gets extracted</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <div className="relative">
            <textarea
              value={quickTestMessage}
              onChange={e => { setQuickTestMessage(e.target.value); setQuickTestResult(null); }}
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) runQuickTest(); }}
              placeholder="Paste your test message here... e.g. &#34;Your OTP code is 252525. Valid for 5 min.&#34;"
              rows={3}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none resize-none transition"
            />
            <span className="absolute bottom-2 right-3 text-[10px] text-slate-500">Ctrl+Enter to extract</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={runQuickTest}
              disabled={!quickTestMessage.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-lg shadow-indigo-600/25">
              🔍 Extract OTP
            </button>
            <button
              onClick={() => { setQuickTestMessage(""); setQuickTestResult(null); }}
              className="text-slate-400 hover:text-slate-200 text-xs transition">Clear</button>
          </div>

          {/* Result display */}
          {quickTestResult && (
            <div className={`rounded-xl border p-4 ${quickTestResult.otp ? "bg-emerald-900/30 border-emerald-700/50" : "bg-red-900/20 border-red-700/50"}`}>
              {quickTestResult.otp ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-emerald-300 uppercase tracking-wider">Extracted OTP</span>
                    <code className="text-2xl font-mono font-bold text-emerald-200 bg-emerald-900/50 px-4 py-1.5 rounded-lg tracking-wider">
                      {quickTestResult.otp}
                    </code>
                    <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded font-medium">
                      via: {quickTestResult.matchedRule}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-400/70 shrink-0">Forwarded message:</span>
                    <code className="text-xs font-mono text-slate-200 bg-slate-800/50 px-3 py-1.5 rounded-lg flex-1">
                      {quickTestResult.template}
                    </code>
                  </div>
                  {(() => {
                    const matchingRule = rules.find(r => r.name === quickTestResult.matchedRule && r.isActive);
                    if (matchingRule?.forwardSupplierId) {
                      return (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 shrink-0">Forward to:</span>
                          <span className="text-[10px] text-slate-400">
                            📦 {matchingRule.forwardSupplierName || `Supplier #${matchingRule.forwardSupplierId}`}
                            {matchingRule.forwardSender ? ` (sender: ${matchingRule.forwardSender})` : ""}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              ) : (                  <div className="flex items-center gap-3">
                    <span className="text-lg">❌</span>
                    <div>
                      <p className="text-sm font-semibold text-red-300">No OTP found</p>
                      <p className="text-[10px] text-red-400/70">
                        {rules.filter(r => r.isActive).length === 0
                          ? "No active extraction rules configured. Add and activate a rule first."
                          : `None of the ${rules.filter(r => r.isActive).length} active rules matched. Try adjusting the regex pattern or min/max length.`}
                      </p>
                    </div>
                  </div>
              )}
            </div>
          )}

          {/* Quick stats */}
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span>{rules.filter(r => r.isActive).length} active rules</span>
            <span>•</span>
            <span>First match wins</span>
            <span>•</span>
            <span>Tested in priority order</span>
          </div>
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
                <th className="text-left px-3 py-2.5 font-medium">Regex / Length</th>
                <th className="text-left px-3 py-2.5 font-medium w-14">Group</th>
                <th className="text-left px-3 py-2.5 font-medium">Forward To</th>
                <th className="text-left px-3 py-2.5 font-medium">Template</th>
                <th className="text-left px-3 py-2.5 font-medium w-48">Applies To</th>
                <th className="text-left px-3 py-2.5 font-medium w-16">Priority</th>
                <th className="text-center px-3 py-2.5 font-medium w-12">Active</th>
                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    <p className="text-2xl mb-2">🔍</p>
                    <p className="text-sm">No OTP extract rules yet</p>
                    <p className="text-xs mt-1">Click "+ Add Rule" to create your first extraction rule</p>
                  </td>
                </tr>
              )}
              {rules.map((rule, idx) => {
                const isDirty = originalRules[idx]
                  ? JSON.stringify({ ...rule, showCustomRegex: undefined }) !== JSON.stringify({ ...originalRules[idx], showCustomRegex: undefined })
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
                        placeholder="OTP Extract"
                        className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 text-xs font-medium text-slate-800 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      {!rule.showCustomRegex ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] text-slate-400">Min</span>
                          <input type="number" min={2} max={20} value={rule.otpMinLength}
                            onChange={e => updateRule(idx, "otpMinLength", parseInt(e.target.value) || 4)}
                            className="w-10 border rounded px-1 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                          <span className="text-[9px] text-slate-400">-</span>
                          <input type="number" min={2} max={20} value={rule.otpMaxLength}
                            onChange={e => updateRule(idx, "otpMaxLength", parseInt(e.target.value) || 8)}
                            className="w-10 border rounded px-1 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                          <span className="text-[9px] text-slate-400">dig</span>
                          <button
                            onClick={() => { updateRule(idx, "showCustomRegex", true); updateRule(idx, "customRegex", rule.customRegex || `(\\d{${rule.otpMinLength},${rule.otpMaxLength}})`); }}
                            className="text-[9px] text-blue-500 hover:text-blue-700 underline ml-1"
                            title="Use custom regex instead">regex</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-wrap">
                          <input value={rule.customRegex} onChange={e => updateRule(idx, "customRegex", e.target.value)}
                            placeholder={`(\\d{${rule.otpMinLength},${rule.otpMaxLength}})`}
                            className="w-44 border rounded px-2 py-1 font-mono text-[10px] focus:ring-2 focus:ring-blue-500 focus:outline-none bg-purple-50" />
                          <button
                            onClick={() => { updateRule(idx, "showCustomRegex", false); updateRule(idx, "customRegex", ""); }}
                            className="text-[9px] text-red-400 hover:text-red-600 underline"
                            title="Switch back to min/max">min/max</button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input type="number" min={1} max={9} value={rule.otpGroupIndex}
                          onChange={e => updateRule(idx, "otpGroupIndex", parseInt(e.target.value) || 1)}
                          className="w-10 border rounded px-1.5 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        {rule.customRegex && !rule.customRegex.includes("(") && (
                          <span className="text-[8px] text-slate-400" title="No capture groups in custom regex — group index ignored">(n/a)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <select value={rule.forwardSupplierId || ""} onChange={e => {
                          const sid = e.target.value ? parseInt(e.target.value) : null;
                          updateRule(idx, "forwardSupplierId", sid);
                          updateRule(idx, "forwardSupplierName", sid ? suppliers.find(s => s.id === sid)?.name || null : null);
                        }} className="border rounded px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[100px]">
                          <option value="">None</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        {rule.forwardSupplierId && (
                          <input value={rule.forwardSender} onChange={e => updateRule(idx, "forwardSender", e.target.value)}
                            placeholder="Sender ID"
                            className="w-24 border rounded px-1.5 py-1 text-[10px] font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input value={rule.forwardTemplate} onChange={e => updateRule(idx, "forwardTemplate", e.target.value)}
                        placeholder="Your OTP code is {otp}"
                        className="w-40 border rounded px-2 py-1 text-[10px] font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <select value={rule.scope} onChange={e => {
                          const v = e.target.value as "client" | "supplier" | "both";
                          updateRule(idx, "scope", v);
                          if (v === "both") { updateRule(idx, "entityId", null); updateRule(idx, "entityName", null); }
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
                        <button onClick={() => testRule(idx)}
                          className="bg-purple-500 text-white px-2 py-1 rounded text-[10px] font-medium hover:bg-purple-600 transition"
                          title="Test OTP extraction with sample">Test</button>
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

      {/* Per-row Test Result */}
      {testRowIdx !== null && testResult && (
        <div className="mt-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-orange-800">🧪 Testing: {rules[testRowIdx]?.name}</h4>
            <button onClick={closeTest} className="text-orange-400 hover:text-orange-600 text-xs font-medium">Close</button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 w-24 shrink-0">Sample Input:</span>
              <input value={testSample} onChange={e => setTestSample(e.target.value)}
                className="flex-1 border rounded px-2 py-1.5 font-mono text-xs bg-white focus:ring-2 focus:ring-orange-500 focus:outline-none" />
              <button onClick={() => testRule(testRowIdx!)}
                className="bg-orange-600 text-white px-3 py-1.5 rounded text-[10px] font-medium hover:bg-orange-700 transition">Re-run</button>
            </div>
            <div className="bg-white rounded-lg p-3 border border-orange-100 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-24 shrink-0">Regex:</span>
                <code className="text-xs font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                  {buildEffectiveRegex(rules[testRowIdx]!)}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-24 shrink-0">Group Index:</span>
                <code className="text-xs font-mono">{rules[testRowIdx]?.otpGroupIndex}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-24 shrink-0">Extracted OTP:</span>
                <code className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${testResult.otp ? "text-amber-700 bg-amber-50" : "text-red-500 bg-red-50"}`}>
                  {testResult.otp || "❌ not found"}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-24 shrink-0">Forward To:</span>
                <span className="text-xs text-slate-700">
                  {rules[testRowIdx]?.forwardSupplierName || "none"}
                  {rules[testRowIdx]?.forwardSender ? ` (sender: ${rules[testRowIdx]?.forwardSender})` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-24 shrink-0">Result:</span>
                <code className={`text-xs font-mono font-semibold px-2 py-1 rounded flex-1 ${testResult.otp ? "text-emerald-700 bg-emerald-50" : "text-red-500 bg-red-50"}`}>
                  {testResult.template}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <th className="text-left px-3 py-2 font-medium">Forward To</th>
                <th className="text-left px-3 py-2 font-medium">Regex</th>
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
                  <td className="px-3 py-2 text-slate-500">{rule.forwardSupplierName || "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-slate-500">
                    {rule.customRegex
                      ? <code className="text-purple-600 bg-purple-50 px-1 rounded">{rule.customRegex}</code>
                      : `${rule.otpMinLength}-${rule.otpMaxLength} digits`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Help */}
      <div className="mt-4 bg-slate-50 border rounded-xl p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-2">💡 How OTP Extract Works</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Min/Max Length:</strong> Automatically builds a regex like <code className="bg-slate-200 px-1 rounded text-[10px]">{`(\\d{4,8})`}</code> to find the OTP. Toggle to <strong>Custom Regex</strong> for advanced patterns.</li>
          <li><strong>Custom Regex:</strong> Overrides min/max. Use capture groups like <code className="bg-slate-200 px-1 rounded text-[10px]">{`OTP[:_](\\d+)`}</code>. Group 1 is the OTP (adjust Group index).</li>
          <li><strong>Group Index:</strong> Which capture group contains the OTP code (1-based). Default: 1.</li>
          <li><strong>Forward To:</strong> Supplier to send the extracted OTP to + optional Sender ID.</li>
          <li><strong>Template:</strong> Message template with <code className="bg-slate-200 px-1 rounded text-[10px]">{`{otp}`}</code> placeholder.</li>
          <li><strong>Test:</strong> Click per-row to extract and preview the result with sample text.</li>
          <li><strong>Update / Cancel:</strong> Save or revert changes per rule.</li>
          <li><strong>Scope:</strong> Drag clients/suppliers from the top bar to assign rules.</li>
        </ul>
      </div>
    </div>
  );
}
