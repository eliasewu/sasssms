"use client";

import { useState, useEffect, useCallback } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";

interface TranslationRule {
  id: number;
  name: string;
  matchPattern: string;
  replacementFixed: string | null;
  mcc: string | null;
  mnc: string | null;
  sortOrder: number;
  isActive: boolean;
  mode: string;
  poolItems?: { id: number; replacementValue: string }[];
}

export default function RandomTranslationPage() {
  const { selection } = useMccMnc();
  const [rules, setRules] = useState<TranslationRule[]>([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<TranslationRule | null>(null);
  const [form, setForm] = useState({ matchPattern: ".*", poolText: "" });
  const [selectedRule, setSelectedRule] = useState<TranslationRule | null>(null);
  const [sampleInput, setSampleInput] = useState("Your code is 123456");
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  const load = useCallback(async () => {
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
      setRules(data.profiles || []);
    } catch (err) {
      setError("Failed to load rules. " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selection]);

  useEffect(() => { load(); }, [load]);

  const saveRule = async () => {
    try {
      setSaving(true);
      setError(null);
      const url = editingRule ? `/api/tenant/sms-translations/${editingRule.id}` : "/api/tenant/sms-translations";
      const method = editingRule ? "PUT" : "POST";
      const body = editingRule
        ? { matchPattern: form.matchPattern, mcc: selection.mcc, mnc: selection.mnc }
        : { name: `RANDOM_${selection.label.replace(/[^a-zA-Z0-9]/g, "_")}`, targetField: "BODY", category: "RANDOM_CONTENT", mode: "RANDOM", matchPattern: form.matchPattern, mcc: selection.mcc, mnc: selection.mnc };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const ruleId = data.profile?.id || editingRule?.id;
      if (form.poolText.trim() && ruleId) {
        await fetch(`/api/tenant/sms-translations/${ruleId}/upload`, { method: "POST", headers: { "Content-Type": "application/json", "x-replace-all": "true" }, body: JSON.stringify({ entries: form.poolText }) });
      }
      setMsg(editingRule ? "Rule updated!" : "Rule created!");
      setTimeout(() => setMsg(""), 3000);
      setShowForm(false); setEditingRule(null);
      setForm({ matchPattern: ".*", poolText: "" });
      load();
    } catch (err) {
      setError("Failed to save rule. " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: number) => {
    try {
      const res = await fetch(`/api/tenant/sms-translations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMsg("Rule deleted"); setTimeout(() => setMsg(""), 3000);
      setSelectedRule(null);
      load();
    } catch (err) {
      setError("Failed to delete rule. " + (err as Error).message);
    }
  };

  const startEdit = (r: TranslationRule) => { setEditingRule(r); setForm({ matchPattern: r.matchPattern, poolText: (r.poolItems || []).map(i => i.replacementValue).join("\n") }); setShowForm(true); };

  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = async (idx: number) => {
    if (draggedIdx === null || draggedIdx === idx) return;
    const reordered = [...rules]; const [item] = reordered.splice(draggedIdx, 1); reordered.splice(idx, 0, item);
    setRules(reordered); setDraggedIdx(null);
    try { await fetch("/api/tenant/sms-translations/reorder", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profiles: reordered.map((r, i) => ({ id: r.id, sortOrder: i })) }) }); } catch { /* best-effort */ }
  };

  const runPreview = () => {
    const activeRules = rules.filter(r => r.isActive && (r.poolItems || []).length > 0);
    if (activeRules.length === 0) { setPreviewResult("No active rules with pool items"); return; }
    let result = sampleInput;
    for (const rule of activeRules) {
      try { const regex = new RegExp(rule.matchPattern, "gm"); if (regex.test(result)) { const pool = rule.poolItems || []; const pick = pool[Math.floor(Math.random() * pool.length)]; result = result.replace(regex, pick.replacementValue); } } catch { /* skip */ }
    }
    setPreviewResult(result);
  };

  const loadDetail = async (rule: TranslationRule) => {
    try {
      const res = await fetch(`/api/tenant/sms-translations/${rule.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSelectedRule((await res.json()).profile);
    } catch (err) {
      setError("Failed to load rule details. " + (err as Error).message);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      {error && (<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center justify-between"><span>{error}</span><button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button></div>)}
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">{msg}</div>}

      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-slate-500">Rules for: <strong>{selection.label}</strong> ({rules.length} rules)</div>
        <button onClick={() => { setEditingRule(null); setForm({ matchPattern: ".*", poolText: "" }); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">+ Add Rule</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2">
          {rules.length === 0 && (<div className="text-center py-12 text-slate-400"><p className="text-4xl mb-3">🎲</p><p className="text-sm">No random content rules yet</p><p className="text-xs mt-1">Create rules with a pool of random replacements</p></div>)}
          {rules.map((rule, idx) => (
            <div key={rule.id} draggable onDragStart={() => handleDragStart(idx)} onDragOver={handleDragOver} onDrop={() => handleDrop(idx)} onClick={() => loadDetail(rule)} className={`cursor-pointer bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow ${selectedRule?.id === rule.id ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}>
              <div className="flex items-center justify-between"><span className="text-sm font-medium truncate">{rule.name}</span><span className="text-[10px] text-slate-400">{idx + 1}</span></div>
              <p className="text-xs text-slate-500 mt-1">Pattern: <code className="bg-slate-100 px-1 rounded">{rule.matchPattern}</code></p>
              <p className="text-xs text-slate-400">{(rule.poolItems || []).length} variants in pool</p>
            </div>
          ))}
        </div>
        <div className="lg:col-span-2">
          {selectedRule ? (
            <div className="bg-white border rounded-xl p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between"><h4 className="font-semibold">{selectedRule.name}</h4><div className="flex gap-2"><button onClick={() => startEdit(selectedRule)} className="px-3 py-1.5 border rounded-lg text-xs">Edit</button><button onClick={() => deleteRule(selectedRule.id)} className="px-3 py-1.5 border border-red-200 rounded-lg text-xs text-red-600">Delete</button></div></div>
              <div><h5 className="text-xs font-medium text-slate-500 mb-2">Random Pool ({(selectedRule.poolItems || []).length} variants)</h5><div className="flex flex-wrap gap-2">{(selectedRule.poolItems || []).map(item => (<span key={item.id} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-mono">{item.replacementValue}</span>))}</div></div>
              <div><h5 className="text-xs font-medium text-slate-500 mb-2">Quick Preview</h5><div className="flex gap-2"><input value={sampleInput} onChange={e => setSampleInput(e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono" /><button onClick={runPreview} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700">Generate</button></div>{previewResult !== null && (<code className="block mt-2 border border-green-200 bg-green-50 rounded-lg px-3 py-2 text-sm font-mono text-green-700">{previewResult}</code>)}</div>
            </div>
          ) : (<div className="bg-white border rounded-xl p-8 text-center text-slate-400"><p className="text-4xl mb-3">🎲</p><p className="text-sm">Select a rule to view details and pool items</p></div>)}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-1">{editingRule ? "Edit Rule" : "New Random Content Rule"}</h3>
            <p className="text-xs text-slate-500 mb-4">For: {selection.label}</p>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Match Pattern</label><input value={form.matchPattern} onChange={e => setForm({...form, matchPattern: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Random Values (one per line)</label><textarea value={form.poolText} onChange={e => setForm({...form, poolText: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono h-32 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" /></div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveRule} disabled={saving} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving..." : editingRule ? "Update" : "Create"}</button>
                <button onClick={() => setShowForm(false)} className="flex-1 border py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
