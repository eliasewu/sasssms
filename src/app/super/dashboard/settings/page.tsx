"use client";

import { useState, useEffect, useCallback } from "react";

interface PaymentGateway {
  id: number; method: string; label: string; is_active: boolean;
  credentials: string; qr_code_url: string | null; wallet_address: string | null;
  network: string | null; min_amount: string;
}

const PAYMENT_METHODS = [
  { value: "stripe", label: "Stripe (Visa/Mastercard)", icon: "💳" },
  { value: "usdt_trc20", label: "USDT TRC20", icon: "₮" },
  { value: "btc", label: "Bitcoin (BTC)", icon: "₿" },
  { value: "usdc", label: "USDC", icon: "💲" },
  { value: "bnb", label: "BNB (BSC)", icon: "🟡" },
];

export default function SuperSettingsPage() {
  const [costPerSms, setCostPerSms] = useState("0.00010");
  const [smppIp, setSmppIp] = useState("0.0.0.0");
  const [secondaryIp, setSecondaryIp] = useState("");
  const [smppPort, setSmppPort] = useState("2775");
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGw, setEditingGw] = useState<PaymentGateway | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwChanging, setPwChanging] = useState(false);
  const [form, setForm] = useState({
    method: "stripe", label: "", credentials: "{}",
    qrCodeUrl: "", walletAddress: "", network: "", minAmount: "25",
  });
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const detectIp = async () => {
    try {
      const r = await fetch("https://api.ipify.org?format=text");
      const ip = await r.text();
      setSmppIp(ip.trim());
    } catch {
      setMsg("Could not auto-detect IP. Set manually.");
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const load = useCallback(async () => {
    const r = await fetch("/api/super/settings").then(r => r.json());
    if (r.settings?.globalCostPerSms) setCostPerSms(r.settings.globalCostPerSms);
    if (r.settings?.smppServerIp) setSmppIp(r.settings.smppServerIp);
    if (r.settings?.smppServerPort) setSmppPort(r.settings.smppServerPort);
    if (r.settings?.secondarySmppIp) setSecondaryIp(r.settings.secondarySmppIp);
    setGateways(r.payments || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Save all settings + auto-sync to all tenants
  const saveAllSettings = async () => {
    setSaving(true);
    const res = await fetch("/api/super/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        globalCostPerSms: costPerSms,
        smppServerIp: smppIp,
        smppServerPort: parseInt(smppPort),
        secondarySmppIp: secondaryIp,
        syncToAllTenants: true,  // ← triggers auto-sync
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setMsg(data.error || "Save failed"); return; }
    setMsg(data.message || `Settings saved. Synced to ${data.syncedCount || 0} tenants.`);
    setTimeout(() => setMsg(""), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    // Upload QR file if selected
    let qrUrl = form.qrCodeUrl;
    if (qrFile) {
      try {
        const fd = new FormData();
        fd.append("qr_image", qrFile);
        const uploadRes = await fetch("/api/super/upload-qr", { method: "POST", body: fd });
        const uploadData = await uploadRes.json();
        if (uploadData.url) {
          qrUrl = uploadData.url;
          setForm(prev => ({ ...prev, qrCodeUrl: qrUrl }));
        }
      } catch {
        setMsg("QR upload failed, using URL instead");
        setTimeout(() => setMsg(""), 3000);
      }
    }

    const credentials = form.method === "stripe"
      ? JSON.stringify({ publishableKey: (form as any).stripePublishableKey || "", secretKey: (form as any).stripeSecretKey || "" })
      : form.credentials;
    if (editingGw) {
      await fetch(`/api/super/settings?id=${editingGw.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: form.method, label: form.label, isActive: editingGw.is_active, credentials, qrCodeUrl: qrUrl || null, walletAddress: form.walletAddress || null, network: form.network || null, minAmount: form.minAmount }),
      });
    } else {
      await fetch("/api/super/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: form.method, label: form.label, isActive: true, credentials, qrCodeUrl: qrUrl || null, walletAddress: form.walletAddress || null, network: form.network || null, minAmount: form.minAmount }),
      });
    }
    setShowForm(false); setEditingGw(null); setQrFile(null); setQrPreview(null); setUploading(false); load();
  };

  const deleteGateway = async (id: number) => {
    if (!confirm("Delete gateway?")) return;
    await fetch(`/api/super/settings?id=${id}`, { method: "DELETE" });
    load();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwCurrent || !pwNew) {
      setMsg("Both fields are required");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    if (pwNew.length < 6) {
      setMsg("New password must be at least 6 characters");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    setPwChanging(true);
    try {
      const res = await fetch("/api/super/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Failed");
        setTimeout(() => setMsg(""), 4000);
        return;
      }
      setMsg("Password changed successfully!");
      setTimeout(() => setMsg(""), 4000);
      setShowPasswordChange(false);
      setPwCurrent("");
      setPwNew("");
    } catch {
      setMsg("Network error. Please try again.");
      setTimeout(() => setMsg(""), 4000);
    } finally {
      setPwChanging(false);
    }
  };

  const editGateway = (gw: PaymentGateway) => {
    setEditingGw(gw);
    let creds: Record<string, string> = {};
    try { creds = JSON.parse(gw.credentials || "{}"); } catch {}
    setForm({
      method: gw.method, label: gw.label, credentials: gw.credentials || "{}",
      qrCodeUrl: gw.qr_code_url || "", walletAddress: gw.wallet_address || "",
      network: gw.network || "", minAmount: gw.min_amount || "25",
    });
    if (gw.method === "stripe") {
      setForm(prev => ({ ...prev, ...{ stripePublishableKey: creds.publishableKey || "", stripeSecretKey: creds.secretKey || "" } as any }));
    }
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Platform Settings</h2>
        <p className="text-sm text-slate-500">All changes auto-sync to landing page and all tenants</p>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm ${
          msg.includes("successfully") || msg.includes("Settings saved")
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>{msg}</div>
      )}

      {/* Change Password Section */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-lg">🔒 Change Password</h3>
            <p className="text-sm text-slate-500">Update your super admin account password</p>
          </div>
          <button
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {showPasswordChange ? "Cancel" : "Change Password"}
          </button>
        </div>
        {showPasswordChange && (
          <form onSubmit={handleChangePassword} className="mt-4 p-4 bg-slate-50 rounded-xl border max-w-md space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                required
                minLength={6}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                placeholder="Min 6 characters"
              />
            </div>
            <button
              type="submit"
              disabled={pwChanging}
              className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition"
            >
              {pwChanging ? "Changing..." : "Update Password"}
            </button>
          </form>
        )}
      </div>

      {/* Global Cost Per SMS */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <h3 className="font-semibold text-lg mb-4">💰 Global SMS Rate</h3>
        <div className="flex items-center gap-4 max-w-lg">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Cost Per SMS ($)</label>
            <input type="number" step="0.000001" value={costPerSms} onChange={e => setCostPerSms(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-lg font-mono" />
          </div>
          <button onClick={saveAllSettings} disabled={saving} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 mt-6">
            {saving ? "Saving..." : "Save & Sync All"}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Saves to platform settings + auto-updates all tenants + landing page</p>
      </div>

      {/* SMPP Server Settings - Auto Detect */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <h3 className="font-semibold text-lg mb-4">🖥️ Default SMPP Server Settings</h3>
        <p className="text-sm text-slate-500 mb-4">Auto-syncs to all tenants when saved. Requires &quot;Save & Sync All&quot; button.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium mb-1">Primary Server IP</label>
            <div className="flex gap-2">
              <input value={smppIp} onChange={e => setSmppIp(e.target.value)} placeholder="0.0.0.0" className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono" />
              <button onClick={detectIp} className="bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-xs hover:bg-slate-200 whitespace-nowrap">🔄 Auto Detect</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Secondary IP (fallback)</label>
            <input value={secondaryIp} onChange={e => setSecondaryIp(e.target.value)} placeholder="Optional secondary IP" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">SMPP Port</label>
            <input type="number" value={smppPort} onChange={e => setSmppPort(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">SMPP Version</label>
            <select defaultValue="3.4" className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="3.3">3.3</option><option value="3.4">3.4 (Java 21)</option><option value="5.0">5.0</option>
            </select>
          </div>
        </div>
        <div className="mt-4 bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
          <strong>Clients connect to:</strong> {smppIp}:{smppPort} (SMPP v3.4, Java 21 ESME/SMSC compatible)
          {secondaryIp && <span> · Fallback: {secondaryIp}:{smppPort}</span>}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button onClick={saveAllSettings} disabled={saving}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold disabled:opacity-50 hover:bg-blue-700 shadow-lg">
          {saving ? "Saving & Syncing All Tenants..." : "💾 Save & Sync All Settings to All Tenants"}
        </button>
      </div>

      {/* Payment Gateways */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div><h3 className="font-semibold text-lg">💳 Payment Gateways</h3><p className="text-sm text-slate-500">Stripe API keys + crypto wallets</p></div>
          <button onClick={() => { setShowForm(true); setEditingGw(null); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add</button>
        </div>
        {showForm && (
          <div className="border rounded-xl p-5 mb-6 bg-slate-50">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Method</label>
                  <select value={form.method} onChange={e => setForm({...form, method: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium mb-1">Label</label><input value={form.label} onChange={e => setForm({...form, label: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              {form.method === "stripe" && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium mb-1">Publishable Key</label><input onChange={e => setForm({...form, credentials: JSON.stringify({publishableKey:e.target.value,secretKey:(form as any).stripeSecretKey||""})})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" /></div>
                  <div><label className="block text-sm font-medium mb-1">Secret Key</label><input type="password" onChange={e => setForm({...form, credentials: JSON.stringify({publishableKey:(form as any).stripePublishableKey||"",secretKey:e.target.value})})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" /></div>
                </div>
              )}
              {form.method !== "stripe" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm font-medium mb-1">Wallet Address</label><input value={form.walletAddress} onChange={e => setForm({...form, walletAddress: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" /></div>
                    <div><label className="block text-sm font-medium mb-1">QR Image URL</label><input value={form.qrCodeUrl} onChange={e => setForm({...form, qrCodeUrl: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                  </div>
                  <div className="border-t pt-3">
                    <label className="block text-sm font-medium mb-2">📎 Or Upload QR Image</label>
                    <div className="flex gap-3 items-start">
                      <label className="cursor-pointer bg-slate-100 text-xs px-4 py-2 rounded-lg hover:bg-slate-200 transition inline-block">
                        Choose File
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setQrFile(f);
                              const reader = new FileReader();
                              reader.onload = (ev) => setQrPreview(ev.target?.result as string);
                              reader.readAsDataURL(f);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      {qrFile && <span className="text-xs text-slate-600 mt-2">{qrFile.name} ({(qrFile.size / 1024).toFixed(1)} KB)</span>}
                    </div>
                    {qrPreview && (
                      <div className="mt-2 border rounded-lg p-2 inline-block bg-slate-50">
                        <img src={qrPreview} alt="QR Preview" className="h-24 w-24 object-contain rounded" />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex gap-2"><button type="submit" disabled={uploading} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm disabled:opacity-50">{uploading ? "Uploading..." : editingGw ? "Update" : "Add"}</button><button type="button" onClick={() => { setShowForm(false); setEditingGw(null); setQrFile(null); setQrPreview(null); }} className="border px-6 py-2 rounded-lg text-sm">Cancel</button></div>
            </form>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {gateways.map(gw => {
            const mi = PAYMENT_METHODS.find(m => m.value === gw.method);
            return (
              <div key={gw.id} className={`border rounded-lg p-4 ${gw.is_active ? "border-green-200" : "opacity-60"}`}>
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{mi?.icon} {gw.label || mi?.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${gw.is_active ? "bg-green-100 text-green-700" : "bg-slate-100"}`}>{gw.is_active ? "Active" : "Inactive"}</span>
                </div>
                {gw.wallet_address && <p className="text-xs font-mono truncate">{gw.wallet_address}</p>}
                <div className="flex gap-2 mt-2"><button onClick={() => editGateway(gw)} className="text-blue-600 hover:underline text-xs">Edit</button><button onClick={() => deleteGateway(gw.id)} className="text-red-600 hover:underline text-xs">Remove</button></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
        <strong>⚠️ Sync Behavior:</strong> When you save settings, all tenant SMPP server IPs, rates, and package prices auto-update. Landing page fetches dynamically via <code className="bg-amber-100 px-1 rounded text-xs">/api/public/settings</code>.
      </div>
    </div>
  );
}
