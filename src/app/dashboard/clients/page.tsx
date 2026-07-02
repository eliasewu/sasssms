"use client";

import { useState, useEffect, useCallback } from "react";
import { useConfirmModal } from "@/components/confirm-modal";

interface Client {
  id: number; client_code: string; name: string; company_name: string; contact_person: string;
  email: string; phone: string; country: string; connection_type: string;
  balance: string; rate_per_sms: string; is_active: boolean; route_plan_id: number;
  smpp_username: string; smpp_allowed_ip: string; max_tps: number;
  billing_mode: string; currency: string; enable_http_api: boolean;
  force_dlr: boolean; webhook_url: string; http_api_key: string;
}

interface RoutePlan { id: number; name: string; }
interface SmppServer { id: number; name: string; host: string; port: number; }

const CONNECTION_TYPES = ["SMPP", "HTTP API", "RCS", "Flash SMS", "WhatsApp", "Telegram", "Voice OTP"];

export default function ClientPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [routePlans, setRoutePlans] = useState<RoutePlan[]>([]);
  const [smppServers, setSmppServers] = useState<SmppServer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({
    clientCode: "", name: "", companyName: "", contactPerson: "", email: "", phone: "",
    country: "", address: "", connectionType: "SMPP",
    smppUsername: "", smppPassword: "", smppAllowedIp: "", smppSystemType: "ESME", maxTps: "10",
    billingMode: "prepaid", currency: "USD", balance: "0", creditLimit: "0", ratePerSms: "0.00030",
    routePlanId: "", enableHttpApi: false, forceDlr: false,
    dlrTimeoutMode: "fixed", dlrTimeout: "60", webhookUrl: "",
  });

  const load = useCallback(async () => {
    const [cr, rr] = await Promise.all([
      fetch("/api/tenant/clients").then(r => r.json()),
      fetch("/api/tenant/route-plans").then(r => r.json()),
    ]);
    setClients(cr.clients || []);
    setRoutePlans(rr.routePlans || []);
    // Fetch SMPP server config
    fetch("/api/tenant/smpp-servers").then(r => r.json()).then(d => setSmppServers(d.servers || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form, routePlanId: form.routePlanId ? parseInt(form.routePlanId) : null,
      maxTps: parseInt(form.maxTps),
      balance: parseFloat(form.balance), creditLimit: parseFloat(form.creditLimit),
      ratePerSms: form.ratePerSms, dlrTimeout: parseInt(form.dlrTimeout),
    };
    if (editing) {
      await fetch(`/api/tenant/clients/${editing.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, isActive: editing.is_active }),
      });
    } else {
      await fetch("/api/tenant/clients", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setShowForm(false); setEditing(null); load();
  };

  const handleEdit = (c: Client) => {
    setEditing(c);
    setForm({
      clientCode: c.client_code || "", name: c.name, companyName: c.company_name || "",
      contactPerson: c.contact_person || "", email: c.email, phone: c.phone,
      country: c.country || "", address: "", connectionType: c.connection_type || "SMPP",
      smppUsername: c.smpp_username || "", smppPassword: "",
      smppAllowedIp: c.smpp_allowed_ip || "", smppSystemType: "ESME", maxTps: c.max_tps?.toString() || "10",
      billingMode: c.billing_mode || "prepaid", currency: c.currency || "USD",
      balance: c.balance, creditLimit: "0", ratePerSms: c.rate_per_sms || "0.00030",
      routePlanId: c.route_plan_id?.toString() || "", enableHttpApi: c.enable_http_api || false,
      forceDlr: c.force_dlr || false, dlrTimeoutMode: "fixed", dlrTimeout: "60",
      webhookUrl: c.webhook_url || "",
    });
    setShowForm(true);
  };

  const { confirm: confirmDelete, modal: confirmModal } = useConfirmModal();

  const handleDelete = async (id: number) => {
    if (!await confirmDelete("Delete this client? It will be archived to CDR.")) return;
    await fetch(`/api/tenant/clients/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Client Management</h2>
          <p className="text-sm text-slate-500">
            Clients connect via SMPP (ESME) to your server port. Java 21 compatible.
            {smppServers.length > 0 && (
              <span className="text-blue-600 ml-2 font-medium">
                Server: {smppServers[0].host}:{smppServers[0].port}
              </span>
            )}
          </p>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          + Add Client
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border shadow-lg max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b px-6 py-4 z-10 flex justify-between">
            <h3 className="font-semibold text-lg">{editing ? "Edit Client" : "Add New Client"}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Company Info */}
            <section className="bg-slate-50 rounded-xl p-5">
              <h4 className="font-semibold text-slate-700 mb-4">🏢 Company Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Client Code" value={form.clientCode} onChange={e => setForm({...form, clientCode: e.target.value})} />
                <Input label="Company Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                <Input label="Contact Person" value={form.contactPerson} onChange={e => setForm({...form, contactPerson: e.target.value})} />
                <Input label="Email *" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
                <Input label="Phone *" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required />
                <Input label="Country" value={form.country} onChange={e => setForm({...form, country: e.target.value})} />
              </div>
            </section>

            {/* Connection Type */}
            <section className="bg-slate-50 rounded-xl p-5">
              <h4 className="font-semibold text-slate-700 mb-4">🔌 Connection Type</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {CONNECTION_TYPES.map(t => (
                  <label key={t} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${form.connectionType === t ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-white"}`}>
                    <input type="radio" name="ctype" checked={form.connectionType === t} onChange={() => setForm({...form, connectionType: t})} className="accent-blue-600" />
                    <span className="text-sm">{t}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* SMPP Settings - Client connects to our server */}
            {form.connectionType === "SMPP" && (
              <section className="bg-slate-50 rounded-xl p-5">
                <h4 className="font-semibold text-slate-700 mb-4">⚙️ SMPP Connection (ESME → SMSC)</h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-700">
                  <strong>Client connects to:</strong> {smppServers[0]?.host || "server-ip"}:{smppServers[0]?.port || "2775"} (SMSC server port)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="SMPP Username" value={form.smppUsername} onChange={e => setForm({...form, smppUsername: e.target.value})} />
                  <Input label="SMPP Password" type="password" value={form.smppPassword} onChange={e => setForm({...form, smppPassword: e.target.value})} />
                  <Input label="Allowed IP" value={form.smppAllowedIp} onChange={e => setForm({...form, smppAllowedIp: e.target.value})} placeholder="0.0.0.0/0" />
                  <div>
                    <label className="block text-sm font-medium mb-1">System Type</label>
                    <select value={form.smppSystemType} onChange={e => setForm({...form, smppSystemType: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="ESME">ESME (Client)</option>
                      <option value="SMSC">SMSC (Server)</option>
                    </select>
                  </div>
                  <Input label="Max TPS" type="number" value={form.maxTps} onChange={e => setForm({...form, maxTps: e.target.value})} />
                </div>
              </section>
            )}

            {/* Billing */}
            <section className="bg-slate-50 rounded-xl p-5">
              <h4 className="font-semibold text-slate-700 mb-4">💰 Billing Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select label="Billing Mode" value={form.billingMode} onChange={e => setForm({...form, billingMode: e.target.value})} options={[{v:"prepaid",l:"Prepaid"},{v:"postpaid",l:"Postpaid"}]} />
                <Select label="Currency" value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} options={[{v:"USD",l:"USD"},{v:"EUR",l:"EUR"},{v:"INR",l:"INR"},{v:"USDT",l:"USDT"}]} />
                <Input label="Initial Balance" type="number" step="0.0001" value={form.balance} onChange={e => setForm({...form, balance: e.target.value})} />
                <Input label="Credit Limit" type="number" step="0.0001" value={form.creditLimit} onChange={e => setForm({...form, creditLimit: e.target.value})} />
                <Input label="Rate Per SMS ($)" type="number" step="0.000001" value={form.ratePerSms} onChange={e => setForm({...form, ratePerSms: e.target.value})} />
              </div>
            </section>

            {/* Routing */}
            <section className="bg-slate-50 rounded-xl p-5">
              <h4 className="font-semibold text-slate-700 mb-4">🔀 Routing Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Routing Plan" value={form.routePlanId} onChange={e => setForm({...form, routePlanId: e.target.value})} options={[{v:"",l:"-- None --"},...routePlans.map(r => ({v:r.id.toString(),l:r.name}))]} />
                <div className="space-y-2">
                  <Check label="Enable HTTP API" checked={form.enableHttpApi} onChange={e => setForm({...form, enableHttpApi: e.target.checked})} />
                  <Check label="Force DLR" checked={form.forceDlr} onChange={e => setForm({...form, forceDlr: e.target.checked})} />
                </div>
                {form.forceDlr && <>
                  <Select label="DLR Timeout Mode" value={form.dlrTimeoutMode} onChange={e => setForm({...form, dlrTimeoutMode: e.target.value})} options={[{v:"fixed",l:"Fixed"},{v:"dynamic",l:"Dynamic"}]} />
                  <Input label="DLR Timeout (s)" type="number" value={form.dlrTimeout} onChange={e => setForm({...form, dlrTimeout: e.target.value})} />
                </>}
                <div className="md:col-span-2">
                  <Input label="Webhook URL" value={form.webhookUrl} onChange={e => setForm({...form, webhookUrl: e.target.value})} placeholder="https://..." />
                </div>
              </div>
            </section>

            <div className="flex gap-3">
              <button type="submit" className="bg-blue-600 text-white px-8 py-2.5 rounded-lg text-sm font-medium">{editing ? "Update Client" : "Create Client"}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="border px-6 py-2.5 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left px-4 py-3">Code/Name</th><th className="text-left px-4 py-3">Contact</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Balance</th><th className="text-left px-4 py-3">Rate</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Actions</th></tr></thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="border-b hover:bg-slate-50">
                <td className="px-4 py-3"><span className="font-medium">{c.name}</span><br/><span className="text-xs text-slate-400">{c.client_code || "—"}</span></td>
                <td className="px-4 py-3 text-xs">{c.email}<br/>{c.phone}</td>
                <td className="px-4 py-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{c.connection_type || "SMPP"}</span>{c.http_api_key ? <><br/><span className="text-xs text-green-600 font-mono">API: {c.http_api_key.slice(0,12)}...</span></> : null}</td>
                <td className="px-4 py-3 font-mono text-xs">${parseFloat(c.balance).toFixed(4)}</td>
                <td className="px-4 py-3 font-mono text-xs">${c.rate_per_sms}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${c.is_active?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>{c.is_active?"Active":"Inactive"}</span></td>
                <td className="px-4 py-3"><button onClick={() => handleEdit(c)} className="text-blue-600 hover:underline text-xs mr-2">Edit</button><button onClick={() => handleDelete(c.id)} className="text-red-600 hover:underline text-xs">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {confirmModal}
    </div>
  );
}

function Input({ label, type = "text", value, onChange, required, placeholder, step }: { label: string; type?: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean; placeholder?: string; step?: string }) {
  return <div><label className="block text-sm font-medium text-slate-700 mb-1">{label}</label><input type={type} value={value} onChange={onChange} required={required} placeholder={placeholder} step={step} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>;
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: {v:string;l:string}[] }) {
  return <div><label className="block text-sm font-medium text-slate-700 mb-1">{label}</label><select value={value} onChange={onChange} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">{options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>;
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return <label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={onChange} className="accent-blue-600" /><span className="text-sm">{label}</span></label>;
}
