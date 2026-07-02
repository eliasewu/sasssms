"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface DefaultAudio {
  id: number; language: string; digit: string;
  fileName: string | null; fileUrl: string | null; audioType: string;
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
  const [selectedLang, setSelectedLang] = useState("English");
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [subTab, setSubTab] = useState<"digits" | "letters">("digits");
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadRef = useRef<{ lang: string; digit: string } | null>(null);

  const flash = (text: string, err = false) => {
    if (err) { setMsgError(text); setTimeout(() => setMsgError(""), 4000); }
    else { setMsg(text); setTimeout(() => setMsg(""), 3000); }
  };

  const load = useCallback(async () => {
    const r = await fetch("/api/super/voice-otp-defaults").then(r => r.json());
    setAudioFiles(r.audio || []);
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
          flash(`✅ Default audio saved: ${meta.lang}/${meta.digit}`);
          load();
        } else {
          flash(`❌ ${data.error || "Upload failed"}`, true);
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

  const handleSeedAll = async () => {
    if (!confirm("Seed default audio to ALL existing tenants? This will add defaults to tenant schemas where they don't exist yet.")) return;
    setSeeding(true);
    try {
      const res = await fetch("/api/super/voice-otp-defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed-all" }),
      });
      const data = await res.json();
      if (res.ok) {
        flash(`✅ ${data.message}`);
      } else {
        flash(`❌ ${data.error || "Seed failed"}`, true);
      }
    } catch {
      flash("Seed error", true);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Voice OTP Default Audio</h2>
          <p className="text-sm text-slate-500">
            Upload default greeting and digit audio per language. These are seeded to all new tenants.
            Tenants can override from their own Voice OTP panel.
          </p>
        </div>
        <button
          onClick={handleSeedAll}
          disabled={seeding || audioFiles.length === 0}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2"
        >
          {seeding ? (
            <><span className="animate-spin">⏳</span> Seeding...</>
          ) : (
            <><span>🌱</span> Seed to All Tenants</>
          )}
        </button>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}
      {msgError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{msgError}</div>}

      <input type="file" ref={fileInputRef} accept=".mp3,.wav,.ogg" className="hidden" />

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
        </div>

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
        <h3 className="font-semibold mb-3">📋 All Default Audio Files</h3>
        <div className="flex flex-wrap gap-2">
          {audioFiles.length === 0 && (
            <p className="text-sm text-slate-400">No default audio files uploaded yet. Select a language and upload files above.</p>
          )}
          {audioFiles.map(f => (
            <div key={f.id} className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 text-xs">
              <span className="font-semibold text-indigo-600">{f.language}</span>
              <span className="font-mono">{f.digit}</span>
              <button onClick={() => { if (f.fileUrl) setPlayingAudio(f.fileUrl); }} className="text-blue-500 hover:text-blue-700" title="Play ▶️">▶️</button>
              <button onClick={() => handleDelete(f.id)} className="text-red-400 hover:text-red-600" title="Delete">×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-sm text-indigo-700">
        <strong>💡 How it works:</strong> When a new tenant registers, the system automatically seeds
        all language groups and copies the default audio files from here into the tenant's schema.
        Tenants can then customize their audio from the <strong>Voice OTP</strong> page in their dashboard.
        Use the <strong>"Seed to All Tenants"</strong> button to push defaults to existing tenants.
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
