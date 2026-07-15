"use client";

import { useState, useEffect, useCallback } from "react";

interface Ticket {
  id: number;
  tenant_id: number;
  tenant_name: string;
  tenant_email: string;
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

export default function SuperSupportTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<{ ticket: Ticket; replies: Reply[] } | null>(null);
  const [replyMsg, setReplyMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchTickets = useCallback(async (filter?: string) => {
    setLoading(true);
    try {
      const params = filter ? `?status=${filter}` : "";
      const res = await fetch(`/api/super/support-tickets${params}`, { credentials: "include" });
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
      const res = await fetch(`/api/super/support-tickets/${ticketId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSelectedTicket({ ticket: data.ticket, replies: data.replies });
      }
    } catch { /* ignore */ }
  };

  const handleReply = async (ticketId: number) => {
    if (!replyMsg.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/super/support-tickets/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: replyMsg.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (selectedTicket) {
          setSelectedTicket({
            ticket: { ...selectedTicket.ticket, replied_by: "super" },
            replies: [...selectedTicket.replies, data.reply],
          });
        }
        setReplyMsg("");
        fetchTickets();
      }
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  const handleStatusChange = async (ticketId: number, newStatus: string) => {
    try {
      const res = await fetch("/api/super/support-tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ticketId, status: newStatus }),
      });
      if (res.ok) {
        fetchTickets();
        // Refresh detail view if open
        if (selectedTicket && selectedTicket.ticket.id === ticketId) {
          openTicket(ticketId);
        }
      }
    } catch { /* ignore */ }
  };

  // Counts
  const openCount = tickets.filter(t => t.status === "OPEN").length;
  const resolvedCount = tickets.filter(t => t.status === "RESOLVED" || t.status === "CLOSED").length;

  if (loading && tickets.length === 0) {
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
          <p className="text-sm text-slate-500 mt-1">
            Manage support requests from all tenants. {openCount} open · {resolvedCount} resolved.
          </p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => { setStatusFilter(""); fetchTickets(); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!statusFilter ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          All
        </button>
        {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); fetchTickets(s); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${statusFilter === s ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Ticket Detail View */}
      {selectedTicket && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-lg text-slate-800">{selectedTicket.ticket.subject}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  From: {selectedTicket.ticket.tenant_name} ({selectedTicket.ticket.tenant_email})
                </p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-600 text-sm">
                ✕ Close
              </button>
            </div>
            <div className="flex items-center gap-3 mt-3">
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
            {/* Status change buttons */}
            <div className="flex gap-2 mt-4">
              {["IN_PROGRESS", "RESOLVED", "CLOSED"].map(s => (
                selectedTicket.ticket.status !== s && (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(selectedTicket.ticket.id, s)}
                    className="px-3 py-1 rounded-lg text-xs font-medium bg-white border hover:bg-slate-50 transition"
                  >
                    Mark {s.replace("_", " ")}
                  </button>
                )
              ))}
              {selectedTicket.ticket.status !== "OPEN" && selectedTicket.ticket.status !== "CLOSED" && (
                <button
                  onClick={() => handleStatusChange(selectedTicket.ticket.id, "OPEN")}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-white border hover:bg-blue-50 text-blue-600 transition"
                >
                  Reopen
                </button>
              )}
            </div>
          </div>

          {/* Replies */}
          <div className="p-6 space-y-4 max-h-[40vh] overflow-y-auto">
            {selectedTicket.replies.map((reply) => (
              <div
                key={reply.id}
                className={`flex ${reply.replied_by === "super" && !reply.message.startsWith("📌") ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[75%] rounded-xl px-4 py-3 ${
                  reply.replied_by === "super" && !reply.message.startsWith("📌")
                    ? "bg-orange-600 text-white"
                    : reply.message.startsWith("📌")
                      ? "bg-slate-100 text-slate-600 text-sm text-center w-full max-w-full"
                      : "bg-slate-100 text-slate-800"
                }`}>
                  {reply.message.startsWith("📌") ? (
                    <p>{reply.message}</p>
                  ) : (
                    <>
                      <p className="text-xs font-medium mb-1 opacity-70">
                        {reply.replied_by === "super" ? reply.replied_by_name + " (Admin)" : reply.replied_by_name + " (Tenant)"}
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
                className="flex-1 border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-500"
                placeholder="Type your reply..."
              />
              <button
                onClick={() => handleReply(selectedTicket.ticket.id)}
                disabled={submitting || !replyMsg.trim()}
                className="px-5 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition"
              >
                {submitting ? "Sending..." : "Send"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tickets Table */}
      {!selectedTicket && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {tickets.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <div className="text-4xl mb-3">🎫</div>
              <p className="font-medium">No support tickets found</p>
              <p className="text-sm mt-1">Tickets created by tenants will appear here.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">ID</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Tenant</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Subject</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Priority</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Last Reply</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Updated</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t hover:bg-orange-50 transition">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">#{ticket.id}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{ticket.tenant_name}</td>
                    <td
                      className="px-5 py-3 font-medium text-slate-800 max-w-xs truncate cursor-pointer hover:text-orange-600"
                      onClick={() => openTicket(ticket.id)}
                    >
                      {ticket.subject}
                    </td>
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
                    <td className="px-5 py-3 text-xs">
                      {ticket.replied_by === "tenant" ? (
                        <span className="text-blue-600 font-medium">⤴ Tenant</span>
                      ) : ticket.replied_by === "super" ? (
                        <span className="text-orange-600 font-medium">⤵ Admin</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">
                      {new Date(ticket.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => openTicket(ticket.id)}
                        className="text-xs px-3 py-1 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 font-medium transition"
                      >
                        View
                      </button>
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
