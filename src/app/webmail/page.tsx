"use client";

import { useState, useEffect, useCallback } from "react";

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
  inReplyTo: string;
  messageId: string;
}

export default function WebmailPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [fullMsg, setFullMsg] = useState<FullMessage | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadInbox = useCallback(async () => {
    try {
      const r = await fetch("/api/webmail/inbox").then((r) => r.json());
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
    fetch("/api/webmail/inbox")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setLoggedIn(true);
          setMessages(data.messages || []);
          setTotal(data.total || 0);
        }
      })
      .catch(() => {});
  }, []);

  // Poll inbox every 30s when logged in; load immediately on login
  useEffect(() => {
    if (!loggedIn) return;
    loadInbox();
    const i = setInterval(loadInbox, 30000);
    return () => clearInterval(i);
  }, [loggedIn, loadInbox]);

  // Fetch full message when UID selected
  useEffect(() => {
    if (selectedUid === null) {
      setFullMsg(null);
      return;
    }
    setLoadingMsg(true);
    fetch(`/api/webmail/message?uid=${selectedUid}`)
      .then((r) => r.json())
      .then((data) => {
        setFullMsg(data.message || null);
        setLoadingMsg(false);
      })
      .catch(() => setLoadingMsg(false));
  }, [selectedUid]);

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
    // loadInbox will be called by the useEffect when loggedIn changes
  };

  const handleLogout = () => {
    document.cookie = "webmail_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setLoggedIn(false);
    setMessages([]);
    setTotal(0);
    setSelectedUid(null);
    setFullMsg(null);
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

  // Login form
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
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@net2app.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
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
              Only @net2app.com accounts are supported.
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

  // Inbox view
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top bar */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow">N</div>
            <div>
              <h1 className="font-semibold text-slate-800 text-sm">Net2APP Webmail</h1>
              <p className="text-xs text-slate-500">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loadError && <span className="text-xs text-amber-600">{loadError}</span>}
            <span className="text-xs text-slate-400 hidden sm:inline">{total} messages</span>
            <button onClick={loadInbox} className="text-xs px-3 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition">Refresh</button>
            <button onClick={handleLogout} className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium">Logout</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        {messages.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Inbox is empty</h3>
            <p className="text-sm text-slate-500">No messages yet. Emails to @net2app.com will appear here.</p>
          </div>
        ) : (
          <>
            {/* Message list */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {messages.map((msg) => (
                <div
                  key={msg.uid}
                  onClick={() => setSelectedUid(selectedUid === msg.uid ? null : msg.uid)}
                  className={`px-4 py-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition flex items-center gap-4 ${
                    !msg.flags.includes("\\Seen") ? "bg-blue-50/50 font-semibold" : ""
                  } ${selectedUid === msg.uid ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(msg.from || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${!msg.flags.includes("\\Seen") ? "text-slate-900" : "text-slate-600"}`}>
                        {msg.from || "Unknown"}
                      </p>
                      <span className="text-xs text-slate-400 shrink-0">{formatDate(msg.date)}</span>
                    </div>
                    <p className={`text-sm truncate mt-0.5 ${!msg.flags.includes("\\Seen") ? "text-slate-800" : "text-slate-500"}`}>
                      {msg.subject}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {msg.hasAttachments && <span className="text-xs">📎</span>}
                    {!msg.flags.includes("\\Seen") && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Full message detail panel */}
            {selectedUid !== null && (
              <div className="mt-4 bg-white rounded-2xl shadow-sm p-6">
                {loadingMsg ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-sm text-slate-500">Loading message...</p>
                  </div>
                ) : fullMsg ? (
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="font-semibold text-lg text-slate-800">{fullMsg.subject}</h2>
                        <div className="text-sm text-slate-500 mt-2 space-y-1">
                          <p><strong>From:</strong> {fullMsg.from}</p>
                          <p><strong>To:</strong> {fullMsg.to}</p>
                          {fullMsg.cc && <p><strong>CC:</strong> {fullMsg.cc}</p>}
                          <p className="text-xs text-slate-400">{new Date(fullMsg.date).toLocaleString()}</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedUid(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
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

                    <div className="border-t pt-4">
                      <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                        {fullMsg.htmlBody
                          ? fullMsg.htmlBody.replace(/<[^>]*>/g, "")  // Strip HTML tags, render as text
                          : fullMsg.textBody}
                      </div>
                    </div>
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
      </div>
    </div>
  );
}
