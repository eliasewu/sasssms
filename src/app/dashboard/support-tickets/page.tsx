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

interface Reply {
  id: number;
  replied_by: string;
  replied_by_name: string;
  message: string;
  created_at: string;
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
    if (!replyMsg.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tenant/support-tickets/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: replyMsg.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (selectedTicket) {
          setSelectedTicket({
            ...selectedTicket,
            replies: [...selectedTicket.replies, data.reply],
          });
        }
        setReplyMsg("");
        fetchTickets();
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
            <div className="p-4 border-t bg-white flex gap-3">
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
                disabled={submitting || !replyMsg.trim()}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {submitting ? "Sending..." : "Send"}
              </button>
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
