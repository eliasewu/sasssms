"use client";

import { useState, useEffect, useCallback } from "react";

interface TenantInfo {
  companyName: string; email: string; packageType: string; balance: string;
  smsCounter: number; smsLimit: number; smsValidUntil: string | null;
  packageExpiresAt: string | null;
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
interface PackageInfo {
  id: number; name: string; description: string; price: string;
  monthlyFee: string; smsCredits: number; freeSmsPerMonth: boolean;
  requiresLicense: boolean; isActive: boolean; features: string[];
}

export default function BillingTopupPage() {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [tab, setTab] = useState<"topup" | "history">("topup");
  const [selectedPkg, setSelectedPkg] = useState<PackageInfo | null>(null);
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
    const [tr, pr, txr, pkr] = await Promise.all([
      fetch("/api/auth/me").then(r => r.json()),
      fetch("/api/tenant/payment-gateways").then(r => r.json()).catch(() => ({ gateways: [] })),
      fetch("/api/tenant/payment-transactions").then(r => r.json()).catch(() => ({ transactions: [] })),
      fetch("/api/public/settings").then(r => r.json()).catch(() => ({ packages: [] })),
    ]);
    if (tr.tenant) setTenant(tr.tenant);
    setGateways(pr.gateways || []);
    setTxns(txr.transactions || []);
    setPackages((pkr.packages || []).filter((p: PackageInfo) => p.isActive));
  }, []);

  useEffect(() => { load(); }, [load]);

  const calculateSms = (amount: number) => {
    const rate = parseFloat(tenant?.costPerSms || "0.00010");
    return Math.floor(amount / rate);
  };

  const selectPackage = (pkg: PackageInfo) => {
    setSelectedPkg(pkg);
    const monthlyFee = parseFloat(pkg.monthlyFee || "0");
    if (pkg.name === "Starter") {
      // Starter: pay-as-you-go, user picks amount (min $25)
      setTopupForm(prev => ({ ...prev, amount: "25", packageType: "starter" }));
    } else {
      // Professional/Enterprise: fixed monthly fee
      setTopupForm(prev => ({ ...prev, amount: monthlyFee.toString(), packageType: pkg.name.toLowerCase() }));
    }
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

  // Package card config
  const pkgIcons: Record<string, string> = { Starter: "🚀", Professional: "⚡", Enterprise: "🏢" };
  const pkgColors: Record<string, string> = {
    Starter: "border-slate-200 hover:border-blue-400",
    Professional: "border-blue-200 hover:border-blue-500 bg-blue-50/30",
    Enterprise: "border-purple-200 hover:border-purple-500 bg-purple-50/30",
  };
  const pkgSelectedColors: Record<string, string> = {
    Starter: "border-blue-500 bg-blue-50 ring-2 ring-blue-200",
    Professional: "border-blue-500 bg-blue-50 ring-2 ring-blue-200",
    Enterprise: "border-purple-500 bg-purple-50 ring-2 ring-purple-200",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Billing & Top-Up</h2>
        <p className="text-sm text-slate-500">Choose a package or top up your SMS balance</p>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}

      {/* Account Status */}
      {tenant && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <p className="text-sm text-slate-500">Current Package</p>
            <p className="text-2xl font-bold text-slate-800 capitalize">{tenant.packageType}</p>
            {isProfessionalOrEnterprise && (
              <p className="text-sm text-blue-600 mt-1">${tenant.monthlyFee || (tenant.packageType === "professional" ? "150" : "400")}/month - SMS included</p>
            )}
            {tenant.packageType === "starter" && (
              <p className="text-sm text-slate-500 mt-1">Pay-as-you-go • ${parseFloat(tenant.costPerSms || "0.00010").toFixed(5)}/SMS</p>
            )}
          </div>
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <p className="text-sm text-slate-500">SMS Credits</p>
            <p className="text-2xl font-bold text-slate-800">{tenant.smsLimit > 0 ? `${Math.max(0, tenant.smsLimit - tenant.smsCounter).toLocaleString()}` : "Unlimited"}</p>
            <p className="text-xs text-slate-500 mt-1">
              {tenant.smsLimit > 0 ? `remaining of ${tenant.smsLimit.toLocaleString()} total` : "Enterprise — no credit limit"}
            </p>
            {tenant.smsLimit > 0 && (
              <div className="mt-2 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${Math.min(100, (tenant.smsCounter / tenant.smsLimit) * 100)}%` }}></div>
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <p className="text-sm text-slate-500">Validity</p>
            {isProfessionalOrEnterprise ? (
              <>
                <p className="text-xl font-bold text-slate-800">
                  {tenant.packageExpiresAt ? new Date(tenant.packageExpiresAt).toLocaleDateString() : "Active"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {tenant.packageExpiresAt && new Date(tenant.packageExpiresAt) < new Date()
                    ? "⚠️ Subscription expired — Renew now"
                    : "Monthly subscription — renews automatically"}
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-slate-800">{tenant.smsValidUntil ? new Date(tenant.smsValidUntil).toLocaleDateString() : "N/A"}</p>
                <p className="text-xs text-slate-500 mt-1">6 months from last recharge</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button onClick={() => setTab("topup")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium ${tab === "topup" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>Top-Up / Buy Package</button>
        <button onClick={() => setTab("history")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium ${tab === "history" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>Payment History</button>
      </div>

      {tab === "topup" && (
        <>
          {/* ── Package Selection Cards ── */}
          <div>
            <h3 className="font-semibold text-lg mb-4">📦 Choose a Package</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {packages.map(pkg => {
                const isSelected = selectedPkg?.id === pkg.id;
                const isCurrent = tenant?.packageType === pkg.name.toLowerCase();
                const monthlyFee = parseFloat(pkg.monthlyFee || "0");
                return (
                  <div
                    key={pkg.id}
                    className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all duration-200 shadow-sm
                      ${isSelected ? pkgSelectedColors[pkg.name] || "border-blue-500 bg-blue-50 ring-2 ring-blue-200" : pkgColors[pkg.name] || "border-slate-200 hover:border-blue-400"}
                    `}
                    onClick={() => selectPackage(pkg)}
                  >
                    {isCurrent && (
                      <span className="absolute top-3 right-3 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">Current</span>
                    )}
                    {isSelected && !isCurrent && (
                      <span className="absolute top-3 right-3 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">Selected</span>
                    )}
                    <div className="text-3xl mb-2">{pkgIcons[pkg.name] || "📦"}</div>
                    <h4 className="font-bold text-lg text-slate-800">{pkg.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5 mb-3">{pkg.description}</p>
                    
                    {/* Pricing */}
                    <div className="mb-3">
                      {monthlyFee > 0 ? (
                        <div>
                          <p className="text-2xl font-bold text-slate-800">${monthlyFee}<span className="text-sm font-normal text-slate-500">/mo</span></p>
                          {pkg.smsCredits > 0 && (
                            <p className="text-xs text-green-600 font-medium mt-0.5">✓ {(pkg.smsCredits / 1000000).toFixed(0)}M SMS included/month</p>
                          )}
                          {pkg.freeSmsPerMonth && pkg.smsCredits === 0 && (
                            <p className="text-xs text-green-600 font-medium mt-0.5">✓ Unlimited SMS included</p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p className="text-2xl font-bold text-green-600">Free</p>
                          <p className="text-xs text-slate-500">Pay only for SMS you send</p>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-1 mb-4">
                      {(pkg.features || []).slice(0, 5).map((f: string, i: number) => (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                      {(pkg.features || []).length > 5 && (
                        <li className="text-xs text-slate-400 pl-5">+{(pkg.features || []).length - 5} more features</li>
                      )}
                    </ul>
                  </div>
                );
              })}
              {packages.length === 0 && (
                <div className="col-span-3 bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-amber-700">No packages available. Please contact admin.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Top-Up / Purchase Form ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top-Up Form */}
            <div className="bg-white rounded-xl border p-6 shadow-sm">
              <h3 className="font-semibold mb-4">
                {selectedPkg && selectedPkg.name !== "Starter"
                  ? `Subscribe to ${selectedPkg.name}`
                  : "Top-Up SMS Balance"}
              </h3>

              {!selectedPkg && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-amber-700">👆 Select a package above to get started.</p>
                </div>
              )}

              {selectedPkg && selectedPkg.name === "Starter" && (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-4 mb-4 text-white">
                  <p className="text-sm text-blue-100">SMS Gateway Rate</p>
                  <p className="text-2xl font-bold">${tenant?.costPerSms || "0.00010"}/SMS</p>
                  <p className="text-xs text-blue-200 mt-1">{Math.floor(1 / parseFloat(tenant?.costPerSms || "0.00010")).toLocaleString()} SMS per $1.00</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white/20 rounded p-1.5"><strong>$25</strong><br/>{Math.floor(25 / parseFloat(tenant?.costPerSms || "0.00010")).toLocaleString()} SMS</div>
                    <div className="bg-white/20 rounded p-1.5"><strong>$50</strong><br/>{Math.floor(50 / parseFloat(tenant?.costPerSms || "0.00010")).toLocaleString()} SMS</div>
                    <div className="bg-white/20 rounded p-1.5"><strong>$100</strong><br/>{Math.floor(100 / parseFloat(tenant?.costPerSms || "0.00010")).toLocaleString()} SMS</div>
                  </div>
                  <p className="text-xs text-blue-200 mt-2">Cumulative: $25 + $50 = {Math.floor(75 / parseFloat(tenant?.costPerSms || "0.00010")).toLocaleString()} SMS total</p>
                </div>
              )}

              {selectedPkg && selectedPkg.name === "Professional" && (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-4 mb-4 text-white">
                  <p className="text-sm text-blue-100">Professional Plan</p>
                  <p className="text-2xl font-bold">$150/month</p>
                  <p className="text-xs text-blue-200 mt-1">10 Million SMS included per month</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-white/20 rounded p-1.5"><strong>200 TPS</strong><br/>Throughput</div>
                    <div className="bg-white/20 rounded p-1.5"><strong>SMPP + Voice</strong><br/>All features</div>
                  </div>
                </div>
              )}

              {selectedPkg && selectedPkg.name === "Enterprise" && (
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-4 mb-4 text-white">
                  <p className="text-sm text-purple-100">Enterprise Plan</p>
                  <p className="text-2xl font-bold">$399/month</p>
                  <p className="text-xs text-purple-200 mt-1">Unlimited SMS • All features • SLA guarantee</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-white/20 rounded p-1.5"><strong>Unlimited TPS</strong><br/>Throughput</div>
                    <div className="bg-white/20 rounded p-1.5"><strong>24/7 Support</strong><br/>White-label</div>
                  </div>
                </div>
              )}

              {selectedPkg && (
                <>
                  {activeGateways.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-amber-700">No payment gateways configured yet. Contact admin.</p>
                    </div>
                  )}

                  <form onSubmit={handleTopup} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {selectedPkg.name === "Starter" ? "Top-Up Amount ($) *" : "Payment Amount ($) *"}
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.01"
                          min={selectedPkg.name === "Starter" ? "25" : parseFloat(selectedPkg.monthlyFee || "0")}
                          value={topupForm.amount}
                          onChange={e => setTopupForm(prev => ({...prev, amount: e.target.value}))}
                          required
                          className={`flex-1 border rounded-lg px-3 py-2 text-lg font-bold ${selectedPkg.name !== "Starter" ? "bg-slate-100 cursor-not-allowed text-slate-600" : ""}`}
                          readOnly={selectedPkg.name !== "Starter"}
                        />
                        {selectedPkg.name === "Starter" ? (
                          <span className="text-sm text-slate-500 whitespace-nowrap">~ {calculateSms(parseFloat(topupForm.amount) || 0).toLocaleString()} SMS</span>
                        ) : (
                          <span className="text-sm text-blue-600 whitespace-nowrap font-medium">Monthly fee</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {selectedPkg.name === "Starter" ? "Minimum: $25.00" : "Fixed monthly subscription"}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Payment Method *</label>
                      <div className="grid grid-cols-2 gap-2">
                        {activeGateways.map(gw => {
                          const icons: Record<string, string> = { stripe: "💳", usdt_trc20: "₮", usdt_erc20: "₮", btc: "₿", usdc: "🪙", bnb: "🟡", eth: "⟠", trx: "🔷" };
                          return (
                            <label key={gw.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${parseInt(topupForm.gatewayId) === gw.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                              <input type="radio" name="gateway" checked={parseInt(topupForm.gatewayId) === gw.id} onChange={() => setTopupForm({...topupForm, gatewayId: gw.id.toString()})} className="accent-blue-600" />
                              <span>{icons[gw.method] || "💰"}</span>
                              <span className="text-sm">{gw.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {selectedPkg.name !== "Starter" && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs text-amber-700">
                          <strong>Monthly subscription:</strong> Your {selectedPkg.name} plan will activate after payment approval. 
                          Billed monthly at ${selectedPkg.monthlyFee}. SMS credits reset each billing cycle.
                        </p>
                      </div>
                    )}

                    {selectedPkg.name === "Starter" && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-xs text-green-700">
                          <strong>6-month validity:</strong> SMS credits are valid for 6 months from purchase. 
                          Recharging within the validity period carries forward your remaining balance.
                        </p>
                      </div>
                    )}

                    <button type="submit" disabled={!topupForm.gatewayId || activeGateways.length === 0} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 hover:bg-blue-700">
                      Continue to Payment
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Quick Amounts / Info */}
            <div className="bg-white rounded-xl border p-6 shadow-sm">
              {selectedPkg && selectedPkg.name === "Starter" ? (
                <>
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
                </>
              ) : (
                <>
                  <h3 className="font-semibold mb-4">Plan Comparison</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="py-2 text-slate-500 font-medium">Feature</th>
                          <th className="py-2 text-slate-500 font-medium">Starter</th>
                          <th className="py-2 text-slate-500 font-medium">Professional</th>
                          <th className="py-2 text-slate-500 font-medium">Enterprise</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { f: "Monthly Fee", s: "Free", p: "$150/mo", e: "$399/mo" },
                          { f: "SMS Volume", s: "Pay-as-you-go", p: "10M included", e: "Unlimited" },
                          { f: "TPS Limit", s: "50", p: "200", e: "Unlimited" },
                          { f: "SMPP Support", s: "✓", p: "✓", e: "✓" },
                          { f: "Voice OTP", s: "—", p: "✓", e: "✓" },
                          { f: "RCS & OTT", s: "—", p: "—", e: "✓" },
                          { f: "White-Label", s: "—", p: "—", e: "✓" },
                          { f: "Support", s: "Email", p: "Priority", e: "24/7 SLA" },
                        ].map((row, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1.5 text-slate-700 font-medium">{row.f}</td>
                            <td className="py-1.5 text-slate-600">{row.s}</td>
                            <td className="py-1.5 text-blue-700 font-medium">{row.p}</td>
                            <td className="py-1.5 text-purple-700 font-medium">{row.e}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="mt-6 bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">SMS Validity Policy</h4>
                <ul className="text-xs text-slate-600 space-y-1">
                  <li><strong>Starter (Pay-as-you-go):</strong> SMS credits valid for <strong>6 months</strong> from purchase</li>
                  <li><strong>Starter Carry-Forward:</strong> Recharge within 6 months — remaining credits carry forward</li>
                  <li><strong>Minimum top-up:</strong> $25.00 for Starter plan</li>
                  <li><strong>Professional:</strong> $150/month with 10M SMS included</li>
                  <li><strong>Enterprise:</strong> $399/month with unlimited SMS + all features</li>
                  <li><strong>Upgrade anytime:</strong> Switch plans — unused credits preserved</li>
                </ul>
              </div>
            </div>
          </div>
        </>
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
                  <td className="px-5 py-3 capitalize">{tx.package_type || "—"}</td>
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
                  <span className="capitalize font-medium">{topupForm.packageType}</span>
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
                  ? "Payment will be confirmed automatically."
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
