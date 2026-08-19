"use client";

import { useState, useEffect, useCallback } from "react";
import Spinner from "../spinner";
import { buildRegex } from "@/lib/regex-utils";
import { autoDetectOtp } from "@/lib/otp-detect";
import TranslationModal from "@/components/translation-modal";
import EntityMultiSelect from "@/components/entity-multiselect";

interface OtpExtractRule {
  ruleId: number | null;
  name: string;
  regexPattern: string;
  otpMinLength: number;
  otpMaxLength: number;
  customRegex: string;
  showCustomRegex: boolean;
  otpGroupIndex: number;
  forwardSupplierId: number | null;
  forwardSupplierName: string | null;
  forwardSender: string;
  forwardTemplate: string;
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

export default function OtpExtractPage() {
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rules, setRules] = useState<OtpExtractRule[]>([]);
  const [clients, setClients] = useState<ClientSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<OtpExtractRule | null>(null);
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  const [sampleMessage, setSampleMessage] = useState("Your OTP code is 252525. Valid for 5 min.");

  const loadRules = useCallback(async (loadedSuppliers: ClientSupplier[]) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/tenant/otp-extract-rules");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const profiles = (data.data || data.rules || []) as any[];

      const parsed: OtpExtractRule[] = profiles.map((p: any) => {
        let otpMin = 4, otpMax = 8;
        let customRegex = "";
        const rawRegex = p.regex_pattern || p.regexPattern || "";
        const lenMatch = rawRegex.match(/\\d\{(\\d+),(\\d+)\}/);
        if (lenMatch) {
          otpMin = parseInt(lenMatch[1]) || 4;
          otpMax = parseInt(lenMatch[2]) || 8;
        } else if (rawRegex && rawRegex !== `(\\d{4,8})`) {
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
          entityIds: [],
          priority: p.sort_order || p.sortOrder || 1,
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
  }, []);

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

  const newDraft = (): OtpExtractRule => ({
    ruleId: null, name: `OTP Extract ${rules.length + 1}`,
    regexPattern: "(\\d{4,8})", otpMinLength: 4, otpMaxLength: 8,
    customRegex: "", showCustomRegex: false, otpGroupIndex: 1,
    forwardSupplierId: suppliers.length > 0 ? suppliers[0].id : null,
    forwardSupplierName: suppliers.length > 0 ? suppliers[0].name : null,
    forwardSender: "", forwardTemplate: "Your OTP code is {otp}",
    scope: "both", entityIds: [],
    priority: rules.length + 1,
    isActive: true, mcc: "", mnc: "",
  });

  const openAdd = () => {
    setDraft(newDraft());
    setEditingIdx(null);
    setPreviewResult(null);
    setModalOpen(true);
  };

  const openEdit = (idx: number) => {
    setDraft(JSON.parse(JSON.stringify(rules[idx])));
    setEditingIdx(idx);
    setPreviewResult(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setDraft(null);
    setEditingIdx(null);
    setPreviewResult(null);
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
      entity_id: rule.entityIds[0] ?? null,
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

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { setError("Name is required"); return; }
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
      loadRules(suppliers);
    } catch (err) {
      setError(`Failed to save: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (idx: number) => {
    const rule = rules[idx];
    if (rule.ruleId) {
      await fetch(`/api/tenant/otp-extract-rules/${rule.ruleId}`, { method: "DELETE" }).catch(() => {});
    }
    setRules(prev => prev.filter((_, i) => i !== idx));
    setMsg("Rule deleted");
    setTimeout(() => setMsg(""), 2000);
  };

  const extractOtp = (content: string): string | null => {
    try {
      const regex = buildRegex(buildEffectiveRegex(draft!));
      const m = content.match(regex);
      if (m) return m[draft!.otpGroupIndex] || m[1] || m[0];
    } catch {}
    // Fall back to smart auto-detection so the OTP is extracted from any
    // content, even when the custom regex doesn't exactly match (e.g.
    // "Your code is (\d+)" vs "Your OTP code is 252525").
    return autoDetectOtp(content);
  };

  const runPreview = () => {
    if (!draft) return;
    const otp = extractOtp(sampleMessage);
    if (!otp) {
      setPreviewResult(`No OTP found in "${sampleMessage}" using pattern ${buildEffectiveRegex(draft)}`);
      return;
    }
    const filled = draft.forwardTemplate.replace(/\{otp\}/g, otp).replace(/\{\{OTP\}\}/g, otp);
    setPreviewResult(`Extracted OTP "${otp}" → forward "${filled}" to ${draft.forwardSupplierName || "supplier"}`);
  };

  const entityLabel = (rule: OtpExtractRule) => {
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
          <h2 className="text-lg font-bold text-slate-800">OTP Extract &amp; Forward</h2>
          <p className="text-xs text-slate-400">Extract OTP from incoming SMS and forward it to a supplier</p>
        </div>
        <div className="flex items-center gap-2">
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
              <th className="text-left px-3 py-2.5 font-medium">OTP Pattern</th>
              <th className="text-left px-3 py-2.5 font-medium">Forward To</th>
              <th className="text-left px-3 py-2.5 font-medium">Template</th>
              <th className="text-left px-3 py-2.5 font-medium w-16">Priority</th>
              <th className="text-center px-3 py-2.5 font-medium w-16">Active</th>
              <th className="text-right px-4 py-2.5 font-medium w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  <p className="text-2xl mb-2">🔢</p>
                  <p className="text-sm">No OTP extract rules yet</p>
                  <p className="text-xs mt-1">Click &quot;+ Add Rule&quot; to create your first rule</p>
                </td>
              </tr>
            )}
            {rules.map((rule, idx) => (
              <tr key={idx} className={`hover:bg-blue-50/40 transition-colors ${!rule.isActive ? "opacity-50" : ""}`}>
                <td className="px-4 py-2 text-slate-400 font-mono">{idx + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{rule.name}</td>
                <td className="px-3 py-2 font-mono text-slate-600">{rule.customRegex || `(\\d{${rule.otpMinLength},${rule.otpMaxLength}})`}</td>
                <td className="px-3 py-2 text-slate-600">{rule.forwardSupplierName || "—"}</td>
                <td className="px-3 py-2 font-mono text-slate-600 max-w-[180px] truncate">{rule.forwardTemplate}</td>
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
          title={editingIdx === null ? "Add OTP Extract" : "Edit OTP Extract"}
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
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
              <input type="number" min={1} max={99} value={draft.priority}
                onChange={e => updateDraft("priority", parseInt(e.target.value) || 1)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Apply To</label>
              <select value={draft.scope} onChange={e => {
                const v = e.target.value as "client" | "supplier" | "both";
                updateDraft("scope", v);
                updateDraft("entityIds", []);
              }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white">
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

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={draft.showCustomRegex}
                onChange={e => { updateDraft("showCustomRegex", e.target.checked); if (!e.target.checked) updateDraft("customRegex", ""); }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4" />
              <label className="text-xs text-slate-700">Use custom OTP regex</label>
            </div>
            {draft.showCustomRegex ? (
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Custom Regex</label>
                <input value={draft.customRegex} onChange={e => updateDraft("customRegex", e.target.value)}
                  placeholder="(\d{6})"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" />
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-xs font-medium text-slate-700">OTP length:</label>
                <input type="number" min={2} max={20} value={draft.otpMinLength}
                  onChange={e => updateDraft("otpMinLength", parseInt(e.target.value) || 4)}
                  className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" />
                <span className="text-xs text-slate-500">to</span>
                <input type="number" min={2} max={20} value={draft.otpMaxLength}
                  onChange={e => updateDraft("otpMaxLength", parseInt(e.target.value) || 8)}
                  className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" />
                <span className="text-xs text-slate-500">digits</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Capture Group Index</label>
                <input type="number" min={0} max={9} value={draft.otpGroupIndex}
                  onChange={e => updateDraft("otpGroupIndex", parseInt(e.target.value) || 1)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Forward To Supplier</label>
                <select value={draft.forwardSupplierId || ""} onChange={e => {
                  const sid = e.target.value ? parseInt(e.target.value) : null;
                  updateDraft("forwardSupplierId", sid);
                  updateDraft("forwardSupplierName", sid ? suppliers.find(s => s.id === sid)?.name || null : null);
                }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white">
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Forward Sender</label>
                <input value={draft.forwardSender} onChange={e => updateDraft("forwardSender", e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Forward Template</label>
                <input value={draft.forwardTemplate} onChange={e => updateDraft("forwardTemplate", e.target.value)}
                  placeholder="Your OTP code is {otp}"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" />
                <p className="text-[10px] text-slate-500 mt-1">Use <code className="bg-blue-100 px-1 rounded">{"{otp}"}</code> as the OTP placeholder.</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Test Message</label>
            <input value={sampleMessage} onChange={e => { setSampleMessage(e.target.value); setPreviewResult(null); }}
              placeholder="Paste the message to test OTP extraction..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" />
            <p className="text-[10px] text-slate-400 mt-1">Preview and Test extract from this text (not a hardcoded sample).</p>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input type="checkbox" checked={draft.isActive} onChange={e => updateDraft("isActive", e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4" />
            <label className="text-sm text-slate-700">Active</label>
          </div>

          {previewResult && (
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <code className="text-xs font-mono text-slate-700 break-all">{previewResult}</code>
            </div>
          )}
        </TranslationModal>
      )}
    </div>
  );
}
