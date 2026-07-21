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
}

export default function ContentTranslationPage() {
  const { selection } = useMccMnc();
  const [rules, setRules] = useState<TranslationRule[]>([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<TranslationRule | null>(null);
  const [form, setForm] = useState({ matchPattern: ".*", replacementFixed: "" });
  const [clients, setClients] = useState<{id:number;name:string}[]>([]);
  const [suppliers, setSuppliers] = useState<{id:number;name:string}[]>([]);
  const [scope, setScope] = useState<"client"|"supplier"|"both">("both");
  const [entityId, setEntityId] = useState<number | null>(null);
  const [sampleContent, setSampleContent] = useState("Your verification code is 123456");
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenant/clients").then(r => r.json()).then(d => setClients(d.clients || [])).catch(() => {});
    fetch("/api/tenant/suppliers").then(r => r.json()).then(d => setSuppliers(d.suppliers || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
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
        ? { matchPattern: form.matchPattern, replacementFixed: form.replacementFixed, mcc: selection.mcc, mnc: selection.mnc, scope, entityId }
        : { name: `CONTENT_${selection.label.replace(/[^a-zA-Z0-9]/g, "_")}`, targetField: "BODY", category: "CONTENT", mode: "FIXED", matchPattern: form.matchPattern, replacementFixed: form.replacementFixed, mcc: selection.mcc, mnc: selection.mnc, scope, entityId };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMsg(editingRule ? "Rule updated!" : "Rule created!");
      setTimeout(() => setMsg(""), 3000);
      setShowForm(false); setEditingRule(null);
      setForm({ matchPattern: ".*", replacementFixed: "" }); setScope("both"); setEntityId(null);
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
      load();
    } catch (err) {
      setError("Failed to delete rule. " + (err as Error).message);
    }
  };

  const startEdit = (r: TranslationRule) => {
    setEditingRule(r); setForm({ matchPattern: r.matchPattern, replacementFixed: r.replacementFixed || "" });
    const a = (r as any).assignments?.[0];
    if (a?.clientId) { setScope("client"); setEntityId(a.clientId); }
    else if (a?.supplierId) { setScope("supplier"); setEntityId(a.supplierId); }
    else { setScope("both"); setEntityId(null); }
    setShowForm(true);
  };
  const scopeLabel = (r: any) => {
    const a = r.assignments?.[0];
    if (a?.clientId) return `👤 ${clients.find(c => c.id === a.clientId)?.name || `#${a.clientId}`}`;
    if (a?.supplierId) return `📦 ${suppliers.find(s => s.id === a.supplierId)?.name || `#${a.supplierId}`}`;
    return "🌐 Global";
  };

  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = async (idx: number) => {
    if (draggedIdx === null || draggedIdx === idx) return;
    const reordered = [...rules]; const [item] = reordered.splice(draggedIdx, 1); reordered.splice(idx, 0, item);
    setRules(reordered); setDraggedIdx(null);
    try { await fetch("/api/tenant/sms-translations/reorder", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profiles: reordered.map((r, i) => ({ id: r.id, sortOrder: i })) }) }); } catch { /* best-effort */ }
  };

  const runPreview = () => {
    let result = sampleContent;
    for (const rule of rules) { if (!rule.isActive) continue; try { result = result.replace(new RegExp(rule.matchPattern, "gm"), rule.replacementFixed || result); } catch { /* skip */ } }
    setPreviewResult(result);
  };

  if (loading) return <Spinner />;

  return (
    <div>
      {error && (<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center justify-between"><span>{error}</span><button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button></div>)}
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">{msg}</div>}

      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-slate-500">Rules for: <strong>{selection.label}</strong> ({rules.length} rules)</div>
        <button onClick={() => { setEditingRule(null); setForm({ matchPattern: ".*", replacementFixed: "" }); setScope("both"); setEntityId(null); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">+ Add Rule</button>
      </div>

      <div className="space-y-2 mb-6">
        {rules.length === 0 && (<div className="text-center py-12 text-slate-400"><p className="text-4xl mb-3">📝</p><p className="text-sm">No content translation rules yet</p></div>)}
        {rules.map((rule, idx) => (
          <div key={rule.id} draggable onDragStart={() => handleDragStart(idx)} onDragOver={handleDragOver} onDrop={() => handleDrop(idx)} className={`flex items-center gap-3 bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow group ${rule.isActive ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
            <div className="cursor-grab text-slate-300 hover:text-slate-500 text-lg shrink-0">⋮⋮</div>
            <div className="flex-1 min-w-0 grid grid-cols-3 gap-4">
              <div><label className="text-[10px] text-slate-400 uppercase tracking-wider">Find (Regex)</label><code className="block text-sm font-mono bg-slate-50 rounded px-2 py-1 truncate">{rule.matchPattern}</code></div>
              <div><label className="text-[10px] text-slate-400 uppercase tracking-wider">Replace With</label><code className="block text-sm font-mono bg-green-50 rounded px-2 py-1 truncate text-green-700">{rule.replacementFixed || "(empty)"}</code></div>
              <div><label className="text-[10px] text-slate-400 uppercase tracking-wider">Scope</label><span className="text-xs">{scopeLabel(rule)}</span></div>
            </div>
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => startEdit(rule)} className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded">✏️</button>
              <button onClick={() => deleteRule(rule.id)} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded">🗑️</button>
            </div>
            <div className="text-[10px] text-slate-400 shrink-0">{idx + 1}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <h4 className="text-sm font-semibold mb-3">🧪 Quick Preview</h4>
        <div className="flex flex-col gap-3">
          <div><label className="text-xs text-slate-500 block mb-1">Sample SMS Content</label><textarea value={sampleContent} onChange={e => setSampleContent(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-mono h-20 resize-none" /></div>
          <div className="flex items-center gap-3">
            <button onClick={runPreview} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700">Preview →</button>
            {previewResult !== null && (<div className="flex-1"><label className="text-xs text-slate-500 block mb-1">Result</label><code className="block w-full border border-green-200 bg-green-50 rounded-lg px-3 py-2 text-sm font-mono text-green-700">{previewResult}</code></div>)}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-1">{editingRule ? "Edit Rule" : "New Content Translation"}</h3>
            <p className="text-xs text-slate-500 mb-4">For: {selection.label}</p>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Find Text</label><input value={form.matchPattern} onChange={e => setForm({...form, matchPattern: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Replace With</label><input value={form.replacementFixed} onChange={e => setForm({...form, replacementFixed: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveRule} disabled={saving} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving..." : editingRule ? "Update" : "Create"}</button>
                <button onClick={() => setShowForm(false)} className="flex-1 border py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
              </div>
              <div className="pt-3 border-t">
                <label className="block text-xs font-medium text-slate-600 mb-1">Apply To (Scope)</label>
                <div className="flex gap-2 mb-2">
                  {(["both","client","supplier"] as const).map(s => (
                    <button key={s} type="button" onClick={() => { setScope(s); setEntityId(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        scope === s ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}>{s === "both" ? "🌐 Both" : s === "client" ? "👤 Client" : "📦 Supplier"}</button>
                  ))}
                </div>
                {scope === "client" && (<select value={entityId || ""} onChange={e => setEntityId(e.target.value ? parseInt(e.target.value) : null)} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">Select client...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
                {scope === "supplier" && (<select value={entityId || ""} onChange={e => setEntityId(e.target.value ? parseInt(e.target.value) : null)} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">Select supplier...</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
