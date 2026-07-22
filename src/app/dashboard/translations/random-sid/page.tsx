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

interface PoolItem {
  id: number;
  replacementValue: string;
  mccmnc: string | null;
}

interface TranslationRule {
  id: number;
  name: string;
  matchPattern: string;
  mcc: string | null;
  mnc: string | null;
  isActive: boolean;
  mode: string;
  poolItems?: PoolItem[];
  assignments?: Array<{ clientId: number | null; supplierId: number | null; priority: number }>;
}

interface MappedMccMnc {
  mccmnc: string;
  countryName: string;
  networkName: string;
  sids: string[];
}

export default function RandomSidTranslationPage() {
  const { selection } = useMccMnc();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [ruleName, setRuleName] = useState("");
  const [scope, setScope] = useState<"client" | "supplier" | "both">("supplier");
  const [entityId, setEntityId] = useState<number | null>(null);
  const [priority, setPriority] = useState(1);
  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);

  // Available MCC/MNC data
  const [availableMccMnc, setAvailableMccMnc] = useState<MccMncEntry[]>([]);
  const [loadingMccMnc, setLoadingMccMnc] = useState(false);

  // Mapped MCC/MNC → SID
  const [mappedItems, setMappedItems] = useState<MappedMccMnc[]>([]);
  const [showFlatPoolModal, setShowFlatPoolModal] = useState(false);
  const [flatPoolText, setFlatPoolText] = useState("");

  // Existing rules
  const [existingRules, setExistingRules] = useState<TranslationRule[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [mccmncLookup, setMccmncLookup] = useState<Map<string, { countryName: string; networkName: string }>>(new Map());

  // Fetch clients and suppliers
  useEffect(() => {
    fetch("/api/tenant/clients").then(r => r.json()).then(d => setClients(d.clients || [])).catch(() => {});
    fetch("/api/tenant/suppliers").then(r => r.json()).then(d => setSuppliers(d.suppliers || [])).catch(() => {});
  }, []);

  // Fetch available MCC/MNC from global database (filtered by selection)
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

      // Build lookup map
      const lookup = new Map<string, { countryName: string; networkName: string }>();
      for (const e of entries) {
        lookup.set(e.mccmnc, { countryName: e.countryName, networkName: e.networkName });
      }
      setMccmncLookup(lookup);
    } catch (err) {
      console.error("Failed to load MCC/MNC data:", err);
    } finally {
      setLoadingMccMnc(false);
    }
  }, [selection]);

  useEffect(() => { loadAvailableMccMnc(); }, [loadAvailableMccMnc]);

  // Load existing rules (load global RANDOM_SID profiles, no mcc/mnc filter)
  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("category", "RANDOM_SID");
      const res = await fetch(`/api/tenant/sms-translations?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setExistingRules(data.profiles || []);
    } catch (err) {
      setError("Failed to load rules. " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  // When rules load, populate mapped items from the first active rule
  useEffect(() => {
    if (existingRules.length > 0) {
      const first = existingRules[0];
      setActiveProfileId(first.id);
      setRuleName(first.name);
      setPriority(first.assignments?.[0]?.priority || 1);
      const assign = first.assignments?.[0];
      if (assign?.clientId) { setScope("client"); setEntityId(assign.clientId); }
      else if (assign?.supplierId) { setScope("supplier"); setEntityId(assign.supplierId); }
      else { setScope("supplier"); setEntityId(null); }

      // Build mapped items from pool items
      const items = (first.poolItems || []) as PoolItem[];
      const mappedMap = new Map<string, string[]>();
      for (const item of items) {
        const key = item.mccmnc || "global";
        if (!mappedMap.has(key)) mappedMap.set(key, []);
        mappedMap.get(key)!.push(item.replacementValue);
      }
      const mapped: MappedMccMnc[] = [];
      for (const [mccmnc, sids] of mappedMap) {
        const info = mccmncLookup.get(mccmnc);
        mapped.push({
          mccmnc: mccmnc === "global" ? "" : mccmnc,
          countryName: info?.countryName || "",
          networkName: info?.networkName || "",
          sids,
        });
      }
      setMappedItems(mapped);
    }
  }, [existingRules, mccmncLookup]);

  // Check if an MCC/MNC is already mapped
  const isMapped = (mccmnc: string) => mappedItems.some(m => m.mccmnc === mccmnc);

  // Click to add MCC/MNC to mapping
  const addToMapping = (entry: MccMncEntry) => {
    if (isMapped(entry.mccmnc)) return;
    setMappedItems(prev => [...prev, {
      mccmnc: entry.mccmnc,
      countryName: entry.countryName,
      networkName: entry.networkName,
      sids: [""],
    }]);
  };

  // Remove mapping
  const removeMapping = (mccmnc: string) => {
    setMappedItems(prev => prev.filter(m => m.mccmnc !== mccmnc));
  };

  // Update a SID for a mapped item
  const updateSid = (mccmnc: string, sidIdx: number, value: string) => {
    setMappedItems(prev => prev.map(m => {
      if (m.mccmnc !== mccmnc) return m;
      const newSids = [...m.sids];
      newSids[sidIdx] = value;
      return { ...m, sids: newSids };
    }));
  };

  // Add SID row
  const addSid = (mccmnc: string) => {
    setMappedItems(prev => prev.map(m => {
      if (m.mccmnc !== mccmnc) return m;
      return { ...m, sids: [...m.sids, ""] };
    }));
  };

  // Remove SID row
  const removeSid = (mccmnc: string, sidIdx: number) => {
    setMappedItems(prev => prev.map(m => {
      if (m.mccmnc !== mccmnc) return m;
      const newSids = m.sids.filter((_, i) => i !== sidIdx);
      return { ...m, sids: newSids };
    }));
  };

  // Import from flat pool text
  const importFlatPool = () => {
    const mccmncs = flatPoolText
      .split(/[\s,;\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const m of mccmncs) {
      if (isMapped(m)) continue;
      const entry = availableMccMnc.find(e => e.mccmnc === m);
      if (entry) {
        addToMapping(entry);
      } else {
        setMappedItems(prev => [...prev, {
          mccmnc: m,
          countryName: "",
          networkName: "",
          sids: [""],
        }]);
      }
    }
    setShowFlatPoolModal(false);
    setFlatPoolText("");
  };

  // Save all mappings as a single global profile
  const saveAll = async () => {
    try {
      setSaving(true);
      setError(null);

      // Delete old rule if exists
      if (activeProfileId) {
        await fetch(`/api/tenant/sms-translations/${activeProfileId}`, { method: "DELETE" });
      }

      // Create profile WITHOUT mcc/mnc (global scope) — per-operator filtering
      // is handled entirely by the mccmnc column on pool items
      const name = ruleName || `RANDOM_SID_${selection.label.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const createRes = await fetch("/api/tenant/sms-translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          targetField: "SENDER",
          category: "RANDOM_SID",
          mode: "RANDOM",
          matchPattern: ".*",
          // No mcc/mnc — global scope; pool item mccmnc tags handle per-operator filtering
          scope,
          entityId,
          priority,
        }),
      });
      if (!createRes.ok) throw new Error(`Create failed: HTTP ${createRes.status}`);
      const createData = await createRes.json();
      const profileId = createData.profile?.id;
      if (!profileId) throw new Error("No profile ID returned");

      setActiveProfileId(profileId);

      // Upload pool items — format: "mccmnc:sid" for tagged, plain "sid" for global
      const entries: string[] = [];
      for (const item of mappedItems) {
        const validSids = item.sids.filter(s => s.trim());
        for (const sid of validSids) {
          if (item.mccmnc) {
            entries.push(`${item.mccmnc}:${sid.trim()}`);
          } else {
            entries.push(sid.trim());
          }
        }
      }

      if (entries.length > 0) {
        const uploadRes = await fetch(`/api/tenant/sms-translations/${profileId}/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-replace-all": "true" },
          body: JSON.stringify({ entries }),
        });
        if (!uploadRes.ok) throw new Error(`Upload failed: HTTP ${uploadRes.status}`);
      }

      setMsg("Rule saved with " + entries.length + " SID mappings!");
      setTimeout(() => setMsg(""), 3000);
      loadRules();
    } catch (err) {
      setError("Failed to save. " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Counts
  const totalAvailable = availableMccMnc.length;
  const totalMapped = mappedItems.filter(m => m.mccmnc).length;

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
        <h2 className="text-lg font-bold">Random SID — MCC/MNC Based Mapping</h2>
        <div className="text-xs text-slate-500">
          Scope: <strong>{selection.label}</strong>
        </div>
      </div>

      {/* Form Row: Rule Name, Scope, Priority */}
      <div className="bg-white border rounded-xl p-4 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Rule Name *</label>
            <input
              value={ruleName}
              onChange={e => setRuleName(e.target.value)}
              placeholder="e.g. Borno VoiceOTP Random SID"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Scope</label>
            <div className="flex gap-2">
              {(["both", "client", "supplier"] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setScope(s); setEntityId(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    scope === s ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {s === "both" ? "Global" : s === "client" ? "Client" : "Supplier"}
                </button>
              ))}
            </div>
            {scope === "client" && (
              <select
                value={entityId || ""}
                onChange={e => setEntityId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-2"
              >
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {scope === "supplier" && (
              <select
                value={entityId || ""}
                onChange={e => setEntityId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-2"
              >
                <option value="">Select supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
            <input
              type="number"
              min={1}
              max={99}
              value={priority}
              onChange={e => setPriority(parseInt(e.target.value) || 1)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={saveAll}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? "Saving..." : "Save All Mappings"}
            </button>
          </div>
        </div>
      </div>

      {/* MCC/MNC → SID Mapping */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Available MCC/MNC */}
        <div
          className="bg-white border rounded-xl p-4 shadow-sm"
          onDragOver={e => e.preventDefault()}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Available MCC/MNC</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {totalAvailable}
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Click or drag right to map</p>

          {/* Quick action: Import from flat pool */}
          <button
            onClick={() => setShowFlatPoolModal(true)}
            className="mb-3 w-full border-2 border-dashed border-slate-300 rounded-lg py-2 text-xs text-slate-500 hover:border-blue-300 hover:text-blue-600 transition"
          >
            + Import from flat pool
          </button>

          {/* Filter */}
          <input
            placeholder="Filter MCC/MNC..."
            className="w-full border rounded-lg px-3 py-1.5 text-xs mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            onChange={e => {
              const q = e.target.value.toLowerCase();
              const items = document.querySelectorAll<HTMLElement>("[data-mccmnc]");
              for (const item of items) {
                const mccmnc = item.dataset.mccmnc || "";
                item.style.display = q ? (mccmnc.includes(q) ? "" : "none") : "";
              }
            }}
          />

          {/* Available list */}
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
              return (
                <div
                  key={entry.mccmnc}
                  data-mccmnc={entry.mccmnc}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData("text/plain", entry.mccmnc);
                  }}
                  onClick={() => addToMapping(entry)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition ${
                    mapped
                      ? "bg-green-50 border border-green-200"
                      : "bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {mapped && <span className="text-green-500 shrink-0">&#10003;</span>}
                    <code className="font-mono font-medium shrink-0">{entry.mccmnc}</code>
                    <span className="text-slate-400 truncate">{entry.networkName || entry.countryName}</span>
                  </div>
                  {mapped && <span className="text-[10px] text-green-600 shrink-0">mapped</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Mapped MCC/MNC → SID */}
        <div
          className="bg-white border rounded-xl p-4 shadow-sm"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            // Find which available entry is being dropped by looking at draggedMccmnc
            // We use a dataTransfer approach: store the mccmnc on drag start
            try {
              const mccmnc = e.dataTransfer.getData("text/plain");
              if (mccmnc) {
                const entry = availableMccMnc.find(en => en.mccmnc === mccmnc);
                if (entry && !isMapped(mccmnc)) addToMapping(entry);
              }
            } catch { /* ignore */ }
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">MCC/MNC to SID Mapping</h3>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Available: {totalMapped}/{totalAvailable} Mapped ({totalMapped})
            </span>
          </div>

          {mappedItems.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <p className="text-2xl mb-2">Click to map</p>
              <p className="text-xs">Click or drag MCC/MNC values from the left panel</p>
            </div>
          )}

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {mappedItems.map(item => (
              <div
                key={item.mccmnc || "global"}
                className="border border-blue-100 bg-blue-50/30 rounded-xl p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="text-sm font-mono font-bold text-blue-700 shrink-0">
                      {item.mccmnc || "Global SID"}
                    </code>
                    {item.networkName && (
                      <span className="text-[10px] text-slate-400 truncate">
                        {item.countryName} {item.networkName}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeMapping(item.mccmnc)}
                    className="text-red-400 hover:text-red-600 text-xs px-2 py-0.5 rounded hover:bg-red-50 transition shrink-0"
                  >
                    X
                  </button>
                </div>

                {/* SID inputs */}
                <div className="space-y-1.5">
                  {item.sids.map((sid, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 w-4 shrink-0">{idx + 1}.</span>
                      <input
                        value={sid}
                        onChange={e => updateSid(item.mccmnc, idx, e.target.value)}
                        placeholder="Sender ID..."
                        className="flex-1 border rounded-lg px-2 py-1.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      {item.sids.length > 1 && (
                        <button
                          onClick={() => removeSid(item.mccmnc, idx)}
                          className="text-red-300 hover:text-red-500 text-xs px-1 shrink-0"
                        >
                          X
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => addSid(item.mccmnc)}
                  className="mt-1.5 text-[10px] text-blue-500 hover:text-blue-700 transition font-medium"
                >
                  + Add another SID
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Existing rules info */}
      {existingRules.length > 0 && (
        <div className="mt-6 bg-slate-50 border rounded-xl p-3">
          <p className="text-xs text-slate-400">
            {existingRules.length} existing rule(s) — editing: <strong>{existingRules[0].name}</strong>
          </p>
        </div>
      )}

      {/* Flat Pool Import Modal */}
      {showFlatPoolModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowFlatPoolModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-1">Import MCC/MNC Flat Pool</h3>
            <p className="text-xs text-slate-500 mb-4">
              Paste MCC/MNC values (one per line). Matching entries from the database will be added to your mapping.
            </p>
            <textarea
              value={flatPoolText}
              onChange={e => setFlatPoolText(e.target.value)}
              placeholder={"470001\n470002\n470003\n470004\n470007\n..."}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono h-40 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={importFlatPool}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                Import to Mapping
              </button>
              <button
                onClick={() => setShowFlatPoolModal(false)}
                className="flex-1 border py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
