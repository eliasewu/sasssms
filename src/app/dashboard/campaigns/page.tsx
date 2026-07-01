"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Campaign {
  id: number; name: string; client_id: number; sender: string; content: string;
  recipients: string; total_count: number; sent_count: number; delivered_count: number;
  failed_count: number; status: string; scheduled_at: string; created_at: string;
}
interface Client { id: number; name: string; }

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [csvPreview, setCsvPreview] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: "", clientId: "", sender: "", content: "", recipients: "" });

  const load = useCallback(async () => {
    const [cr, cl] = await Promise.all([
      fetch("/api/tenant/campaigns").then(r => r.json()),
      fetch("/api/tenant/clients").then(r => r.json()),
    ]);
    setCampaigns(cr.campaigns || []);
    setClients(cl.clients || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split(/[\n,]/).map(l => l.trim()).filter(Boolean);
      setCsvPreview(lines);
      setForm({...form, recipients: lines.join("\n")});
    };
    reader.readAsText(file);
  };

  const createCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipients = form.recipients.split(/[\n,]/).map(r => r.trim()).filter(Boolean);
    await fetch("/api/tenant/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, clientId: parseInt(form.clientId) || clients[0]?.id,
        sender: form.sender, content: form.content,
        recipients: JSON.stringify(recipients), totalCount: recipients.length,
      }),
    });
    setShowForm(false); setCsvPreview([]);
    setForm({ name: "", clientId: "", sender: "", content: "", recipients: "" });
    load();
  };

  const runCampaign = async (id: number) => {
    await fetch(`/api/tenant/campaigns/${id}/run`, { method: "POST" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-slate-800">Bulk Campaigns</h2><p className="text-sm text-slate-500">Upload recipients via CSV/Excel, create and run SMS campaigns</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ New Campaign</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Create Campaign</h3>
          <form onSubmit={createCampaign} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Campaign Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
              <div><label className="block text-sm font-medium mb-1">Client</label><select value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">Select</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium mb-1">Sender ID *</label><input value={form.sender} onChange={e => setForm({...form, sender: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
            </div>
            <div><label className="block text-sm font-medium mb-1">Message Content *</label><textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={3} required className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
            <div>
              <div className="flex items-center gap-4 mb-2">
                <label className="block text-sm font-medium">Recipients (CSV/Excel upload or manual)</label>
                <label className="cursor-pointer bg-slate-100 text-xs px-3 py-1 rounded hover:bg-slate-200">
                  📎 Upload CSV
                  <input type="file" ref={fileRef} accept=".csv,.txt" onChange={handleFileUpload} className="hidden"/>
                </label>
              </div>
              <textarea value={form.recipients} onChange={e => setForm({...form, recipients: e.target.value})} rows={5} placeholder="+254755424815&#10;+254712345678&#10;+254798765432" className="w-full border rounded-lg px-3 py-2 text-sm font-mono"/>
              <div className="flex justify-between mt-1">
                <p className="text-xs text-slate-400">{(form.recipients || "").split(/[\n,]/).filter(Boolean).length} recipients</p>
                {csvPreview.length > 0 && <p className="text-xs text-green-600">✅ CSV loaded: {csvPreview.length} numbers</p>}
              </div>
            </div>
            <div className="flex gap-2"><button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Create Campaign</button><button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button></div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {campaigns.map(c => (
          <div key={c.id} className="bg-white rounded-xl border p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div><h4 className="font-semibold text-lg">{c.name}</h4><p className="text-xs text-slate-500">Sender: {c.sender}</p></div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${c.status==="DRAFT"?"bg-slate-100 text-slate-700":c.status==="RUNNING"?"bg-amber-100 text-amber-700":c.status==="COMPLETED"?"bg-green-100 text-green-700":"bg-blue-100 text-blue-700"}`}>{c.status}</span>
            </div>
            <p className="text-sm text-slate-600 mb-4 line-clamp-2">{c.content}</p>
            <div className="grid grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center"><p className="text-xl font-bold">{c.total_count}</p><p className="text-[10px] text-slate-500">Total</p></div>
              <div className="text-center"><p className="text-xl font-bold text-blue-600">{c.sent_count}</p><p className="text-[10px] text-slate-500">Sent</p></div>
              <div className="text-center"><p className="text-xl font-bold text-green-600">{c.delivered_count}</p><p className="text-[10px] text-slate-500">Delivered</p></div>
              <div className="text-center"><p className="text-xl font-bold text-red-600">{c.failed_count}</p><p className="text-[10px] text-slate-500">Failed</p></div>
            </div>
            {c.status === "DRAFT" && <div className="mt-4"><button onClick={() => runCampaign(c.id)} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium">▶ Run Campaign</button></div>}
            {c.status === "RUNNING" && <div className="mt-4 w-full bg-slate-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full" style={{width: `${c.total_count>0?(c.sent_count/c.total_count)*100:0}%`}}/></div>}
          </div>
        ))}
        {campaigns.length === 0 && <div className="text-center py-12 text-slate-400 bg-white rounded-xl border">No campaigns created yet. Upload CSV and create a campaign.</div>}
      </div>
    </div>
  );
}
