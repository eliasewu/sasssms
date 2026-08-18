"use client";

import { useState, useEffect, useCallback } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";
import { buildRegex } from "@/lib/regex-utils";
import TranslationModal from "@/components/translation-modal";
import EntityMultiSelect from "@/components/entity-multiselect";

// Escape regex-special characters so an exact phone number becomes a literal match pattern
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Detect if a stored regex pattern represents a simple exact match:
// starts with ^, ends with $, and the middle contains no regex special chars
function isExactMatchPattern(pattern: string): boolean {
  if (!pattern.startsWith("^") || !pattern.endsWith("$")) return false;
  const inner = pattern.slice(1, -1);
  const specialChars = /(?<!\\)[.*+?{}()|[\]\\]/;
  return !specialChars.test(inner);
}

// Detect if a stored regex pattern represents a simple prefix match:
// starts with ^, does NOT end with $, and the middle contains no regex special chars
function isPrefixMatchPattern(pattern: string): boolean {
  if (!pattern.startsWith("^") || pattern.endsWith("$")) return false;
  const inner = pattern.slice(1);
  const specialChars = /(?<!\\)[.*+?{}()|[\]\\]/;
  return !specialChars.test(inner);
}

// Extract the raw number from an exact-match regex pattern like "^\+971501234567$"
function extractNumber(pattern: string): string {
  let inner = isExactMatchPattern(pattern) ? pattern.slice(1, -1) : pattern.slice(1);
  return inner.replace(/\\(.)/g, "$1");
}

interface BlacklistRule {
  ruleId: number | null;
  name: string;
  matchMode: "exact" | "prefix" | "regex";
  number: string;
  matchPattern: string;
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

export default function NumberBlacklistPage() {
  const { selection } = useMccMnc();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rules, setRules] = useState<BlacklistRule[]>([]);
  const [clients, setClients] = useState<ClientSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);

  // Quick Test
  const [quickTestNumber, setQuickTestNumber] = useState("8801700000000");
  const [quickTestResult, setQuickTestResult] = useState<{ blocked: boolean; matchedRule: string | null } | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<BlacklistRule | null>(null);
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  const loadRules = useCallback(async (loadedClients: ClientSupplier[], loadedSuppliers: ClientSupplier[]) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selection.mcc) params.set("mcc", selection.mcc);
      if (selection.mnc) params.set("mnc", selection.mnc);
      params.set("category", "NUMBER_BLACKLIST");
      const res = await fetch(`/api/tenant/sms-translations?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const profiles = (data.profiles || []) as any[];

      const parsed: BlacklistRule[] = profiles.map((p: any) => {
        const assignments = (p.assignments || []).filter((x: any) => x.isActive !== false);
        const rawPattern: string = p.match_pattern || p.matchPattern || "^880";
        let matchMode: "exact" | "prefix" | "regex" = "regex";
        let number = "";
        if (isExactMatchPattern(rawPattern)) { matchMode = "exact"; number = extractNumber(rawPattern); }
        else if (isPrefixMatchPattern(rawPattern)) { matchMode = "prefix"; number = extractNumber(rawPattern); }
        else { matchMode = "regex"; number = rawPattern; }
        const clientIds = assignments.filter((a: any) => a.clientId).map((a: any) => a.clientId as number);
        const supplierIds = assignments.filter((a: any) => a.supplierId).map((a: any) => a.supplierId as number);
        const scope: "client" | "supplier" | "both" = clientIds.length > 0 ? "client" : supplierIds.length > 0 ? "supplier" : "both";
        const entityIds = scope === "client" ? clientIds : scope === "supplier" ? supplierIds : [];
        return {
          ruleId: p.id,
          name: p.name,
          matchMode,
          number,
          matchPattern: rawPattern,
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
      setError("Failed to load blacklist rules. " + (err as Error).message);
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

  // Build the effective regex pattern for saving
  const effectivePattern = (rule: BlacklistRule): string => {
    if (rule.matchMode === "exact") return "^" + escapeRegex(rule.number || "") + "$";
    if (rule.matchMode === "prefix") return "^" + escapeRegex(rule.number || "");
    return rule.number || rule.matchPattern;
  };

  const newDraft = (): BlacklistRule => ({
    ruleId: null, name: `Blacklist ${rules.length + 1}`,
    matchMode: "prefix", number: "", matchPattern: "",
    scope: "both", entityIds: [],
    priority: rules.length + 1, isActive: true,
    mcc: selection.mcc || "", mnc: selection.mnc || "",
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

  const saveRuleToApi = async (rule: BlacklistRule): Promise<number | null> => {
    const finalPattern = effectivePattern(rule);
    if (!finalPattern) throw new Error("Enter a number or prefix to block");
    if (rule.ruleId) {
      const res = await fetch(`/api/tenant/sms-translations/${rule.ruleId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rule.name, matchPattern: finalPattern,
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
          name: rule.name, targetField: "DESTINATION", category: "NUMBER_BLACKLIST", mode: "FIXED",
          matchPattern: finalPattern,
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
    if (draft.matchMode !== "regex" && !draft.number.trim()) { setError("Enter a number or prefix to block"); return; }
    if (draft.matchMode === "regex" && !draft.number.trim()) { setError("Enter a regex pattern"); return; }
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
    setMsg("Blacklist rule deleted");
    setTimeout(() => setMsg(""), 2000);
  };

  const testRuleAgainstNumber = (rule: BlacklistRule): boolean => {
    try {
      return buildRegex(effectivePattern(rule)).test(quickTestNumber);
    } catch { return false; }
  };

  const runQuickTest = () => {
    for (const rule of rules) {
      if (!rule.isActive) continue;
      if (testRuleAgainstNumber(rule)) {
        setQuickTestResult({ blocked: true, matchedRule: rule.name });
        return;
      }
    }
    setQuickTestResult({ blocked: false, matchedRule: null });
  };

  const runPreview = () => {
    if (!draft) return;
    const pattern = effectivePattern(draft);
    if (!pattern) { setPreviewResult("(no pattern)"); return; }
    const matched = (() => { try { return buildRegex(pattern).test(quickTestNumber); } catch { return false; } })();
    setPreviewResult(matched
      ? `"${quickTestNumber}" matches ${pattern} → BLOCKED`
      : `"${quickTestNumber}" does not match ${pattern} → allowed`);
  };

  const entityLabel = (rule: BlacklistRule) => {
    if (rule.scope === "client") return rule.entityIds.map(id => clients.find(c => c.id === id)?.name || `Client #${id}`).join(", ");
    if (rule.scope === "supplier") return rule.entityIds.map(id => suppliers.find(s => s.id === id)?.name || `Supplier #${id}`).join(", ");
    return "All clients and suppliers";
  };

  const modeLabel = (m: string) => m === "exact" ? "Exact" : m === "prefix" ? "Prefix" : "Regex";

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
          <h2 className="text-lg font-bold text-slate-800">Number Blacklist</h2>
          <p className="text-xs text-slate-400">Block SMS to specific numbers or number prefixes</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Scope: <strong>{selection.label}</strong></span>
          <button onClick={openAdd}
            className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-700 transition">
            + Add Blacklist
          </button>
        </div>
      </div>

      {/* Quick Blacklist Test */}
      <div className="bg-gradient-to-br from-slate-800 via-red-950 to-slate-900 border border-slate-700 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🚫</span>
          <div>
            <h3 className="text-lg font-bold text-white">Quick Blacklist Test</h3>
            <p className="text-xs text-slate-400">Enter a destination number to check if it&apos;s blacklisted</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input value={quickTestNumber}
            onChange={e => { setQuickTestNumber(e.target.value); setQuickTestResult(null); }}
            onKeyDown={e => { if (e.key === "Enter") runQuickTest(); }}
            className="flex-1 bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-slate-500 focus:ring-2 focus:ring-red-500 focus:outline-none transition" />
          <button onClick={runQuickTest} disabled={!quickTestNumber.trim()}
            className="bg-red-600 hover:bg-red-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-semibold transition shadow-lg shadow-red-600/25">
            🚫 Check
          </button>
        </div>
        {quickTestResult && (
          <div className={`mt-4 rounded-xl border p-4 ${quickTestResult.blocked ? "bg-red-900/30 border-red-700/50" : "bg-emerald-900/30 border-emerald-700/50"}`}>
            {quickTestResult.blocked ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <span className="text-[10px] font-medium text-red-300 uppercase tracking-wider block mb-1">Number</span>
                    <code className="text-sm font-mono text-slate-300 break-all">{quickTestNumber}</code>
                  </div>
                  <div className="bg-red-900/40 rounded-lg p-3">
                    <span className="text-[10px] font-medium text-red-300 uppercase tracking-wider block mb-1">Status</span>
                    <code className="text-lg font-bold text-red-200 tracking-wider">BLOCKED 🚫</code>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-red-300 uppercase tracking-wider">Blocked by rule</span>
                  <code className="text-sm font-mono font-bold text-red-200 bg-red-900/50 px-3 py-1 rounded-lg">{quickTestResult.matchedRule}</code>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-lg">✅</span>
                <div>
                  <p className="text-sm font-semibold text-emerald-300">Not blacklisted</p>
                  <p className="text-[10px] text-emerald-400/70">This number is not blocked by any active blacklist rules.</p>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="mt-3 text-[10px] text-slate-500">{rules.filter(r => r.isActive).length} active rules • first match wins</div>
      </div>

      {/* Rules Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
              <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
              <th className="text-left px-3 py-2.5 font-medium">Rule Name</th>
              <th className="text-left px-3 py-2.5 font-medium w-24">Mode</th>
              <th className="text-left px-3 py-2.5 font-medium">Number / Prefix</th>
              <th className="text-left px-3 py-2.5 font-medium">Applies To</th>
              <th className="text-left px-3 py-2.5 font-medium w-16">Priority</th>
              <th className="text-center px-3 py-2.5 font-medium w-16">Active</th>
              <th className="text-right px-4 py-2.5 font-medium w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  <p className="text-2xl mb-2">🚫</p>
                  <p className="text-sm">No number blacklist rules yet</p>
                  <p className="text-xs mt-1">Click &quot;+ Add Blacklist&quot; to block numbers or number series</p>
                </td>
              </tr>
            )}
            {rules.map((rule, idx) => (
              <tr key={idx} className={`hover:bg-red-50/40 transition-colors ${!rule.isActive ? "opacity-50" : ""}`}>
                <td className="px-4 py-2 text-slate-400 font-mono">{idx + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{rule.name}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${rule.matchMode === "exact" ? "bg-blue-50 text-blue-700" : rule.matchMode === "prefix" ? "bg-purple-50 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                    {modeLabel(rule.matchMode)}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-slate-600">{rule.number || effectivePattern(rule)}</td>
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
                    <button onClick={() => { if (confirm("Delete this blacklist rule?")) deleteRule(idx); }}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded text-[10px] font-medium transition">Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit / Add Modal */}
      {modalOpen && draft && (
        <TranslationModal
          title={editingIdx === null ? "Add Number DND" : "Edit Number DND"}
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
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
              <input type="number" min={1} max={99} value={draft.priority}
                onChange={e => updateDraft("priority", parseInt(e.target.value) || 1)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none" />
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
              }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white">
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

          {/* Number Blacklist (DND) section */}
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-2 mb-2">
              <span className="text-red-500 text-lg leading-none mt-0.5">🚫</span>
              <div>
                <h4 className="text-sm font-bold text-red-700">Number Blacklist (DND)</h4>
                <p className="text-xs text-red-600/80">Block SMS delivery to specific numbers or number prefixes. Messages to blocked numbers will be rejected.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="text-xs font-medium text-red-700 mb-1 block">Number or Prefix to Block</label>
                <input
                  value={draft.number}
                  onChange={e => updateDraft("number", e.target.value)}
                  placeholder={draft.matchMode === "regex" ? "^8801[3-9]" : "00251"}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-500 focus:outline-none bg-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-red-700 mb-1 block">Match Mode</label>
                <select value={draft.matchMode} onChange={e => updateDraft("matchMode", e.target.value as "exact" | "prefix" | "regex")}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white">
                  <option value="prefix">Prefix match (blocks all numbers starting…)</option>
                  <option value="exact">Exact match (blocks one number)</option>
                  <option value="regex">Regex pattern</option>
                </select>
              </div>
            </div>
            {draft.matchMode === "regex" && (
              <p className="text-[10px] text-red-600/80 mt-2">Regex mode: enter a full pattern, e.g. <code className="bg-red-100 px-1 rounded">^8801[3-9]</code></p>
            )}
          </div>

          {/* Active */}
          <div className="mt-4 flex items-center gap-2">
            <input type="checkbox" checked={draft.isActive} onChange={e => updateDraft("isActive", e.target.checked)}
              className="rounded border-slate-300 text-red-600 focus:ring-red-500 h-4 w-4" />
            <label className="text-sm text-slate-700">Active</label>
          </div>

          {/* Preview result */}
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
