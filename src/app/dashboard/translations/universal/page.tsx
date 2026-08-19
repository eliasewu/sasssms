"use client";

import { useState, useEffect, useCallback } from "react";
import Spinner from "../spinner";
import { buildRegex, convertBackrefs, determineTon, determineNpi } from "@/lib/regex-utils";
import TranslationModal from "@/components/translation-modal";
import EntityMultiSelect from "@/components/entity-multiselect";

// ── SMPP parameters a translation rule can regex match / replace ──
const PARAMETERS = [
  { value: "SRC_ROUTING", label: "Src Routing", desc: "source_addr" },
  { value: "DST_ROUTING", label: "Dst Routing", desc: "destination_addr" },
  { value: "SRC_NUMBER", label: "Src Number", desc: "source_addr" },
  { value: "DST_NUMBER", label: "Dst Number", desc: "destination_addr" },
  { value: "SRC_NUMBER_TON", label: "Src Number TON", desc: "source_addr_ton" },
  { value: "DST_NUMBER_TON", label: "Dst Number TON", desc: "dest_addr_ton" },
  { value: "SRC_NUMBER_NPI", label: "Src Number NPI", desc: "source_addr_npi" },
  { value: "DST_NUMBER_NPI", label: "Dst Number NPI", desc: "dest_addr_npi" },
  { value: "SMS_BODY", label: "SMS Body", desc: "short_message" },
];

interface TranslationRule {
  ruleId: number | null;
  name: string;
  targetField: string;
  matchPattern: string;
  replacementFixed: string;
  scope: "client" | "supplier" | "both";
  entityIds: number[];
  priority: number;
  isActive: boolean;
  mode: string;
  category: string | null;
}

interface ClientSupplier {
  id: number;
  name: string;
}

export default function UniversalTranslationPage() {
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rules, setRules] = useState<TranslationRule[]>([]);
  const [clients, setClients] = useState<ClientSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<TranslationRule | null>(null);
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  // Sample values used by the Preview/Test buttons.
  const [sampleSender, setSampleSender] = useState("NET2APP");
  const [sampleDestination, setSampleDestination] = useState("+8801612345678");
  const [sampleContent, setSampleContent] = useState("Your OTP code is 252525. Valid for 5 min.");

  const loadRules = useCallback(async (loadedClients: ClientSupplier[], loadedSuppliers: ClientSupplier[]) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/tenant/sms-translations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const profiles = (data.profiles || []) as any[];

      const parsed: TranslationRule[] = profiles.map((p: any) => {
        const assignments = (p.assignments || []).filter((x: any) => x.isActive !== false);
        const clientIds = assignments.filter((a: any) => a.clientId).map((a: any) => a.clientId as number);
        const supplierIds = assignments.filter((a: any) => a.supplierId).map((a: any) => a.supplierId as number);
        const scope: "client" | "supplier" | "both" =
          clientIds.length > 0 ? "client" : supplierIds.length > 0 ? "supplier" : "both";
        const entityIds = scope === "client" ? clientIds : scope === "supplier" ? supplierIds : [];
        return {
          ruleId: p.id,
          name: p.name,
          targetField: p.target_field || p.targetField || "SMS_BODY",
          matchPattern: p.match_pattern || p.matchPattern || ".*",
          replacementFixed: p.replacement_fixed ?? p.replacementFixed ?? "",
          scope,
          entityIds,
          priority: assignments[0]?.priority || 1,
          isActive: p.is_active !== false,
          mode: p.mode || "FIXED",
          category: p.category || null,
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
      loadRules(cls, sups);
    }).catch(() => loadRules([], []));
  }, [loadRules]);

  const newDraft = (): TranslationRule => ({
    ruleId: null,
    name: `Translation ${rules.length + 1}`,
    targetField: "SMS_BODY",
    matchPattern: ".*",
    replacementFixed: "",
    scope: "both",
    entityIds: [],
    priority: rules.length + 1,
    isActive: true,
    mode: "FIXED",
    category: null,
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

  // ── Client-side preview: run the regex match/replace against the sample ──
  const previewTransform = (rule: TranslationRule): string => {
    const input = inputFor(rule.targetField);
    try {
      const regex = buildRegex(rule.matchPattern || ".*", "m");
      if (!regex.test(input)) return "(no match)";
      const replacement = rule.replacementFixed ?? "";
      return input.replace(regex, convertBackrefs(replacement));
    } catch {
      return "(invalid regex)";
    }
  };

  const inputFor = (targetField: string): string => {
    switch (targetField) {
      case "SRC_ROUTING":
      case "SRC_NUMBER":
      case "SENDER":
        return sampleSender;
      case "DST_ROUTING":
      case "DST_NUMBER":
      case "DESTINATION":
        return sampleDestination;
      case "SRC_NUMBER_TON":
        return String(determineTon(sampleSender));
      case "SRC_NUMBER_NPI":
        return String(determineNpi(sampleSender));
      case "DST_NUMBER_TON":
        return String(determineTon(sampleDestination));
      case "DST_NUMBER_NPI":
        return String(determineNpi(sampleDestination));
      case "SMS_BODY":
      case "BODY":
      default:
        return sampleContent;
    }
  };

  const runPreview = () => {
    if (!draft) return;
    const input = inputFor(draft.targetField);
    const out = previewTransform(draft);
    setPreviewResult(`"${input}"  →  "${out}"`);
  };

  const saveRuleToApi = async (rule: TranslationRule): Promise<number | null> => {
    if (rule.ruleId) {
      const res = await fetch(`/api/tenant/sms-translations/${rule.ruleId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rule.name,
          targetField: rule.targetField,
          mode: rule.mode,
          matchPattern: rule.matchPattern,
          replacementFixed: rule.replacementFixed,
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
          name: rule.name, targetField: rule.targetField, mode: rule.mode,
          matchPattern: rule.matchPattern, replacementFixed: rule.replacementFixed,
          category: "UNIVERSAL",
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

  const toggleActive = async (idx: number) => {
    const rule = rules[idx];
    if (!rule.ruleId) return;
    await fetch(`/api/tenant/sms-translations/${rule.ruleId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    }).catch(() => {});
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, isActive: !r.isActive } : r));
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

  const entityLabel = (rule: TranslationRule) => {
    if (rule.scope === "client") return rule.entityIds.map(id => clients.find(c => c.id === id)?.name || `Client #${id}`).join(", ");
    if (rule.scope === "supplier") return rule.entityIds.map(id => suppliers.find(s => s.id === id)?.name || `Supplier #${id}`).join(", ");
    return "All clients & suppliers";
  };

  const paramLabel = (value: string) => PARAMETERS.find(p => p.value === value)?.label || value;

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
          <h2 className="text-lg font-bold text-slate-800">Universal Translation</h2>
          <p className="text-xs text-slate-400">Regex match → replace across any SMPP parameter</p>
        </div>
        <button onClick={openAdd}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
          + Add Rule
        </button>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
              <th className="text-left px-3 py-2.5 font-medium w-10">ID</th>
              <th className="text-left px-3 py-2.5 font-medium w-16">Status</th>
              <th className="text-left px-3 py-2.5 font-medium">Translation Name</th>
              <th className="text-left px-3 py-2.5 font-medium">Allow To</th>
              <th className="text-left px-3 py-2.5 font-medium">Parameter</th>
              <th className="text-left px-3 py-2.5 font-medium">Match (regex)</th>
              <th className="text-left px-3 py-2.5 font-medium">Replace</th>
              <th className="text-left px-3 py-2.5 font-medium w-16">Priority</th>
              <th className="text-right px-3 py-2.5 font-medium w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                  <p className="text-2xl mb-2">🌐</p>
                  <p className="text-sm">No translation rules yet</p>
                  <p className="text-xs mt-1">Click &quot;+ Add Rule&quot; to create your first rule</p>
                </td>
              </tr>
            )}
            {rules.map((rule, idx) => (
              <tr key={idx} className={`hover:bg-blue-50/40 transition-colors ${!rule.isActive ? "opacity-50" : ""}`}>
                <td className="px-3 py-2 text-slate-400 font-mono">{rule.ruleId ?? "—"}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggleActive(idx)}
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
                      rule.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                    }`}>
                    {rule.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-3 py-2 font-medium text-slate-800">{rule.name}</td>
                <td className="px-3 py-2 text-slate-600">{entityLabel(rule)}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px]">{paramLabel(rule.targetField)}</span>
                </td>
                <td className="px-3 py-2 font-mono text-slate-600 max-w-[180px] truncate">{rule.matchPattern}</td>
                <td className="px-3 py-2 font-mono text-slate-600 max-w-[180px] truncate">{rule.replacementFixed || "—"}</td>
                <td className="px-3 py-2 text-slate-500">{rule.priority}</td>
                <td className="px-3 py-2 text-right">
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
          title={editingIdx === null ? "Add Translation" : "Edit Translation"}
          onClose={closeModal}
          onPreview={runPreview}
          onTest={runPreview}
          onSave={handleSave}
          saving={saving}
          saveLabel="Update"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Translation Name <span className="text-red-500">*</span></label>
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
              <label className="text-xs font-medium text-slate-600 mb-1 block">Allow To</label>
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

          <div className="mt-4">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Parameter (SMPP field)</label>
            <select value={draft.targetField} onChange={e => { updateDraft("targetField", e.target.value); setPreviewResult(null); }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white">
              {PARAMETERS.map(p => (
                <option key={p.value} value={p.value}>{p.label} — {p.desc}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Match (regex) <span className="text-red-500">*</span></label>
              <input value={draft.matchPattern} onChange={e => updateDraft("matchPattern", e.target.value)}
                placeholder="(\d+)\s(\d+)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" />
              <p className="text-[10px] text-slate-400 mt-1">Example: <code className="bg-slate-100 px-1 rounded">(\d+)\s(\d+)</code> or <code className="bg-slate-100 px-1 rounded">(.*\d+)-(\d+)</code></p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Replace</label>
              <input value={draft.replacementFixed} onChange={e => updateDraft("replacementFixed", e.target.value)}
                placeholder="\1\2"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" />
              <p className="text-[10px] text-slate-400 mt-1">Use <code className="bg-slate-100 px-1 rounded">\1</code>, <code className="bg-slate-100 px-1 rounded">\2</code> for captured groups. Example: <code className="bg-slate-100 px-1 rounded">\1\2</code></p>
            </div>
          </div>

          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-medium text-slate-500 mb-1 block">Sample Sender</label>
              <input value={sampleSender} onChange={e => { setSampleSender(e.target.value); setPreviewResult(null); }}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono bg-white" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-500 mb-1 block">Sample Destination</label>
              <input value={sampleDestination} onChange={e => { setSampleDestination(e.target.value); setPreviewResult(null); }}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono bg-white" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-500 mb-1 block">Sample Body</label>
              <input value={sampleContent} onChange={e => { setSampleContent(e.target.value); setPreviewResult(null); }}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono bg-white" />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input type="checkbox" checked={draft.isActive} onChange={e => updateDraft("isActive", e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4" />
            <label className="text-sm text-slate-700">Active</label>
          </div>

          {previewResult !== null && (
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <code className="text-xs font-mono text-emerald-800 break-all block">{previewResult}</code>
            </div>
          )}
        </TranslationModal>
      )}
    </div>
  );
}
