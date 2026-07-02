"use client";

import { useState, useEffect, useCallback } from "react";
import { useConfirmModal } from "@/components/confirm-modal";

const CONNECTION_TYPES = ["SMPP", "HTTP API", "Email", "WhatsApp OTT", "Telegram OTT", "Voice OTP", "Local Bypass", "RCS", "Flash SMS"];
const SMPP_VERSIONS = ["3.3", "3.4", "5.0"];
const BIND_TYPES = ["TRX", "TX", "RX"];
const CONNECTION_MODES = ["CLIENT", "SERVER"];

interface Supplier {
  id: number; supplier_code: string; name: string; company_name: string; contact_person: string;
  email: string; phone: string; connection_type: string; connection_mode: string;
  host: string; port: number; username: string; system_id: string; system_type: string;
  smpp_version: string; bind_type: string; address_ton: number; address_npi: number;
  address_range: string; inbound_mode: boolean; api_url: string; connector_id: number;
  cost_per_sms: string; currency: string; force_dlr: boolean;
  is_active: boolean; bind_status: string;
}
interface Connector { id: number; name: string; type: string; provider: string; region: string; api_url?: string; }

export default function SupplierPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplierCode: "", name: "", companyName: "", contactPerson: "", email: "", phone: "",
    connectionType: "SMPP", connectionMode: "CLIENT",
    host: "", port: "2775", username: "", password: "", systemId: "", systemType: "ESME",
    smppVersion: "3.4", bindType: "TRX", addressTon: "0", addressNpi: "0", addressRange: "",
    inboundMode: false,
    apiUrl: "", apiKey: "",
    currency: "USD", costPerSms: "0.00000", initialBalance: "0", creditLimit: "0",
    forceDlr: false,
  });

  const load = useCallback(async () => {
    try {
      const [sr, cr] = await Promise.all([
        fetch("/api/tenant/suppliers").then(r => r.json()),
        fetch("/api/tenant/connectors").then(r => r.json()).catch(() => ({ connectors: [] })),
      ]);
      setSuppliers(sr.suppliers || []);
      setConnectors(cr.connectors || []);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");

    // Build payload with exact field names the API expects
    const payload: Record<string, unknown> = {
      supplierCode: form.supplierCode || null,
      name: form.name,
      companyName: form.companyName || null,
      contactPerson: form.contactPerson || null,
      email: form.email || null,
      phone: form.phone || null,
      connectionType: form.connectionType,
      connectionMode: form.connectionMode,
      host: form.host || null,
      port: parseInt(form.port) || 2775,
      username: form.username || null,
      password: form.password || null,
      systemId: form.systemId || null,
      systemType: form.systemType || null,
      smppVersion: form.smppVersion,
      bindType: form.bindType,
      addressTon: parseInt(form.addressTon) || 0,
      addressNpi: parseInt(form.addressNpi) || 0,
      addressRange: form.addressRange || null,
      inboundMode: form.inboundMode,
      apiUrl: form.apiUrl || null,
      apiKey: form.apiKey || null,
      currency: form.currency,
      costPerSms: form.costPerSms || "0",
      initialBalance: form.initialBalance || "0",
      creditLimit: form.creditLimit || "0",
        forceDlr: form.forceDlr,
        connectorId: (form as any).connectorId ? parseInt((form as any).connectorId) : null,
        config: form.connectionType === "VOICE_OTP" ? JSON.stringify({ type: "voice_otp" }) : null,
      };

    try {
      let res: Response;
      if (editing) {
        res = await fetch(`/api/tenant/suppliers/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, isActive: editing.is_active }),
        });
      } else {
        res = await fetch("/api/tenant/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Failed: ${res.status}`);
        setSaving(false);
        return;
      }

      setShowForm(false); setEditing(null); setError("");
      load();
    } catch (err) {
      setError("Network error. Please try again.");
    }
    setSaving(false);
  };

  const handleEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      supplierCode: s.supplier_code || "", name: s.name, companyName: s.company_name || "",
      contactPerson: s.contact_person || "", email: s.email || "", phone: s.phone || "",
      connectionType: s.connection_type, connectionMode: s.connection_mode || "CLIENT",
      host: s.host || "", port: (s.port || 2775).toString(), username: s.username || "",
      password: "", systemId: s.system_id || "", systemType: s.system_type || "ESME",
      smppVersion: s.smpp_version || "3.4", bindType: s.bind_type || "TRX",
      addressTon: (s.address_ton || 0).toString(), addressNpi: (s.address_npi || 0).toString(),
      addressRange: s.address_range || "", inboundMode: s.inbound_mode || false,
      apiUrl: s.api_url || "", apiKey: "",
      currency: s.currency || "USD", costPerSms: s.cost_per_sms || "0",
      initialBalance: "0", creditLimit: "0", forceDlr: s.force_dlr || false,
    });
    setShowForm(true);
  };

  const { confirm: confirmDelete, modal: confirmModal } = useConfirmModal();

  const handleDelete = async (id: number) => {
    if (!await confirmDelete("Archive this supplier to CDR?")) return;
    await fetch(`/api/tenant/suppliers/${id}`, { method: "DELETE" });
    load();
  };

  const typeColors: Record<string, string> = {
    SMPP: "bg-blue-100 text-blue-700", "HTTP API": "bg-green-100 text-green-700",
    RCS: "bg-purple-100 text-purple-700", "Flash SMS": "bg-amber-100 text-amber-700",
    "Voice OTP": "bg-red-100 text-red-700", "WhatsApp OTT": "bg-emerald-100 text-emerald-700",
    "Telegram OTT": "bg-cyan-100 text-cyan-700", Email: "bg-pink-100 text-pink-700",
    "Local Bypass": "bg-orange-100 text-orange-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-slate-800">Supplier Management</h2><p className="text-sm text-slate-500">{suppliers.length} suppliers configured</p></div>
        <button onClick={() => { setShowForm(true); setEditing(null); setError(""); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">+ Add Supplier</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border shadow-lg max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between z-10">
            <h3 className="font-semibold text-lg">{editing ? "Edit" : "Add"} Supplier</h3>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          
          {error && <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Company Info */}
            <section className="bg-slate-50 rounded-xl p-5">
              <h4 className="font-semibold mb-4">🏢 Company Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <F label="Supplier Code" value={form.supplierCode} onChange={v => setForm({...form, supplierCode: v})} />
                <F label="Company Name *" value={form.name} onChange={v => setForm({...form, name: v})} required />
                <F label="Contact Person" value={form.contactPerson} onChange={v => setForm({...form, contactPerson: v})} />
                <F label="Email" type="email" value={form.email} onChange={v => setForm({...form, email: v})} />
                <F label="Phone" value={form.phone} onChange={v => setForm({...form, phone: v})} />
                <div>
                  <label className="block text-sm font-medium mb-1">Connection Mode</label>
                  <select value={form.connectionMode} onChange={e => setForm({...form, connectionMode: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {CONNECTION_MODES.map(m => <option key={m} value={m}>{m === "CLIENT" ? "Client (ESME) — connect to external SMSC" : "Server (SMSC) — clients connect to us"}</option>)}
                  </select>
                </div>
              </div>
            </section>

            {/* Connection Type */}
            <section className="bg-slate-50 rounded-xl p-5">
              <h4 className="font-semibold mb-3">🔌 Connection Type</h4>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {CONNECTION_TYPES.map(t => (
                  <label key={t} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs ${form.connectionType === t ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>
                    <input type="radio" name="stype" checked={form.connectionType === t} onChange={() => setForm({...form, connectionType: t})} className="accent-blue-600" />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* SMPP Settings */}
            {form.connectionType === "SMPP" && (
              <section className="bg-slate-50 rounded-xl p-5">
                <h4 className="font-semibold mb-3">⚙️ SMPP Connection (v{form.smppVersion})</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <F label="SMPP Host *" value={form.host} onChange={v => setForm({...form, host: v})} required={form.connectionMode === "CLIENT"} placeholder="145.239.1.103" />
                  <F label="Port" type="number" value={form.port} onChange={v => setForm({...form, port: v})} />
                  <F label="System ID" value={form.systemId} onChange={v => setForm({...form, systemId: v})} />
                  <F label="Password" type="password" value={form.password} onChange={v => setForm({...form, password: v})} />
                  <div>
                    <label className="block text-sm font-medium mb-1">System Type</label>
                    <select value={form.systemType} onChange={e => setForm({...form, systemType: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="ESME">ESME</option><option value="SMSC">SMSC</option><option value="EIMS">EIMS/modern</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">SMPP Version</label>
                    <select value={form.smppVersion} onChange={e => setForm({...form, smppVersion: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                      {SMPP_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Bind Type</label>
                    <select value={form.bindType} onChange={e => setForm({...form, bindType: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                      {BIND_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <F label="Address TON" type="number" value={form.addressTon} onChange={v => setForm({...form, addressTon: v})} />
                  <F label="Address NPI" type="number" value={form.addressNpi} onChange={v => setForm({...form, addressNpi: v})} />
                  <F label="Address Range" value={form.addressRange} onChange={v => setForm({...form, addressRange: v})} />
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={form.inboundMode} onChange={e => setForm({...form, inboundMode: e.target.checked})} className="accent-blue-600" /><span className="text-sm">Inbound Mode</span></label>
                  </div>
                </div>
              </section>
            )}

            {/* API Settings + Connector Dropdown */}
            {["HTTP API", "RCS", "Flash SMS", "WhatsApp OTT", "Telegram OTT", "Email"].includes(form.connectionType) && (
              <section className="bg-slate-50 rounded-xl p-5">
                <h4 className="font-semibold mb-3">🌐 API Connector</h4>
                <p className="text-xs text-slate-500 mb-3">Select from pre-loaded API connectors or enter custom API details</p>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Select API Connector</label>
                  <select value={(form as any).connectorId || ""} onChange={e => {
                    const cid = e.target.value;
                    if (cid) {
                      const conn = connectors.find(c => c.id === parseInt(cid));
                      if (conn) {
                        setForm({...form, apiUrl: conn.api_url || "", apiKey: "", ...{connectorId: cid} as any});
                      }
                    }
                  }} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">-- Select Pre-Loaded Connector --</option>
                    {connectors.filter(c => {
                      const ft = form.connectionType;
                      if (ft === "Flash SMS") return c.type === "FLASH_SMS";
                      if (ft === "RCS") return c.type === "RCS";
                      if (ft === "WhatsApp OTT") return c.name.includes("WhatsApp");
                      if (ft === "Telegram OTT") return c.name.includes("Telegram");
                      return c.type === "HTTP_API";
                    }).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.provider}) — {c.region} [{c.type}]</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <F label="API URL" value={form.apiUrl} onChange={v => setForm({...form, apiUrl: v})} />
                  <F label="API Key / Token" value={form.apiKey} onChange={v => setForm({...form, apiKey: v})} />
                </div>
              </section>
            )}

            {/* Billing */}
            <section className="bg-slate-50 rounded-xl p-5">
              <h4 className="font-semibold mb-3">💰 Billing Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Currency</label>
                  <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="USD">USD</option><option value="EUR">EUR</option><option value="INR">INR</option>
                  </select>
                </div>
                <F label="Cost Per SMS ($)" type="number" step="0.000001" value={form.costPerSms} onChange={v => setForm({...form, costPerSms: v})} />
                <F label="Initial Balance" type="number" step="0.0001" value={form.initialBalance} onChange={v => setForm({...form, initialBalance: v})} />
                <F label="Credit Limit" type="number" step="0.0001" value={form.creditLimit} onChange={v => setForm({...form, creditLimit: v})} />
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.forceDlr} onChange={e => setForm({...form, forceDlr: e.target.checked})} className="accent-blue-600" /><span className="text-sm">Force DLR</span></label>
                </div>
              </div>
            </section>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving..." : editing ? "Update Supplier" : "Create Supplier"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="border px-6 py-2.5 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Supplier Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Mode</th><th className="text-left px-4 py-3">Host:Port</th><th className="text-left px-4 py-3">Cost/SMS</th><th className="text-left px-4 py-3">Bind</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Actions</th></tr>
          </thead>
          <tbody>
            {suppliers.map(s => (
              <tr key={s.id} className="border-b hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${typeColors[s.connection_type] || "bg-slate-100"}`}>{s.connection_type}</span></td>
                <td className="px-4 py-3"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{s.connection_mode || "CLIENT"}</span></td>
                <td className="px-4 py-3 font-mono text-xs">{s.host ? `${s.host}:${s.port}` : s.api_url ? s.api_url.slice(0,30) : "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">${s.cost_per_sms}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${s.bind_status === "BOUND" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{s.bind_status || "UNBOUND"}</span></td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${s.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{s.is_active ? "Active" : "Inactive"}</span></td>
                <td className="px-4 py-3">
                  <button onClick={() => handleEdit(s)} className="text-blue-600 hover:underline text-xs mr-2">Edit</button>
                  <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No suppliers yet. Click &quot;Add Supplier&quot; to create one.</td></tr>}
          </tbody>
        </table>
      </div>
      {confirmModal}
    </div>
  );
}

function F({ label, type = "text", value, onChange, required, placeholder, step }: { label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string; step?: string }) {
  return <div><label className="block text-sm font-medium text-slate-700 mb-1">{label}</label><input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder} step={step} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" /></div>;
}
