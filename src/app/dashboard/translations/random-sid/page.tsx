"use client";

import { useState, useEffect, useCallback } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";

interface RandomSidItem {
  mccmnc: string;
  countryName: string;
  networkName: string;
  sids: string[];
}

interface ClientSupplier {
  id: number;
  name: string;
}

export default function RandomSidTranslationPage() {
  const { selection } = useMccMnc();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<RandomSidItem[]>([]);
  const [clients, setClients] = useState<ClientSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<ClientSupplier[]>([]);

  // Form
  const [ruleName, setRuleName] = useState("");
  const [scope, setScope] = useState<"client" | "supplier" | "both">("both");
  const [entityId, setEntityId] = useState<number | null>(null);
  const [priority, setPriority] = useState(1);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);

  // Preview
  const [sampleMccmnc, setSampleMccmnc] = useState("47001");
  const [previewSid, setPreviewSid] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenant/clients").then(r => r.json()).then(d => setClients(d.clients || [])).catch(() => {});
    fetch("/api/tenant/suppliers").then(r => r.json()).then(d => setSuppliers(d.suppliers || [])).catch(() => {});
  }, []);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("category", "RANDOM_SID");
      const res = await fetch(`/api/tenant/sms-translations?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const profiles = (data.profiles || []) as any[];

      if (profiles.length > 0) {
        const first = profiles[0];
        setActiveProfileId(first.id);
        setRuleName(first.name);
        const a = (first.assignments || []).find((x: any) => x.isActive !== false);
        setPriority(a?.priority || 1);
        if (a?.clientId) { setScope("client"); setEntityId(a.clientId); }
        else if (a?.supplierId) { setScope("supplier"); setEntityId(a.supplierId); }
        else { setScope("both"); setEntityId(null); }

        // Build mapped items from pool
        const poolItems = (first.pool_items || first.poolItems || []) as any[];
        const mappedMap = new Map<string, string[]>();
        for (const item of poolItems) {
          const key = item.mccmnc || (item.mcc && item.mnc ? item.mcc + item.mnc : "global");
          if (!mappedMap.has(key)) mappedMap.set(key, []);
          mappedMap.get(key)!.push(item.replacementValue || item.replacement_value || "");
        }
        const mapped: RandomSidItem[] = [];
        for (const [mccmnc, sids] of mappedMap) {
          mapped.push({
            mccmnc: mccmnc === "global" ? "" : mccmnc,
            countryName: "",
            networkName: "",
            sids,
          });
        }
        setItems(mapped);
      } else {
        setItems([]);
      }
    } catch (err) {
      setError("Failed to load rules. " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const addItem = () => {
    setItems(prev => [...prev, { mccmnc: "", countryName: "", networkName: "", sids: [""] }]);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const updateSid = (itemIdx: number, sidIdx: number, value: string) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== itemIdx) return item;
      const sids = [...item.sids];
      sids[sidIdx] = value;
      return { ...item, sids };
    }));
  };

  const addSid = (itemIdx: number) => {
    setItems(prev => prev.map((item, i) => i === itemIdx ? { ...item, sids: [...item.sids, ""] } : item));
  };

  const removeSid = (itemIdx: number, sidIdx: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== itemIdx) return item;
      return { ...item, sids: item.sids.filter((_, j) => j !== sidIdx) };
    }));
  };

  const saveAll = async () => {
    try {
      setSaving(true); setError(null);

      if (activeProfileId) {
        await fetch(`/api/tenant/sms-translations/${activeProfileId}`, { method: "DELETE" });
      }

      const name = ruleName || `RANDOM_SID_${selection.label.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const createRes = await fetch("/api/tenant/sms-translations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, targetField: "SENDER", category: "RANDOM_SID", mode: "RANDOM",
          matchPattern: ".*", scope, entityId, priority,
        }),
      });
      if (!createRes.ok) throw new Error(`Create failed: HTTP ${createRes.status}`);
      const createData = await createRes.json();
      const profileId = createData.profile?.id;
      if (!profileId) throw new Error("No profile ID returned");
      setActiveProfileId(profileId);

      const entries: string[] = [];
      for (const item of items) {
        const validSids = item.sids.filter(s => s.trim());
        for (const sid of validSids) {
          entries.push(item.mccmnc ? `${item.mccmnc}:${sid.trim()}` : sid.trim());
        }
      }

      if (entries.length > 0) {
        const uploadRes = await fetch(`/api/tenant/sms-translations/${profileId}/upload`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-replace-all": "true" },
          body: JSON.stringify({ entries }),
        });
        if (!uploadRes.ok) throw new Error(`Upload failed: HTTP ${uploadRes.status}`);
      }

      setMsg(`Saved ${entries.length} SID mappings!`);
      setTimeout(() => setMsg(""), 3000);
      loadRules();
    } catch (err) {
      setError("Failed to save. " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const randomPreview = () => {
    const matching = items.filter(i => !i.mccmnc || i.mccmnc === sampleMccmnc);
    const pool = matching.length > 0 ? matching : items.filter(i => !i.mccmnc);
    if (pool.length === 0) { setPreviewSid(null); return; }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const validSids = pick.sids.filter(s => s.trim());
    setPreviewSid(validSids.length > 0 ? validSids[Math.floor(Math.random() * validSids.length)] : "(empty pool)");
  };

  const totalSids = items.reduce((sum, item) => sum + item.sids.filter(s => s.trim()).length, 0);

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
          <h2 className="text-lg font-bold text-slate-800">Random SID Mapping</h2>
          <p className="text-xs text-slate-400">Assign random sender IDs per MCC/MNC — one global rule with per-operator pools</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Scope: <strong>{selection.label}</strong></span>
          <button onClick={addItem}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
            + Add MCC/MNC
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4 mb-6">
        <h4 className="text-sm font-semibold text-violet-800 mb-3">🎲 Random SID Preview</h4>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500 text-xs">MCC/MNC:</span>
          <input value={sampleMccmnc} onChange={e => setSampleMccmnc(e.target.value)}
            className="w-24 border rounded-lg px-2 py-2 font-mono text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none bg-white" />
          <button onClick={randomPreview}
            className="bg-violet-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-violet-700 transition">
            🎲 Random Pick
          </button>
          {previewSid !== null && (
            <code className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded font-mono font-bold text-base">{previewSid}</code>
          )}
        </div>
      </div>

      {/* Form: Rule name, scope, priority */}
      <div className="bg-white border rounded-xl p-4 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Rule Name *</label>
            <input value={ruleName} onChange={e => setRuleName(e.target.value)}
              placeholder="e.g. Random SID Rule"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Scope</label>
            <div className="flex gap-1">
              {(["both", "client", "supplier"] as const).map(s => (
                <button key={s} type="button" onClick={() => { setScope(s); setEntityId(null); }}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition ${scope === s ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {s === "both" ? "Global" : s === "client" ? "Client" : "Supplier"}
                </button>
              ))}
            </div>
            {scope === "client" && (
              <select value={entityId || ""} onChange={e => setEntityId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border rounded px-2 py-1 text-xs mt-1">
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {scope === "supplier" && (
              <select value={entityId || ""} onChange={e => setEntityId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border rounded px-2 py-1 text-xs mt-1">
                <option value="">Select supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
            <input type="number" min={1} max={99} value={priority} onChange={e => setPriority(parseInt(e.target.value) || 1)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div className="flex items-end">
            <button onClick={saveAll} disabled={saving}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? "Saving..." : "Save All Mappings"}
            </button>
          </div>
        </div>
      </div>

      {/* MCC/MNC → SID Grid */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b bg-slate-50 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">📱 MCC/MNC → SID Mapping</span>
          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{items.length} operators — {totalSids} SIDs</span>
        </div>

        {items.length === 0 && (
          <div className="px-4 py-12 text-center text-slate-400">
            <p className="text-2xl mb-2">📱</p>
            <p className="text-sm">No mappings yet</p>
            <p className="text-xs mt-1">Click "+ Add MCC/MNC" to create your first mapping</p>
          </div>
        )}

        <div className="p-4 space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="border border-blue-100 bg-blue-50/20 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <input value={item.mccmnc} onChange={e => updateItem(idx, "mccmnc", e.target.value)}
                    placeholder="MCCMNC (e.g. 47001)"
                    className="w-24 border rounded px-2 py-1 font-mono text-xs font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" />
                  {item.mccmnc && <span className="text-[10px] text-slate-400">or leave empty for global</span>}
                </div>
                <button onClick={() => removeItem(idx)}
                  className="text-red-400 hover:text-red-600 text-xs px-1.5 py-0.5 rounded hover:bg-red-50 transition">✕</button>
              </div>

              <div className="space-y-1.5">
                {item.sids.map((sid, si) => (
                  <div key={si} className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 w-4">{si + 1}.</span>
                    <input value={sid} onChange={e => updateSid(idx, si, e.target.value)}
                      placeholder="Sender ID..."
                      className="flex-1 border rounded px-2 py-1.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" />
                    {item.sids.length > 1 && (
                      <button onClick={() => removeSid(idx, si)}
                        className="text-red-400 hover:text-red-600 text-[10px] px-0.5">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => addSid(idx)}
                className="mt-1.5 text-[10px] text-blue-500 hover:text-blue-700 transition font-medium">+ Add SID</button>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 border-t bg-slate-50 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">{totalSids} total SIDs across {items.length} operators</span>
          <button onClick={saveAll} disabled={saving}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
            {saving ? "Saving..." : "Save All"}
          </button>
        </div>
      </div>

      {/* Help */}
      <div className="mt-4 bg-slate-50 border rounded-xl p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-2">💡 How Random SID Works</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>MCC/MNC:</strong> Leave empty for a global pool (matches any operator), or set a specific code.</li>
          <li><strong>SIDs:</strong> Sender IDs in the pool. One is randomly selected when sending through that operator.</li>
          <li><strong>Rule Name & Scope:</strong> One global rule with per-operator SID pools. Scope controls which client/supplier this applies to.</li>
        </ul>
      </div>
    </div>
  );
}
