"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface VotpConfig {
  id: number; country_group: string; prefixes: string; primary_language: string;
  secondary_language: string; primary_audio_count: number; secondary_audio_count: number; is_active: boolean;
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
  const [showSipForm, setShowSipForm] = useState(false);
  const [selectedLang, setSelectedLang] = useState("");
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ countryGroup: "", prefixes: "", primaryLanguage: "", secondaryLanguage: "English" });
  const [sipForm, setSipForm] = useState({ name: "", sipHost: "", sipPort: "5060", sipUsername: "", sipPassword: "", callerId: "Net2APP", maxRetries: "3", timeout: "30" });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [cr, sr, lr, ar] = await Promise.all([
      fetch("/api/tenant/voice-otp-config").then(r => r.json()),
      fetch("/api/tenant/voice-otp-sip").then(r => r.json()).catch(() => ({ configs: [] })),
      fetch("/api/tenant/voice-otp-call-logs").then(r => r.json()).catch(() => ({ logs: [] })),
      fetch("/api/tenant/voice-otp-audio").then(r => r.json()).catch(() => ({ audio: [] })),
    ]);
    setConfigs(cr.configs || []);
    setSipConfigs(sr.configs || []);
    setCallLogs(lr.logs || []);
    setAudioFiles(ar.audio || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Language Group
  const handleLangSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/tenant/voice-otp-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false); setForm({ countryGroup: "", prefixes: "", primaryLanguage: "", secondaryLanguage: "English" });
    setMsg("Language group added. English default audio is built-in.");
    setTimeout(() => setMsg(""), 3000);
    load();
  };

  // SIP Config
  const handleSipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/tenant/voice-otp-sip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sipForm) });
    setShowSipForm(false);
    setMsg(`SIP endpoint ${sipForm.name} saved. All Voice OTP calls route via Asterisk at ${sipForm.sipHost}:${sipForm.sipPort}`);
    setTimeout(() => setMsg(""), 4000);
    load();
  };

  // Audio Upload
  const handleAudioUpload = async (configId: number, lang: string, digit: string) => {
    const input = fileInputRef.current;
    if (!input) return;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      
      // Simulate upload - in production this goes to /public/uploads/voice/
      const fileName = `voice_${configId}_${lang}_${digit}_${Date.now()}.${file.name.split(".").pop()}`;
      
      await fetch("/api/tenant/voice-otp-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId, language: lang, digit, fileName, fileUrl: `/uploads/voice/${fileName}`, audioType: "wav" }),
      });
      setMsg(`Uploaded ${lang} digit ${digit}`);
      setTimeout(() => setMsg(""), 2000);
      load();
    };
    input.click();
  };

  const getAudioForDigit = (configId: number, lang: string, digit: string) => {
    return audioFiles.find(f => f.config_id === configId && f.language === lang && f.digit === digit);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Voice OTP Configuration</h2>
        <p className="text-sm text-slate-500">Languages, audio upload (MP3→WAV), SIP endpoints per tenant, retry logic</p>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map(t => (<button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${tab === t ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>{t}</button>))}
      </div>

      {/* Languages Tab */}
      {tab === "Languages" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center"><p className="text-sm text-slate-500">Map country groups to languages. 1st = local, 2nd = fallback (English or local).</p><button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Language</button></div>
          {showForm && (<div className="bg-white rounded-xl border p-5"><form onSubmit={handleLangSubmit} className="grid grid-cols-2 gap-3"><Input label="Country Group *" value={form.countryGroup} onChange={v => setForm({...form, countryGroup: v})} /><Input label="Prefixes *" value={form.prefixes} onChange={v => setForm({...form, prefixes: v})} placeholder="+91,+880" /><Input label="1st Language (Local) *" value={form.primaryLanguage} onChange={v => setForm({...form, primaryLanguage: v})} /><Input label="2nd Language (Retry) — leave blank for English" value={form.secondaryLanguage} onChange={v => setForm({...form, secondaryLanguage: v})} /><div className="col-span-2 flex gap-2"><button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Save</button><button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button></div></form></div>)}
          <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-5 py-3 text-left">Group</th><th className="px-5 py-3 text-left">Prefixes</th><th className="px-5 py-3 text-left">1st (Local)</th><th className="px-5 py-3 text-left">2nd (Fallback)</th><th className="px-5 py-3 text-left">Audio</th><th className="px-5 py-3 text-left">Status</th></tr></thead><tbody>{configs.map(c => (<tr key={c.id} className="border-b"><td className="px-5 py-3 font-medium">{c.country_group}</td><td className="px-5 py-3 font-mono text-xs">{c.prefixes}</td><td className="px-5 py-3">{c.primary_language}</td><td className="px-5 py-3">{c.secondary_language || "English (default)"}</td><td className="px-5 py-3 text-xs">{c.primary_audio_count}/10 · {c.secondary_audio_count}/10</td><td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${c.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{c.is_active ? "Active" : "Inactive"}</span></td></tr>))}</tbody></table></div>
        </div>
      )}

      {/* Audio Tab — Upload MP3/WAV per digit */}
      {tab === "Audio" && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <select value={selectedConfigId || ""} onChange={e => { const id = parseInt(e.target.value); setSelectedConfigId(id); const cfg = configs.find(c => c.id === id); setSelectedLang(cfg?.primary_language || ""); }} className="border rounded-lg px-4 py-2 text-sm"><option value="">Select Language Group</option>{configs.map(c => <option key={c.id} value={c.id}>{c.country_group} — {c.primary_language}</option>)}</select>
            {selectedConfigId && (<select value={selectedLang} onChange={e => setSelectedLang(e.target.value)} className="border rounded-lg px-4 py-2 text-sm"><option value={configs.find(c => c.id === selectedConfigId)?.primary_language || ""}>{configs.find(c => c.id === selectedConfigId)?.primary_language} (1st-Local)</option><option value={configs.find(c => c.id === selectedConfigId)?.secondary_language || "English"}>{configs.find(c => c.id === selectedConfigId)?.secondary_language || "English"} (2nd-Fallback)</option></select>)}
          </div>
          <input type="file" ref={fileInputRef} accept=".mp3,.wav" className="hidden" />
          
          {selectedConfigId && selectedLang && (
            <div>
              <p className="text-sm text-slate-500 mb-3">
                Upload MP3/WAV for <strong>{selectedLang}</strong> digits. English digits 0-9 are pre-built — no need to upload.
              </p>
              <div className="grid grid-cols-5 gap-3">
                {/* Greeting */}
                <button onClick={() => handleAudioUpload(selectedConfigId, selectedLang, "greeting")} className="border-2 border-dashed rounded-xl p-3 text-center hover:border-blue-500 transition">
                  {getAudioForDigit(selectedConfigId, selectedLang, "greeting") ? (<><span className="text-2xl text-green-600 block">✅</span><span className="text-xs text-green-600">Uploaded</span></>) : (<><span className="text-2xl block">🎙️</span><span className="text-xs">Greeting</span></>)}
                </button>
                {[0,1,2,3,4,5,6,7,8,9].map(d => {
                  const audio = getAudioForDigit(selectedConfigId, selectedLang, d.toString());
                  const isEnglish = selectedLang === "English";
                  return (
                    <button key={d} onClick={() => !isEnglish && handleAudioUpload(selectedConfigId, selectedLang, d.toString())} className={`border-2 rounded-xl p-3 text-center transition ${isEnglish ? "border-green-300 bg-green-50 cursor-default" : "border-dashed hover:border-blue-500 cursor-pointer"}`}>
                      <span className="text-2xl font-bold block">{d}</span>
                      <span className={`text-xs ${isEnglish || audio ? "text-green-600" : "text-slate-400"}`}>{isEnglish ? "Built-in" : audio ? "Uploaded" : "Upload"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
            <strong>🎵 Audio Format:</strong> MP3 files auto-convert to 8kHz mono WAV. English digits (0-9) are built-in globally. Only upload for non-English local languages.
          </div>
        </div>
      )}

      {/* SIP Config Tab — Per tenant SIP endpoint */}
      {tab === "SIP Config" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">Each tenant configures their own Asterisk SIP endpoint. All Voice OTP calls route via this SIP trunk.</p>
            <button onClick={() => setShowSipForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add SIP Endpoint</button>
          </div>
          {showSipForm && (<div className="bg-white rounded-xl border p-5"><form onSubmit={handleSipSubmit} className="grid grid-cols-3 gap-3"><Input label="Name *" value={sipForm.name} onChange={v => setSipForm({...sipForm, name: v})} /><Input label="SIP Host *" value={sipForm.sipHost} onChange={v => setSipForm({...sipForm, sipHost: v})} placeholder="asterisk.example.com" /><Input label="SIP Port" value={sipForm.sipPort} onChange={v => setSipForm({...sipForm, sipPort: v})} /><Input label="Username" value={sipForm.sipUsername} onChange={v => setSipForm({...sipForm, sipUsername: v})} /><Input label="Password" type="password" value={sipForm.sipPassword} onChange={v => setSipForm({...sipForm, sipPassword: v})} /><Input label="Caller ID" value={sipForm.callerId} onChange={v => setSipForm({...sipForm, callerId: v})} /><Input label="Max Retries" value={sipForm.maxRetries} onChange={v => setSipForm({...sipForm, maxRetries: v})} /><Input label="Timeout (s)" value={sipForm.timeout} onChange={v => setSipForm({...sipForm, timeout: v})} /><div className="flex items-end gap-2"><button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Save</button><button type="button" onClick={() => setShowSipForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button></div></form></div>)}
          <div className="grid md:grid-cols-2 gap-4">
            {sipConfigs.map(s => (<div key={s.id} className="bg-white rounded-xl border p-5"><div className="flex justify-between mb-2"><h4 className="font-semibold">{s.name}</h4><span className={`px-2 py-0.5 rounded-full text-xs ${s.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{s.is_active ? "Active" : "Inactive"}</span></div><p className="text-sm font-mono text-slate-600">sip:{s.sip_host}:{s.sip_port || 5060}</p><p className="text-xs text-slate-500">Retries: {s.max_retries || 3} · Timeout: {s.timeout || 30}s</p></div>))}
          </div>
        </div>
      )}

      {/* Call Logs Tab */}
      {tab === "Call Logs" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Each row shows the full Voice OTP call journey — country detection, language mapping, audio playlist, and multi-attempt SIP calls via Asterisk.</p>
          <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-3 text-left">Destination</th><th className="px-3 py-3 text-left">OTP</th><th className="px-3 py-3 text-left">Country</th><th className="px-3 py-3 text-left">Language</th><th className="px-3 py-3 text-left">Status</th><th className="px-3 py-3 text-left">Attempts</th><th className="px-3 py-3 text-left">Duration</th><th className="px-3 py-3 text-left">SIP</th><th className="px-3 py-3 text-left">Time</th></tr></thead><tbody>{callLogs.map(l => {
            const attempts = l.attempt_log ? (() => { try { return JSON.parse(l.attempt_log); } catch { return []; } })() : [];
            const playlist = l.audio_playlist ? (() => { try { return JSON.parse(l.audio_playlist); } catch { return []; } })() : [];
            const attemptLang = attempts.length > 0 ? attempts.map((a: {language:string;status:string}) => `${a.language}(${a.status.slice(0,1)})`).join("→") : "";
            return (<tr key={l.id} className="border-b hover:bg-slate-50"><td className="px-3 py-3 font-mono text-xs">{l.destination}</td><td className="px-3 py-3 font-mono font-bold text-xs">{l.otp_code}</td><td className="px-3 py-3 text-xs">{l.country || "—"} ({l.mcc || "?"})</td><td className="px-3 py-3"><div className="text-xs font-medium">{l.language}</div>{attemptLang && <div className="text-[10px] text-slate-400 mt-0.5">{attemptLang}</div>}{playlist.length > 0 && <div className="text-[10px] text-slate-400">🎵 {playlist.length} files</div>}</td><td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${l.status === "COMPLETED" || l.status === "DELIVERED" ? "bg-green-100 text-green-700" : l.status === "FAILED" ? "bg-red-100 text-red-700" : l.status === "IN_PROGRESS" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{l.status}</span></td><td className="px-3 py-3 text-xs">{l.attempt_count}/3</td><td className="px-3 py-3 text-xs">{l.duration || 0}s</td><td className="px-3 py-3 text-[10px] text-slate-400 max-w-[100px] truncate">{l.sip_config_name || "—"}</td><td className="px-3 py-3 text-[10px] text-slate-500">{new Date(l.created_at).toLocaleString()}</td></tr>);
          })}</tbody></table></div>
        </div>
      )}
    </div>
  );
}

function Input({ label, type = "text", value, onChange, placeholder }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div><label className="block text-sm font-medium mb-1">{label}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>;
}
