"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useColumnFilters, FilterRow, FilterToggle, type ColumnFilterDef } from "@/components/column-filters";

interface Invoice {
  id: number; client_id: number; client_name: string; invoice_number: string;
  amount: string; tax: string; total_amount: string; status: string;
  period_start: string; period_end: string; due_date: string; notes: string | null;
  created_at: string; created_by: string; created_for_type: string; created_for_name: string;
  supplier_name?: string;
}
interface Client { id: number; name: string; }
interface Supplier { id: number; name: string; }

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"client"|"supplier">("client");
  const [form, setForm] = useState({ clientId: "", supplierId: "", periodStart: "", periodEnd: "", taxRate: "0", notes: "" });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [ir, cr, sr] = await Promise.all([
      fetch("/api/tenant/invoices").then(r => r.json()),
      fetch("/api/tenant/clients").then(r => r.json()),
      fetch("/api/tenant/suppliers").then(r => r.json()),
    ]);
    setInvoices(ir.invoices || []);
    setClients(cr.clients || []);
    setSuppliers(sr.suppliers || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/tenant/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: tab === "client" ? parseInt(form.clientId) : undefined,
        supplierId: tab === "supplier" ? parseInt(form.supplierId) : undefined,
        periodStart: new Date(form.periodStart).toISOString(),
        periodEnd: new Date(form.periodEnd).toISOString(),
        taxRate: parseFloat(form.taxRate),
        notes: form.notes,
        createdForType: tab,
      }),
    });
    const data = await res.json();
    setShowForm(false);
    setMsg(`Invoice ${data.invoice.invoice_number} generated for ${data.details.createdForName}`);
    setTimeout(() => setMsg(""), 4000);
    load();
  };

  const downloadCSV = (inv: Invoice) => {
    const csv = `Invoice Number,${inv.invoice_number}\nClient,${inv.client_name || inv.created_for_name}\nAmount,$${inv.amount}\nTax,$${inv.tax}\nTotal,$${inv.total_amount}\nPeriod,${new Date(inv.period_start).toLocaleDateString()} - ${new Date(inv.period_end).toLocaleDateString()}\nDue,${new Date(inv.due_date).toLocaleDateString()}\nStatus,${inv.status}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${inv.invoice_number}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const downloadSummary = (inv: Invoice) => {
    // Generate summary with MCC/MNC breakdown
    fetch(`/api/tenant/invoices/${inv.id}/mcc-summary`)
      .then(r => r.json())
      .then(data => {
        let csv = "MCC,Country,Network,Count,Cost\n";
        (data.summary || []).forEach((s: Record<string,unknown>) => {
          csv += `${s.mcc},${s.country},${s.network},${s.count},$${s.cost}\n`;
        });
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${inv.invoice_number}_mcc_summary.csv`; a.click(); URL.revokeObjectURL(url);
      })
      .catch(() => alert("No MCC data available yet"));
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/tenant/invoices/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  };

  const invoiceFilters: ColumnFilterDef[] = useMemo(() => [
    { key: "invoice_number", placeholder: "Invoice #..." },
    { key: "created_for_name", placeholder: "Client/Supplier..." },
    { key: "period_start", placeholder: "Period..." },
    { key: "amount", placeholder: "Amount..." },
    { key: "tax", placeholder: "Tax..." },
    { key: "total_amount", placeholder: "Total..." },
    { key: "status", placeholder: "Draft / Paid..." },
  ], []);
  const { values, set, toggle, showFilters, hasActive, filterData } = useColumnFilters(invoiceFilters);
  const activeFilterCount = useMemo(() => Object.values(values).filter(v => v.trim()).length, [values]);
  const filteredInvoices = useMemo(() => filterData(invoices), [invoices, filterData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Invoices</h2>
          <p className="text-sm text-slate-500">Generate invoices with MCC-based summary. Download PDF/Excel.</p>
        </div>
        <div className="flex items-center gap-3">
          <FilterToggle showFilters={showFilters} hasActive={hasActive} activeCount={activeFilterCount} onClick={toggle} />
          <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Generate Invoice</button>
        </div>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Generate Invoice</h3>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-4 w-64">
            <button onClick={() => setTab("client")} className={`flex-1 py-2 rounded text-sm ${tab==="client"?"bg-white shadow text-slate-800":"text-slate-500"}`}>Client</button>
            <button onClick={() => setTab("supplier")} className={`flex-1 py-2 rounded text-sm ${tab==="supplier"?"bg-white shadow text-slate-800":"text-slate-500"}`}>Supplier</button>
          </div>
          <form onSubmit={generateInvoice} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tab === "client" ? (
              <div><label className="block text-sm font-medium mb-1">Client *</label><select value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">Select Client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            ) : (
              <div><label className="block text-sm font-medium mb-1">Supplier *</label><select value={form.supplierId} onChange={e => setForm({...form, supplierId: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">Select Supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            )}
            <div><label className="block text-sm font-medium mb-1">Tax Rate (%)</label><input type="number" step="0.1" value={form.taxRate} onChange={e => setForm({...form, taxRate: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Period Start *</label><input type="date" value={form.periodStart} onChange={e => setForm({...form, periodStart: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Period End *</label><input type="date" value={form.periodEnd} onChange={e => setForm({...form, periodEnd: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div className="md:col-span-2 flex gap-2"><button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Generate Invoice</button><button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button></div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="px-5 py-3 text-left">Invoice #</th><th className="px-5 py-3 text-left">For</th><th className="px-5 py-3 text-left">Period</th><th className="px-5 py-3 text-left">Amount</th><th className="px-5 py-3 text-left">Tax</th><th className="px-5 py-3 text-left">Total</th><th className="px-5 py-3 text-left">Status</th><th className="px-5 py-3 text-left">Download</th></tr>
          {showFilters && <FilterRow filters={invoiceFilters} values={values} onChange={set} colSpan={1} />}
          </thead>
          <tbody>
            {filteredInvoices.map(inv => (
              <tr key={inv.id} className="border-b hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs">{inv.invoice_number}</td>
                <td className="px-5 py-3 text-xs"><span className="font-medium">{inv.created_for_name || inv.client_name}</span><br/><span className="text-slate-400">{inv.created_for_type}</span></td>
                <td className="px-5 py-3 text-xs">{new Date(inv.period_start).toLocaleDateString()} — {new Date(inv.period_end).toLocaleDateString()}</td>
                <td className="px-5 py-3 font-mono">${parseFloat(inv.amount).toFixed(4)}</td>
                <td className="px-5 py-3 font-mono">${parseFloat(inv.tax || "0").toFixed(4)}</td>
                <td className="px-5 py-3 font-mono font-bold">${parseFloat(inv.total_amount).toFixed(4)}</td>
                <td className="px-5 py-3">
                  <select value={inv.status} onChange={e => updateStatus(inv.id, e.target.value)} className="border rounded px-2 py-1 text-xs">
                    <option value="DRAFT">Draft</option><option value="SENT">Sent</option><option value="PAID">Paid</option><option value="OVERDUE">Overdue</option><option value="CANCELLED">Cancelled</option>
                  </select>
                </td>
                <td className="px-5 py-3">
                  <button onClick={() => downloadCSV(inv)} className="text-blue-600 hover:underline text-xs mr-2">📥 CSV</button>
                  <button onClick={() => downloadSummary(inv)} className="text-purple-600 hover:underline text-xs">📊 MCC</button>
                </td>
              </tr>
            ))}
            {filteredInvoices.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">{hasActive ? "No invoices match your filters." : "No invoices yet."}</td></tr>}
          </tbody>
        </table>
        {hasActive && <div className="px-4 py-2 border-t bg-slate-50 text-xs text-slate-500">Showing {filteredInvoices.length} of {invoices.length} invoices</div>}
      </div>
    </div>
  );
}
