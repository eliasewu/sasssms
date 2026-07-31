"use client";

import { useState, useEffect, useCallback, useRef } from "react";


interface InboxMessage {
  uid: number;
  from: string;
  to: string;
  subject: string;
  date: string;
  flags: string[];
  size: number;
  hasAttachments: boolean;
  preview?: string;
}

interface FullMessage extends InboxMessage {
  textBody: string;
  htmlBody: string;
  attachments: Array<{ filename: string; contentType: string; size: number }>;
  cc: string;
  bcc: string;
  inReplyTo: string;
  messageId: string;
}

interface FolderInfo {
  name: string;
  displayName: string;
  total: number;
  unseen: number;
  specialUse: string;
}

type ViewMode = "folder" | "compose";

// Standard folders shown in the sidebar
const STANDARD_FOLDERS = [
  { name: "INBOX", icon: "📥", label: "Inbox" },
  { name: "Drafts", icon: "📝", label: "Drafts" },
  { name: "Sent", icon: "📤", label: "Sent" },
  { name: "Junk", icon: "⚠️", label: "Junk" },
  { name: "Trash", icon: "🗑️", label: "Trash" },
  { name: "Archive", icon: "📦", label: "Archive" },
];

const FOLDER_ICONS: Record<string, string> = {
  INBOX: "📥",
  Drafts: "📝",
  Sent: "📤",
  Junk: "⚠️",
  Trash: "🗑️",
  Archive: "📦",
};

export default function WebmailPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("folder");
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [fullMsg, setFullMsg] = useState<FullMessage | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Folder state
  const [currentFolder, setCurrentFolder] = useState("INBOX");
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [folderCounts, setFolderCounts] = useState<Record<string, { total: number; unseen: number }>>({});

  // Compose state
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeFiles, setComposeFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");
  const composeBodyRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Action menu state
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const moveMenuRef = useRef<HTMLDivElement>(null);

  // Close move menu when clicking outside
  useEffect(() => {
    if (!showMoveMenu) return;
    const handler = (e: MouseEvent) => {
      if (moveMenuRef.current && !moveMenuRef.current.contains(e.target as Node)) {
        setShowMoveMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMoveMenu]);

  // ── Load folders ──
  const loadFolders = useCallback(async () => {
    try {
      const r = await fetch("/api/webmail/folders").then((r) => r.json());
      if (r.folders) {
        setFolders(r.folders);
        const counts: Record<string, { total: number; unseen: number }> = {};
        for (const f of r.folders as FolderInfo[]) {
          counts[f.name] = { total: f.total, unseen: f.unseen };
        }
        setFolderCounts(counts);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  // ── Load messages from current folder ──
  const loadFolderMessages = useCallback(async (folder: string) => {
    try {
      const r = await fetch(`/api/webmail/folder?folder=${encodeURIComponent(folder)}`).then((r) => r.json());
      if (r.error) {
        setLoggedIn(false);
        setLoadError(r.error);
        return;
      }
      setMessages(r.messages || []);
      setTotal(r.total || 0);
      setLoadError("");
    } catch {
      setLoadError("Connection error — retrying...");
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    fetch("/api/webmail/folder?folder=INBOX")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setLoggedIn(true);
          setMessages(data.messages || []);
          setTotal(data.total || 0);
          loadFolders();
        }
      })
      .catch(() => {});
  }, [loadFolders]);

  // Poll current folder every 30s when logged in
  useEffect(() => {
    if (!loggedIn) return;
    loadFolderMessages(currentFolder);
    const i = setInterval(() => loadFolderMessages(currentFolder), 30000);
    return () => clearInterval(i);
  }, [loggedIn, currentFolder, loadFolderMessages]);

  // Fetch full message when UID selected
  useEffect(() => {
    if (selectedUid === null) {
      setFullMsg(null);
      return;
    }
    setLoadingMsg(true);
    fetch(`/api/webmail/folder?folder=${encodeURIComponent(currentFolder)}&uid=${selectedUid}`)
      .then((r) => r.json())
      .then((data) => {
        setFullMsg(data.message || null);
        setLoadingMsg(false);
        // Mark as seen if in INBOX
        if (data.message && currentFolder === "INBOX" && data.message.flags?.includes("\\Seen") === false) {
          fetch("/api/webmail/flag", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: selectedUid, folder: currentFolder, flag: "\\Seen", set: true }),
          }).catch(() => {});
        }
      })
      .catch(() => setLoadingMsg(false));
  }, [selectedUid, currentFolder]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/webmail/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error || "Login failed");
    setLoggedIn(true);
    setCurrentFolder("INBOX");
    loadFolders();
    loadFolderMessages("INBOX");
  };

  const handleLogout = async () => {
    await fetch("/api/webmail/logout", { method: "POST" });
    setLoggedIn(false);
    setMessages([]);
    setTotal(0);
    setSelectedUid(null);
    setFullMsg(null);
    setFolders([]);
    setFolderCounts({});
    setViewMode("folder");
    setCurrentFolder("INBOX");
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      setSendError("Please fill in To, Subject, and message body.");
      return;
    }
    setSending(true);
    setSendError("");
    setSendSuccess("");
    try {
      const hasFiles = composeFiles.length > 0;
      let res: Response;
      if (hasFiles) {
        const formData = new FormData();
        formData.append("to", composeTo);
        formData.append("cc", composeCc);
        formData.append("subject", composeSubject);
        formData.append("body", composeBody);
        formData.append("isHtml", "false");
        for (const file of composeFiles) {
          formData.append("files", file);
        }
        res = await fetch("/api/webmail/send", { method: "POST", body: formData });
      } else {
        res = await fetch("/api/webmail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: composeTo,
            cc: composeCc,
            subject: composeSubject,
            body: composeBody,
            isHtml: false,
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error || "Send failed");
      } else {
        setSendSuccess(`Sent to ${composeTo}`);
        setComposeTo("");
        setComposeCc("");
        setComposeSubject("");
        setComposeBody("");
        setComposeFiles([]);
        setTimeout(() => {
          setViewMode("folder");
          setSendSuccess("");
          loadFolderMessages(currentFolder);
          loadFolders();
        }, 1500);
      }
    } catch {
      setSendError("Network error — please try again");
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!composeTo.trim() && !composeSubject.trim() && !composeBody.trim()) {
      return; // Nothing to save
    }
    setSending(true);
    try {
      const res = await fetch("/api/webmail/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composeTo,
          cc: composeCc,
          subject: composeSubject,
          body: composeBody,
          isHtml: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSendSuccess("Draft saved to Drafts folder");
        setTimeout(() => {
          setViewMode("folder");
          setSendSuccess("");
          loadFolders();
        }, 1200);
      } else {
        setSendError(data.error || "Failed to save draft");
      }
    } catch {
      setSendError("Network error saving draft");
    } finally {
      setSending(false);
    }
  };

  const handleReply = (msg: FullMessage) => {
    setComposeTo(msg.from);
    setComposeCc("");
    setComposeSubject(`Re: ${msg.subject.replace(/^Re:\s*/i, "")}`);
    setComposeBody(`\n\n\n-------- Original Message --------\nFrom: ${msg.from}\nDate: ${msg.date}\nSubject: ${msg.subject}\n\n${msg.textBody}`);
    setViewMode("compose");
    setSelectedUid(null);
    setTimeout(() => composeBodyRef.current?.focus(), 100);
  };

  const handleReplyAll = (msg: FullMessage) => {
    const self = email.toLowerCase();
    const allRecipients = [msg.from, msg.to, msg.cc]
      .filter(Boolean)
      .filter((r) => !r.toLowerCase().includes(self));
    setComposeTo([...new Set(allRecipients)].join(", "));
    setComposeCc("");
    setComposeSubject(`Re: ${msg.subject.replace(/^Re:\s*/i, "")}`);
    setComposeBody(`\n\n\n-------- Original Message --------\nFrom: ${msg.from}\nDate: ${msg.date}\nSubject: ${msg.subject}\n\n${msg.textBody}`);
    setViewMode("compose");
    setSelectedUid(null);
    setTimeout(() => composeBodyRef.current?.focus(), 100);
  };

  const handleForward = (msg: FullMessage) => {
    setComposeTo("");
    setComposeCc("");
    setComposeSubject(`Fwd: ${msg.subject.replace(/^Fwd:\s*/i, "")}`);
    setComposeBody(`\n\n\n-------- Forwarded Message --------\nFrom: ${msg.from}\nDate: ${msg.date}\nSubject: ${msg.subject}\n\n${msg.textBody}`);
    setViewMode("compose");
    setSelectedUid(null);
    setTimeout(() => composeBodyRef.current?.focus(), 100);
  };

  const handleDelete = async (uid: number) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/webmail/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, folder: currentFolder }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedUid(null);
        setFullMsg(null);
        loadFolderMessages(currentFolder);
        loadFolders();
      }
    } catch {
      // Non-fatal
    } finally {
      setActionLoading(false);
    }
  };

  const handleMove = async (uid: number, toFolder: string) => {
    setActionLoading(true);
    setShowMoveMenu(false);
    try {
      const res = await fetch("/api/webmail/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, fromFolder: currentFolder, toFolder }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedUid(null);
        setFullMsg(null);
        loadFolderMessages(currentFolder);
        loadFolders();
      }
    } catch {
      // Non-fatal
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleRead = async (uid: number, isSeen: boolean) => {
    try {
      await fetch("/api/webmail/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, folder: currentFolder, flag: "\\Seen", set: !isSeen }),
      });
      loadFolderMessages(currentFolder);
      if (selectedUid === uid && fullMsg) {
        setFullMsg({ ...fullMsg, flags: isSeen ? [...fullMsg.flags.filter(f => f !== "\\Seen")] : [...fullMsg.flags, "\\Seen"] });
      }
    } catch {
      // Non-fatal
    }
  };

  const switchFolder = (folderName: string) => {
    setCurrentFolder(folderName);
    setSelectedUid(null);
    setFullMsg(null);
    setViewMode("folder");
    loadFolderMessages(folderName);
  };

  const formatDate = (d: string) => {
    try {
      const dt = new Date(d);
      const now = new Date();
      const isToday = dt.toDateString() === now.toDateString();
      if (isToday) return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return dt.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return d;
    }
  };

  // Build the sidebar folder list — standard folders first, then any extras
  const sidebarFolders = STANDARD_FOLDERS.map(sf => {
    const info = folders.find(f => f.name === sf.name);
    const counts = folderCounts[sf.name];
    return {
      name: sf.name,
      icon: sf.icon,
      label: sf.label,
      total: counts?.total ?? info?.total ?? 0,
      unseen: counts?.unseen ?? info?.unseen ?? 0,
    };
  }).filter(f => folders.length === 0 || folders.some(fi => fi.name === f.name));

  // ──────────────────────────── LOGIN ────────────────────────────
  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">N</div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Net2APP</span>
              <p className="text-xs text-slate-500">Team Webmail</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-1">Webmail Login</h2>
          <p className="text-gray-500 mb-6 text-sm">Access your @net2app.com email account</p>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm mb-4">{error}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@net2app.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>
            <button
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 shadow-lg hover:from-blue-500 hover:to-indigo-500 transition"
            >
              {loading ? "Connecting..." : "Sign In to Webmail"}
            </button>
          </form>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700">
              <strong>Secure IMAP</strong> — Credentials are encrypted with AES-256-GCM and stored in an httpOnly cookie.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t text-center space-y-2">
            <a href="/" className="text-sm text-slate-500 hover:text-slate-700 transition">← Back to Home</a>
            <p className="text-center text-xs text-slate-400">© {new Date().getFullYear()} Tri Angle Trade Centre Fze LLC</p>
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────── MAIN APP ────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top bar */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow">N</div>
            <div>
              <h1 className="font-semibold text-slate-800 text-sm">Net2APP Webmail</h1>
              <p className="text-xs text-slate-500">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loadError && <span className="text-xs text-amber-600 hidden sm:inline">{loadError}</span>}
            <button onClick={() => { loadFolderMessages(currentFolder); loadFolders(); }} className="text-xs px-3 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition">🔄 Refresh</button>
            <button onClick={handleLogout} className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium">Logout</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex gap-4 p-4" style={{ minHeight: "calc(100vh - 65px)" }}>
        {/* ── SIDEBAR ── */}
        <aside className="w-56 shrink-0 hidden md:block">
          <button
            onClick={() => { setViewMode("compose"); setSelectedUid(null); }}
            className={`w-full mb-3 px-4 py-2.5 rounded-xl text-sm font-semibold shadow transition flex items-center justify-center gap-2 ${viewMode === "compose" ? "bg-indigo-600 text-white" : "bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50"}`}
          >
            ✏️ Compose
          </button>

          <nav className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {sidebarFolders.map((f) => (
              <button
                key={f.name}
                onClick={() => switchFolder(f.name)}
                className={`w-full px-4 py-2.5 text-left text-sm border-b border-slate-50 flex items-center justify-between transition ${
                  currentFolder === f.name && viewMode === "folder"
                    ? "bg-blue-50 text-blue-700 font-semibold border-l-4 border-l-blue-500"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span>{f.icon}</span>
                  <span className="truncate">{f.label}</span>
                </span>
                {f.unseen > 0 && f.name === "INBOX" && (
                  <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">{f.unseen}</span>
                )}
                {f.total > 0 && f.name !== "INBOX" && (
                  <span className="text-xs text-slate-400">{f.total}</span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 min-w-0">
          {/* ── COMPOSE VIEW ── */}
          {viewMode === "compose" && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">✏️ New Message</h2>
                {/* Mobile folder switcher */}
                <select
                  className="md:hidden text-sm border rounded-lg px-2 py-1"
                  value={currentFolder}
                  onChange={(e) => { switchFolder(e.target.value); setViewMode("folder"); }}
                >
                  {sidebarFolders.map(f => <option key={f.name} value={f.name}>{f.icon} {f.label}</option>)}
                </select>
              </div>
              {sendError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm mb-4">{sendError}</div>}
              {sendSuccess && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-lg text-sm mb-4">✅ {sendSuccess}</div>}
              <form onSubmit={handleSend} className="space-y-4">
                <div className="flex gap-2">
                  <label className="text-sm font-medium text-slate-600 w-16 pt-3">To:</label>
                  <input
                    type="text" required value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="recipient@example.com"
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <label className="text-sm font-medium text-slate-600 w-16 pt-3">Cc:</label>
                  <input
                    type="text" value={composeCc}
                    onChange={(e) => setComposeCc(e.target.value)}
                    placeholder="cc@example.com (optional)"
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <label className="text-sm font-medium text-slate-600 w-16 pt-3">Subject:</label>
                  <input
                    type="text" required value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Email subject"
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                  />
                </div>
              <div>
                <textarea
                  ref={composeBodyRef}
                  required value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={12}
                  placeholder="Write your message here..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm resize-y"
                />
              </div>
              {/* Attachments */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setComposeFiles((prev) => [...prev, ...Array.from(e.target.files!)].slice(0, 10));
                      }
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition flex items-center gap-1"
                  >
                    📎 Attach files
                  </button>
                  <span className="text-xs text-slate-400">Max 10 files, 10MB each</span>
                </div>
                {composeFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {composeFiles.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-blue-700">
                        📎 {f.name} ({(f.size / 1024).toFixed(1)} KB)
                        <button
                          type="button"
                          onClick={() => setComposeFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="text-blue-400 hover:text-blue-600 ml-1"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={sending}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm shadow-lg hover:from-blue-500 hover:to-indigo-500 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {sending ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Sending...
                      </>
                    ) : (
                      <>📨 Send</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={sending}
                    className="px-4 py-2.5 border border-slate-300 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    💾 Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => { setViewMode("folder"); setSendError(""); setSendSuccess(""); }}
                    className="px-4 py-2.5 border border-slate-300 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── FOLDER VIEW ── */}
          {viewMode === "folder" && messages.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
              <div className="text-6xl mb-4">{FOLDER_ICONS[currentFolder] || "📂"}</div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                {currentFolder === "INBOX" ? "Inbox is empty" : `${currentFolder} is empty`}
              </h3>
              <p className="text-sm text-slate-500">
                {currentFolder === "INBOX" ? "Emails to @net2app.com will appear here." : "No messages in this folder."}
              </p>
            </div>
          )}

          {viewMode === "folder" && messages.length > 0 && (
            <>
              {/* Message list */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b bg-slate-50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    {FOLDER_ICONS[currentFolder] || "📂"} {currentFolder === "INBOX" ? "Inbox" : currentFolder}
                    <span className="text-xs text-slate-400 font-normal">({total})</span>
                  </h3>
                  {/* Mobile folder switcher */}
                  <select
                    className="md:hidden text-sm border rounded-lg px-2 py-1"
                    value={currentFolder}
                    onChange={(e) => switchFolder(e.target.value)}
                  >
                    {sidebarFolders.map(f => <option key={f.name} value={f.name}>{f.icon} {f.label}</option>)}
                  </select>
                </div>
                {messages.map((msg) => (
                  <div
                    key={msg.uid}
                    onClick={() => setSelectedUid(selectedUid === msg.uid ? null : msg.uid)}
                    className={`px-4 py-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition flex items-center gap-4 ${
                      !msg.flags.includes("\\Seen") ? "bg-blue-50/50 font-semibold" : ""
                    } ${selectedUid === msg.uid ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(currentFolder === "Sent" ? (msg.to || "R") : (msg.from || "U")).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${!msg.flags.includes("\\Seen") ? "text-slate-900" : "text-slate-600"}`}>
                          {currentFolder === "Sent" ? `To: ${msg.to || "Unknown"}` : (msg.from || "Unknown")}
                        </p>
                        <span className="text-xs text-slate-400 shrink-0">{formatDate(msg.date)}</span>
                      </div>
                      <p className={`text-sm truncate mt-0.5 ${!msg.flags.includes("\\Seen") ? "text-slate-800" : "text-slate-500"}`}>
                        {msg.subject}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {msg.hasAttachments && <span className="text-xs">📎</span>}
                      {msg.flags.includes("\\Flagged") && <span className="text-xs">⭐</span>}
                      {!msg.flags.includes("\\Seen") && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Full message detail panel */}
              {selectedUid !== null && (
                <div className="mt-4 bg-white rounded-2xl shadow-sm p-6 relative">
                  {loadingMsg ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-sm text-slate-500">Loading message...</p>
                    </div>
                  ) : fullMsg ? (
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h2 className="font-semibold text-lg text-slate-800">{fullMsg.subject}</h2>
                          <div className="text-sm text-slate-500 mt-2 space-y-1">
                            <p><strong>From:</strong> {fullMsg.from}</p>
                            <p><strong>To:</strong> {fullMsg.to}</p>
                            {fullMsg.cc && <p><strong>CC:</strong> {fullMsg.cc}</p>}
                            <p className="text-xs text-slate-400">{new Date(fullMsg.date).toLocaleString()}</p>
                          </div>
                        </div>
                        <button onClick={() => setSelectedUid(null)} className="text-slate-400 hover:text-slate-600 text-lg ml-4">✕</button>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
                        {currentFolder !== "Sent" && (
                          <>
                            <button onClick={() => handleReply(fullMsg)} className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1 text-slate-700">
                              ↩️ Reply
                            </button>
                            <button onClick={() => handleReplyAll(fullMsg)} className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1 text-slate-700">
                              ↩️↩️ Reply All
                            </button>
                            <button onClick={() => handleForward(fullMsg)} className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1 text-slate-700">
                              ↗️ Forward
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleToggleRead(fullMsg.uid, fullMsg.flags.includes("\\Seen"))}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1 text-slate-700"
                        >
                          {fullMsg.flags.includes("\\Seen") ? "📬 Mark Unread" : "📭 Mark Read"}
                        </button>
                        {/* Move menu */}
                        <div className="relative" ref={moveMenuRef}>
                          <button
                            onClick={() => setShowMoveMenu(!showMoveMenu)}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1 text-slate-700"
                          >
                            📁 Move to ▾
                          </button>
                          {showMoveMenu && (
                            <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[140px]">
                              {STANDARD_FOLDERS.filter(f => f.name !== currentFolder).map(f => (
                                <button
                                  key={f.name}
                                  onClick={() => handleMove(fullMsg.uid, f.name)}
                                  className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 last:border-0"
                                >
                                  {f.icon} {f.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(fullMsg.uid)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition flex items-center gap-1"
                        >
                          🗑️ {currentFolder === "Trash" ? "Delete Forever" : "Delete"}
                        </button>
                      </div>

                      {fullMsg.attachments.length > 0 && (
                        <div className="border-t pt-3 mb-4">
                          <p className="text-xs font-medium text-slate-500 mb-2">Attachments ({fullMsg.attachments.length})</p>
                          <div className="flex flex-wrap gap-2">
                            {fullMsg.attachments.map((att, i) => (
                              <span key={i} className="inline-flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-1.5 text-xs text-slate-600">
                                📎 {att.filename} ({(att.size / 1024).toFixed(1)} KB)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-4">
                        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                          {fullMsg.htmlBody
                            ? fullMsg.htmlBody.replace(/<[^>]*>/g, "")
                            : fullMsg.textBody}
                        </div>
                      </div>

                      {/* Bottom action bar */}
                      {currentFolder !== "Sent" && (
                        <div className="flex gap-2 mt-6 pt-4 border-t">
                          <button onClick={() => handleReply(fullMsg)} className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-1 shadow">
                            ↩️ Reply
                          </button>
                          <button onClick={() => handleReplyAll(fullMsg)} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-1 shadow">
                            ↩️↩️ Reply All
                          </button>
                          <button onClick={() => handleForward(fullMsg)} className="px-4 py-2 text-sm font-medium bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition flex items-center gap-1 shadow">
                            ↗️ Forward
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <p>Unable to load message</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Mobile compose button (when not in compose view) */}
          {viewMode === "folder" && (
            <button
              onClick={() => { setViewMode("compose"); setSelectedUid(null); }}
              className="md:hidden fixed bottom-4 right-4 w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-xl z-10"
            >
              ✏️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
