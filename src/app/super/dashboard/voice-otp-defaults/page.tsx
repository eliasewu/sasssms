"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AudioDuration from "@/components/audio-duration";

interface DefaultAudio {
  id: number; language: string; digit: string;
  fileName: string | null; fileUrl: string | null; audioType: string;
}

interface Tenant {
  id: number; companyName: string; schemaName: string;
}

const LANGUAGES = [
  "English", "Spanish", "Arabic", "French", "Portuguese", "Russian",
  "German", "Italian", "Dutch", "Turkish", "Hindi", "Bangla", "Urdu",
  "Indonesian", "Malay", "Filipino", "Thai", "Vietnamese", "Mandarin",
  "Japanese", "Korean", "Cantonese", "Swahili", "Polish",
  "Swedish", "Norwegian", "Danish", "Finnish", "Ukrainian",
  "Romanian", "Czech", "Hungarian", "Greek", "Hebrew", "Persian",
  "Somali", "Amharic", "Burmese", "Khmer", "Nepali", "Sinhala",
  "Georgian", "Armenian", "Azerbaijani", "Kazakh", "Uzbek",
  "Icelandic", "Estonian", "Latvian", "Lithuanian", "Bulgarian",
  "Serbian", "Croatian", "Slovak", "Bosnian", "Albanian", "Maltese",
].sort((a, b) => a.localeCompare(b));

const DIGITS = ["greeting", "0","1","2","3","4","5","6","7","8","9"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function SuperVoiceOtpDefaultsPage() {
  const [audioFiles, setAudioFiles] = useState<DefaultAudio[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedLang, setSelectedLang] = useState("English");
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [subTab, setSubTab] = useState<"digits" | "letters">("digits");
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMode, setSeedMode] = useState<"all" | "selected">("all");
  const [selectedTenantIds, setSelectedTenantIds] = useState<number[]>([]);
  const [showSeedDialog, setShowSeedDialog] = useState(false);
  const [seedResult, setSeedResult] = useState<{message: string; seededCount: number; totalTenants: number} | null>(null);
  // ── Voice OTP config push state ──
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [configPushMode, setConfigPushMode] = useState<"all" | "selected">("all");
  const [configSelectedIds, setConfigSelectedIds] = useState<number[]>([]);
  const [configSettings, setConfigSettings] = useState({ playCount: 3, retryCount: 1, bilingual: false, languageMode: "local", playMode: "local_single" });
  const [configPushing, setConfigPushing] = useState(false);
  const [configResult, setConfigResult] = useState<{message: string} | null>(null);
  // ── HTTP API config push state ──
  const [showHttpDialog, setShowHttpDialog] = useState(false);
  const [httpPushMode, setHttpPushMode] = useState<"all" | "selected">("all");
  const [httpSelectedIds, setHttpSelectedIds] = useState<number[]>([]);
  const [httpSettings, setHttpSettings] = useState({ enableHttpApi: true, maxTps: 0, webhookUrl: "", httpApiKey: "" });
  const [httpPushing, setHttpPushing] = useState(false);
  const [httpResult, setHttpResult] = useState<{message: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadRef = useRef<{ lang: string; digit: string } | null>(null);
  // ── Bulk upload state (upload all 11 files for a language at once) ──
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ total: number; uploaded: number; extra: number; missing: string[]; errors: string[] } | null>(null);

  const flash = (text: string, err = false) => {
    if (err) { setMsgError(text); setTimeout(() => setMsgError(""), 4000); }
    else { setMsg(text); setTimeout(() => setMsg(""), 3000); }
  };

  const load = useCallback(async () => {
    const [ar, tr] = await Promise.all([
      fetch("/api/super/voice-otp-defaults").then(r => r.json()),
      fetch("/api/super/tenants").then(r => r.json()).catch(() => ({ tenants: [] })),
    ]);
    setAudioFiles(ar.audio || []);
    setTenants(tr.tenants || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getAudio = (lang: string, digit: string) => {
    return audioFiles.find(f => f.language === lang && f.digit === digit);
  };

  // File upload handler via hidden input
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    const handler = async () => {
      const meta = pendingUploadRef.current;
      if (!meta) return;
      const file = input.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("language", meta.lang);
        formData.append("digit", meta.digit);
        formData.append("file", file);

        const res = await fetch("/api/super/voice-otp-defaults", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok) {
          flash(`Default audio saved: ${meta.lang}/${meta.digit}`);
          load();
        } else {
          flash(`${data.error || "Upload failed"}`, true);
        }
      } catch {
        flash("Upload error", true);
      } finally {
        setUploading(false);
        pendingUploadRef.current = null;
        input.value = "";
      }
    };
    input.addEventListener("change", handler);
    return () => input.removeEventListener("change", handler);
  }, [load]);

  const handleUpload = (lang: string, digit: string) => {
    const input = fileInputRef.current;
    if (!input) return;
    pendingUploadRef.current = { lang, digit };
    input.value = "";
    input.click();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/super/voice-otp-defaults?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      flash("Default audio deleted");
      load();
    } else {
      flash("Delete failed", true);
    }
  };

  const handleSeed = async () => {
    const targetTenants = seedMode === "selected" ? selectedTenantIds : [];
    const action = seedMode === "selected" ? "seed-selected" : "seed-all";

    if (seedMode === "selected" && selectedTenantIds.length === 0) {
      flash("Select at least one tenant.", true);
      return;
    }

    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch("/api/super/voice-otp-defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, tenantIds: targetTenants }),
      });
      const data = await res.json();
      if (res.ok) {
        setSeedResult(data);
        flash(data.message);
      } else {
        flash(`${data.error || "Seed failed"}`, true);
      }
    } catch {
      flash("Seed error", true);
    } finally {
      setSeeding(false);
    }
  };

  const toggleTenant = (id: number) => {
    setSelectedTenantIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const toggleConfigTenant = (id: number) => {
    setConfigSelectedIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleConfigPush = async () => {
    if (configPushMode === "selected" && configSelectedIds.length === 0) {
      flash("Select at least one tenant.", true);
      return;
    }
    setConfigPushing(true);
    setConfigResult(null);
    try {
      const res = await fetch("/api/super/voice-otp-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: configPushMode === "selected" ? "seed-selected" : "seed-all",
          tenantIds: configPushMode === "selected" ? configSelectedIds : [],
          settings: configSettings,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfigResult(data);
        flash(data.message);
      } else {
        flash(`${data.error || "Config push failed"}`, true);
      }
    } catch {
      flash("Config push error", true);
    } finally {
      setConfigPushing(false);
    }
  };

  const toggleHttpTenant = (id: number) => {
    setHttpSelectedIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleHttpPush = async () => {
    if (httpPushMode === "selected" && httpSelectedIds.length === 0) {
      flash("Select at least one tenant.", true);
      return;
    }
    setHttpPushing(true);
    setHttpResult(null);
    try {
      // Only send fields the super admin actually filled in
      const settings: Record<string, unknown> = { enableHttpApi: httpSettings.enableHttpApi };
      if (httpSettings.maxTps > 0) settings.maxTps = httpSettings.maxTps;
      if (httpSettings.webhookUrl.trim()) settings.webhookUrl = httpSettings.webhookUrl.trim();
      if (httpSettings.httpApiKey.trim()) settings.httpApiKey = httpSettings.httpApiKey.trim();

      const res = await fetch("/api/super/http-api-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: httpPushMode === "selected" ? "seed-selected" : "seed-all",
          tenantIds: httpPushMode === "selected" ? httpSelectedIds : [],
          settings,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setHttpResult(data);
        flash(data.message);
      } else {
        flash(`${data.error || "HTTP config push failed"}`, true);
      }
    } catch {
      flash("HTTP config push error", true);
    } finally {
      setHttpPushing(false);
    }
  };

  const selectAllTenants = () => {
    setSelectedTenantIds(tenants.map(t => t.id));
  };

  // Bulk upload: one request with all selected files; the API maps each
  // filename to its slot (greeting.wav, 0.wav ... 9.wav).
  const handleBulkUpload = async () => {
    const input = bulkInputRef.current;
    if (!input || !input.files || input.files.length === 0) return;
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const formData = new FormData();
      formData.append("language", selectedLang);
      Array.from(input.files).forEach(f => formData.append("file", f, f.name));
      const res = await fetch("/api/super/voice-otp-defaults", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        if (data.bulk) setBulkResult(data.bulk);
        flash(data.message || "Bulk upload complete");
        load();
      } else {
        flash(`${data.error || "Bulk upload failed"}`, true);
      }
    } catch {
      flash("Bulk upload error", true);
    } finally {
      setBulkUploading(false);
      input.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Voice OTP Default Audio</h2>
          <p className="text-sm text-slate-500">
            Upload default greeting and digit audio per language. Push to all tenants or specific ones.
            Tenants can override from their own Voice OTP panel.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowHttpDialog(true)}
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <><span>🌐</span> Push HTTP API</>
          </button>
          <button
            onClick={() => setShowConfigDialog(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <><span>⚙️</span> Push Config</>
          </button>
          <button
            onClick={() => setShowSeedDialog(true)}
            disabled={audioFiles.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            {seeding ? (
              <><span className="animate-spin">⏳</span> Seeding...</>
            ) : (
              <><span>📤</span> Push to Tenants</>
            )}
          </button>
        </div>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}
      {msgError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{msgError}</div>}

      {/* Seed Dialog */}
      {showSeedDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">📤 Push Voice OTP Audio to Tenants</h3>
                <button onClick={() => { setShowSeedDialog(false); setSeedResult(null); }} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
              </div>

              <p className="text-sm text-slate-500 mb-4">
                Push {audioFiles.length} default audio file(s) to tenants. Select &quot;All Tenants&quot; or choose specific tenants.
                Audio files will appear in each tenant&apos;s Voice OTP → Audio tab.
              </p>

              {/* Mode selector */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setSeedMode("all")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${
                    seedMode === "all" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  🌍 All Tenants ({tenants.length})
                </button>
                <button
                  onClick={() => setSeedMode("selected")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${
                    seedMode === "selected" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  🎯 Select Tenants {selectedTenantIds.length > 0 ? `(${selectedTenantIds.length})` : ""}
                </button>
              </div>

              {/* Tenant List */}
              {seedMode === "selected" && (
                <div className="border rounded-xl max-h-[300px] overflow-y-auto mb-4">
                  <div className="sticky top-0 bg-slate-50 border-b px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">{selectedTenantIds.length} selected</span>
                    <button onClick={selectAllTenants} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Select All</button>
                  </div>
                  {tenants.map(t => (
                    <label key={t.id} className={`flex items-center gap-3 px-3 py-2.5 border-b last:border-0 cursor-pointer hover:bg-slate-50 transition ${selectedTenantIds.includes(t.id) ? "bg-indigo-50" : ""}`}>
                      <input
                        type="checkbox"
                        checked={selectedTenantIds.includes(t.id)}
                        onChange={() => toggleTenant(t.id)}
                        className="accent-indigo-600 rounded"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{t.companyName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{t.schemaName}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Result */}
              {seedResult && (
                <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200">
                  <p className="font-semibold text-green-800">{seedResult.seededCount > 0 ? "✅" : "ℹ️"} {seedResult.message}</p>
                  <p className="text-xs text-green-600 mt-1">{seedResult.seededCount} of {seedResult.totalTenants} tenants received audio files</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSeed}
                  disabled={seeding || (seedMode === "selected" && selectedTenantIds.length === 0)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  {seeding ? (
                    <><span className="animate-spin">⏳</span> Pushing...</>
                  ) : (
                    <><span>📤</span> Push to {seedMode === "all" ? `All (${tenants.length})` : `${selectedTenantIds.length} Selected`} Tenant(s)</>
                  )}
                </button>
                <button onClick={() => { setShowSeedDialog(false); setSeedResult(null); }} className="px-6 py-2.5 border rounded-lg text-sm hover:bg-slate-50 transition">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Config Push Dialog */}
      {showConfigDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">⚙️ Push Voice OTP Config to Tenants</h3>
                <button onClick={() => { setShowConfigDialog(false); setConfigResult(null); }} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
              </div>

              <p className="text-sm text-slate-500 mb-4">
                Push call settings (play count, retries, language mode) to all or selected tenants.
                Only the fields you set are applied — tenant-specific overrides are preserved for unset fields.
              </p>

              {/* Mode selector */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setConfigPushMode("all")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${
                    configPushMode === "all" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  🌍 All Tenants ({tenants.length})
                </button>
                <button
                  onClick={() => setConfigPushMode("selected")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${
                    configPushMode === "selected" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  🎯 Select Tenants {configSelectedIds.length > 0 ? `(${configSelectedIds.length})` : ""}
                </button>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <label className="block">
                  <span className="text-xs text-slate-500 font-medium">Play Count (digit repeats)</span>
                  <input
                    type="number" min={1} max={10}
                    value={configSettings.playCount}
                    onChange={e => setConfigSettings({ ...configSettings, playCount: parseInt(e.target.value) || 3 })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500 font-medium">Retry Count</span>
                  <input
                    type="number" min={0} max={10}
                    value={configSettings.retryCount}
                    onChange={e => setConfigSettings({ ...configSettings, retryCount: parseInt(e.target.value) || 1 })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500 font-medium">Language Mode</span>
                  <select
                    value={configSettings.languageMode}
                    onChange={e => setConfigSettings({ ...configSettings, languageMode: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="local">local</option>
                    <option value="global">global</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500 font-medium">Play Mode</span>
                  <select
                    value={configSettings.playMode}
                    onChange={e => setConfigSettings({ ...configSettings, playMode: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="local_single">Local (Single)</option>
                    <option value="local_double">Local (Double)</option>
                    <option value="local_international">Local + International</option>
                  </select>
                </label>
                <label className="flex items-end gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={configSettings.bilingual}
                    onChange={e => setConfigSettings({ ...configSettings, bilingual: e.target.checked })}
                    className="accent-emerald-600 w-4 h-4"
                  />
                  <span className="text-xs text-slate-500 font-medium">Bilingual (both languages)</span>
                </label>
              </div>

              {/* Tenant List */}
              {configPushMode === "selected" && (
                <div className="border rounded-xl max-h-[260px] overflow-y-auto mb-4">
                  <div className="sticky top-0 bg-slate-50 border-b px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">{configSelectedIds.length} selected</span>
                    <button onClick={() => setConfigSelectedIds(tenants.map(t => t.id))} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Select All</button>
                  </div>
                  {tenants.map(t => (
                    <label key={t.id} className={`flex items-center gap-3 px-3 py-2.5 border-b last:border-0 cursor-pointer hover:bg-slate-50 transition ${configSelectedIds.includes(t.id) ? "bg-emerald-50" : ""}`}>
                      <input
                        type="checkbox"
                        checked={configSelectedIds.includes(t.id)}
                        onChange={() => toggleConfigTenant(t.id)}
                        className="accent-emerald-600 rounded"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{t.companyName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{t.schemaName}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Result */}
              {configResult && (
                <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="font-semibold text-emerald-800">✅ {configResult.message}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleConfigPush}
                  disabled={configPushing || (configPushMode === "selected" && configSelectedIds.length === 0)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  {configPushing ? (
                    <><span className="animate-spin">⏳</span> Pushing...</>
                  ) : (
                    <><span>⚙️</span> Push Config to {configPushMode === "all" ? `All (${tenants.length})` : `${configSelectedIds.length} Selected`} Tenant(s)</>
                  )}
                </button>
                <button onClick={() => { setShowConfigDialog(false); setConfigResult(null); }} className="px-6 py-2.5 border rounded-lg text-sm hover:bg-slate-50 transition">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HTTP API Config Push Dialog */}
      {showHttpDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">🌐 Push HTTP API Settings to Tenants</h3>
                <button onClick={() => { setShowHttpDialog(false); setHttpResult(null); }} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
              </div>

              <p className="text-sm text-slate-500 mb-4">
                Push HTTP API settings (enable/disable, rate limit, DLR webhook, API key) to all or selected tenants.
                Applies to every active client in each tenant. Blank fields are left untouched — tenant overrides are preserved.
              </p>

              {/* Mode selector */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setHttpPushMode("all")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${
                    httpPushMode === "all" ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  🌍 All Tenants ({tenants.length})
                </button>
                <button
                  onClick={() => setHttpPushMode("selected")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${
                    httpPushMode === "selected" ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  🎯 Select Tenants {httpSelectedIds.length > 0 ? `(${httpSelectedIds.length})` : ""}
                </button>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <label className="flex items-end gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={httpSettings.enableHttpApi}
                    onChange={e => setHttpSettings({ ...httpSettings, enableHttpApi: e.target.checked })}
                    className="accent-sky-600 w-4 h-4"
                  />
                  <span className="text-xs text-slate-500 font-medium">Enable HTTP API (on all clients)</span>
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500 font-medium">Max TPS (rate limit / sec)</span>
                  <input
                    type="number" min={0}
                    value={httpSettings.maxTps || ""}
                    onChange={e => setHttpSettings({ ...httpSettings, maxTps: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 100 (blank = keep)"
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </label>
                <label className="block col-span-2">
                  <span className="text-xs text-slate-500 font-medium">DLR Webhook URL (endpoint)</span>
                  <input
                    type="text"
                    value={httpSettings.webhookUrl}
                    onChange={e => setHttpSettings({ ...httpSettings, webhookUrl: e.target.value })}
                    placeholder="https://client.com/dlr-callback (blank = keep)"
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </label>
                <label className="block col-span-2">
                  <span className="text-xs text-slate-500 font-medium">HTTP API Key (credential)</span>
                  <input
                    type="text"
                    value={httpSettings.httpApiKey}
                    onChange={e => setHttpSettings({ ...httpSettings, httpApiKey: e.target.value })}
                    placeholder="Leave blank to keep each client's own key"
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </label>
              </div>

              {/* Tenant List */}
              {httpPushMode === "selected" && (
                <div className="border rounded-xl max-h-[260px] overflow-y-auto mb-4">
                  <div className="sticky top-0 bg-slate-50 border-b px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">{httpSelectedIds.length} selected</span>
                    <button onClick={() => setHttpSelectedIds(tenants.map(t => t.id))} className="text-xs text-sky-600 hover:text-sky-800 font-medium">Select All</button>
                  </div>
                  {tenants.map(t => (
                    <label key={t.id} className={`flex items-center gap-3 px-3 py-2.5 border-b last:border-0 cursor-pointer hover:bg-slate-50 transition ${httpSelectedIds.includes(t.id) ? "bg-sky-50" : ""}`}>
                      <input
                        type="checkbox"
                        checked={httpSelectedIds.includes(t.id)}
                        onChange={() => toggleHttpTenant(t.id)}
                        className="accent-sky-600 rounded"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{t.companyName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{t.schemaName}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Result */}
              {httpResult && (
                <div className="mb-4 p-4 rounded-xl bg-sky-50 border border-sky-200">
                  <p className="font-semibold text-sky-800">✅ {httpResult.message}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleHttpPush}
                  disabled={httpPushing || (httpPushMode === "selected" && httpSelectedIds.length === 0)}
                  className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  {httpPushing ? (
                    <><span className="animate-spin">⏳</span> Pushing...</>
                  ) : (
                    <><span>🌐</span> Push HTTP API to {httpPushMode === "all" ? `All (${tenants.length})` : `${httpSelectedIds.length} Selected`} Tenant(s)</>
                  )}
                </button>
                <button onClick={() => { setShowHttpDialog(false); setHttpResult(null); }} className="px-6 py-2.5 border rounded-lg text-sm hover:bg-slate-50 transition">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} accept=".mp3,.wav,.ogg" className="hidden" />
      <input
        ref={bulkInputRef}
        type="file"
        accept=".mp3,.wav,.ogg"
        multiple
        className="hidden"
        onChange={handleBulkUpload}
      />

      {uploading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <span className="animate-spin">⏳</span> Uploading audio file...
        </div>
      )}

      {/* Language Selector */}
      <div className="bg-white rounded-xl border p-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">Select Language</label>
        <select
          value={selectedLang}
          onChange={e => setSelectedLang(e.target.value)}
          className="w-full max-w-md border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        >
          {LANGUAGES.map(lang => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
        <p className="text-xs text-slate-400 mt-2">
          Upload greeting and digit audio for <strong>{selectedLang}</strong>. These become the default audio
          for all new tenants. Existing tenants' audio is not affected.
        </p>
      </div>

      {/* Audio Grid */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center gap-4 mb-4">
          <h3 className="font-semibold">{selectedLang} Audio Files</h3>
          {/* Sub-tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setSubTab("digits")} className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${subTab === "digits" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>
              🔢 Digits (0–9)
            </button>
            <button onClick={() => setSubTab("letters")} className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${subTab === "letters" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>
              🔤 Letters (A–Z)
            </button>
          </div>
          <span className="text-xs text-slate-400">
            {audioFiles.filter(f => f.language === selectedLang).length} files uploaded
          </span>
          <button
            onClick={() => bulkInputRef.current?.click()}
            disabled={bulkUploading}
            className="ml-auto bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            title="Select greeting + digits 0-9 files for this language (name them greeting.wav, 0.wav ... 9.wav)"
          >
            {bulkUploading ? (
              <><span className="animate-spin">⏳</span> Uploading {selectedLang}...</>
            ) : (
              <><span>📦</span> Bulk Upload (11 files)</>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-4 -mt-2">
          📦 Name the files <code className="bg-slate-100 px-1 rounded">greeting.wav</code>, <code className="bg-slate-100 px-1 rounded">0.wav</code> … <code className="bg-slate-100 px-1 rounded">9.wav</code>
          (any of <strong>.mp3 / .wav / .ogg</strong>), select them all at once, and they upload for <strong>{selectedLang}</strong> —
          one click, auto-pushed to all tenants.
        </p>

        {bulkResult && (
          <div className={`mb-4 p-4 rounded-xl border ${bulkResult.missing.length === 0 && bulkResult.errors.length === 0 ? "bg-green-50 border-green-200" : "bg-purple-50 border-purple-200"}`}>
            <p className="font-semibold text-purple-800">
              {bulkResult.uploaded}/{bulkResult.total} core files uploaded for {selectedLang}
              {bulkResult.extra > 0 && <span className="text-xs font-normal text-purple-500"> (+{bulkResult.extra} letter/extra file{bulkResult.extra > 1 ? "s" : ""})</span>}
            </p>
            {bulkResult.missing.length > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ Not uploaded (name files: greeting.wav, 0.wav … 9.wav): {bulkResult.missing.join(", ")}
              </p>
            )}
            {bulkResult.errors.length > 0 && (
              <p className="text-xs text-red-600 mt-1">Errors: {bulkResult.errors.join("; ")}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {/* Greeting tile */}
          <AudioTile
            label="🎙️ Greeting"
            audio={getAudio(selectedLang, "greeting")}
            playingAudio={playingAudio}
            setPlayingAudio={setPlayingAudio}
            onUpload={() => handleUpload(selectedLang, "greeting")}
            onDelete={() => { const a = getAudio(selectedLang, "greeting"); if (a) handleDelete(a.id); }}
          />

          {/* Digits */}
          {subTab === "digits" && DIGITS.filter(d => d !== "greeting").map(d => {
            const audio = getAudio(selectedLang, d);
            return (
              <AudioTile
                key={d}
                label={d}
                audio={audio}
                playingAudio={playingAudio}
                setPlayingAudio={setPlayingAudio}
                onUpload={() => handleUpload(selectedLang, d)}
                onDelete={() => { const a = getAudio(selectedLang, d); if (a) handleDelete(a.id); }}
              />
            );
          })}

          {/* Letters */}
          {subTab === "letters" && LETTERS.map(letter => {
            const audio = getAudio(selectedLang, letter);
            return (
              <AudioTile
                key={letter}
                label={letter}
                audio={audio}
                playingAudio={playingAudio}
                setPlayingAudio={setPlayingAudio}
                onUpload={() => handleUpload(selectedLang, letter)}
                onDelete={() => { const a = getAudio(selectedLang, letter); if (a) handleDelete(a.id); }}
              />
            );
          })}
        </div>
      </div>

      {/* Player */}
      {playingAudio && (
        <div className="bg-slate-800 rounded-xl p-3 flex items-center gap-3">
          <button onClick={() => setPlayingAudio(null)} className="text-white hover:text-red-400 text-sm">✕ Stop</button>
          <audio src={playingAudio} controls autoPlay className="h-8 flex-1" />
        </div>
      )}

      {/* All Default Files List */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold mb-3">📋 All Default Audio Files ({audioFiles.length})</h3>
        <div className="flex flex-wrap gap-2">
          {audioFiles.length === 0 && (
            <p className="text-sm text-slate-400">No default audio files uploaded yet. Select a language and upload files above.</p>
          )}
          {audioFiles.map(f => (
            <div key={f.id} className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 text-xs">
              <span className="font-semibold text-indigo-600">{f.language}</span>
              <span className="font-mono">{f.digit}</span>
              <AudioDuration url={f.fileUrl} />
              <button onClick={() => { if (f.fileUrl) setPlayingAudio(f.fileUrl); }} className="text-blue-500 hover:text-blue-700" title="Play ▶️">▶️</button>
              <button onClick={() => handleDelete(f.id)} className="text-red-400 hover:text-red-600" title="Delete">×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-sm text-indigo-700">
        <strong>💡 How it works:</strong> Upload default audio per tile, or use <strong>📦 Bulk Upload</strong> to drop in all 11 files
        (greeting + 0-9) for a language at once. Click <strong>"Push to Tenants"</strong> to send to all or specific tenants.
        The audio files appear in each tenant&apos;s Voice OTP → Audio tab. Tenants can still upload their own custom audio.
        Auto-creates language configs if missing.
      </div>
    </div>
  );
}

// ── Audio Tile Component ──
function AudioTile({ label, audio, playingAudio, setPlayingAudio, onUpload, onDelete }: {
  label: string; audio: DefaultAudio | undefined;
  playingAudio: string | null; setPlayingAudio: (url: string | null) => void;
  onUpload: () => void; onDelete: () => void;
}) {
  const hasFile = !!audio?.fileUrl;

  return (
    <div className={`relative border-2 rounded-xl p-3 text-center transition ${hasFile ? "border-indigo-300 bg-indigo-50" : "border-dashed border-slate-300 hover:border-indigo-400"}`}>
      <span className={`text-xl font-bold block ${hasFile ? "text-indigo-700" : "text-slate-500"}`}>{label}</span>
      <span className="text-[10px] text-slate-400">
        {hasFile ? "Uploaded" : "Click to upload"}
      </span>
      {hasFile && (
        <div className="mt-0.5"><AudioDuration url={audio!.fileUrl} /></div>
      )}
      <div className="mt-2 flex items-center justify-center gap-1.5">
        <button onClick={onUpload} className="w-7 h-7 bg-slate-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-slate-600 transition" title="Upload audio">📁</button>
        {hasFile && (
          <button onClick={() => setPlayingAudio(audio!.fileUrl)} className="w-7 h-7 bg-indigo-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-indigo-600 transition" title="Play ▶️">▶️</button>
        )}
        {hasFile && (
          <button onClick={onDelete} className="w-7 h-7 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition" title="Delete">🗑️</button>
        )}
      </div>
    </div>
  );
}
