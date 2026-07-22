"use client";

import { useState, useEffect, useCallback } from "react";
import { useMccMnc } from "../layout";
import Spinner from "../spinner";

interface MccMncEntry {
  mcc: string;
  mnc: string;
  mccmnc: string;
  countryCode: string;
  countryName: string;
  networkName: string;
}

interface MappedRule {
  mccmnc: string;
  countryName: string;
  networkName: string;
  ruleId: number | null;
  name: string;
  matchPattern: string;
  replacementFixed: string;
  scope: "client" | "supplier" | "both";
  entityId: number | null;
  isActive: boolean;
}

const DEFAULT_PATTERN = "^\\+880";
const DEFAULT_REPLACEMENT = "0";

export default function NumberTranslationPage() {
  const { selection } = useMccMnc();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMccMnc, setLoadingMccMnc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  // Form state
  const [ruleName, setRuleName] = useState("");
  const [defaultScope, setDefaultScope] = useState<"client" | "supplier" | "both">("both");
  const [defaultEntityId, setDefaultEntityId] = useState<number | null>(null);
  const [defaultPattern, setDefaultPattern] = useState(DEFAULT_PATTERN);
  const [defaultReplacement, setDefaultReplacement] = useState(DEFAULT_REPLACEMENT);
  const [priority, setPriority] = useState(1);
  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);

  // Available MCC/MNC data
  const [availableMccMnc, setAvailableMccMnc] = useState<MccMncEntry[]>([]);

  // Mapped rules
  const [mappedRules, setMappedRules] = useState<MappedRule[]>([]);
  const [mccmncLookup, setMccmncLookup] = useState<Map<string, { countryName: string; networkName: string }>>(new Map());
  const [showFlatPoolModal, setShowFlatPoolModal] = useState(false);
  const [flatPoolText, setFlatPoolText] = useState("");

  // Fetch clients and suppliers
  useEffect(() => {
    fetch("/api/tenant/clients").then(r => r.json()).then(d => setClients(d.clients || [])).catch(() => {});
    fetch("/api/tenant/suppliers").then(r => r.json()).then(d => setSuppliers(d.suppliers || [])).catch(() => {});
  }, []);

  // Fetch available MCC/MNC
  const loadAvailableMccMnc = useCallback(async () => {
    try {
      setLoadingMccMnc(true);
      const params = new URLSearchParams();
      if (selection.mcc) params.set("search", selection.mcc);
      params.set("limit", "200");
      const res = await fetch(`/api/tenant/mcc-mnc?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const entries = (data.data || []) as MccMncEntry[];
      setAvailableMccMnc(entries);
      const lookup = new Map<string, { countryName: string; networkName: string }>();
      for (const e of entries) lookup.set(e.mccmnc, { countryName: e.countryName, networkName: e.networkName });
      setMccmncLookup(lookup);
    } finally {
      setLoadingMccMnc(false);
    }
  }, [selection]);

  useEffect(() => { loadAvailableMccMnc(); }, [loadAvailableMccMnc]);

  // Load existing rules
  const loadRules = useCallback(async () => {
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
      const rules = (data.profiles || []) as any[];
      const mapped: MappedRule[] = rules.map(r => ({
        mccmnc: (r.mcc || "") + (r.mnc || ""),
        countryName: mccmncLookup.get((r.mcc || "") + (r.mnc || ""))?.countryName || "",
        networkName: mccmncLookup.get((r.mcc || "") + (r.mnc || ""))?.networkName || "",
        ruleId: r.id,
        name: r.name,
        matchPattern: r.match_pattern || r.matchPattern || ".*",
        replacementFixed: r.replacement_fixed ?? "",
        isActive: r.is_active !== false,
        scope: "both",
        entityId: null,
      }));
      // Enrich with assignment info
      for (const r of mapped) {
        const ruleData = rules.find((rd: any) => rd.id === r.ruleId);
        const assign = ruleData?.assignments?.[0];
        if (assign?.clientId) { r.scope = "client"; r.entityId = assign.clientId; }
        else if (assign?.supplierId) { r.scope = "supplier"; r.entityId = assign.supplierId; }
      }
      setMappedRules(mapped);
      if (mapped.length > 0) setRuleName(mapped[0].name.replace(/_(470\d{3})$/, ""));
    } catch (err) {
      setError("Failed to load rules. " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selection, mccmncLookup]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const isMapped = (mccmnc: string) => mappedRules.some(m => m.mccmnc === mccmnc);

  const addToMapping = (entry: MccMncEntry) => {
    if (isMapped(entry.mccmnc)) return;
    setMappedRules(prev => [...prev, {
      mccmnc: entry.mccmnc,
      countryName: entry.countryName,
      networkName: entry.networkName,
      ruleId: null,
      name: entry.networkName
        ? `NUM_${entry.networkName.replace(/[^a-zA-Z0-9]/g, "_")}`
        : `NUM_${entry.mccmnc}`,
      matchPattern: defaultPattern,
      replacementFixed: defaultReplacement,
      scope: defaultScope,
      entityId: defaultEntityId,
      isActive: true,
    }]);
  };

  const removeMapping = (mccmnc: string) => {
    setMappedRules(prev => prev.filter(m => m.mccmnc !== mccmnc));
  };

  const updateRule = (mccmnc: string, field: string, value: any) => {
    setMappedRules(prev => prev.map(m => m.mccmnc === mccmnc ? { ...m, [field]: value } : m));
  };

  // Save All
  const saveAll = async () => {
    try {
      setSaving(true);
      setError(null);
      const errMsgs: string[] = [];
      let saved = 0;

      for (const rule of mappedRules) {
        const mcc = rule.mccmnc.slice(0, 3);
        const mnc = rule.mccmnc.slice(3);

        try {
          if (rule.ruleId) {
            // Update
            const res = await fetch(`/api/tenant/sms-translations/${rule.ruleId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: rule.name || undefined,
                matchPattern: rule.matchPattern,
                replacementFixed: rule.replacementFixed,
                mcc, mnc,
                scope: rule.scope,
                entityId: rule.entityId,
              }),
            });
            if (!res.ok) { errMsgs.push(`${rule.mccmnc}: update failed (HTTP ${res.status})`); continue; }
          } else {
            // Create
            const res = await fetch("/api/tenant/sms-translations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: rule.name || `NUM_${rule.mccmnc}`,
                targetField: "DESTINATION",
                category: "NUMBER",
                mode: "FIXED",
                matchPattern: rule.matchPattern,
                replacementFixed: rule.replacementFixed || null,
                mcc, mnc,
                scope: rule.scope,
                entityId: rule.entityId,
              }),
            });
            if (!res.ok) { errMsgs.push(`${rule.mccmnc}: create failed (HTTP ${res.status})`); continue; }
          }
          saved++;
        } catch (e) { errMsgs.push(`${rule.mccmnc}: ${(e as Error).message}`); }
      }

      if (errMsgs.length > 0) {
        setSaveErrors(errMsgs);
        setMsg(`Saved ${saved}/${mappedRules.length} (${errMsgs.length} failed)`);
        setTimeout(() => setMsg(""), 5000);
      } else {
        setSaveErrors([]);
        setMsg(`All ${saved} rules saved!`);
        setTimeout(() => setMsg(""), 3000);
      }
      loadRules();
    } catch (err) {
      setError("Failed to save. " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const importFlatPool = () => {
    const mccmncs = flatPoolText.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean);
    for (const m of mccmncs) {
      if (isMapped(m)) continue;
      const entry = availableMccMnc.find(e => e.mccmnc === m);
      if (entry) addToMapping(entry);
      else {
        setMappedRules(prev => [...prev, {
          mccmnc: m, countryName: "", networkName: "", ruleId: null,
          name: `NUM_${m}`, matchPattern: defaultPattern,
          replacementFixed: defaultReplacement,
          scope: defaultScope, entityId: defaultEntityId, isActive: true,
        }]);
      }
    }
    setShowFlatPoolModal(false);
    setFlatPoolText("");
  };

  const totalAvailable = availableMccMnc.length;
  const totalMapped = mappedRules.length;

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">Number Prefix Translation — MCC/MNC Based</h2>
        <div className="text-xs text-slate-500">Scope: <strong>{selection.label}</strong></div>
      </div>

      {/* Form Row: Rule Name, Scope, Pattern, Replacement, Priority, Save */}
      <div className="bg-white border rounded-xl p-4 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Rule Name *</label>
            <input value={ruleName} onChange={e => setRuleName(e.target.value)}
              placeholder="e.g. BD Number Prefix"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Default Scope</label>
            <div className="flex gap-1">
              {(["both", "client", "supplier"] as const).map(s => (
                <button key={s} type="button" onClick={() => { setDefaultScope(s); setDefaultEntityId(null); }}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition ${defaultScope === s ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {s === "both" ? "Global" : s === "client" ? "Client" : "Supplier"}
                </button>
              ))}
            </div>
            {defaultScope === "client" && (
              <select value={defaultEntityId || ""} onChange={e => setDefaultEntityId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border rounded px-2 py-1 text-xs mt-1">
                <option value="">Select...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {defaultScope === "supplier" && (
              <select value={defaultEntityId || ""} onChange={e => setDefaultEntityId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border rounded px-2 py-1 text-xs mt-1">
                <option value="">Select...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Find Pattern</label>
            <input value={defaultPattern} onChange={e => setDefaultPattern(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Replace With</label>
            <input value={defaultReplacement} onChange={e => setDefaultReplacement(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
            <input type="number" min={1} max={99} value={priority} onChange={e => setPriority(parseInt(e.target.value) || 1)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div className="flex items-end">
            <button onClick={saveAll} disabled={saving}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </div>
      </div>

      {/* MCC/MNC → Number Rule Mapping */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Available MCC/MNC */}
        <div className="bg-white border rounded-xl p-4 shadow-sm" onDragOver={e => e.preventDefault()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Available MCC/MNC</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{totalAvailable}</span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Click or drag right to map</p>

          <button onClick={() => setShowFlatPoolModal(true)}
            className="mb-3 w-full border-2 border-dashed border-slate-300 rounded-lg py-2 text-xs text-slate-500 hover:border-blue-300 hover:text-blue-600 transition">
            + Import from flat pool
          </button>

          <input placeholder="Filter MCC/MNC..."
            className="w-full border rounded-lg px-3 py-1.5 text-xs mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            onChange={e => {
              const q = e.target.value.toLowerCase();
              document.querySelectorAll<HTMLElement>("[data-mccmnc]").forEach(item => {
                const m = item.dataset.mccmnc || "";
                item.style.display = q ? (m.includes(q) ? "" : "none") : "";
              });
            }} />

          <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
            {availableMccMnc.length === 0 && !loadingMccMnc && (
              <div className="text-center py-8 text-slate-400">
                <p className="text-2xl mb-2">No data</p>
                <p className="text-xs">Select a country to load available values</p>
              </div>
            )}
            {loadingMccMnc && <Spinner />}
            {availableMccMnc.map(entry => {
              const mapped = isMapped(entry.mccmnc);
              const hasRule = mapped && !!mappedRules.find(m => m.mccmnc === entry.mccmnc)?.ruleId;
              return (
                <div key={entry.mccmnc} data-mccmnc={entry.mccmnc}
                  draggable onDragStart={e => e.dataTransfer.setData("text/plain", entry.mccmnc)}
                  onClick={() => addToMapping(entry)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition ${
                    hasRule ? "bg-green-50 border border-green-200"
                    : mapped ? "bg-amber-50 border border-amber-200"
                    : "bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200"
                  }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {hasRule && <span className="text-green-500 shrink-0">&#10003;</span>}
                    {mapped && !hasRule && <span className="text-amber-500 shrink-0">~</span>}
                    <code className="font-mono font-medium shrink-0">{entry.mccmnc}</code>
                    <span className="text-slate-400 truncate">{entry.networkName || entry.countryName}</span>
                  </div>
                  <span className="text-[10px] shrink-0">{hasRule ? "saved" : mapped ? "draft" : ""}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Mapped Number Rules */}
        <div className="bg-white border rounded-xl p-4 shadow-sm"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            try {
              const mccmnc = e.dataTransfer.getData("text/plain");
              if (mccmnc) {
                const entry = availableMccMnc.find(en => en.mccmnc === mccmnc);
                if (entry && !isMapped(mccmnc)) addToMapping(entry);
              }
            } catch {}
          }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Number Prefix Rules</h3>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Available: {totalMapped}/{totalAvailable} Mapped ({totalMapped})
            </span>
          </div>

          {mappedRules.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <p className="text-2xl mb-2">Click to map</p>
              <p className="text-xs">Click or drag MCC/MNC values from the left panel</p>
            </div>
          )}

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {mappedRules.map(rule => (
              <div key={rule.mccmnc}
                className={`border rounded-xl p-3 transition ${!rule.isActive ? "opacity-60" : ""} ${!rule.ruleId ? "border-blue-300 bg-blue-50/20" : "border-slate-200"}`}>
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="text-sm font-mono font-bold text-blue-700 shrink-0">{rule.mccmnc}</code>
                    {rule.networkName && <span className="text-[10px] text-slate-400 truncate">{rule.countryName} {rule.networkName}</span>}
                    {!rule.ruleId && <span className="text-[10px] text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded-full shrink-0">new</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${rule.scope === "client" ? "bg-purple-100 text-purple-700" : rule.scope === "supplier" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                      {rule.scope === "client"
                        ? `Client ${clients.find(c => c.id === rule.entityId)?.name || `#${rule.entityId}`}`
                        : rule.scope === "supplier"
                          ? `Supplier ${suppliers.find(s => s.id === rule.entityId)?.name || `#${rule.entityId}`}`
                          : "Global"}
                    </span>
                  </div>
                  <button onClick={() => removeMapping(rule.mccmnc)}
                    className="text-red-400 hover:text-red-600 text-xs px-1.5 py-0.5 rounded hover:bg-red-50 transition shrink-0">X</button>
                </div>

                {/* Fields */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Rule Name</label>
                      <input value={rule.name} onChange={e => updateRule(rule.mccmnc, "name", e.target.value)}
                        className="w-full border rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Scope</label>
                      <select value={rule.scope} onChange={e => {
                        const val = e.target.value as "client" | "supplier" | "both";
                        updateRule(rule.mccmnc, "scope", val);
                        updateRule(rule.mccmnc, "entityId", null);
                      }} className="w-full border rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none">
                        <option value="both">Global</option><option value="client">Client</option><option value="supplier">Supplier</option>
                      </select>
                      {rule.scope === "client" && (
                        <select value={rule.entityId || ""} onChange={e => updateRule(rule.mccmnc, "entityId", e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full border rounded px-2 py-1 text-xs mt-1">
                          <option value="">Select...</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}
                      {rule.scope === "supplier" && (
                        <select value={rule.entityId || ""} onChange={e => updateRule(rule.mccmnc, "entityId", e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full border rounded px-2 py-1 text-xs mt-1">
                          <option value="">Select...</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Find Pattern</label>
                      <input value={rule.matchPattern} onChange={e => updateRule(rule.mccmnc, "matchPattern", e.target.value)}
                        className="w-full border rounded px-2 py-1 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Replace With</label>
                      <input value={rule.replacementFixed} onChange={e => updateRule(rule.mccmnc, "replacementFixed", e.target.value)}
                        className="w-full border rounded px-2 py-1 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {saveErrors.length > 0 && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-xs font-medium text-red-700 mb-1">Save errors ({saveErrors.length}):</p>
          {saveErrors.map((e, i) => <p key={i} className="text-[10px] text-red-600 font-mono">{e}</p>)}
        </div>
      )}

      {/* Status info */}
      <div className="mt-6 bg-slate-50 border rounded-xl p-3 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {mappedRules.filter(r => r.ruleId).length} saved rule(s) — {mappedRules.filter(r => !r.ruleId).length} draft(s)
        </p>
        <p className="text-[10px] text-slate-400">
          Dedicated assignment per client/supplier: {mappedRules.filter(r => r.scope !== "both").length} rules
        </p>
      </div>

      {/* Flat Pool Import Modal */}
      {showFlatPoolModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowFlatPoolModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-1">Import MCC/MNC Flat Pool</h3>
            <p className="text-xs text-slate-500 mb-4">Paste MCC/MNC values to create number prefix rules.</p>
            <textarea value={flatPoolText} onChange={e => setFlatPoolText(e.target.value)}
              placeholder={"470001\n470002\n470003\n470004\n470007\n..."}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono h-40 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
            <div className="flex gap-2 mt-4">
              <button onClick={importFlatPool} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700">Import</button>
              <button onClick={() => setShowFlatPoolModal(false)} className="flex-1 border py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
