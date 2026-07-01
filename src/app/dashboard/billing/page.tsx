"use client";

import { useState, useEffect, useCallback } from "react";

interface TenantInfo {
  companyName: string; email: string; packageType: string; balance: string;
  smsCounter: number; smsLimit: number; smsValidUntil: string | null;
  lastRechargeAt: string | null; lastRechargeAmount: string | null;
  costPerSms: string; monthlyFee?: string;
}
interface PaymentGateway {
  id: number; method: string; label: string; is_active: boolean;
  qr_code_url: string | null; wallet_address: string | null;
  network: string | null; min_amount: string;
}
interface Transaction {
  id: number; amount: string; payment_method: string; status: string;
  package_type: string | null; sms_amount: number; created_at: string;
  metadata?: Record<string, unknown> | string | null;
}

export default function BillingTopupPage() {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<"topup" | "history">("topup");
  const [topupForm, setTopupForm] = useState({ gatewayId: "", amount: "25", packageType: "" });
  const [showPayment, setShowPayment] = useState(false);
  const [selectedGw, setSelectedGw] = useState<PaymentGateway | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [smsEstimate, setSmsEstimate] = useState(0);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [tr, pr, txr] = await Promise.all([
      fetch("/api/auth/me").then(r => r.json()),
      fetch("/api/tenant/payment-gateways").then(r => r.json()).catch(() => ({ gateways: [] })),
      fetch("/api/tenant/payment-transactions").then(r => r.json()).catch(() => ({ transactions: [] })),
    ]);
    if (tr.tenant) setTenant(tr.tenant);
    setGateways(pr.gateways || []);
    setTxns(txr.transactions || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const calculateSms = (amount: number) => {
    const rate = parseFloat(tenant?.costPerSms || "0.00025");
    return Math.floor(amount / rate);
  };

  const handleTopup = (e: React.FormEvent) => {
    e.preventDefault();
    const gw = gateways.find(g => g.id === parseInt(topupForm.gatewayId));
    if (!gw) return alert("Select a payment gateway");
    setSelectedGw(gw);
    setProofFile(null);
    setProofPreview(null);
    setPaymentAmount(parseFloat(topupForm.amount));
    setSmsEstimate(calculateSms(parseFloat(topupForm.amount)));
    setShowPayment(true);
  };

  const confirmPayment = async () => {
    setUploading(true);
    
    // Upload proof file if selected (for crypto/manual payments)
    let proofUrl: string | null = null;
    if (proofFile) {
      try {
        const fd = new FormData();
        fd.append("proof", proofFile);
        const uploadRes = await fetch("/api/tenant/upload-payment-proof", { method: "POST", body: fd });
        const uploadData = await uploadRes.json();
        if (uploadData.url) proofUrl = uploadData.url;
      } catch { /* proceed without proof */ }
    }

    const res = await fetch("/api/tenant/payment-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: paymentAmount,
        paymentMethod: selectedGw?.method,
        gatewayId: selectedGw?.id,
        packageType: topupForm.packageType || null,
        smsAmount: smsEstimate,
        proofUrl,
      }),
    });
    const data = await res.json();
    
    setShowPayment(false);
    setProofFile(null);
    setProofPreview(null);
    setUploading(false);
    setMsg(data.status === "PENDING_CONFIRMATION" 
      ? "Payment submitted with proof! Awaiting admin approval."
      : "Payment submitted! Awaiting confirmation.");
    setTimeout(() => setMsg(""), 4000);
    load();
  };

  const isProfessionalOrEnterprise = tenant?.packageType === "professional" || tenant?.packageType === "enterprise";
  const activeGateways = gateways.filter(g => g.is_active);
  const minAmount = selectedGw ? parseFloat(selectedGw.min_amount || "25") : 25;
  const validityText = tenant?.smsValidUntil
    ? `Valid until: ${new Date(tenant.smsValidUntil).toLocaleDateString()}`
    : "No active SMS balance";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Billing & Top-Up</h2>
        <p className="text-sm text-slate-500">Manage your SMS balance, packages, and payments</p>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}

      {/* Account Status */}
      {tenant && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <p className="text-sm text-slate-500">Package</p>
            <p className="text-2xl font-bold text-slate-800 capitalize">{tenant.packageType}</p>
            {isProfessionalOrEnterprise && (
              <p className="text-sm text-blue-600 mt-1">${tenant.monthlyFee || (tenant.packageType === "professional" ? "150" : "400")}/month - SMS included</p>
            )}
          </div>
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <p className="text-sm text-slate-500">SMS Balance</p>
            <p className="text-2xl font-bold text-slate-800">{tenant.smsLimit > 0 ? `${tenant.smsCounter.toLocaleString()} / ${tenant.smsLimit.toLocaleString()}` : `${tenant.smsCounter.toLocaleString()}`}</p>
            <p className="text-xs text-slate-500 mt-1">{tenant.smsLimit > 0 ? `${((tenant.smsCounter / tenant.smsLimit) * 100).toFixed(1)}% used` : "Pay-as-you-go"}</p>
          </div>
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <p className="text-sm text-slate-500">Validity</p>
            <p className="text-xl font-bold text-slate-800">{tenant.smsValidUntil ? new Date(tenant.smsValidUntil).toLocaleDateString() : "N/A"}</p>
            <p className="text-xs text-slate-500 mt-1">3 months from last recharge</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button onClick={() => setTab("topup")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium ${tab === "topup" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>Top-Up / Buy Package</button>
        <button onClick={() => setTab("history")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium ${tab === "history" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>Payment History</button>
      </div>

      {tab === "topup" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top-Up Form */}
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Top-Up SMS Balance</h3>

            {isProfessionalOrEnterprise ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-700">
                  <strong>{tenant?.packageType === "professional" ? "Professional" : "Enterprise"} Plan:</strong> Monthly fee covers all SMS. 
                  Top-up adds credit for SMS validity extension only.
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  Monthly fee: ${tenant?.packageType === "professional" ? "150" : "400"}/month
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-slate-600">Rate: <strong>${tenant?.costPerSms || "0.00025"}/SMS</strong></p>
                <p className="text-xs text-slate-500 mt-1">Minimum top-up: $25 - Validity: 3 months</p>
              </div>
            )}

            {activeGateways.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-700">No payment gateways configured yet. Contact admin.</p>
              </div>
            )}

            <form onSubmit={handleTopup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Top-Up Amount ($) *</label>
                <div className="flex items-center gap-3">
                  <input type="number" step="0.01" min="25" value={topupForm.amount} onChange={e => setTopupForm({...topupForm, amount: e.target.value})} required className="flex-1 border rounded-lg px-3 py-2 text-lg font-bold" />
                  <span className="text-sm text-slate-500 whitespace-nowrap">~ {calculateSms(parseFloat(topupForm.amount) || 0).toLocaleString()} SMS</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Minimum: $25.00</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment Method *</label>
                <div className="grid grid-cols-2 gap-2">
                  {activeGateways.map(gw => {
                    const icons: Record<string, string> = { stripe: "C", usdt_trc20: "T", usdt_erc20: "T", btc: "B", usdc: "U", bnb: "N", eth: "E", trx: "X" };
                    return (
                      <label key={gw.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${parseInt(topupForm.gatewayId) === gw.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                        <input type="radio" name="gateway" checked={parseInt(topupForm.gatewayId) === gw.id} onChange={() => setTopupForm({...topupForm, gatewayId: gw.id.toString()})} className="accent-blue-600" />
                        <span>{icons[gw.method] || "?"}</span>
                        <span className="text-sm">{gw.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {isProfessionalOrEnterprise && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700">Monthly subscription must be active. Top-up extends SMS validity by 3 months.</p>
                </div>
              )}

              <button type="submit" disabled={!topupForm.gatewayId || activeGateways.length === 0} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 hover:bg-blue-700">
                Continue to Payment
              </button>
            </form>
          </div>

          {/* Quick Amounts */}
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Quick Top-Up</h3>
            <div className="grid grid-cols-3 gap-3">
              {[25, 50, 100, 250, 500, 1000].map(amt => (
                <button key={amt} onClick={() => setTopupForm({...topupForm, amount: amt.toString()})}
                  className={`border rounded-xl p-4 text-center hover:border-blue-500 transition ${parseFloat(topupForm.amount) === amt ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>
                  <p className="text-xl font-bold text-slate-800">${amt}</p>
                  <p className="text-xs text-slate-500 mt-1">~ {calculateSms(amt).toLocaleString()} SMS</p>
                </button>
              ))}
            </div>

            <div className="mt-6 bg-slate-50 rounded-lg p-4">
              <h4 className="font-medium text-sm mb-2">SMS Validity Policy</h4>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>- SMS credit valid for <strong>3 months</strong> from purchase date</li>
                <li>- Recharging extends validity by 3 months from recharge date</li>
                <li>- Minimum top-up amount: <strong>$25.00</strong></li>
                <li>- Unused credits expire after validity period</li>
                <li>- Professional/Enterprise: Monthly fee covers all SMS</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Tab */}
      {tab === "history" && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-left px-5 py-3">Amount</th>
                <th className="text-left px-5 py-3">Method</th>
                <th className="text-left px-5 py-3">SMS</th>
                <th className="text-left px-5 py-3">Package</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {txns.map(tx => {
                let meta: any = null;
                try { meta = tx.metadata ? (typeof tx.metadata === "string" ? JSON.parse(tx.metadata) : tx.metadata) : null; } catch { /* ignore */ }
                return (
                <tr key={tx.id} className="border-b hover:bg-slate-50">
                  <td className="px-5 py-3 text-xs">{new Date(tx.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 font-mono font-bold">${parseFloat(tx.amount).toFixed(2)}</td>
                  <td className="px-5 py-3">{tx.payment_method}</td>
                  <td className="px-5 py-3">{tx.sms_amount.toLocaleString()}</td>
                  <td className="px-5 py-3 capitalize">{tx.package_type || "-"}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        tx.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                        tx.status === "PENDING" || tx.status === "PENDING_CONFIRMATION" || tx.status === "PENDING_STRIPE" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                      }`}>{tx.status}</span>
                      {meta?.proofUrl && (
                        <a href={meta.proofUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:text-blue-700 underline" title="View payment proof">
                          View Proof
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
              {txns.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No payments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && selectedGw && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPayment(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-xl mb-4">Complete Payment</h3>

            <div className="bg-slate-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-slate-500">Amount:</span>
                <span className="font-bold text-lg">${paymentAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SMS:</span>
                <span className="font-bold">{smsEstimate.toLocaleString()} SMS</span>
              </div>
              {topupForm.packageType && (
                <div className="flex justify-between mt-1">
                  <span className="text-slate-500">Package:</span>
                  <span className="capitalize">{topupForm.packageType}</span>
                </div>
              )}
            </div>

            {/* Stripe */}
            {selectedGw.method === "stripe" ? (
              <div className="border rounded-lg p-4 mb-4">
                <p className="text-center text-slate-500 mb-3">Stripe Payment Integration</p>
                <div className="bg-slate-100 rounded p-4 text-center">
                  <input placeholder="Card Number: 4242 4242 4242 4242" className="w-full border rounded px-3 py-2 mb-2 text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="MM/YY" className="border rounded px-3 py-2 text-sm" />
                    <input placeholder="CVC" className="border rounded px-3 py-2 text-sm" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">Test mode - no real charge</p>
              </div>
            ) : (
              /* Crypto */
              <>
              <div className="border rounded-lg p-4 mb-4 text-center">
                <p className="text-sm text-slate-600 mb-3">
                  Send <strong>${paymentAmount.toFixed(2)}</strong> to:
                </p>
                {selectedGw.qr_code_url ? (
                  <img src={selectedGw.qr_code_url} alt="QR" className="w-48 h-48 mx-auto border rounded-lg object-cover mb-3" />
                ) : (
                  <div className="w-48 h-48 mx-auto border rounded-lg flex items-center justify-center text-slate-300 text-sm mb-3">
                    QR Code
                  </div>
                )}
                {selectedGw.wallet_address && (
                  <div className="bg-slate-100 rounded p-2">
                    <p className="text-xs font-mono truncate">{selectedGw.wallet_address}</p>
                    <p className="text-xs text-slate-500 mt-1">Network: {selectedGw.network || selectedGw.method}</p>
                  </div>
                )}
              </div>

              {/* Payment Proof Upload for Crypto */}
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 mb-4 hover:border-blue-400 transition">
                <p className="text-sm font-medium text-slate-700 mb-2">Upload Payment Receipt</p>
                <p className="text-xs text-slate-500 mb-3">Attach a screenshot or PDF of your transfer confirmation</p>
                
                {proofPreview ? (
                  <div className="relative mb-2">
                    {proofFile?.type?.startsWith("image/") ? (
                      <img src={proofPreview} alt="Proof preview" className="w-full max-h-48 object-contain rounded-lg border cursor-zoom-in" onClick={() => setLightboxOpen(true)} />
                    ) : (
                      <div className="bg-slate-50 rounded-lg border p-4 text-center">
                        <span className="text-3xl">PDF</span>
                        <p className="text-sm text-slate-600 mt-1">{proofFile?.name}</p>
                      </div>
                    )}
                    <button onClick={() => { setProofFile(null); setProofPreview(null); }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600">X</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-24 cursor-pointer bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                    <span className="text-2xl mb-1">Upload</span>
                    <span className="text-xs text-slate-500">Click to upload or drag and drop</span>
                    <span className="text-xs text-slate-400">PNG, JPEG, WebP, PDF - Max 10MB</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setProofFile(f);
                          if (f.type.startsWith("image/")) {
                            const reader = new FileReader();
                            reader.onload = ev => setProofPreview(ev.target?.result as string);
                            reader.readAsDataURL(f);
                          } else {
                            setProofPreview(f.name);
                          }
                        }
                      }} className="hidden" />
                  </label>
                )}
                {proofFile && (
                  <div className="flex items-center justify-between bg-blue-50 rounded px-2 py-1 mt-2">
                    <span className="text-xs text-blue-700 truncate flex-1">{proofFile.name} ({(proofFile.size / 1024).toFixed(1)} KB)</span>
                    <span className="text-xs text-blue-500 ml-2">Ready</span>
                  </div>
                )}
              </div>
              </>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-amber-700">
                {selectedGw.method === "stripe"
                  ? "Payment will be confirmed automatically. Validity: 3 months."
                  : "Crypto payments require admin approval. Upload your receipt above for faster verification."}
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={confirmPayment}
                disabled={uploading || (selectedGw.method !== "stripe" && !proofFile)}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {uploading ? "Uploading..." : "Confirm Payment"}
              </button>
              <button onClick={() => { setShowPayment(false); setProofFile(null); setProofPreview(null); }}
                className="flex-1 border py-3 rounded-lg font-medium hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Image Lightbox */}
      {lightboxOpen && proofPreview && proofFile?.type?.startsWith("image/") && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-8" onClick={() => setLightboxOpen(false)}>
          <img src={proofPreview} alt="Payment proof" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          <button onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg hover:bg-white/40">
            X
          </button>
        </div>
      )}
    </div>
  );
}
