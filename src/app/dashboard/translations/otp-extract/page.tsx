"use client";

import { useState, useEffect, useCallback } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";

interface Supplier {
  id: number;
  name: string;
}

interface OtpRule {
  id: number;
  name: string;
  mcc: string | null;
  mnc: string | null;
  regexPattern: string;
  otpGroupIndex: number;
  forwardSupplierId: number | null;
  forwardSender: string | null;
  forwardTemplate: string | null;
  isActive: boolean;
  sortOrder: number;
  supplierName?: string;
}

export default function OtpExtractPage() {
  const { selection } = useMccMnc();
  const [rules, setRules] = useState<OtpRule[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<OtpRule | null>(null);
  const [form, setForm] = useState({
    name: "", regexPattern: "", otpGroupIndex: 1,
    forwardSupplierId: null as number | null, forwardSender: "", forwardTemplate: "{otp}",
  });

  const [testContent, setTestContent] = useState("Your OTP is 362514. Do not share.");
  const [testResult, setTestResult] = useState<any>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selection.mcc) params.set("mcc", selection.mcc);
      if (selection.mnc) params.set("mnc", selection.mnc);
      const [rulesRes, suppliersRes] = await Promise.all([
        fetch(`/api/tenant/otp-extract-rules?${params}`).then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
        fetch("/api/tenant/suppliers").then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).catch(() => ({ suppliers: [] })),
      ]);
      setRules(rulesRes.rules || []);
      setSuppliers(suppliersRes.suppliers || []);
    } catch (err) {
      setError("Failed to load data. " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selection]);

  useEffect(() => { load(); }, [load]);

  const saveRule = async () => {
    if (!form.name || !form.regexPattern) {
      setMsg("Name and regex pattern are required");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const url = editingRule ? `/api/tenant/otp-extract-rules/${editingRule.id}` : "/api/tenant/otp-extract-rules";
      const method = editingRule ? "PUT" : "POST";
      const body = { name: form.name, regexPattern: form.regexPattern, otpGroupIndex: form.otpGroupIndex, forwardSupplierId: form.forwardSupplierId, forwardSender: form.forwardSender, forwardTemplate: form.forwardTemplate, mcc: selection.mcc, mnc: selection.mnc };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
      setMsg(editingRule ? "Rule updated!" : "Rule created!");
      setTimeout(() => setMsg(""), 3000);
      setShowForm(false); setEditingRule(null);
      setForm({ name: "", regexPattern: "", otpGroupIndex: 1, forwardSupplierId: null, forwardSender: "", forwardTemplate: "{otp}" });
      load();
    } catch (err) {
      setError("Failed to save rule. " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: number) => {
    try {
      const res = await fetch(`/api/tenant/otp-extract-rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMsg("Rule deleted"); setTimeout(() => setMsg(""), 3000);
      if (selectedRuleId === id) setSelectedRuleId(null);
      load();
    } catch (err) {
      setError("Failed to delete rule. " + (err as Error).message);
    }
  };

  const startEdit = (r: OtpRule) => { setEditingRule(r); setForm({ name: r.name, regexPattern: r.regexPattern, otpGroupIndex: r.otpGroupIndex, forwardSupplierId: r.forwardSupplierId, forwardSender: r.forwardSender || "", forwardTemplate: r.forwardTemplate || "{otp}" }); setShowForm(true); };

  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = async (idx: number) => {
    if (draggedIdx === null || draggedIdx === idx) return;
    const reordered = [...rules]; const [item] = reordered.splice(draggedIdx, 1); reordered.splice(idx, 0, item);
    setRules(reordered); setDraggedIdx(null);
    try { await fetch("/api/tenant/otp-extract-rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules: reordered.map((r, i) => ({ id: r.id, sortOrder: i })) }) }); } catch { /* best-effort */ }
  };

  const testRule = async (ruleId: number) => {
    if (!testContent) return;
    try {
      setTesting(true);
      setTestResult(null);
      const res = await fetch(`/api/tenant/otp-extract-rules/${ruleId}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sampleContent: testContent }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTestResult(await res.json());
      setSelectedRuleId(ruleId);
    } catch (err) {
      setError("Test failed. " + (err as Error).message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      {error && (<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center justify-between"><span>{error}</span><button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button></div>)}
      {msg && <div className={`px-4 py-3 rounded-lg text-sm mb-4 ${msg.startsWith("Error") ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>{msg}</div>}

      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-slate-500">Rules for: <strong>{selection.label}</strong> ({rules.length} rules)</div>
        <button onClick={() => { setEditingRule(null); setForm({ name: "", regexPattern: "", otpGroupIndex: 1, forwardSupplierId: null, forwardSender: "", forwardTemplate: "{otp}" }); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">+ Add Rule</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2">
          {rules.length === 0 && (<div className="text-center py-12 text-slate-400"><p className="text-4xl mb-3">🔐</p><p className="text-sm">No OTP extract rules yet</p><p className="text-xs mt-1">Create rules to automatically extract OTPs from incoming SMS</p></div>)}
          {rules.map((rule, idx) => (
            <div key={rule.id} draggable onDragStart={() => handleDragStart(idx)} onDragOver={handleDragOver} onDrop={() => handleDrop(idx)} onClick={() => testRule(rule.id)} className={`cursor-pointer bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow ${selectedRuleId === rule.id ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}>
              <div className="flex items-center justify-between"><span className={`text-sm font-medium truncate ${!rule.isActive && "opacity-50"}`}>{rule.name}</span><span className={`px-1.5 py-0.5 rounded text-[10px] ${rule.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{rule.isActive ? "Active" : "Inactive"}</span></div>
              <p className="text-xs text-slate-500 mt-1 font-mono truncate">{rule.regexPattern}</p>
              <p className="text-xs text-slate-400 mt-0.5">Forward to: {rule.supplierName || "—"} {rule.forwardSender && `as ${rule.forwardSender}`}</p>
            </div>
          ))}
        </div>
        <div className="lg:col-span-2">
          <div className="bg-white border rounded-xl p-4 shadow-sm space-y-4">
            <h4 className="font-semibold text-sm">🧪 Test OTP Extraction</h4>
            {selectedRuleId && (<div className="flex items-center justify-between"><span className="text-xs text-slate-500">Testing: <strong>{rules.find(r => r.id === selectedRuleId)?.name}</strong></span><div className="flex gap-2">{rules.find(r => r.id === selectedRuleId) && (<><button onClick={() => startEdit(rules.find(r => r.id === selectedRuleId)!)} className="px-3 py-1.5 border rounded-lg text-xs">Edit</button><button onClick={() => deleteRule(selectedRuleId)} className="px-3 py-1.5 border border-red-200 rounded-lg text-xs text-red-600">Delete</button></>)}</div></div>)}
            <div><label className="text-xs font-medium text-slate-500 block mb-1">Sample SMS Content</label><textarea value={testContent} onChange={e => setTestContent(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-mono h-24 resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
            <div className="flex flex-wrap gap-2">
              {rules.filter(r => r.isActive).map(rule => (
                <button key={rule.id} onClick={() => testRule(rule.id)} disabled={testing} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${selectedRuleId === rule.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"} disabled:opacity-50`}>Test: {rule.name}</button>
              ))}
            </div>
            {testing && <Spinner />}
            {testResult && (
              <div className={`border rounded-lg p-4 ${testResult.matched ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                {testResult.matched ? (
                  <div className="space-y-2"><div className="flex items-center gap-2"><span className="text-green-600 text-lg">✅</span><span className="text-sm font-medium text-green-700">OTP Extracted!</span></div><div className="grid grid-cols-2 gap-2 text-xs"><div><span className="text-slate-500">Extracted OTP:</span><code className="block mt-0.5 bg-green-100 text-green-800 px-2 py-1 rounded font-mono font-bold text-lg">{testResult.extractedOtp}</code></div><div><span className="text-slate-500">Forwarded Content:</span><code className="block mt-0.5 bg-white border px-2 py-1 rounded font-mono">{testResult.forwardedContent}</code></div></div></div>
                ) : (<div className="flex items-center gap-2"><span className="text-amber-600 text-lg">⚠️</span><div><p className="text-sm font-medium text-amber-700">No match</p><p className="text-xs text-amber-600">{testResult.message}</p></div></div>)}
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-1">{editingRule ? "Edit Rule" : "New OTP Extract Rule"}</h3>
            <p className="text-xs text-slate-500 mb-4">For: {selection.label}</p>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Rule Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Regex Pattern *</label><input value={form.regexPattern} onChange={e => setForm({...form, regexPattern: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Capture Group Index</label><input type="number" value={form.otpGroupIndex} onChange={e => setForm({...form, otpGroupIndex: parseInt(e.target.value) || 1})} min={1} max={5} className="w-24 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
              <div className="border-t pt-3"><h4 className="text-sm font-medium text-slate-700 mb-2">📤 Forward Settings</h4></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Forward to Supplier</label><select value={form.forwardSupplierId || ""} onChange={e => setForm({...form, forwardSupplierId: e.target.value ? parseInt(e.target.value) : null})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"><option value="">— None —</option>{suppliers.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}</select></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Forward Sender ID</label><input value={form.forwardSender} onChange={e => setForm({...form, forwardSender: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
              <div><label className="block text-xs font-medium text-slate-600 mb-1">Forward Template</label><input value={form.forwardTemplate} onChange={e => setForm({...form, forwardTemplate: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
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
