"use client";

import { useState, useEffect, useCallback } from "react";

interface Transaction {
  id: number;
  tenant_id: number;
  company_name: string;
  tenant_email: string;
  amount: string;
  payment_method: string;
  status: string;
  package_type: string;
  sms_amount: number;
  transaction_id: string;
  notes: string;
  metadata: string | null;
  created_at: string;
}

export default function PaymentApprovalsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<"pending" | "completed" | "rejected">("pending");
  const [msg, setMsg] = useState("");
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const statusMap: Record<string, string> = {
      pending: "ALL_PENDING",
      completed: "COMPLETED",
      rejected: "REJECTED",
    };
    const r = await fetch(`/api/super/payment-approvals?status=${statusMap[tab]}`).then(r => r.json());
    setTransactions(r.transactions || []);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (txnId: number, action: "approve" | "reject") => {
    const res = await fetch("/api/super/payment-approvals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: txnId, action, reason: action === "reject" ? reasons[txnId] : undefined }),
    });
    const data = await res.json();
    setMsg(data.message || (res.ok ? "Done" : "Failed"));
    setTimeout(() => setMsg(""), 4000);
    setReasons(prev => { const n = { ...prev }; delete n[txnId]; return n; });
    load();
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-slate-100 text-slate-700",
      PENDING_CONFIRMATION: "bg-amber-100 text-amber-700",
      PENDING_STRIPE: "bg-blue-100 text-blue-700",
      COMPLETED: "bg-green-100 text-green-700",
      REJECTED: "bg-red-100 text-red-700",
    };
    return colors[s] || "bg-slate-100 text-slate-700";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Payment Approvals</h2>
        <p className="text-sm text-slate-500">Review and approve/reject tenant payments</p>
      </div>

      {msg && <div className={`px-4 py-3 rounded-lg text-sm ${msg.includes("approved") ? "bg-green-50 border border-green-200 text-green-700" : msg.includes("rejected") ? "bg-red-50 border border-red-200 text-red-700" : "bg-blue-50 border border-blue-200 text-blue-700"}`}>{msg}</div>}

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {(["pending", "completed", "rejected"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>
            {t === "pending" ? "⏳ Awaiting Approval" : t === "completed" ? "✅ Approved" : "❌ Rejected"}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">Tenant</th>
              <th className="text-left px-4 py-3">Amount</th>
              <th className="text-left px-4 py-3">Method</th>
              <th className="text-left px-4 py-3">SMS</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Proof</th>
              <th className="text-left px-4 py-3">Date</th>
              {tab === "pending" && <th className="text-left px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id} className="border-b hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">#{t.id}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{t.company_name || `Tenant #${t.tenant_id}`}</p>
                  <p className="text-xs text-slate-500">{t.tenant_email}</p>
                </td>
                <td className="px-4 py-3 font-mono font-bold">${parseFloat(t.amount).toFixed(2)}</td>
                <td className="px-4 py-3">{t.payment_method?.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">{t.sms_amount?.toLocaleString() || "—"}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge(t.status)}`}>{t.status}</span></td>
                <td className="px-4 py-3">
                  {(() => {
                    let meta: any = null;
                    try { meta = t.metadata ? (typeof t.metadata === "string" ? JSON.parse(t.metadata) : t.metadata) : null; } catch {}
                    if (meta?.proofUrl) {
                      const isImage = /\.(png|jpg|jpeg|webp|gif)$/i.test(meta.proofUrl);
                      if (isImage) {
                        return (
                          <img src={meta.proofUrl} alt="Payment proof"
                            onClick={() => setLightboxUrl(meta.proofUrl)}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            className="w-14 h-10 object-cover rounded border cursor-pointer hover:ring-2 hover:ring-blue-400 hover:scale-105 transition-all" />
                        );
                      }
                      return (
                        <a href={meta.proofUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline">
                          📄 View PDF
                        </a>
                      );
                    }
                    return <span className="text-xs text-slate-400">—</span>;
                  })()}
                </td>
                <td className="px-4 py-3 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                {tab === "pending" && (
                  <td className="px-4 py-3">
                    <div className="flex gap-2 items-center">
                      <button onClick={() => handleAction(t.id, "approve")} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium">Approve</button>
                      <input
                        value={reasons[t.id] || ""}
                        onChange={e => setReasons(prev => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder="Rejection reason..."
                        className="border rounded px-2 py-1 text-xs w-32"
                      />
                      <button onClick={() => handleAction(t.id, "reject")} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium">Reject</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan={tab === "pending" ? 9 : 8} className="px-4 py-8 text-center text-slate-400">No {tab} payments.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Lightbox for proof images */}
      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-8"
          onClick={() => setLightboxUrl(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setLightboxUrl(null); }}
          tabIndex={0}>
          <img src={lightboxUrl} alt="Payment proof" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          <button onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg transition">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
