"use client";

import { useState, useEffect, useCallback } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";
import TranslationModal from "@/components/translation-modal";
import EntityMultiSelect from "@/components/entity-multiselect";
import { matchPatternForName, matchPrefixesForName } from "@/lib/number-match";

interface NumberRule {
  ruleId: number | null;
  name: string;
  stripDigits: number;
  addPrefix: string;
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

export default function NumberTranslationPage() {
  const { selection } = useMccMnc();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testNumber, setTestNumber] = useState("1234567890");

  const [rules, setRules] = useState<NumberRule[]>([]);
  const [clients, setClients] = useState<ClientSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<NumberRule | null>(null);
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  // Load clients and suppliers
  useEffect(() => {
    fetch("/api/tenant/clients").then(r => r.json()).then(d => setClients(d.clients || [])).catch(() => {});
    fetch("/api/tenant/suppliers").then(r => r.json()).then(d => setSuppliers(d.suppliers || [])).catch(() => {});
  }, []);

  const loadRules = useCallback(async (loadedClients: ClientSupplier[], loadedSuppliers: ClientSupplier[]) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selection.mcc) params.set("mcc", selection.mcc);
      if (selection.mnc) params.set("mnc", selection.mnc);
      params.set("category", "NUMBER");
      const res = await fetch(`/api/tenant/sms-translations?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const profiles = (data.profiles || []) as any[];

      const parsed: NumberRule[] = profiles.map((p: any) => {
        let stripDigits = 0;
        let addPrefix = "";
        try {
          const parsed = JSON.parse(p.replacement_fixed || "{}");
          if (parsed?.steps) {
            for (const step of parsed.steps) {
              if (step.type === "stripDigits") stripDigits = parseInt(step.value || "0", 10) || 0;
              if (step.type === "addPrefix") addPrefix = step.value || "";
            }
          }
        } catch {}
        const assignments = (p.assignments || []).filter((x: any) => x.isActive !== false);
        const clientIds = assignments.filter((a: any) => a.clientId).map((a: any) => a.clientId as number);
        const supplierIds = assignments.filter((a: any) => a.supplierId).map((a: any) => a.supplierId as number);
        const scope: "client" | "supplier" | "both" = clientIds.length > 0 ? "client" : supplierIds.length > 0 ? "supplier" : "both";
        const entityIds = scope === "client" ? clientIds : scope === "supplier" ? supplierIds : [];
        return {
          ruleId: p.id,
          name: p.name,
          stripDigits,
          addPrefix,
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

  const newDraft = (): NumberRule => ({
    ruleId: null, name: `Number Rule ${rules.length + 1}`,
    stripDigits: 0, addPrefix: "",
    scope: "both", entityIds: [],
    priority: rules.length + 1, isActive: true,
    mcc: "", mnc: "",
  });

  // Build a realistic sample destination from a rule's name, e.g. "00971" →
  // "0097112345678", so "strip 5 + add 0" previews as 012345678.
  const sampleForRuleName = (name: string): string => {
    const prefixes = matchPrefixesForName(name);
    return prefixes ? prefixes[0] + "12345678" : "1234567890";
  };

  const openAdd = () => {
    setDraft(newDraft());
    setEditingIdx(null);
    setPreviewResult(null);
    setTestNumber("1234567890");
    setModalOpen(true);
  };

  const openEdit = (idx: number) => {
    const rule = rules[idx];
    setDraft(JSON.parse(JSON.stringify(rule)));
    setEditingIdx(idx);
    setPreviewResult(null);
    setTestNumber(sampleForRuleName(rule.name));
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

  // Build pipeline JSON
  const buildPipeline = (rule: NumberRule) => {
    const steps: { type: string; value: string }[] = [];
    if (rule.stripDigits > 0) steps.push({ type: "stripDigits", value: String(rule.stripDigits) });
    if (rule.addPrefix) steps.push({ type: "addPrefix", value: rule.addPrefix });
    return JSON.stringify({ steps });
  };

  const saveRuleToApi = async (rule: NumberRule): Promise<number | null> => {
    const jsonSteps = buildPipeline(rule);
    if (rule.ruleId) {
      const res = await fetch(`/api/tenant/sms-translations/${rule.ruleId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rule.name, matchPattern: matchPatternForName(rule.name), replacementFixed: jsonSteps,
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
          name: rule.name, targetField: "DESTINATION", category: "NUMBER", mode: "FIXED",
          matchPattern: matchPatternForName(rule.name), replacementFixed: jsonSteps,
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

  const sample = testNumber.trim() || "1234567890";

  const previewTransform = (input: string, strip: number, add: string): string => {
    let result = input.replace(/^\+/, "00");
    if (strip > 0 && strip < result.length) result = result.slice(strip);
    if (add) result = add + result;
    return result;
  };

  const runPreview = () => {
    if (!draft) return;
    const stripped = previewTransform(sample, draft.stripDigits, "");
    const final = previewTransform(sample, draft.stripDigits, draft.addPrefix);
    setPreviewResult(`${sample} → strip ${draft.stripDigits} → ${stripped}${draft.addPrefix ? ` → + "${draft.addPrefix}" → ${final}` : ""}`);
  };

  const entityLabel = (rule: NumberRule) => {
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

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Number Translation</h2>
          <p className="text-xs text-slate-400">Rule name = country prefix to match. Strip prefix digits, add custom prefixes — applied per client or supplier</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Scope: <strong>{selection.label}</strong></span>
          <button onClick={openAdd}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
            + Add Rule
          </button>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
              <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
              <th className="text-left px-3 py-2.5 font-medium">Name</th>
              <th className="text-left px-3 py-2.5 font-medium">Strip</th>
              <th className="text-left px-3 py-2.5 font-medium">Add Prefix</th>
              <th className="text-left px-3 py-2.5 font-medium">Applies To</th>
              <th className="text-left px-3 py-2.5 font-medium w-16">Priority</th>
              <th className="text-center px-3 py-2.5 font-medium w-12">Active</th>
              <th className="text-center px-3 py-2.5 font-medium">Preview</th>
              <th className="text-right px-4 py-2.5 font-medium w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                  <p className="text-2xl mb-2">🔢</p>
                  <p className="text-sm">No number translation rules yet</p>
                  <p className="text-xs mt-1">Click &quot;+ Add Rule&quot; to create your first rule</p>
                </td>
              </tr>
            )}
            {rules.map((rule, idx) => {
              const preview = rule.isActive ? previewTransform(sampleForRuleName(rule.name), rule.stripDigits, rule.addPrefix) : "—";
              return (
                <tr key={idx} className={`hover:bg-blue-50/40 transition-colors ${!rule.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{rule.name}</td>
                  <td className="px-3 py-2 text-slate-600">{rule.stripDigits} digits</td>
                  <td className="px-3 py-2 font-mono text-slate-600">{rule.addPrefix || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{entityLabel(rule)}</td>
                  <td className="px-3 py-2 text-slate-500">{rule.priority}</td>
                  <td className="px-3 py-2 text-center">
                    {rule.isActive
                      ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Active</span>
                      : <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-400">Inactive</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <code className="text-[10px] text-slate-400 font-mono">{sampleForRuleName(rule.name)}</code>
                    <span className="text-slate-300 mx-1">→</span>
                    <code className={`text-[10px] font-mono font-semibold ${rule.isActive ? "text-emerald-700" : "text-slate-400"}`}>{preview}</code>
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
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit / Add Modal */}
      {modalOpen && draft && (
        <TranslationModal
          title={editingIdx === null ? "Add Number Translation" : "Edit Number Translation"}
          onClose={closeModal}
          onPreview={runPreview}
          onTest={runPreview}
          onSave={handleSave}
          saving={saving}
          saveLabel="Update"
        >
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Name <span className="text-red-500">*</span></label>
              <input value={draft.name} onChange={e => updateDraft("name", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              <p className="text-[10px] text-slate-400 mt-1">Name = country prefix to match (e.g. "0091" matches 0091… / +91… / 91…). A non-numeric name matches all numbers.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
              <input type="number" min={1} max={99} value={draft.priority}
                onChange={e => updateDraft("priority", parseInt(e.target.value) || 1)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>

          {/* Row 2 */}
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

          {/* Strip / Add Prefix section */}
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <label className="text-xs font-medium text-slate-700 mb-1 block">Test Number</label>
            <input
              value={testNumber}
              onChange={e => setTestNumber(e.target.value)}
              placeholder="e.g. 00971506380825"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Result: <code className="font-mono">{sample}</code>
              <span className="mx-1 text-slate-400">→</span>
              <code className="font-mono font-semibold text-emerald-700">{previewTransform(sample, draft.stripDigits, draft.addPrefix)}</code>
            </p>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Strip Prefix (digits to remove)</label>
                <input type="number" min={0} max={20} value={draft.stripDigits}
                  onChange={e => updateDraft("stripDigits", parseInt(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white" />
                <p className="text-[10px] text-slate-500 mt-1">{sample} with strip={draft.stripDigits} → {previewTransform(sample, draft.stripDigits, "")}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Add Prefix (text to prepend)</label>
                <input value={draft.addPrefix} onChange={e => updateDraft("addPrefix", e.target.value)}
                  placeholder="77"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white" />
                <p className="text-[10px] text-slate-500 mt-1">{sample} + add &quot;{draft.addPrefix || ""}&quot; → {previewTransform(sample, draft.stripDigits, draft.addPrefix)}</p>
              </div>
            </div>
          </div>

          {/* Active */}
          <div className="mt-4 flex items-center gap-2">
            <input type="checkbox" checked={draft.isActive} onChange={e => updateDraft("isActive", e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4" />
            <label className="text-sm text-slate-700">Active</label>
          </div>

          {/* Preview result */}
          {previewResult && (
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <code className="text-xs font-mono text-emerald-800 break-all">{previewResult}</code>
            </div>
          )}
        </TranslationModal>
      )}
    </div>
  );
}
