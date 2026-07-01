"use client";

import { useState, useEffect, useCallback } from "react";

interface SmsInbox { id: number; sender: string; destination: string; content: string; received_at: string; is_read: boolean; }

export default function InboxPage() {
  const [messages, setMessages] = useState<SmsInbox[]>([]);
  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/inbox").then(r => r.json());
    setMessages(r.messages || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-bold text-slate-800">SMS Inbox (MO)</h2><p className="text-sm text-slate-500">Mobile-originated incoming messages</p></div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="text-left px-5 py-3">From</th><th className="text-left px-5 py-3">To</th><th className="text-left px-5 py-3">Content</th><th className="text-left px-5 py-3">Received</th><th className="text-left px-5 py-3">Status</th></tr></thead>
          <tbody>{messages.map(m => (<tr key={m.id} className={`border-b ${!m.is_read?"bg-blue-50/50":""}`}><td className="px-5 py-3 font-mono">{m.sender}</td><td className="px-5 py-3 font-mono">{m.destination}</td><td className="px-5 py-3 max-w-md truncate">{m.content}</td><td className="px-5 py-3 text-xs">{new Date(m.received_at).toLocaleString()}</td><td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${m.is_read?"bg-slate-100":"bg-blue-100 text-blue-700"}`}>{m.is_read?"Read":"New"}</span></td></tr>))}{messages.length===0&&<tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No incoming messages</td></tr>}</tbody></table>
      </div>
    </div>
  );
}
