"use client";

import { useState, useEffect, useCallback } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";
import { buildRegex } from "@/lib/regex-utils";
import TranslationModal from "@/components/translation-modal";
import EntityMultiSelect from "@/components/entity-multiselect";

interface ContentRule {
  ruleId: number | null;
  name: string;
  matchPattern: string;
  replacementFixed: string;
  otpMinLength: number;
  otpMaxLength: number;
  customRegex: string;
  showCustomRegex: boolean;
  scope: "client" | "supplier" | "both";
  entityIds: number[];
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<ContentRule | null>(null);
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [extractedOtp, setExtractedOtp] = useState<string | null>(null);

  const sampleContent = "Your OTP code is 252525. Valid for 5 min.";

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
        const assignments = (p.assignments || []).filter((x: any) => x.isActive !== false);
        let replacement = "";
        let otpMin = 4, otpMax = 8;
        let customRegex = "";
        const raw = p.replacement_fixed || "";
        if (raw.startsWith("{")) {
          try {
            const meta = JSON.parse(raw);
            if (meta.replacement) replacement = meta.replacement;
            if (meta.otpMinLength) otpMin = meta.otpMinLength;
            if (meta.otpMaxLength) otpMax = meta.otpMaxLength;
            if (meta.customRegex) customRegex = meta.customRegex;
          } catch { replacement = raw; }
        } else {
          replacement = raw;
        }
        const clientIds = assignments.filter((a: any) => a.clientId).map((a: any) => a.clientId as number);
        const supplierIds = assignments.filter((a: any) => a.supplierId).map((a: any) => a.supplierId as number);
        const scope: "client" | "supplier" | "both" = clientIds.length > 0 ? "client" : supplierIds.length > 0 ? "supplier" : "both";
        const entityIds = scope === "client" ? clientIds : scope === "supplier" ? supplierIds : [];
        return {
          ruleId: p.id,
          name: p.name,
          matchPattern: p.match_pattern || ".*",
          replacementFixed: replacement,
          otpMinLength: otpMin,
          otpMaxLength: otpMax,
          customRegex,
          showCustomRegex: !!customRegex,
          scope,
          entityIds,
          priority: assignments[0]?.priority || 1,
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

  const newDraft = (): ContentRule => ({
    ruleId: null, name: `OTP Forward ${rules.length + 1}`,
    matchPattern: "facebook|FB|OTP", replacementFixed: "Your verification code is {{OTP}}",
    otpMinLength: 4, otpMaxLength: 8, customRegex: "", showCustomRegex: false,
    scope: "both", entityIds: [],
    priority: rules.length + 1,
    isActive: true, mcc: selection.mcc || "", mnc: selection.mnc || "",
  });

  const openAdd = () => {
    setDraft(newDraft());
    setEditingIdx(null);
    setPreviewResult(null);
    setExtractedOtp(null);
    setModalOpen(true);
  };

  const openEdit = (idx: number) => {
    setDraft(JSON.parse(JSON.stringify(rules[idx])));
    setEditingIdx(idx);
    setPreviewResult(null);
    setExtractedOtp(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setDraft(null);
    setEditingIdx(null);
    setPreviewResult(null);
    setExtractedOtp(null);
  };

  const updateDraft = (field: string, value: any) => {
    setDraft(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const toggleEntity = (id: number) => {
    setDraft(prev => {
      if (!prev) return prev;
      const has = prev.entityIds.includes(id);
      return { ...prev, entityIds: has ? prev.entityIds.filter(x => x !== id) : [...prev.entityIds, id] };
    });
  };

  const extractOtpWithCustom = (content: string, customRegex: string, minLen: number, maxLen: number): string | null => {
    if (customRegex) {
      try {
        const regex = buildRegex(customRegex);
        const m = content.match(regex);
        return m ? (m[1] || m[0]) : null;
      } catch { /* fall through */ }
    }
    const regex = buildRegex(`\\b(\\d{${minLen},${maxLen}})\\b`);
    const m = content.match(regex);
    return m ? m[1] : null;
  };

  const previewTransform = (content: string, match: string, replace: string, minOtp: number, maxOtp: number, customRegex?: string): string => {
    try {
      let result = content.replace(buildRegex(match, "m"), replace);
      const otp = extractOtpWithCustom(content, customRegex || "", minOtp, maxOtp);
      if (otp) result = result.replace(/\{\{OTP\}\}/g, otp);
      return result;
    } catch { return content; }
  };

  const buildReplacementJson = (rule: ContentRule): string => {
    const obj: any = {
      replacement: rule.replacementFixed,
      otpMinLength: rule.otpMinLength,
      otpMaxLength: rule.otpMaxLength,
    };
    if (rule.customRegex) obj.customRegex = rule.customRegex;
    return JSON.stringify(obj);
  };

  const saveRuleToApi = async (rule: ContentRule): Promise<number | null> => {
    const jsonReplacement = buildReplacementJson(rule);
    const lengthRegex = `(\\d{${rule.otpMinLength},${rule.otpMaxLength}})`;
    if (rule.ruleId) {
      const res = await fetch(`/api/tenant/sms-translations/${rule.ruleId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rule.name,
          matchPattern: rule.matchPattern || lengthRegex,
          replacementFixed: jsonReplacement,
          mcc: rule.mcc || null, mnc: rule.mnc || null,
          scope: rule.scope, entityIds: rule.entityIds, priority: rule.priority,
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
          matchPattern: rule.matchPattern || lengthRegex,
          replacementFixed: jsonReplacement,
          mcc: rule.mcc || null, mnc: rule.mnc || null,
          scope: rule.scope, entityIds: rule.entityIds, priority: rule.priority,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      return created.profile?.id || created.id || null;
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { setError("Name is required"); return; }
    if (!draft.matchPattern.trim()) { setError("Match pattern is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const newId = await saveRuleToApi(draft);
      if (editingIdx === null) {
        setRules(prev => [...prev, { ...draft, ruleId: newId ?? draft.ruleId }]);
      } else {
        setRules(prev => prev.map((r, i) => i === editingIdx ? { ...draft, ruleId: newId ?? draft.ruleId } : r));
      }
      setMsg(`"${draft.name}" saved!`);
      setTimeout(() => setMsg(""), 2500);
      closeModal();
      loadRules(clients, suppliers);
    } catch (err) {
      setError(`Failed to save: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (idx: number) => {
    const rule = rules[idx];
    if (rule.ruleId) {
      await fetch(`/api/tenant/sms-translations/${rule.ruleId}`, { method: "DELETE" }).catch(() => {});
    }
    setRules(prev => prev.filter((_, i) => i !== idx));
    setMsg("Rule deleted");
    setTimeout(() => setMsg(""), 2000);
  };

  const runPreview = () => {
    if (!draft) return;
    const otp = extractOtpWithCustom(sampleContent, draft.customRegex, draft.otpMinLength, draft.otpMaxLength);
    setExtractedOtp(otp);
    const result = previewTransform(sampleContent, draft.matchPattern, draft.replacementFixed, draft.otpMinLength, draft.otpMaxLength, draft.customRegex);
    setPreviewResult(result);
  };

  const entityLabel = (rule: ContentRule) => {
    if (rule.scope === "client") return rule.entityIds.map(id => clients.find(c => c.id === id)?.name || `Client #${id}`).join(", ");
    if (rule.scope === "supplier") return rule.entityIds.map(id => suppliers.find(s => s.id === id)?.name || `Supplier #${id}`).join(", ");
    return "All clients and suppliers";
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

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Content Translation</h2>
          <p className="text-xs text-slate-400">Match keywords, replace with OTP templates — applied per client or supplier</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Scope: <strong>{selection.label}</strong></span>
          <button onClick={openAdd}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
            + Add Rule
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
              <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
              <th className="text-left px-3 py-2.5 font-medium">Name</th>
              <th className="text-left px-3 py-2.5 font-medium">Match</th>
              <th className="text-left px-3 py-2.5 font-medium">Replace With</th>
              <th className="text-left px-3 py-2.5 font-medium">OTP</th>
              <th className="text-left px-3 py-2.5 font-medium">Applies To</th>
              <th className="text-left px-3 py-2.5 font-medium w-16">Priority</th>
              <th className="text-center px-3 py-2.5 font-medium w-16">Active</th>
              <th className="text-right px-4 py-2.5 font-medium w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                  <p className="text-2xl mb-2">✉️</p>
                  <p className="text-sm">No content translation rules yet</p>
                  <p className="text-xs mt-1">Click &quot;+ Add Rule&quot; to create your first rule</p>
                </td>
              </tr>
            )}
            {rules.map((rule, idx) => (
              <tr key={idx} className={`hover:bg-blue-50/40 transition-colors ${!rule.isActive ? "opacity-50" : ""}`}>
                <td className="px-4 py-2 text-slate-400 font-mono">{idx + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{rule.name}</td>
                <td className="px-3 py-2 font-mono text-slate-600 max-w-[140px] truncate">{rule.matchPattern}</td>
                <td className="px-3 py-2 font-mono text-slate-600 max-w-[180px] truncate">{rule.replacementFixed}</td>
                <td className="px-3 py-2 text-slate-500">{rule.otpMinLength}-{rule.otpMaxLength} digits</td>
                <td className="px-3 py-2 text-slate-600">{entityLabel(rule)}</td>
                <td className="px-3 py-2 text-slate-500">{rule.priority}</td>
                <td className="px-3 py-2 text-center">
                  {rule.isActive
                    ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Active</span>
                    : <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-400">Inactive</span>}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(idx)}
                      className="bg-slate-600 text-white px-2.5 py-1 rounded text-[10px] font-medium hover:bg-slate-700 transition">Edit</button>
                    <button onClick={() => { if (confirm("Delete this rule?")) deleteRule(idx); }}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded text-[10px] font-medium transition">Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && draft && (
        <TranslationModal
          title={editingIdx === null ? "Add Content Translation" : "Edit Content Translation"}
          onClose={closeModal}
          onPreview={runPreview}
          onTest={runPreview}
          onSave={handleSave}
          saving={saving}
          saveLabel="Update"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Name <span className="text-red-500">*</span></label>
              <input value={draft.name} onChange={e => updateDraft("name", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
              <input type="number" min={1} max={99} value={draft.priority}
                onChange={e => updateDraft("priority", parseInt(e.target.value) || 1)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Apply To</label>
              <select value={draft.scope} onChange={e => {
                const v = e.target.value as "client" | "supplier" | "both";
                updateDraft("scope", v);
                updateDraft("entityIds", []);
              }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white">
                <option value="both">All Clients &amp; Suppliers</option>
                <option value="client">Client</option>
                <option value="supplier">Supplier</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Applies to</label>
              {draft.scope === "both" ? (
                <input readOnly value="All clients and suppliers"
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500" />
              ) : (
                <EntityMultiSelect
                  entities={draft.scope === "client" ? clients : suppliers}
                  selectedIds={draft.entityIds}
                  onToggle={toggleEntity}
                />
              )}
            </div>
          </div>

          <div className="mt-4 bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Match Pattern (keywords)</label>
                <input value={draft.matchPattern} onChange={e => updateDraft("matchPattern", e.target.value)}
                  placeholder="facebook|FB|OTP"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Replace With</label>
                <input value={draft.replacementFixed} onChange={e => updateDraft("replacementFixed", e.target.value)}
                  placeholder="Your verification code is {{OTP}}"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white" />
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs font-medium text-slate-700">OTP length:</label>
              <input type="number" min={2} max={20} value={draft.otpMinLength}
                onChange={e => updateDraft("otpMinLength", parseInt(e.target.value) || 4)}
                className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white" />
              <span className="text-xs text-slate-500">to</span>
              <input type="number" min={2} max={20} value={draft.otpMaxLength}
                onChange={e => updateDraft("otpMaxLength", parseInt(e.target.value) || 8)}
                className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white" />
              <span className="text-xs text-slate-500">digits</span>
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-mono">{"{{OTP}}"}</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={draft.showCustomRegex}
                onChange={e => { updateDraft("showCustomRegex", e.target.checked); if (!e.target.checked) updateDraft("customRegex", ""); }}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4" />
              <label className="text-xs text-slate-700">Use custom OTP regex</label>
            </div>
            {draft.showCustomRegex && (
              <input value={draft.customRegex} onChange={e => updateDraft("customRegex", e.target.value)}
                placeholder="(\d{6})"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white" />
            )}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input type="checkbox" checked={draft.isActive} onChange={e => updateDraft("isActive", e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4" />
            <label className="text-sm text-slate-700">Active</label>
          </div>

          {previewResult !== null && (
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
              {extractedOtp && <p className="text-xs text-emerald-600">Extracted OTP: <code className="font-mono font-bold">{extractedOtp}</code></p>}
              <code className="text-sm font-mono font-bold text-emerald-800 break-all block">{previewResult}</code>
            </div>
          )}
        </TranslationModal>
      )}
    </div>
  );
}
