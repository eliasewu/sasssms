"use client";

import { useState, useEffect, useCallback } from "react";

interface Ticket {
  id: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  replied_by: string | null;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

interface Attachment {
  id: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

interface Reply {
  id: number;
  replied_by: string;
  replied_by_name: string;
  message: string;
  attachments?: Attachment[];
  created_at: string;
}

function isImage(mimeType: string): boolean { return mimeType.startsWith("image/"); }

const MAX_FILES = 5;
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getUploadLimitError(files: File[]): string | null {
  if (files.length > MAX_FILES) return `Maximum ${MAX_FILES} files allowed per reply.`;
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > MAX_TOTAL_SIZE) return `Total upload size exceeds ${formatFileSize(MAX_TOTAL_SIZE)}. Please reduce file sizes or remove some files.`;
  return null;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-slate-200 text-slate-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<{ ticket: Ticket; replies: Reply[] } | null>(null);
  const [replyMsg, setReplyMsg] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // New ticket form
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/support-tickets", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const openTicket = async (ticketId: number) => {
    try {
      const res = await fetch(`/api/tenant/support-tickets/${ticketId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSelectedTicket({ ticket: data.ticket, replies: data.replies });
      }
    } catch { /* ignore */ }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tenant/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject: subject.trim(), description: description.trim(), priority }),
      });
      if (res.ok) {
        setShowForm(false);
        setSubject("");
        setDescription("");
        setPriority("MEDIUM");
        fetchTickets();
      }
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  const handleReply = async (ticketId: number) => {
    if (!replyMsg.trim() && selectedFiles.length === 0) return;
    setSubmitting(true);
    setUploadProgress(0);

    const onSuccess = (data: { reply: Reply }) => {
      if (selectedTicket) {
        setSelectedTicket({
          ...selectedTicket,
          replies: [...selectedTicket.replies, data.reply],
        });
      }
      setReplyMsg("");
      setSelectedFiles([]);
      setUploadProgress(0);
      fetchTickets();
    };

    if (selectedFiles.length > 0) {
      // Use XMLHttpRequest for upload progress tracking
      const formData = new FormData();
      formData.append("message", replyMsg.trim());
      selectedFiles.forEach(f => formData.append("files", f));

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/tenant/support-tickets/${ticketId}`);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { onSuccess(JSON.parse(xhr.responseText)); } catch { /* ignore */ }
        }
        setSubmitting(false);
      };

      xhr.onerror = () => setSubmitting(false);
      xhr.send(formData);
      return;
    }

    // Text-only: use fetch (no progress bar needed)
    try {
      const res = await fetch(`/api/tenant/support-tickets/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: replyMsg.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        onSuccess(data);
      }
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Loading tickets...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">🎫 Support Tickets</h2>
          <p className="text-sm text-slate-500 mt-1">Open a ticket if you need help — our team will respond quickly.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setSelectedTicket(null); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm"
        >
          {showForm ? "✕ Cancel" : "+ New Ticket"}
        </button>
      </div>

      {/* New Ticket Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-lg text-slate-800">Create New Support Ticket</h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief summary of your issue"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 min-h-[120px]"
              placeholder="Describe your issue in detail — steps to reproduce, error messages, etc."
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !subject.trim() || !description.trim()}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
          >
            {submitting ? "Creating..." : "Submit Ticket"}
          </button>
        </form>
      )}

      {/* Ticket Detail View */}
      {selectedTicket && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {/* Ticket Header */}
          <div className="p-6 border-b bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-lg text-slate-800">{selectedTicket.ticket.subject}</h3>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕ Close
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedTicket.ticket.status]}`}>
                {selectedTicket.ticket.status}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[selectedTicket.ticket.priority]}`}>
                {selectedTicket.ticket.priority}
              </span>
              <span className="text-xs text-slate-400">
                Ticket #{selectedTicket.ticket.id} · {new Date(selectedTicket.ticket.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Replies */}
          <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
            {selectedTicket.replies.map((reply) => (
              <div
                key={reply.id}
                className={`flex ${reply.replied_by === "tenant" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[75%] rounded-xl px-4 py-3 ${
                  reply.replied_by === "tenant"
                    ? "bg-blue-600 text-white"
                    : reply.message.startsWith("📌")
                      ? "bg-slate-100 text-slate-600 text-sm text-center w-full max-w-full"
                      : "bg-slate-100 text-slate-800"
                }`}>
                  {reply.message.startsWith("📌") ? (
                    <p>{reply.message}</p>
                  ) : (
                    <>
                      <p className="text-xs font-medium mb-1 opacity-70">
                        {reply.replied_by === "tenant" ? "You" : reply.replied_by_name}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                      {reply.attachments && reply.attachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {reply.attachments.map((att) => (
                            isImage(att.mimeType) ? (
                              <a
                                key={att.id}
                                href={att.filePath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img
                                  src={att.filePath}
                                  alt={att.fileName}
                                  className="w-full max-w-[280px] rounded-lg border border-white/20 shadow-sm hover:shadow-md transition-shadow"
                                  loading="lazy"
                                />
                                <span className="text-[10px] opacity-70 mt-1 block truncate">
                                  {att.fileName} ({formatFileSize(att.fileSize)})
                                </span>
                              </a>
                            ) : (
                              <a
                                key={att.id}
                                href={att.filePath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
                                  reply.replied_by === "tenant"
                                    ? "bg-white/20 hover:bg-white/30"
                                    : "bg-slate-200 hover:bg-slate-300"
                                }`}
                              >
                                <span>📎</span>
                                <span className="truncate max-w-[180px]">{att.fileName}</span>
                                <span className="opacity-60 shrink-0">({formatFileSize(att.fileSize)})</span>
                              </a>
                            )
                          ))}
                        </div>
                      )}
                      <p className="text-xs mt-1 opacity-50 text-right">
                        {new Date(reply.created_at).toLocaleString()}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Reply Box */}
          {selectedTicket.ticket.status !== "CLOSED" && (
            <div className="p-4 border-t bg-white">
              <div className="flex gap-3 mb-2">
                <input
                  type="text"
                  value={replyMsg}
                  onChange={e => setReplyMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(selectedTicket.ticket.id); } }}
                  className="flex-1 border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Type your reply..."
                />
                <button
                  onClick={() => handleReply(selectedTicket.ticket.id)}
                  disabled={submitting || (!replyMsg.trim() && selectedFiles.length === 0) || !!getUploadLimitError(selectedFiles)}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {submitting ? "Sending..." : "Send"}
                </button>
              </div>
              {/* Upload progress bar */}
              {submitting && uploadProgress > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">Uploading files...</span>
                    <span className="text-xs text-blue-600 font-medium">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {/* Drag-and-drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                onDragLeave={e => {
                  e.preventDefault(); e.stopPropagation();
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
                }}
                onDrop={e => {
                  e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
                  if (e.dataTransfer.files.length > 0) {
                    setSelectedFiles(Array.from(e.dataTransfer.files));
                  }
                }}
                className={`relative border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
                  isDragOver
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 hover:border-blue-300 bg-slate-50/50"
                }`}
              >
                {isDragOver ? (
                  <p className="text-sm text-blue-600 font-medium">📂 Drop files here to attach</p>
                ) : selectedFiles.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedFiles.map((f, i) => (
                      <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                        📎 {f.name} ({formatFileSize(f.size)})
                        <button onClick={() => setSelectedFiles(prev => prev.filter((_, j) => j !== i))} className="ml-1 text-blue-400 hover:text-red-500">✕</button>
                      </span>
                    ))}
                    <label className="cursor-pointer text-xs text-blue-500 hover:text-blue-700 font-medium ml-auto">
                      + Add more
                      <input type="file" multiple onChange={e => setSelectedFiles(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden" />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <p className="text-sm text-slate-500">
                      <span className="text-blue-500 font-medium">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, PDF, ZIP up to 10MB each (max 5 files / 25MB total)</p>
                    <input
                      type="file"
                      multiple
                      onChange={e => setSelectedFiles(Array.from(e.target.files || []))}
                      className="hidden"
                    />
                  </label>
                )}
                {getUploadLimitError(selectedFiles) && (
                  <div className="mt-2">
                    <span className="text-xs text-red-500 font-medium">⚠ {getUploadLimitError(selectedFiles)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tickets List */}
      {!selectedTicket && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {tickets.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <div className="text-4xl mb-3">🎫</div>
              <p className="font-medium">No support tickets yet</p>
              <p className="text-sm mt-1">Click "New Ticket" to create your first support request.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">ID</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Subject</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Priority</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Replies</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Updated</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => openTicket(ticket.id)}
                    className="border-t hover:bg-blue-50 transition cursor-pointer"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">#{ticket.id}</td>
                    <td className="px-5 py-3 font-medium text-slate-800 max-w-xs truncate">{ticket.subject}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status]}`}>
                        {ticket.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">{ticket.reply_count}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">
                      {new Date(ticket.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
