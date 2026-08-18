"use client";

import { useState, useEffect, useCallback } from "react";

interface Smtp { host: string; port: number; username: string | null; password: string | null; fromEmail: string | null; fromName: string | null; encryption: string; isActive: boolean; }
interface BankAccount { id: number; label: string | null; account_holder_name: string | null; bank_name: string | null; account_number: string | null; iban: string | null; swift_bic: string | null; bank_address: string | null; currency: string; usdt_wallet: string | null; usdt_network: string | null; is_active: boolean; }
interface InvoiceSettings { id: number; currency: string; timezone: string; taxRate: number; dueDays: number; invoicePrefix: string; nextInvoiceNumber: number; autoEmailInvoice: boolean; notifyRateChange: boolean; notifyLowBalance: boolean; welcomeEmailAuto: boolean; }
interface Schedule { id: number; name: string; frequency: string; day_of_week: number; day_of_month: number; interval_days: number | null; scope: string; entity_id: number | null; period_days: number; is_active: boolean; last_run_at: string | null; next_run_at: string | null; }

const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function BillingSettingsPage() {
  const [tab, setTab] = useState<"smtp" | "bank" | "invoice" | "schedule">("smtp");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Billing Settings</h2>
        <p className="text-sm text-slate-500">Configure SMTP, bank details, invoice defaults, and recurring schedules.</p>
      </div>
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {([["smtp", "✉️ SMTP"], ["bank", "🏦 Bank Details"], ["invoice", "📄 Invoice Settings"], ["schedule", "🔄 Schedules"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm ${tab === k ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>{label}</button>
        ))}
      </div>
      {tab === "smtp" && <SmtpTab />}
      {tab === "bank" && <BankTab />}
      {tab === "invoice" && <InvoiceTab />}
      {tab === "schedule" && <ScheduleTab />}
    </div>
  );
}

function SmtpTab() {
  const [smtp, setSmtp] = useState<Smtp | null>(null);
  const [msg, setMsg] = useState("");
  const [testTo, setTestTo] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/smtp-config").then(r => r.json());
    setSmtp(r.smtp);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!smtp) return <p className="text-slate-400 text-sm">Loading…</p>;

  const save = async () => {
    const res = await fetch("/api/tenant/smtp-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(smtp) });
    const data = await res.json();
    if (!res.ok) alert(data.error || "Failed to save");
    else { setMsg("SMTP saved"); setTimeout(() => setMsg(""), 3000); }
  };

  const test = async () => {
    const res = await fetch("/api/tenant/smtp-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: testTo || undefined }) });
    const data = await res.json();
    if (!res.ok) alert(data.error || "Test failed");
    else alert("Test email sent ✅");
  };

  return (
    <div className="bg-white rounded-xl border p-6 shadow-sm max-w-2xl space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="SMTP Host" value={smtp.host} onChange={v => setSmtp({ ...smtp, host: v })} />
        <Field label="Port" type="number" value={String(smtp.port)} onChange={v => setSmtp({ ...smtp, port: parseInt(v) || 587 })} />
        <Field label="Username" value={smtp.username || ""} onChange={v => setSmtp({ ...smtp, username: v || null })} />
        <Field label="Password" type="password" value={smtp.password || ""} onChange={v => setSmtp({ ...smtp, password: v || null })} />
        <Field label="From Email" value={smtp.fromEmail || ""} onChange={v => setSmtp({ ...smtp, fromEmail: v || null })} />
        <Field label="From Name" value={smtp.fromName || ""} onChange={v => setSmtp({ ...smtp, fromName: v || null })} />
        <div>
          <label className="block text-sm font-medium mb-1">Encryption</label>
          <select value={smtp.encryption} onChange={e => setSmtp({ ...smtp, encryption: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="tls">TLS (STARTTLS)</option>
            <option value="ssl">SSL</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={save} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm">Save SMTP</button>
        <input value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="test recipient (defaults to your email)" className="border rounded-lg px-3 py-2 text-sm flex-1" />
        <button onClick={test} className="border px-4 py-2 rounded-lg text-sm">Send Test</button>
        {msg && <span className="text-green-600 text-sm">{msg}</span>}
      </div>
      <p className="text-xs text-slate-400">Leave host empty to fall back to the platform SMTP relay. Emails are sent for invoices, rate changes, low-balance alerts, and welcome emails.</p>
    </div>
  );
}

function BankTab() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [form, setForm] = useState<Partial<BankAccount>>({ currency: "USD" });
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/bank-accounts").then(r => r.json());
    setAccounts(r.bankAccounts || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const url = editingId ? `/api/tenant/bank-accounts/${editingId}` : "/api/tenant/bank-accounts";
    const method = editingId ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ currency: "USD" }); setEditingId(null); load();
  };

  const del = async (id: number) => {
    await fetch(`/api/tenant/bank-accounts/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-6 shadow-sm max-w-3xl grid grid-cols-2 gap-4">
        <Field label="Label (e.g. Primary EUR)" value={form.label || ""} onChange={v => setForm({ ...form, label: v })} />
        <Field label="Account Holder Name" value={form.account_holder_name || ""} onChange={v => setForm({ ...form, account_holder_name: v })} />
        <Field label="Bank Name" value={form.bank_name || ""} onChange={v => setForm({ ...form, bank_name: v })} />
        <Field label="Account Number" value={form.account_number || ""} onChange={v => setForm({ ...form, account_number: v })} />
        <Field label="IBAN" value={form.iban || ""} onChange={v => setForm({ ...form, iban: v })} />
        <Field label="SWIFT / BIC" value={form.swift_bic || ""} onChange={v => setForm({ ...form, swift_bic: v })} />
        <Field label="Bank Address" value={form.bank_address || ""} onChange={v => setForm({ ...form, bank_address: v })} />
        <Field label="Currency" value={form.currency || "USD"} onChange={v => setForm({ ...form, currency: v })} />
        <Field label="USDT Wallet (optional)" value={form.usdt_wallet || ""} onChange={v => setForm({ ...form, usdt_wallet: v })} />
        <Field label="USDT Network" value={form.usdt_network || ""} onChange={v => setForm({ ...form, usdt_network: v })} placeholder="TRC20" />
        <div className="col-span-2 flex gap-2">
          <button onClick={submit} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm">{editingId ? "Update" : "+ Add Bank Account"}</button>
          {editingId && <button onClick={() => { setEditingId(null); setForm({ currency: "USD" }); }} className="border px-4 py-2 rounded-lg text-sm">Cancel</button>}
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr>
            <th className="text-left px-4 py-3">Holder / Bank</th><th className="text-left px-4 py-3">Account</th><th className="text-left px-4 py-3">IBAN / SWIFT</th><th className="text-left px-4 py-3">Currency</th><th className="text-left px-4 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} className="border-b hover:bg-slate-50">
                <td className="px-4 py-3"><span className="font-medium">{a.account_holder_name || "—"}</span><br/><span className="text-xs text-slate-400">{a.bank_name || ""}</span></td>
                <td className="px-4 py-3 font-mono text-xs">{a.account_number || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{a.iban || "—"}<br/>{a.swift_bic || ""}</td>
                <td className="px-4 py-3 text-xs">{a.currency}</td>
                <td className="px-4 py-3"><button onClick={() => { setEditingId(a.id); setForm(a); }} className="text-blue-600 hover:underline text-xs mr-2">Edit</button><button onClick={() => del(a.id)} className="text-red-600 hover:underline text-xs">Delete</button></td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">No bank accounts yet — add one to show payment details on invoices.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvoiceTab() {
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/invoice-settings").then(r => r.json());
    setSettings(r.settings);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!settings) return <p className="text-slate-400 text-sm">Loading…</p>;

  const save = async () => {
    const res = await fetch("/api/tenant/invoice-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    if (!res.ok) { alert("Failed to save"); return; }
    setMsg("Saved"); setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="bg-white rounded-xl border p-6 shadow-sm max-w-2xl space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Currency" value={settings.currency} onChange={v => setSettings({ ...settings, currency: v })} />
        <Field label="Timezone" value={settings.timezone} onChange={v => setSettings({ ...settings, timezone: v })} />
        <Field label="Tax Rate (%)" type="number" value={String(settings.taxRate)} onChange={v => setSettings({ ...settings, taxRate: parseFloat(v) || 0 })} />
        <Field label="Payment Due (days)" type="number" value={String(settings.dueDays)} onChange={v => setSettings({ ...settings, dueDays: parseInt(v) || 15 })} />
        <Field label="Invoice Prefix" value={settings.invoicePrefix} onChange={v => setSettings({ ...settings, invoicePrefix: v })} />
        <Field label="Next Invoice Number" type="number" value={String(settings.nextInvoiceNumber)} onChange={v => setSettings({ ...settings, nextInvoiceNumber: parseInt(v) || 1000 })} />
      </div>
      <div className="space-y-2">
        <Toggle label="Auto-email invoices on generation" checked={settings.autoEmailInvoice} onChange={v => setSettings({ ...settings, autoEmailInvoice: v })} />
        <Toggle label="Notify on rate change / new rate" checked={settings.notifyRateChange} onChange={v => setSettings({ ...settings, notifyRateChange: v })} />
        <Toggle label="Low-balance alerts for clients" checked={settings.notifyLowBalance} onChange={v => setSettings({ ...settings, notifyLowBalance: v })} />
        <Toggle label="Auto-send welcome email on new client/supplier" checked={settings.welcomeEmailAuto} onChange={v => setSettings({ ...settings, welcomeEmailAuto: v })} />
      </div>
      <button onClick={save} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm">{msg || "Save Settings"}</button>
    </div>
  );
}

function ScheduleTab() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [form, setForm] = useState({ name: "", frequency: "weekly", dayOfWeek: "1", dayOfMonth: "1", intervalDays: "", scope: "all", periodDays: "7" });

  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/invoice-schedules").then(r => r.json());
    setSchedules(r.schedules || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    await fetch("/api/tenant/invoice-schedules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, frequency: form.frequency,
        dayOfWeek: parseInt(form.dayOfWeek) || 1, dayOfMonth: parseInt(form.dayOfMonth) || 1,
        intervalDays: form.intervalDays ? parseInt(form.intervalDays) : null,
        scope: form.scope, periodDays: parseInt(form.periodDays) || 7,
      }),
    });
    load();
  };

  const toggle = async (s: Schedule) => {
    await fetch(`/api/tenant/invoice-schedules/${s.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...s, isActive: !s.is_active }) });
    load();
  };
  const del = async (id: number) => {
    await fetch(`/api/tenant/invoice-schedules/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-6 shadow-sm max-w-2xl grid grid-cols-2 gap-4">
        <Field label="Schedule Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Weekly — Every Monday" />
        <div>
          <label className="block text-sm font-medium mb-1">Frequency</label>
          <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom (interval days)</option>
          </select>
        </div>
        {form.frequency === "weekly" && (
          <div>
            <label className="block text-sm font-medium mb-1">Day of Week</label>
            <select value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
              {DAYS.map((d, i) => i > 0 && <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
        )}
        {form.frequency === "monthly" && <Field label="Day of Month" type="number" value={form.dayOfMonth} onChange={v => setForm({ ...form, dayOfMonth: v })} />}
        {form.frequency === "custom" && <Field label="Interval (days)" type="number" value={form.intervalDays} onChange={v => setForm({ ...form, intervalDays: v })} />}
        <Field label="Billing Period (days)" type="number" value={form.periodDays} onChange={v => setForm({ ...form, periodDays: v })} />
        <button onClick={submit} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm self-end">+ Add Schedule</button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr>
            <th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Frequency</th><th className="text-left px-4 py-3">Period</th><th className="text-left px-4 py-3">Last Run</th><th className="text-left px-4 py-3">Active</th><th className="text-left px-4 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {schedules.map(s => (
              <tr key={s.id} className="border-b hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-xs capitalize">{s.frequency}{s.frequency === "weekly" ? ` (${DAYS[s.day_of_week] || "Monday"})` : s.frequency === "monthly" ? ` (day ${s.day_of_month})` : s.interval_days ? ` (every ${s.interval_days}d)` : ""}</td>
                <td className="px-4 py-3 text-xs">{s.period_days} days</td>
                <td className="px-4 py-3 text-xs text-slate-400">{s.last_run_at ? new Date(s.last_run_at).toLocaleDateString() : "Never"}</td>
                <td className="px-4 py-3"><button onClick={() => toggle(s)} className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{s.is_active ? "Active" : "Inactive"}</button></td>
                <td className="px-4 py-3"><button onClick={() => del(s.id)} className="text-red-600 hover:underline text-xs">Delete</button></td>
              </tr>
            ))}
            {schedules.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">No schedules yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full border rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-blue-600" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
