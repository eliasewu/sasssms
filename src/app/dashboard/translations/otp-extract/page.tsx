"use client";

import { useState, useEffect, useCallback } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";

interface OtpExtractRule {
  ruleId: number | null;
  name: string;
  regexPattern: string;
  otpGroupIndex: number;
  forwardSupplierId: number | null;
  forwardSender: string;
  forwardTemplate: string;
  isActive: boolean;
  mcc: string;
  mnc: string;
  sortOrder: number;
}

interface Supplier {
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Preview
  const [sampleContent, setSampleContent] = useState("Your OTP code is 252525. Valid for 5 min.");
  const [extractedOtp, setExtractedOtp] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenant/suppliers").then(r => r.json()).then(d => setSuppliers(d.suppliers || [])).catch(() => {});
  }, []);

  const loadRules = useCallback(async () => {
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

      const parsed: OtpExtractRule[] = profiles.map((p: any) => ({
        ruleId: p.id,
        name: p.name || `OTP_${p.mcc || ""}${p.mnc || ""}`,
        regexPattern: p.regex_pattern || p.regexPattern || "(\\d{4,8})",
        otpGroupIndex: p.otp_group_index || p.otpGroupIndex || 1,
        forwardSupplierId: p.forward_supplier_id || p.forwardSupplierId || null,
        forwardSender: p.forward_sender || p.forwardSender || "",
        forwardTemplate: p.forward_template || p.forwardTemplate || "Your OTP code is {otp}",
        isActive: p.is_active !== false,
        mcc: p.mcc || "",
        mnc: p.mnc || "",
        sortOrder: p.sort_order || p.sortOrder || 1,
      }));
      setRules(parsed);
    } catch (err) {
      setError("Failed to load rules. " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selection]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const addRule = () => {
    setRules(prev => [...prev, {
      ruleId: null, name: `OTP Rule ${prev.length + 1}`,
      regexPattern: "(\\d{4,8})", otpGroupIndex: 1,
      forwardSupplierId: suppliers.length > 0 ? suppliers[0].id : null,
      forwardSender: "", forwardTemplate: "Your OTP code is {otp}",
      isActive: true, mcc: selection.mcc || "", mnc: selection.mnc || "",
      sortOrder: prev.length + 1,
    }]);
  };

  const deleteRule = async (idx: number) => {
    const rule = rules[idx];
    if (rule.ruleId) {
      await fetch(`/api/tenant/otp-extract-rules/${rule.ruleId}`, { method: "DELETE" });
    }
    setRules(prev => prev.filter((_, i) => i !== idx));
    setMsg("Rule deleted");
    setTimeout(() => setMsg(""), 2000);
    loadRules();
  };

  const updateRule = (idx: number, field: string, value: any) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const saveRuleToApi = async (rule: OtpExtractRule): Promise<number | null> => {
    const payload: any = {
      name: rule.name,
      regex_pattern: rule.regexPattern,
      otp_group_index: rule.otpGroupIndex,
      forward_supplier_id: rule.forwardSupplierId,
      forward_sender: rule.forwardSender || null,
      forward_template: rule.forwardTemplate,
      mcc: rule.mcc || null,
      mnc: rule.mnc || null,
      sort_order: rule.sortOrder,
      is_active: rule.isActive,
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
      if (newId && !rule.ruleId) updateRule(idx, "ruleId", newId);
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
    loadRules();
  };

  const runExtract = () => {
    for (const rule of rules) {
      if (!rule.isActive) continue;
      try {
        const re = new RegExp(rule.regexPattern, "gm");
        const m = re.exec(sampleContent);
        if (m && m[rule.otpGroupIndex]) {
          const otp = m[rule.otpGroupIndex];
          const applied = (rule.forwardTemplate || "{otp}").replace(/\{otp\}/g, otp);
          setExtractedOtp(applied);
          return;
        }
      } catch { /* skip */ }
    }
    setExtractedOtp("(no match)");
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
          <h2 className="text-lg font-bold text-slate-800">OTP Extract & Forward Rules</h2>
          <p className="text-xs text-slate-400">Extract OTP codes from SMS content and forward them to a supplier</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Scope: <strong>{selection.label}</strong></span>
          <button onClick={addRule}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
            + Add Rule
          </button>
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-gradient-to-r from-orange-50 to-rose-50 border border-orange-200 rounded-xl p-4 mb-6">
        <h4 className="text-sm font-semibold text-orange-800 mb-3">🔍 OTP Extraction Preview</h4>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input value={sampleContent} onChange={e => setSampleContent(e.target.value)}
            className="w-64 border rounded-lg px-3 py-2 font-mono text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white" />
          <button onClick={runExtract}
            className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-700 transition">
            Extract OTP
          </button>
          {extractedOtp !== null && (
            <code className={`px-3 py-1 rounded font-mono font-bold text-sm ${extractedOtp === "(no match)" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"}`}>
              {extractedOtp}
            </code>
          )}
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
                <th className="text-left px-3 py-2.5 font-medium">Rule Name</th>
                <th className="text-left px-3 py-2.5 font-medium">Regex Pattern</th>
                <th className="text-left px-3 py-2.5 font-medium w-16">Group</th>
                <th className="text-left px-3 py-2.5 font-medium">Forward To</th>
                <th className="text-left px-3 py-2.5 font-medium">Template</th>
                <th className="text-left px-3 py-2.5 font-medium w-16">Order</th>
                <th className="text-center px-3 py-2.5 font-medium w-12">Active</th>
                <th className="text-right px-4 py-2.5 font-medium w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <p className="text-2xl mb-2">🔍</p>
                    <p className="text-sm">No OTP extract rules yet</p>
                    <p className="text-xs mt-1">Click "+ Add Rule" to create your first rule</p>
                  </td>
                </tr>
              )}
              {rules.map((rule, idx) => (
                <tr key={idx} className={`hover:bg-blue-50/40 transition-colors ${!rule.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <input value={rule.name} onChange={e => updateRule(idx, "name", e.target.value)}
                      className="w-full border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 py-0.5 text-xs font-medium text-slate-800 focus:outline-none" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={rule.regexPattern} onChange={e => updateRule(idx, "regexPattern", e.target.value)}
                      placeholder="(\\d{4,8})"
                      className="w-36 border rounded px-2 py-1 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={1} max={9} value={rule.otpGroupIndex} onChange={e => updateRule(idx, "otpGroupIndex", parseInt(e.target.value) || 1)}
                      className="w-12 border rounded px-1.5 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <select value={rule.forwardSupplierId || ""} onChange={e => updateRule(idx, "forwardSupplierId", e.target.value ? parseInt(e.target.value) : null)}
                        className="border rounded px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[100px]">
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
                    <input type="number" min={1} max={99} value={rule.sortOrder} onChange={e => updateRule(idx, "sortOrder", parseInt(e.target.value) || 1)}
                      className="w-12 border rounded px-1.5 py-1 text-center font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={rule.isActive} onChange={e => updateRule(idx, "isActive", e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5" />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => saveRule(idx)}
                        className="bg-green-600 text-white px-2.5 py-1 rounded text-[10px] font-medium hover:bg-green-700 transition">Save</button>
                      <button onClick={() => { if (confirm("Delete this rule?")) deleteRule(idx); }}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded text-[10px] font-medium transition">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
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

      {/* Help */}
      <div className="mt-4 bg-slate-50 border rounded-xl p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-2">💡 How OTP Extract Works</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Regex Pattern:</strong> Pattern to find the OTP code. Default <code className="bg-slate-200 px-1 rounded text-[10px]">(\d{"{4,8}"})</code> matches 4-8 digit codes.</li>
          <li><strong>Capture Group:</strong> Which regex group contains the OTP. Usually 1.</li>
          <li><strong>Forward To:</strong> Supplier to forward the extracted OTP message to. Leave empty to just extract without forwarding.</li>
          <li><strong>Template:</strong> Message template with <code className="bg-slate-200 px-1 rounded text-[10px]">{"{otp}"}</code> placeholder. Applied to the forwarded message.</li>
        </ul>
      </div>
    </div>
  );
}
