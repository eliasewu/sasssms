"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MCC_LANGUAGE_DATABASE } from "@/lib/voice-otp-database";
import { useConfirmModal } from "@/components/confirm-modal";

// Extract unique languages from the 220+ MCC database, sorted alphabetically
const DB_LANGUAGES = [...new Set(
  Object.values(MCC_LANGUAGE_DATABASE).map(e => e.language)
)];

// Additional languages requested by user (sorted by global speaker population)
const ADDITIONAL_LANGUAGES = [
  "Mandarin Chinese", "Standard Arabic", "Nigerian Pidgin", "Egyptian Arabic",
  "Marathi", "Telugu", "Hausa", "Western Punjabi", "Tagalog (Filipino)",
  "Tamil", "Yue Chinese (Cantonese)", "Wu Chinese", "Iranian Persian",
  "Javanese", "Gujarati", "Kannada", "Levantine Arabic", "Sudanese Arabic",
  "Yoruba", "Bhojpuri", "Odia (Oriya)", "Malayalam", "Xiang Chinese",
  "Eastern Punjabi", "Hakka Chinese", "Jinyu Chinese", "Maithili",
  "Sindhi", "Fula (Fulani)", "Zulu", "Oromo", "Chittagonian",
  "Haryanvi", "Magahi", "Marwari", "Min Bei Chinese", "Northern Zhuang",
  "Tunisian Arabic", "Serbo-Croatian", "Shona", "Ilokano", "Uyghur",
  "Hiligaynon", "Sukuma", "Santali", "Xhosa", "Min Dong Chinese",
  "Balochi", "Minangkabau", "Mossi", "Afrikaans", "Tatar",
];

// Complete language list: DB languages + additional requested languages, deduplicated & sorted
const ALL_LANGUAGES = [...new Set([...DB_LANGUAGES, ...ADDITIONAL_LANGUAGES])].sort((a, b) => a.localeCompare(b));

interface VotpConfig {
  id: number; country_group: string; prefixes: string; primary_language: string;
  secondary_language: string; primary_audio_count: number; secondary_audio_count: number;
  play_count: number; retry_count: number; bilingual: boolean; is_active: boolean;
}
interface SipConfig {
  id: number; name: string; sip_host: string; sip_port: number; sip_username: string;
  caller_id: string; max_retries: number; timeout: number; is_active: boolean;
}
interface CallLog {
  id: number; destination: string; otp_code: string; language: string; status: string;
  attempt_count: number; duration: number; sip_config_name: string | null;
  call_sid: string | null; country: string | null; mcc: string | null;
  audio_playlist: string | null; attempt_log: string | null; created_at: string;
}
interface AudioFile { id: number; config_id: number; language: string; digit: string; file_name: string | null; file_url: string | null; audio_type: string; }

const TABS = ["Languages", "Audio", "SIP Config", "Call Logs"];

export default function VoiceOtpFullPage() {
  const [tab, setTab] = useState("Languages");
  const [configs, setConfigs] = useState<VotpConfig[]>([]);
  const [sipConfigs, setSipConfigs] = useState<SipConfig[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showSipForm, setShowSipForm] = useState(false);
  const [editingSipId, setEditingSipId] = useState<number | null>(null);
  const [selectedLang, setSelectedLang] = useState("");
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadRef = useRef<{configId: number; lang: string; digit: string} | null>(null);
  const [form, setForm] = useState({ countryGroup: "", prefixes: "", primaryLanguage: "", secondaryLanguage: "English", playCount: "3", retryCount: "1", bilingual: false });
  const [sipForm, setSipForm] = useState({ name: "", sipHost: "", sipPort: "5060", sipUsername: "", sipPassword: "", callerId: "Net2APP", maxRetries: "3", timeout: "30" });
  const [uploading, setUploading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioSubTab, setAudioSubTab] = useState<"digits" | "letters">("digits");
  const [sipTesting, setSipTesting] = useState(false);
  const [sipTestResult, setSipTestResult] = useState<{success:boolean;reachable?:boolean;latency?:number;error?:string;sipResponse?:string;sipSuccess?:boolean} | null>(null);
  const [showTestCall, setShowTestCall] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testOtp, setTestOtp] = useState("");
  const [testSender, setTestSender] = useState("OTP");
  const [testClientId, setTestClientId] = useState("");
  const [testClients, setTestClients] = useState<Array<{id: number; name: string; connection_type: string}>>([]);
  const [testResult, setTestResult] = useState<any>(null);
  const [testSending, setTestSending] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [logStatusFilter, setLogStatusFilter] = useState("");
  const [logDateFrom, setLogDateFrom] = useState("");
  const [logDateTo, setLogDateTo] = useState("");
  const [logPage, setLogPage] = useState(1);
  const logPageSize = 25;

  const { confirm: confirmDelete, modal: confirmModal } = useConfirmModal();

  const flash = (text: string, err = false) => {
    if (err) { setMsgError(text); setTimeout(() => setMsgError(""), 4000); }
    else { setMsg(text); setTimeout(() => setMsg(""), 3000); }
  };

  const load = useCallback(async () => {
    const [cr, sr, lr, ar, clr] = await Promise.all([
      fetch("/api/tenant/voice-otp-config").then(r => r.json()),
      fetch("/api/tenant/voice-otp-sip").then(r => r.json()).catch(() => ({ configs: [] })),
      fetch("/api/tenant/voice-otp-call-logs").then(r => r.json()).catch(() => ({ logs: [] })),
      fetch("/api/tenant/voice-otp-audio").then(r => r.json()).catch(() => ({ audio: [] })),
      fetch("/api/tenant/clients").then(r => r.json()).catch(() => ({ clients: [] })),
    ]);
    setConfigs(cr.configs || []);
    setSipConfigs(sr.configs || []);
    setCallLogs(lr.logs || []);
    setAudioFiles(ar.audio || []);
    setTestClients(clr.clients || []);
  }, []);

  // Auto-select first client after clients load
  useEffect(() => {
    if (testClients.length > 0 && !testClientId) {
      setTestClientId(String(testClients[0].id));
    }
  }, [testClients, testClientId]);

  useEffect(() => { load(); pendingUploadRef.current = null; }, [load, tab]);

  // Auto-refresh call logs every 10s when Call Logs tab is active
  useEffect(() => {
    if (tab !== "Call Logs") return;
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [tab, load]);

  // ── Language Group: Add/Edit/Delete ──
  const handleLangSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.countryGroup || !form.prefixes || !form.primaryLanguage) {
      flash("Country group, prefixes, and primary language are required.", true);
      return;
    }
    try {
      if (editingId) {
        const config = configs.find(c => c.id === editingId);
        await fetch("/api/tenant/voice-otp-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, playCount: parseInt(form.playCount) || 3, retryCount: parseInt(form.retryCount) || 1, bilingual: form.bilingual, id: editingId, isActive: config?.is_active ?? true }),
        });
        flash("Language group updated.");
      } else {
        await fetch("/api/tenant/voice-otp-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, playCount: parseInt(form.playCount) || 3, retryCount: parseInt(form.retryCount) || 1, bilingual: form.bilingual }),
        });
        flash("Language group added.");
      }
      setShowForm(false); setEditingId(null);
      setForm({ countryGroup: "", prefixes: "", primaryLanguage: "", secondaryLanguage: "English", playCount: "3", retryCount: "1", bilingual: false });
      load();
    } catch { flash("Error saving language group.", true); }
  };

  const handleEdit = (c: VotpConfig) => {
    setForm({ countryGroup: c.country_group, prefixes: c.prefixes, primaryLanguage: c.primary_language, secondaryLanguage: c.secondary_language || "English", playCount: String(c.play_count || 3), retryCount: String(c.retry_count || 1), bilingual: c.bilingual || false });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!await confirmDelete("Delete this language group and all its audio files?")) return;
    await fetch(`/api/tenant/voice-otp-config?id=${id}`, { method: "DELETE" });
    flash("Language group deleted.");
    load();
  };

  const handleToggle = async (config: VotpConfig) => {
    await fetch("/api/tenant/voice-otp-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryGroup: config.country_group, prefixes: config.prefixes, primaryLanguage: config.primary_language, secondaryLanguage: config.secondary_language || null, playCount: config.play_count, retryCount: config.retry_count, bilingual: config.bilingual, isActive: !config.is_active, id: config.id }),
    });
    flash(`Language group ${config.is_active ? "deactivated" : "activated"}.`);
    load();
  };

  // ── SIP Config: Add/Edit/Delete ──
  const handleSipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSipId) {
      await fetch("/api/tenant/voice-otp-sip", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...sipForm, id: editingSipId }) });
      flash("SIP endpoint updated.");
    } else {
      await fetch("/api/tenant/voice-otp-sip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sipForm) });
      flash(`SIP endpoint ${sipForm.name} saved.`);
    }
    setShowSipForm(false); setEditingSipId(null);
    load();
  };

  // ── Audio Upload (real file) ──
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
        formData.append("configId", String(meta.configId));
        formData.append("language", meta.lang);
        formData.append("digit", meta.digit);
        formData.append("file", file);

        await fetch("/api/tenant/voice-otp-audio", {
          method: "POST",
          body: formData,
        });
        flash(`Uploaded ${meta.lang} ${meta.digit === "greeting" ? "greeting" : `digit ${meta.digit}`}`);
        load();
      } catch { flash("Upload failed.", true); }
      finally {
        setUploading(false);
        pendingUploadRef.current = null;
        input.value = "";
      }
    };
    input.addEventListener("change", handler);
    return () => input.removeEventListener("change", handler);
  }, [load]);

  const handleAudioUpload = (configId: number, lang: string, digit: string) => {
    const input = fileInputRef.current;
    if (!input) return;
    pendingUploadRef.current = { configId, lang, digit };
    input.value = "";
    input.click();
  };

  const handleDeleteAudio = async (audioId: number) => {
    if (!await confirmDelete("Delete this audio file?")) return;
    await fetch(`/api/tenant/voice-otp-audio?id=${audioId}`, { method: "DELETE" });
    flash("Audio deleted.");
    load();
  };

  const getAudioForDigit = (configId: number, lang: string, digit: string) => {
    return audioFiles.find(f => f.config_id === configId && f.language === lang && f.digit === digit);
  };

  // ── SIP Test Connection ──
  const handleSipTest = async () => {
    if (!sipForm.sipHost) {
      flash("Enter a SIP host first.", true);
      return;
    }
    setSipTesting(true);
    setSipTestResult(null);
    try {
      const res = await fetch("/api/tenant/voice-otp-sip/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: sipForm.sipHost, port: sipForm.sipPort }),
      });
      const data = await res.json();
      setSipTestResult(data);
      if (data.success && data.reachable) {
        flash(`✅ ${sipForm.sipHost}:${sipForm.sipPort} — reachable (${data.latency}ms)`);
      } else {
        flash(`❌ ${data.error || "Connection failed"}`, true);
      }
    } catch {
      flash("Network error testing connection.", true);
    }
    setSipTesting(false);
  };

  // ── Test Call ──
  const handleTestCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone || !testOtp || !testClientId) {
      flash("Phone number, OTP, and client are required.", true);
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const content = `Your OTP is ${testOtp}`;
      const res = await fetch("/api/tenant/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: parseInt(testClientId),
          sender: testSender || "OTP",
          destination: testPhone,
          content,
        }),
      });
      const data = await res.json();
      setTestResult({ ...data, httpStatus: res.status });
      if (res.ok) {
        flash("✅ Test call initiated! Check Call Logs tab for results.");
        load();
      } else {
        flash(`Test call failed: ${data.error || "Unknown error"}`, true);
      }
    } catch {
      flash("Network error sending test call.", true);
    }
    setTestSending(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Voice OTP Configuration</h2>              <p className="text-sm text-slate-500">Group by language — all prefixes for the same language go in one group</p>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}
      {msgError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{msgError}</div>}

      {/* ── Test Call Card ── */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowTestCall(!showTestCall)}
          className="w-full flex items-center justify-between px-5 py-3 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📞</span>
            <div>
              <h3 className="font-semibold text-indigo-800">Test Voice OTP Call</h3>
              <p className="text-xs text-indigo-500">Send a test OTP to any phone number to verify audio, language detection & SIP routing</p>
            </div>
          </div>
          <span className={`text-indigo-400 transition ${showTestCall ? "rotate-180" : ""}`}>▼</span>
        </button>

        {showTestCall && (
          <div className="px-5 pb-5 border-t border-indigo-100">
            <form onSubmit={handleTestCall} className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-indigo-700 mb-1">Phone Number *</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="+254755424815"
                  required
                  className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-indigo-700 mb-1">OTP Code *</label>
                <input
                  type="text"
                  value={testOtp}
                  onChange={e => setTestOtp(e.target.value)}
                  placeholder="123456"
                  required
                  maxLength={8}
                  className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-indigo-700 mb-1">Sender</label>
                <input
                  type="text"
                  value={testSender}
                  onChange={e => setTestSender(e.target.value)}
                  placeholder="OTP"
                  className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-indigo-700 mb-1">Client</label>
                <select
                  value={testClientId}
                  onChange={e => setTestClientId(e.target.value)}
                  required
                  className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  <option value="">Select Client</option>
                  {testClients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.connection_type ? ` (${c.connection_type})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={testSending}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2"
                  >
                    {testSending ? (
                      <><span className="animate-spin">⏳</span> Calling…</>
                    ) : (
                      <><span>📞</span> Send Test Call</>
                    )}
                  </button>
                  <span className="text-xs text-indigo-400">
                    Uses real audio, language detection & SIP routing
                  </span>
                </div>
              </div>
            </form>

            {/* Test result */}
            {testResult && (
              <div className={`mt-3 rounded-lg border p-4 ${
                testResult.httpStatus === 200
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}>
                {testResult.httpStatus === 200 && testResult.voiceOtp ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">✅</span>
                      <span className="font-semibold text-green-800">Call Initiated</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        testResult.voiceOtp.status === "COMPLETED" || testResult.voiceOtp.status === "DELIVERED"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>{testResult.voiceOtp.status}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white rounded-lg p-2 border">
                        <span className="text-slate-400">Country</span>
                        <p className="font-semibold">{testResult.voiceOtp.country || "—"}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border">
                        <span className="text-slate-400">Language</span>
                        <p className="font-semibold">{testResult.voiceOtp.language || "—"}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border">
                        <span className="text-slate-400">Attempts</span>
                        <p className="font-semibold">{testResult.voiceOtp.attemptCount}/3</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border">
                        <span className="text-slate-400">Call SID</span>
                        <p className="font-mono text-[10px] truncate" title={testResult.voiceOtp.callSid}>{testResult.voiceOtp.callSid || "—"}</p>
                      </div>
                    </div>
                    {testResult.voiceOtp.attempts && testResult.voiceOtp.attempts.length > 0 && (
                      <div className="bg-white rounded-lg p-2 border text-xs">
                        <span className="text-slate-400 block mb-1">Attempt Chain</span>
                        <div className="flex flex-wrap gap-1">
                          {testResult.voiceOtp.attempts.map((a: any, i: number) => (
                            <span key={i} className={`px-2 py-0.5 rounded-full text-[10px] ${
                              a.status === "ANSWERED" ? "bg-green-100 text-green-700" :
                              a.status === "NO_ANSWER" ? "bg-orange-100 text-orange-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              #{a.attempt} {a.language} ({a.status}) {a.duration}s
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTab("Call Logs")}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                      >View in Call Logs →</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">❌</span>
                    <div>
                      <p className="font-semibold text-red-800">Call Failed</p>
                      <p className="text-sm text-red-600">{testResult.error || "Unknown error"}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${tab === t ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>
            {t}
            {t === "Call Logs" && tab === "Call Logs" && (
              <span className="relative flex h-2 w-2" title="Auto-refreshing every 10s">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Languages Tab ── */}
      {tab === "Languages" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-slate-500">Group by language name. Add all country prefixes for that language in one group.</p>
              <p className="text-xs text-slate-400 mt-0.5">Format: <strong>Language Group</strong> = language name e.g. "Arabic", <strong>Prefixes</strong> = comma-separated e.g. +966,+971,+962,+20,+213</p>
            </div>
            <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ countryGroup: "", prefixes: "", primaryLanguage: "", secondaryLanguage: "English", playCount: "3", retryCount: "1", bilingual: false }); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Language</button>
          </div>
          
          {showForm && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold mb-3">{editingId ? "Edit Language Group" : "New Language Group"}</h3>
              <form onSubmit={handleLangSubmit} className="grid grid-cols-2 gap-3">
                <Input label="Language Group *" value={form.countryGroup} onChange={v => setForm({...form, countryGroup: v})} placeholder="e.g. Arabic" />
                <Input label="Prefixes * (comma-separated)" value={form.prefixes} onChange={v => setForm({...form, prefixes: v})} placeholder="+966,+971,+962,+20" />
                <LanguageSelect label="Primary Audio Language *" value={form.primaryLanguage} onChange={v => setForm({...form, primaryLanguage: v})} />
                <LanguageSelect label="Fallback Language" value={form.secondaryLanguage} onChange={v => setForm({...form, secondaryLanguage: v})} />
                <Input label="Play Count (digit repeats)" type="number" value={form.playCount} onChange={v => setForm({...form, playCount: v})} placeholder="3" />
                <Input label="Retry Count (call attempts)" type="number" value={form.retryCount} onChange={v => setForm({...form, retryCount: v})} placeholder="1" />
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.bilingual} onChange={e => setForm({...form, bilingual: e.target.checked})} className="accent-blue-600" />
                    <span className="text-sm font-medium">🌐 Bilingual — concatenate 1st + 2nd language audio in one call</span>
                  </label>
                </div>
                <div className="col-span-2 text-xs text-slate-400">Group all country prefixes that speak the same language together. System detects destination country from prefix, maps to the language group, and plays audio in that language. Choose from <strong>200+ languages</strong> or pick "Custom…" for unlisted languages.</div>
                <div className="col-span-2 flex gap-2">
                  <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">{editingId ? "Update" : "Save"}</button>
                  <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr><th className="px-4 py-3 text-left">Language</th><th className="px-4 py-3 text-left">Prefixes</th><th className="px-4 py-3 text-left">1st/2nd Lang</th><th className="px-4 py-3 text-left">Play/Retry</th><th className="px-4 py-3 text-left">Audio</th><th className="px-4 py-3 text-left">Bilingual</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {configs.map(c => (
                  <tr key={c.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{c.country_group}</td>
                    <td className="px-4 py-3 font-mono text-xs max-w-[120px] truncate" title={c.prefixes}>{c.prefixes}</td>
                    <td className="px-4 py-3 text-xs">{c.primary_language}{c.secondary_language ? ` / ${c.secondary_language}` : ""}</td>
                    <td className="px-4 py-3 text-xs font-mono">{c.play_count || 3}×<span className="text-slate-400"> / </span>{c.retry_count || 1}↺</td>
                    <td className="px-4 py-3 text-xs">{c.primary_audio_count}/{c.secondary_audio_count} files</td>
                    <td className="px-4 py-3">{c.bilingual ? <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">🌐 Bilingual</span> : <span className="text-xs text-slate-400">Single</span>}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggle(c)} className={`px-2 py-0.5 rounded-full text-xs cursor-pointer ${c.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}>
                        {c.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => handleEdit(c)} className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-md transition" title="Edit">✏️</button>
                        <button onClick={() => handleDelete(c.id)} className="px-2.5 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-md transition" title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {configs.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No language groups configured. Click "+ Add Language" to create one.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Audio Tab ── */}
      {tab === "Audio" && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <select value={selectedConfigId || ""} onChange={e => { const id = parseInt(e.target.value); setSelectedConfigId(id); const cfg = configs.find(c => c.id === id); setSelectedLang(cfg?.primary_language || ""); }} className="border rounded-lg px-4 py-2 text-sm">                  <option value="">Select Language Group</option>
              {configs.map(c => <option key={c.id} value={c.id}>{c.country_group} — {c.primary_language} {c.prefixes ? `(${c.prefixes})` : ""}</option>)}
            </select>
            {selectedConfigId && (
              <select value={selectedLang} onChange={e => setSelectedLang(e.target.value)} className="border rounded-lg px-4 py-2 text-sm">
                <option value="" disabled>Select language for audio upload…</option>
                {ALL_LANGUAGES.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            )}
          </div>
          
          <input type="file" ref={fileInputRef} accept=".mp3,.wav,.ogg" className="hidden" />

          {uploading && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <span className="animate-spin">⏳</span> Uploading audio file...
            </div>
          )}

          {selectedConfigId && selectedLang && (
            <div>
              <p className="text-sm text-slate-500 mb-3">
                Upload custom audio for <strong>{selectedLang}</strong>. Click a tile to upload, ▶️ to play, 🗑️ to delete. Built-in English audio is always available as fallback.
              </p>

              {/* Sub-tabs: Digits / Letters */}
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-3">
                <button onClick={() => setAudioSubTab("digits")} className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${audioSubTab === "digits" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>🔢 Digits (0–9)</button>
                <button onClick={() => setAudioSubTab("letters")} className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${audioSubTab === "letters" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>🔤 Letters (A–Z)</button>
              </div>

              {/* Greeting + Digit/Letter Grid */}
              <div className="grid grid-cols-5 lg:grid-cols-6 gap-3">
                {/* Greeting tile */}
                <AudioTile
                  lang={selectedLang}
                  digit="greeting"
                  label="🎙️ Greeting"
                  audio={getAudioForDigit(selectedConfigId, selectedLang, "greeting")}
                  playingAudio={playingAudio}
                  setPlayingAudio={setPlayingAudio}
                  onUpload={() => handleAudioUpload(selectedConfigId, selectedLang, "greeting")}
                  onDelete={() => { const a = getAudioForDigit(selectedConfigId, selectedLang, "greeting"); if (a) handleDeleteAudio(a.id); }}
                />

                {/* Digits 0-9 */}
                {audioSubTab === "digits" && [0,1,2,3,4,5,6,7,8,9].map(d => {
                  const audio = getAudioForDigit(selectedConfigId, selectedLang, d.toString());
                  return (
                    <AudioTile
                      key={d}
                      lang={selectedLang}
                      digit={d.toString()}
                      label={String(d)}
                      audio={audio}
                      playingAudio={playingAudio}
                      setPlayingAudio={setPlayingAudio}
                      onUpload={() => handleAudioUpload(selectedConfigId, selectedLang, d.toString())}
                      onDelete={() => { const a = getAudioForDigit(selectedConfigId, selectedLang, d.toString()); if (a) handleDeleteAudio(a.id); }}
                    />
                  );
                })}

                {/* Letters A-Z */}
                {audioSubTab === "letters" && "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(letter => {
                  const audio = getAudioForDigit(selectedConfigId, selectedLang, letter);
                  return (
                    <AudioTile
                      key={letter}
                      lang={selectedLang}
                      digit={letter}
                      label={letter}
                      audio={audio}
                      playingAudio={playingAudio}
                      setPlayingAudio={setPlayingAudio}
                      onUpload={() => handleAudioUpload(selectedConfigId, selectedLang, letter)}
                      onDelete={() => { const a = getAudioForDigit(selectedConfigId, selectedLang, letter); if (a) handleDeleteAudio(a.id); }}
                    />
                  );
                })}
              </div>

              {/* Uploaded files list */}
              {audioFiles.filter(f => f.config_id === selectedConfigId && (f.language === selectedLang || f.language === (configs.find(c => c.id === selectedConfigId)?.secondary_language || "English"))).length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-600 mb-2">Uploaded files:</p>
                  <div className="flex flex-wrap gap-2">
                    {audioFiles.filter(f => f.config_id === selectedConfigId).map(f => (
                      <div key={f.id} className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 text-xs">
                        <span className="font-mono">{f.language}/{f.digit}</span>
                        <span className="text-slate-400">{f.file_name}</span>
                        <button onClick={() => { if (f.file_url) setPlayingAudio(f.file_url); }} className="text-blue-500 hover:text-blue-700" title="Play ▶️">▶️</button>
                        <button onClick={() => handleDeleteAudio(f.id)} className="text-red-400 hover:text-red-600" title="Delete">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HTML5 Audio Player */}
          {playingAudio && (
            <div className="bg-slate-800 rounded-xl p-3 flex items-center gap-3">
              <button onClick={() => setPlayingAudio(null)} className="text-white hover:text-red-400 text-sm">✕ Stop</button>
              <audio src={playingAudio} controls autoPlay className="h-8 flex-1" />
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <strong>🎵 Audio:</strong> Upload MP3 or WAV files for any language. Built-in English audio serves as fallback when custom files are not uploaded. Supports alphanumeric OTP codes (e.g. "AB3X9") with digits 0-9 and letters A-Z.
          </div>
        </div>
      )}

      {/* ── SIP Config Tab ── */}
      {tab === "SIP Config" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">Each tenant configures their own Asterisk SIP endpoint. All Voice OTP calls route via this SIP trunk.</p>
            <button onClick={() => setShowSipForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add SIP Endpoint</button>
          </div>
          {showSipForm && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold mb-3">{editingSipId ? "Edit SIP Endpoint" : "New SIP Endpoint"}</h3>
              <form onSubmit={handleSipSubmit} className="grid grid-cols-3 gap-3">
                <Input label="Name *" value={sipForm.name} onChange={v => setSipForm({...sipForm, name: v})} />
                <div>
                  <label className="block text-sm font-medium mb-1">SIP Host *</label>
                  <div className="flex gap-1">
                    <input type="text" value={sipForm.sipHost} onChange={e => { setSipForm({...sipForm, sipHost: e.target.value}); setSipTestResult(null); }} placeholder="asterisk.example.com" className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="button" onClick={handleSipTest} disabled={sipTesting || !sipForm.sipHost}
                      className="px-3 py-2 border border-blue-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition whitespace-nowrap flex items-center gap-1"
                    >
                      {sipTesting ? <><span className="animate-spin">⏳</span> Testing…</> : <>🔌 Test</>}
                    </button>
                  </div>
                  {sipTestResult && (
                    <div className={`mt-1.5 flex items-center gap-1.5 text-xs ${sipTestResult.success && sipTestResult.reachable ? "text-green-600" : "text-red-600"}`}>
                      <span>{sipTestResult.success && sipTestResult.reachable ? "✅" : "❌"}</span>
                      <span>
                        {sipTestResult.success && sipTestResult.reachable
                          ? `Connected (${sipTestResult.latency}ms)${sipTestResult.sipSuccess ? " • SIP OK" : " • No SIP response"}`
                          : sipTestResult.error || "Connection failed"
                        }
                      </span>
                    </div>
                  )}
                </div>
                <Input label="SIP Port" value={sipForm.sipPort} onChange={v => setSipForm({...sipForm, sipPort: v})} />
                <Input label="Username" value={sipForm.sipUsername} onChange={v => setSipForm({...sipForm, sipUsername: v})} />
                <Input label="Password" type="password" value={sipForm.sipPassword} onChange={v => setSipForm({...sipForm, sipPassword: v})} />
                <Input label="Caller ID" value={sipForm.callerId} onChange={v => setSipForm({...sipForm, callerId: v})} />
                <Input label="Max Retries" value={sipForm.maxRetries} onChange={v => setSipForm({...sipForm, maxRetries: v})} />
                <Input label="Timeout (s)" value={sipForm.timeout} onChange={v => setSipForm({...sipForm, timeout: v})} />
                <div className="flex items-end gap-2">
                  <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">{editingSipId ? "Update" : "Save"}</button>
                  <button type="button" onClick={() => { setShowSipForm(false); setEditingSipId(null); }} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
                </div>
              </form>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {sipConfigs.map(s => (
              <div key={s.id} className="bg-white rounded-xl border p-5 group">
                <div className="flex justify-between mb-2">
                  <h4 className="font-semibold">{s.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${s.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{s.is_active ? "Active" : "Inactive"}</span>
                    <button onClick={() => { setSipForm({ name: s.name, sipHost: s.sip_host || "", sipPort: String(s.sip_port || 5060), sipUsername: s.sip_username || "", sipPassword: "", callerId: s.caller_id || "Net2APP", maxRetries: String(s.max_retries || 3), timeout: String(s.timeout || 30) }); setEditingSipId(s.id); setShowSipForm(true); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-500 text-xs transition" title="Edit">✏️</button>
                    <button onClick={async () => { if (await confirmDelete(`Delete SIP endpoint "${s.name}"?`)) { await fetch(`/api/tenant/voice-otp-sip?id=${s.id}`, { method: "DELETE" }); flash("SIP endpoint deleted."); load(); } }} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs transition" title="Delete">🗑️</button>
                  </div>
                </div>
                <p className="text-sm font-mono text-slate-600">sip:{s.sip_host}:{s.sip_port || 5060}</p>
                <p className="text-xs text-slate-500">Retries: {s.max_retries || 3} · Timeout: {s.timeout || 30}s</p>
              </div>
            ))}
            {sipConfigs.length === 0 && (
              <div className="col-span-2 py-8 text-center text-slate-400 text-sm">No SIP endpoints configured. Click "+ Add SIP Endpoint" to create one.</div>
            )}
          </div>
        </div>
      )}

      {/* ── Call Logs Tab ── */}
      {tab === "Call Logs" && (() => {
        // Compute filtered logs
        const filtered = callLogs.filter(l => {
          const matchesSearch = !logSearch ||
            l.destination.toLowerCase().includes(logSearch.toLowerCase()) ||
            l.otp_code.toLowerCase().includes(logSearch.toLowerCase()) ||
            (l.country || "").toLowerCase().includes(logSearch.toLowerCase()) ||
            (l.language || "").toLowerCase().includes(logSearch.toLowerCase()) ||
            (l.sip_config_name || "").toLowerCase().includes(logSearch.toLowerCase());
          const matchesStatus = !logStatusFilter || l.status === logStatusFilter;
          const matchesDateFrom = !logDateFrom || new Date(l.created_at) >= new Date(logDateFrom);
          const matchesDateTo = !logDateTo || new Date(l.created_at) <= new Date(logDateTo + "T23:59:59");
          return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Paginate
        const totalPages = Math.max(1, Math.ceil(filtered.length / logPageSize));
        const safePage = Math.min(logPage, totalPages);
        const startIdx = (safePage - 1) * logPageSize;
        const pageLogs = filtered.slice(startIdx, startIdx + logPageSize);

        const getPageNumbers = () => {
          const pages: (number | string)[] = [];
          const delta = 1;
          const left = Math.max(2, safePage - delta);
          const right = Math.min(totalPages - 1, safePage + delta);
          pages.push(1);
          if (left > 2) pages.push("...");
          for (let i = left; i <= right; i++) pages.push(i);
          if (right < totalPages - 1) pages.push("...");
          if (totalPages > 1) pages.push(totalPages);
          return pages;
        };

        const LOG_STATUSES = ["COMPLETED", "DELIVERED", "FAILED", "IN_PROGRESS", "NO_ANSWER", "BUSY"];

        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Each row shows the full Voice OTP call journey — country detection, language mapping, audio playlist, and multi-attempt SIP calls via Asterisk.</p>

            {/* Filters bar */}
            <div className="bg-white rounded-xl border p-4 flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                <input
                  type="text"
                  value={logSearch}
                  onChange={e => { setLogSearch(e.target.value); setLogPage(1); }}
                  placeholder="Search by destination, OTP, country, language, SIP…"
                  className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Status filter */}
              <select
                value={logStatusFilter}
                onChange={e => { setLogStatusFilter(e.target.value); setLogPage(1); }}
                className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                {LOG_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Date from */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">From</span>
                <input
                  type="date"
                  value={logDateFrom}
                  onChange={e => { setLogDateFrom(e.target.value); setLogPage(1); }}
                  className="border rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Date to */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">To</span>
                <input
                  type="date"
                  value={logDateTo}
                  onChange={e => { setLogDateTo(e.target.value); setLogPage(1); }}
                  className="border rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Clear filters */}
              {(logSearch || logStatusFilter || logDateFrom || logDateTo) && (
                <button
                  onClick={() => { setLogSearch(""); setLogStatusFilter(""); setLogDateFrom(""); setLogDateTo(""); setLogPage(1); }}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                >✕ Clear filters</button>
              )}
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {filtered.length === 0
                  ? "No logs match your filters."
                  : `Showing ${startIdx + 1}–${Math.min(startIdx + logPageSize, filtered.length)} of ${filtered.length} log${filtered.length === 1 ? "" : "s"}`}
              </p>
            </div>

            {/* Logs table */}
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-slate-500">Destination</th>
                    <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-slate-500">OTP</th>
                    <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-slate-500">Country</th>
                    <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-slate-500">Language Journey</th>
                    <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-slate-500">Attempts</th>
                    <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-slate-500">Duration</th>
                    <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-slate-500">SIP</th>
                    <th className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-slate-500">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {pageLogs.map(l => {
                    const attempts = l.attempt_log ? (() => { try { return JSON.parse(l.attempt_log); } catch { return []; } })() : [];
                    const playlist = l.audio_playlist ? (() => { try { return JSON.parse(l.audio_playlist); } catch { return []; } })() : [];
                    const attemptLang = attempts.length > 0
                      ? attempts.map((a: {language: string; status: string}) => `${a.language}(${a.status.slice(0,1)})`).join(" → ")
                      : "";
                    return (
                      <tr key={l.id} className="border-b hover:bg-slate-50 transition">
                        <td className="px-3 py-3 font-mono text-xs">{l.destination}</td>
                        <td className="px-3 py-3 font-mono font-bold text-xs">{l.otp_code}</td>
                        <td className="px-3 py-3 text-xs">{l.country || "—"} <span className="text-slate-400">({l.mcc || "?"})</span></td>
                        <td className="px-3 py-3">
                          <div className="text-xs font-medium">{l.language}</div>
                          {attemptLang && (
                            <div className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate" title={attemptLang}>
                              {attemptLang}
                            </div>
                          )}
                          {playlist.length > 0 && (
                            <div className="text-[10px] text-slate-400" title={playlist.map((p: any) => p.file || p).join(", ")}>
                              🎵 {playlist.length} file{playlist.length === 1 ? "" : "s"}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            l.status === "COMPLETED" || l.status === "DELIVERED"
                              ? "bg-green-100 text-green-700"
                              : l.status === "FAILED"
                              ? "bg-red-100 text-red-700"
                              : l.status === "IN_PROGRESS"
                              ? "bg-amber-100 text-amber-700"
                              : l.status === "NO_ANSWER"
                              ? "bg-orange-100 text-orange-700"
                              : l.status === "BUSY"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-slate-100 text-slate-600"
                          }`}>{l.status}</span>
                        </td>
                        <td className="px-3 py-3 text-xs">{l.attempt_count}/3</td>
                        <td className="px-3 py-3 text-xs font-mono">{l.duration || 0}s</td>
                        <td className="px-3 py-3 text-[10px] text-slate-400 max-w-[110px] truncate" title={l.sip_config_name || ""}>{l.sip_config_name || "—"}</td>
                        <td className="px-3 py-3 text-[10px] text-slate-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {pageLogs.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-12 text-center text-slate-400">
                        <div className="text-2xl mb-2">📞</div>
                        <p>{callLogs.length === 0 ? "No call logs yet. Send a Voice OTP to see logs here." : "No logs match your current filters."}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filtered.length > logPageSize && (
              <div className="flex items-center justify-between bg-white rounded-xl border px-4 py-3">
                <button
                  onClick={() => setLogPage(Math.max(1, safePage - 1))}
                  disabled={safePage <= 1}
                  className="px-3 py-1.5 text-sm border rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >← Prev</button>

                <div className="flex items-center gap-1">
                  {getPageNumbers().map((p, i) =>
                    typeof p === "string" ? (
                      <span key={`ellipsis-${i}`} className="px-2 text-slate-400 text-sm">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setLogPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                          p === safePage
                            ? "bg-blue-600 text-white"
                            : "hover:bg-slate-100 text-slate-600"
                        }`}
                      >{p}</button>
                    )
                  )}
                </div>

                <button
                  onClick={() => setLogPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage >= totalPages}
                  className="px-3 py-1.5 text-sm border rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >Next →</button>
              </div>
            )}
          </div>
        );
      })()}
      {confirmModal}
    </div>
  );
}

// ── Audio Tile Component ──
function AudioTile({ lang, digit, label, audio, playingAudio, setPlayingAudio, onUpload, onDelete }: {
  lang: string; digit: string; label: string; audio: AudioFile | undefined;
  playingAudio: string | null; setPlayingAudio: (url: string | null) => void;
  onUpload: () => void; onDelete: () => void;
}) {
  const hasFile = !!audio?.file_url;

  return (
    <div className={`relative border-2 rounded-xl p-3 text-center transition ${hasFile ? "border-green-300 bg-green-50" : "border-dashed border-slate-300 hover:border-blue-400"}`}>
      <span className={`text-xl font-bold block ${hasFile ? "text-green-700" : "text-slate-500"}`}>{label}</span>
      <span className="text-[10px] text-slate-400">
        {hasFile ? "Uploaded" : "Click to upload"}
      </span>
      
      {/* Action buttons — always visible */}
      <div className="mt-2 flex items-center justify-center gap-1.5">
        <button onClick={onUpload} className="w-7 h-7 bg-slate-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-slate-600 transition" title="Upload audio">📁</button>
        {hasFile && (
          <button onClick={() => setPlayingAudio(audio!.file_url)} className="w-7 h-7 bg-blue-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-blue-600 transition" title="Play ▶️">▶️</button>
        )}
        {hasFile && (
          <button onClick={onDelete} className="w-7 h-7 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition" title="Delete">🗑️</button>
        )}
      </div>
    </div>
  );
}

function Input({ label, type = "text", value, onChange, placeholder }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div><label className="block text-sm font-medium mb-1">{label}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>;
}

// ── Language Dropdown Component ──
function LanguageSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [showCustomInput, setShowCustomInput] = useState(
    value !== "" && !ALL_LANGUAGES.includes(value)
  );

  // Sync when value changes from outside (e.g., editing a different config)
  useEffect(() => {
    setShowCustomInput(value !== "" && !ALL_LANGUAGES.includes(value));
  }, [value]);

  const handleSelect = (selected: string) => {
    if (selected === "__custom__") {
      setShowCustomInput(true);
      onChange("");
    } else {
      setShowCustomInput(false);
      onChange(selected);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {showCustomInput ? (
        <div className="flex gap-1">
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Type any language name…"
            className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => { setShowCustomInput(false); onChange(""); }}
            className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            title="Back to list"
          >✕</button>
        </div>
      ) : (
        <select
          value={value || ""}
          onChange={e => handleSelect(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="" disabled>Select a language…</option>
          <option value="__custom__">✏️ Custom…</option>
          {ALL_LANGUAGES.map(lang => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
      )}
    </div>
  );
}
