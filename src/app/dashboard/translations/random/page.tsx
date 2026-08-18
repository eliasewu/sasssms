"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";
import TranslationModal from "@/components/translation-modal";
import EntityMultiSelect from "@/components/entity-multiselect";

interface RandomRule {
  ruleId: number | null;
  name: string;
  matchPattern: string;
  poolItems: string[];
  extractOtp: boolean;
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

export default function RandomContentPage() {
  const { selection } = useMccMnc();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rules, setRules] = useState<RandomRule[]>([]);
  const [clients, setClients] = useState<ClientSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);

  // Quick Test
  const [quickTestMessage, setQuickTestMessage] = useState("Your OTP code is 252525");
  const [quickTestResult, setQuickTestResult] = useState<string | null>(null);
  const [sampleDestination, setSampleDestination] = useState("33612345678");
  const [previewMeta, setPreviewMeta] = useState<{ ruleName: string; applied: boolean; samples: string[] } | null>(null);
  const [testing, setTesting] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<RandomRule | null>(null);
  const [draftPreview, setDraftPreview] = useState<string | null>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

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
        const assignments = (p.assignments || []).filter((x: any) => x.isActive !== false);
        const clientIds = assignments.filter((a: any) => a.clientId).map((a: any) => a.clientId as number);
        const supplierIds = assignments.filter((a: any) => a.supplierId).map((a: any) => a.supplierId as number);
        const scope: "client" | "supplier" | "both" = clientIds.length > 0 ? "client" : supplierIds.length > 0 ? "supplier" : "both";
        const entityIds = scope === "client" ? clientIds : scope === "supplier" ? supplierIds : [];
        return {
          ruleId: p.id,
          name: p.name,
          matchPattern: p.match_pattern || p.matchPattern || ".*",
          poolItems: (p.pool_items || []).map((pi: any) => pi.replacementValue || pi.replacement_value || ""),
          extractOtp: true,
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

  const newDraft = (): RandomRule => ({
    ruleId: null, name: `Random Rule ${rules.length + 1}`,
    matchPattern: ".*",
    poolItems: [
      "Your OTP code is {{OTP}}. Valid for 5 min.",
      "Verification code: {{OTP}}",
      "{{OTP}} is your one-time password",
      "OTP: {{OTP}}. Do not share.",
    ],
    extractOtp: true,
    scope: "both", entityIds: [], priority: rules.length + 1,
    isActive: true, mcc: selection.mcc || "", mnc: selection.mnc || "",
  });

  const openAdd = () => {
    setDraft(newDraft());
    setEditingIdx(null);
    setDraftPreview(null);
    setModalOpen(true);
  };

  const openEdit = (idx: number) => {
    setDraft(JSON.parse(JSON.stringify(rules[idx])));
    setEditingIdx(idx);
    setDraftPreview(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setDraft(null);
    setEditingIdx(null);
    setDraftPreview(null);
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

  const draftTemplatesText = (r: RandomRule) => r.poolItems.join("\n");
  const setDraftTemplatesText = (text: string) => {
    const items = text.split(/\r?\n/);
    updateDraft("poolItems", items);
  };

  // Bulk upload templates from .txt / .csv file into the draft
  const handleDraftBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "txt" && ext !== "csv") {
      setError("Only .txt or .csv files are supported");
      setTimeout(() => setError(null), 3000);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
      if (lines.length === 0) { setMsg("No templates found in file"); setTimeout(() => setMsg(""), 2000); return; }
      const templates = lines.map(l => (l.includes(",") ? l.split(",")[0].trim() : l.trim()));
      updateDraft("poolItems", templates);
      setMsg(`Loaded ${templates.length} templates from ${file.name}`);
      setTimeout(() => setMsg(""), 2500);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const saveRuleToApi = async (rule: RandomRule): Promise<number | null> => {
    const poolText = rule.poolItems.filter(p => p.trim()).join("\n");
    if (rule.ruleId) {
      const res = await fetch(`/api/tenant/sms-translations/${rule.ruleId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rule.name, matchPattern: rule.matchPattern,
          mcc: rule.mcc || null, mnc: rule.mnc || null,
          scope: rule.scope, entityIds: rule.entityIds, priority: rule.priority,
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
          scope: rule.scope, entityIds: rule.entityIds, priority: rule.priority,
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

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { setError("Name is required"); return; }
    const templates = draft.poolItems.filter(p => p.trim());
    if (templates.length === 0) { setError("Add at least one template"); return; }
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

  // Run an EXACT preview through the real translation engine
  const runPreviewForRule = async (rule: RandomRule): Promise<{ exact: string; samples: string[]; applied: boolean }> => {
    const otp = quickTestMessage.match(/\b(\d{4,8})\b/)?.[1] || "123456";
    const fillOtp = (t: string) => (rule.extractOtp ? t.replace(/\{\{OTP\}\}/g, otp) : t);

    if (!rule.ruleId) {
      const active = rule.poolItems.filter(p => p.trim());
      const exact = active.length === 0 ? "" : fillOtp(active[Math.floor(Math.random() * active.length)]);
      return { exact, samples: active.map(fillOtp), applied: active.length > 0 };
    }

    const res = await fetch("/api/tenant/sms-translations/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: rule.ruleId,
        sampleSender: "TEST",
        sampleDestination: sampleDestination.trim() || "33612345678",
        sampleContent: quickTestMessage,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const exact = data.sample?.translated?.content ?? "";
    const applied = !!data.sample?.applied;
    const samples: string[] = Array.isArray(data.randomSamples)
      ? data.randomSamples.map(fillOtp)
      : [];
    return { exact, samples, applied };
  };

  const runPreview = async (rule: RandomRule) => {
    setTesting(true);
    setQuickTestResult(null);
    setPreviewMeta(null);
    try {
      const r = await runPreviewForRule(rule);
      setQuickTestResult(r.applied ? r.exact : "(no match)");
      setPreviewMeta({ ruleName: rule.name, applied: r.applied, samples: r.samples });
    } catch (e) {
      setQuickTestResult("(preview error: " + (e as Error).message + ")");
    } finally {
      setTesting(false);
    }
  };

  const runDraftPreview = async () => {
    if (!draft) return;
    const r = await runPreviewForRule(draft);
    setDraftPreview(r.applied ? r.exact : "(no templates)");
  };

  const runQuickTest = () => {
    const activeRules = rules.filter(r => r.isActive && r.poolItems.some(p => p.trim()));
    if (activeRules.length === 0) {
      setQuickTestResult("(no active rules)");
      setPreviewMeta(null);
      return;
    }
    const pick = activeRules[Math.floor(Math.random() * activeRules.length)];
    runPreview(pick);
  };

  const entityLabel = (rule: RandomRule) => {
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
          <h2 className="text-lg font-bold text-slate-800">Random Content</h2>
          <p className="text-xs text-slate-400">Extract OTP from any content and send a random pre-uploaded template</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Scope: <strong>{selection.label}</strong></span>
          <button onClick={openAdd}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
            + Add Rule
          </button>
        </div>
      </div>

      {/* Quick Random Test */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-purple-950 border border-slate-700 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🎲</span>
          <div>
            <h3 className="text-lg font-bold text-white">Quick Random Pick Test</h3>
            <p className="text-xs text-slate-400">Extract OTP from original message and fill into random template</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-medium text-slate-400 mb-1 block">Original Message (with OTP)</label>
            <input value={quickTestMessage} onChange={e => { setQuickTestMessage(e.target.value); setQuickTestResult(null); }}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:ring-2 focus:ring-purple-500 focus:outline-none" />
          </div>
          <div className="w-48">
            <label className="text-[10px] font-medium text-slate-400 mb-1 block">Destination Number</label>
            <input value={sampleDestination} onChange={e => { setSampleDestination(e.target.value); setQuickTestResult(null); }}
              placeholder="33612345678"
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:ring-2 focus:ring-purple-500 focus:outline-none" />
          </div>
          <button onClick={runQuickTest} disabled={testing}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-lg shadow-purple-600/25 shrink-0 disabled:opacity-50">
            {testing ? "Testing..." : "🎲 Random Pick"}
          </button>
        </div>
        {quickTestResult !== null && (
          <div className={`mt-4 rounded-xl border p-4 ${quickTestResult.startsWith("(no") || quickTestResult.startsWith("(preview error") ? "bg-red-900/20 border-red-700/50" : "bg-emerald-900/30 border-emerald-700/50"}`}>
            {quickTestResult.startsWith("(no") || quickTestResult.startsWith("(preview error") ? (
              <div className="flex items-center gap-3">
                <span className="text-lg">❌</span>
                <p className="text-sm font-semibold text-red-300">{quickTestResult === "(no active rules)" ? "No active rules with templates configured" : quickTestResult.slice(1, -1)}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {previewMeta && (
                  <p className="text-[10px] font-medium text-purple-300">
                    Rule: <span className="font-semibold">{previewMeta.ruleName}</span>
                    <span className="mx-2">•</span>
                    Destination: <span className="font-mono">{sampleDestination}</span>
                    <span className="mx-2">•</span>
                    {previewMeta.applied ? "✅ applied" : "❌ not applied"}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <span className="text-[10px] font-medium text-red-300 uppercase tracking-wider block mb-1">Original Message</span>
                    <code className="text-xs font-mono text-slate-300 break-all">{quickTestMessage}</code>
                  </div>
                  <div className="bg-emerald-900/40 rounded-lg p-3">
                    <span className="text-[10px] font-medium text-emerald-300 uppercase tracking-wider block mb-1">Exact Result</span>
                    <code className="text-sm font-mono font-bold text-emerald-200 break-all">{quickTestResult}</code>
                  </div>
                </div>
                {previewMeta && previewMeta.samples.length > 1 && (
                  <div className="bg-slate-800/40 rounded-lg p-3">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">Other random picks from this pool</span>
                    <div className="space-y-1">
                      {previewMeta.samples.slice(0, 5).map((s, i) => (
                        <code key={i} className="text-[10px] font-mono text-slate-300 block break-all">• {s}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="mt-3 text-[10px] text-slate-500">
          {rules.filter(r => r.isActive).length} active rules • {rules.reduce((s, r) => s + r.poolItems.filter(p => p.trim()).length, 0)} total templates
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
              <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
              <th className="text-left px-3 py-2.5 font-medium">Name</th>
              <th className="text-left px-3 py-2.5 font-medium">Templates</th>
              <th className="text-left px-3 py-2.5 font-medium">Applies To</th>
              <th className="text-left px-3 py-2.5 font-medium w-16">Priority</th>
              <th className="text-center px-3 py-2.5 font-medium w-16">Active</th>
              <th className="text-right px-4 py-2.5 font-medium w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  <p className="text-2xl mb-2">🎲</p>
                  <p className="text-sm">No random content rules yet</p>
                  <p className="text-xs mt-1">Click &quot;+ Add Rule&quot; to create your first rule</p>
                </td>
              </tr>
            )}
            {rules.map((rule, idx) => {
              const count = rule.poolItems.filter(p => p.trim()).length;
              return (
                <tr key={idx} className={`hover:bg-purple-50/40 transition-colors ${!rule.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{rule.name}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">{count} templates</span>
                  </td>
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
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit / Add Modal */}
      {modalOpen && draft && (
        <TranslationModal
          title={editingIdx === null ? "Add Random Content" : "Edit Random Content"}
          onClose={closeModal}
          onPreview={runDraftPreview}
          onTest={runDraftPreview}
          onSave={handleSave}
          saving={saving}
          saveLabel="Update"
        >
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Name <span className="text-red-500">*</span></label>
              <input value={draft.name} onChange={e => updateDraft("name", e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
              <input type="number" min={1} max={99} value={draft.priority}
                onChange={e => updateDraft("priority", parseInt(e.target.value) || 1)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
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
              }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white">
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

          {/* Templates section */}
          <div className="mt-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700">Templates (one per line)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-200 text-purple-800">
                  {draft.poolItems.filter(p => p.trim()).length} templates
                </span>
              </div>
              <button onClick={() => updateDraft("poolItems", [])}
                className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-medium transition">
                🗑 <span>Clear all</span>
              </button>
            </div>
            <textarea
              value={draftTemplatesText(draft)}
              onChange={e => setDraftTemplatesText(e.target.value)}
              rows={6}
              placeholder={"Your OTP code is {{OTP}}. Valid for 5 min.\nVerification code: {{OTP}}\n{{OTP}} is your one-time password\nOTP: {{OTP}}. Do not share."}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white resize-y"
            />
            <div className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={draft.extractOtp} onChange={e => updateDraft("extractOtp", e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4" />
              <label className="text-xs text-slate-700">Extract OTP from original message (use {"{{OTP}}"} in templates)</label>
            </div>
            <div
              onClick={() => bulkInputRef.current?.click()}
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-purple-300 bg-white hover:bg-purple-50 cursor-pointer transition"
            >
              <span className="text-purple-500">📁</span>
              <span className="text-xs text-purple-700 font-medium">Bulk Upload Templates</span>
              <span className="text-[10px] text-slate-400">— upload 100s of templates from a .txt file</span>
              <span className="ml-auto text-purple-400">▼</span>
            </div>
            <input ref={bulkInputRef} type="file" accept=".txt,.csv" onChange={handleDraftBulkUpload} className="hidden" />
          </div>

          {/* Active */}
          <div className="mt-4 flex items-center gap-2">
            <input type="checkbox" checked={draft.isActive} onChange={e => updateDraft("isActive", e.target.checked)}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4" />
            <label className="text-sm text-slate-700">Active</label>
          </div>

          {/* Draft preview result */}
          {draftPreview && (
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider block mb-1">Exact Result</span>
              <code className="text-sm font-mono font-bold text-emerald-800 break-all">{draftPreview}</code>
            </div>
          )}
        </TranslationModal>
      )}
    </div>
  );
}
