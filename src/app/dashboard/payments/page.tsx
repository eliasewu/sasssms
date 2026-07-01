"use client";

import { useState, useEffect, useCallback } from "react";

interface Payment { id: number; client_id: number; client_name?: string; amount: string; payment_method: string; status: string; created_at: string; }

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ clientId: "", amount: "", paymentMethod: "bank_transfer", notes: "" });
  const [clients, setClients] = useState<{id: number; name: string}[]>([]);

  const load = useCallback(async () => {
    const [pr, cr] = await Promise.all([
      fetch("/api/tenant/payments").then((r) => r.json()),
      fetch("/api/tenant/clients").then((r) => r.json()),
    ]);
    setPayments(pr.payments || []);
    setClients(cr.clients || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/tenant/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Payments</h2>
          <p className="text-sm text-slate-500">Record and track client payments</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Record Payment</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required className="border rounded-lg px-3 py-2 text-sm">
              <option value="">Select Client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required placeholder="Amount" className="border rounded-lg px-3 py-2 text-sm" />
            <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="border rounded-lg px-3 py-2 text-sm">
              <option value="bank_transfer">Bank Transfer</option>
              <option value="credit_card">Credit Card</option>
              <option value="paypal">PayPal</option>
              <option value="crypto">Cryptocurrency</option>
              <option value="cash">Cash</option>
            </select>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className="border rounded-lg px-3 py-2 text-sm" />
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-5 py-3">Date</th>
              <th className="text-left px-5 py-3">Client</th>
              <th className="text-left px-5 py-3">Amount</th>
              <th className="text-left px-5 py-3">Method</th>
              <th className="text-left px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b hover:bg-slate-50">
                <td className="px-5 py-3 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3">{clients.find((c) => c.id === p.client_id)?.name || p.client_id}</td>
                <td className="px-5 py-3 font-mono font-medium">${parseFloat(p.amount).toFixed(2)}</td>
                <td className="px-5 py-3">{p.payment_method?.replace("_", " ")}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${p.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{p.status}</span></td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No payments recorded.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
