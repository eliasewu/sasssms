"use client";

import { useState, useEffect, useCallback } from "react";

interface Tenant {
  id: number; companyName: string; email: string; phone: string;
  schemaName: string; isActive: boolean; status: string; balance: string; packageType: string;
  smppEnabled: boolean; httpEnabled: boolean; rcsEnabled: boolean;
  flashSmsEnabled: boolean; voiceOtpEnabled: boolean; ottEnabled: boolean;
  businessApiEnabled: boolean; emailEnabled: boolean; autoRenewEnabled: boolean;
  smsCounter: number; smsLimit: number; smsValidUntil: string | null;
  packageExpiresAt: string | null;
  maxTps: number; maxConcurrentCalls: number; costPerSms: string; smppServerIp: string; smppServerPort: number;
  createdAt: string;
}

interface MccStat {
  mcc: string; country_code: string; country_name: string;
  total_msgs: number; delivered: number; failed: number;
  total_cost: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [mccModal, setMccModal] = useState<{tenantId:number;tenantName:string}|null>(null);
  const [mccStats, setMccStats] = useState<MccStat[]>([]);
  const [msg, setMsg] = useState("");
  const [resetModal, setResetModal] = useState<{email:string}|null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Tenant | null>(null);
  const [suspendConfirm, setSuspendConfirm] = useState<Tenant | null>(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<Tenant | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/super/tenants").then(r => r.json());
    setTenants(r.tenants || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (tenant: Tenant) => {
    await fetch(`/api/super/tenants/${tenant.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tenant),
    });
    setEditing(null);
    setMsg(`Tenant "${tenant.companyName}" updated`);
    setTimeout(() => setMsg(""), 3000);
    load();
  };

  const handleResetPassword = async () => {
    if (!resetModal || !newPassword) return;
    await fetch("/api/super/auth/reset-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetModal.email, newPassword, type: "tenant" }),
    });
    setResetModal(null); setNewPassword("");
    setMsg(`Password reset for ${resetModal.email}`);
    setTimeout(() => setMsg(""), 3000);
  };

  const viewMccTraffic = async (tenantId: number, tenantName: string) => {
    setMccModal({ tenantId, tenantName });
    const r = await fetch(`/api/super/mcc-traffic?tenantId=${tenantId}`).then(r => r.json());
    setMccStats(r.stats || []);
  };

  const toggleService = (tenant: Tenant, service: string) => {
    const updated = { ...tenant, [service]: !(tenant[service as keyof Tenant] as boolean) };
    setEditing(updated);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const res = await fetch(`/api/super/tenants/${deleteConfirm.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false, status: "inactive" }),
    });
    if (!res.ok) {
      setMsg("Failed to deactivate tenant");
      setTimeout(() => setMsg(""), 3000);
      setDeleteConfirm(null);
      return;
    }
    setDeleteConfirm(null);
    setMsg(`Tenant "${deleteConfirm.companyName}" deactivated`);
    setTimeout(() => setMsg(""), 3000);
    load();
  };

  const handleSuspend = async () => {
    if (!suspendConfirm) return;
    const res = await fetch(`/api/super/tenants/${suspendConfirm.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "suspended", isActive: false }),
    });
    if (!res.ok) {
      setMsg("Failed to suspend tenant");
      setTimeout(() => setMsg(""), 3000);
      setSuspendConfirm(null);
      return;
    }
    setSuspendConfirm(null);
    setMsg(`Tenant "${suspendConfirm.companyName}" suspended`);
    setTimeout(() => setMsg(""), 3000);
    load();
  };

  const handleUnsuspend = async (tenant: Tenant) => {
    await fetch(`/api/super/tenants/${tenant.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active", isActive: true }),
    });
    setMsg(`Tenant "${tenant.companyName}" reactivated`);
    setTimeout(() => setMsg(""), 3000);
    load();
  };

  const handleHardDelete = async () => {
    if (!hardDeleteConfirm) return;
    const res = await fetch(`/api/super/tenants/${hardDeleteConfirm.id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      setMsg("Failed to permanently delete tenant");
      setTimeout(() => setMsg(""), 3000);
      setHardDeleteConfirm(null);
      return;
    }
    setHardDeleteConfirm(null);
    setMsg(`Tenant "${hardDeleteConfirm.companyName}" permanently deleted`);
    setTimeout(() => setMsg(""), 3000);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Tenant Management</h2>
        <p className="text-sm text-slate-500">{tenants.length} tenants registered</p>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex justify-between z-10">
              <h3 className="font-semibold text-lg">Edit: {editing.companyName}</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Package</label><select value={editing.packageType||"starter"} onChange={e => setEditing({...editing, packageType: e.target.value})} className="w-full border rounded-lg px-3 py-2"><option value="starter">Starter</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option></select></div>
                <div><label className="block text-sm font-medium mb-1">Cost/SMS</label><input type="number" step="0.000001" value={editing.costPerSms} onChange={e => setEditing({...editing, costPerSms: e.target.value})} className="w-full border rounded-lg px-3 py-2 font-mono" /></div>
                <div><label className="block text-sm font-medium mb-1">Max TPS</label><input type="number" value={editing.maxTps||0} onChange={e => setEditing({...editing, maxTps: parseInt(e.target.value)||0})} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm font-medium mb-1">Voice OTP Concurrent</label><input type="number" value={editing.maxConcurrentCalls ?? 10} onChange={e => setEditing({...editing, maxConcurrentCalls: parseInt(e.target.value) ?? 10})} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm font-medium mb-1">SMS Limit</label><input type="number" value={editing.smsLimit||0} onChange={e => setEditing({...editing, smsLimit: parseInt(e.target.value)||0})} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm font-medium mb-1">SMPP Server IP</label><input value={editing.smppServerIp||""} onChange={e => setEditing({...editing, smppServerIp: e.target.value})} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm font-medium mb-1">SMPP Port</label><input type="number" value={editing.smppServerPort||2775} onChange={e => setEditing({...editing, smppServerPort: parseInt(e.target.value)})} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm font-medium mb-1">Status</label><select value={editing.status||"active"} onChange={e => setEditing({...editing, status: e.target.value})} className="w-full border rounded-lg px-3 py-2"><option value="active">Active</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></select></div>
                <div className="flex items-end"><label className="flex items-center gap-2"><input type="checkbox" checked={editing.isActive} onChange={() => setEditing({...editing, isActive: !editing.isActive})} className="accent-green-600" /><span className="text-sm">Active Account</span></label></div>
              </div>
              {(editing.packageType === 'professional' || editing.packageType === 'enterprise') && (
                <div className="border rounded-xl p-4 bg-amber-50/50 border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">⏱️</span>
                    <label className="text-sm font-semibold text-amber-800">Emergency Validity Extension</label>
                  </div>
                  <p className="text-xs text-amber-600 mb-3">Override the package expiry date for Professional/Enterprise tenants. Use for emergency extensions.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-amber-700 mb-1">Package Expires At</label>
                      <input
                        type="date"
                        value={editing.packageExpiresAt ? new Date(editing.packageExpiresAt).toISOString().slice(0, 10) : ""}
                        onChange={e => setEditing({...editing, packageExpiresAt: e.target.value ? new Date(e.target.value).toISOString() : null})}
                        className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setMonth(d.getMonth() + 6);
                          setEditing({...editing, packageExpiresAt: d.toISOString()});
                        }}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-2 rounded-lg text-xs font-medium transition"
                      >
                        +6 Months
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setFullYear(d.getFullYear() + 1);
                          setEditing({...editing, packageExpiresAt: d.toISOString()});
                        }}
                        className="ml-2 bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-2 rounded-lg text-xs font-medium transition"
                      >
                        +1 Year
                      </button>
                    </div>
                  </div>
                  {editing.packageExpiresAt && (
                    <p className="text-xs text-amber-700 mt-2">
                      Current expiry: <strong>{new Date(editing.packageExpiresAt).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "long", day: "numeric" })}</strong>
                    </p>
                  )}
                </div>
              )}
              <div><label className="block text-sm font-medium mb-2">Enabled Services</label>
                <div className="grid grid-cols-4 gap-2">
                  {[["smppEnabled","SMPP"],["httpEnabled","HTTP"],["rcsEnabled","RCS"],["flashSmsEnabled","Flash SMS"],["voiceOtpEnabled","Voice OTP"],["ottEnabled","OTT"],["businessApiEnabled","Business API"],["emailEnabled","Email"]].map(([k,l]) => (
                    <label key={k} className="flex items-center gap-2 p-2 border rounded hover:bg-slate-50"><input type="checkbox" checked={editing[k as keyof Tenant] as boolean} onChange={() => toggleService(editing, k as string)} className="accent-blue-600" /><span className="text-xs">{l}</span></label>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4 mt-4">
                <label className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer">
                  <input type="checkbox" checked={editing.autoRenewEnabled} onChange={() => toggleService(editing, "autoRenewEnabled")} className="accent-green-600 w-5 h-5" />
                  <div>
                    <span className="text-sm font-medium">🔄 Auto-Renew Subscription</span>
                    <p className="text-xs text-slate-500">Automatically charge balance and renew Pro/Enterprise plans when they expire</p>
                  </div>
                </label>
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleUpdate(editing)} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Save</button>
                <button onClick={() => setEditing(null)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="font-semibold text-lg">Deactivate Tenant?</h3>
              <p className="text-sm text-slate-500 mt-1">
                This will deactivate <strong>{deleteConfirm.companyName}</strong> ({deleteConfirm.email}).
                The tenant and all their data will be preserved but they will not be able to log in.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition">
                Yes, Deactivate
              </button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 border hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Confirmation Modal */}
      {suspendConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSuspendConfirm(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">⏸️</span>
              </div>
              <h3 className="font-semibold text-lg">Suspend Tenant?</h3>
              <p className="text-sm text-slate-500 mt-1">
                This will suspend <strong>{suspendConfirm.companyName}</strong> ({suspendConfirm.email}).
                They will not be able to log in. You can unsuspend later.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSuspend} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition">
                Yes, Suspend
              </button>
              <button onClick={() => setSuspendConfirm(null)} className="flex-1 border hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hard Delete Confirmation Modal */}
      {hardDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setHardDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-red-200 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">💀</span>
              </div>
              <h3 className="font-semibold text-lg">Permanently Delete Tenant?</h3>
              <p className="text-sm text-slate-500 mt-1">
                This will <strong className="text-red-600">permanently delete</strong> {hardDeleteConfirm.companyName} ({hardDeleteConfirm.email})
                and all their data including schema "{hardDeleteConfirm.schemaName}".
                This action cannot be undone!
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleHardDelete} className="flex-1 bg-red-700 hover:bg-red-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition">
                Yes, Delete Forever
              </button>
              <button onClick={() => setHardDeleteConfirm(null)} className="flex-1 border hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setResetModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">Reset Password: {resetModal.email}</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">New Password</label><input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="Min 6 characters" /></div>
              <div className="flex gap-2"><button onClick={handleResetPassword} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Reset Password</button><button onClick={() => setResetModal(null)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button></div>
            </div>
          </div>
        </div>
      )}

      {/* MCC Traffic Modal */}
      {mccModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setMccModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex justify-between"><h3 className="font-semibold text-lg">📊 MCC Traffic: {mccModal.tenantName}</h3><button onClick={() => setMccModal(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button></div>
            <div className="p-6"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left">MCC</th><th className="px-4 py-3 text-left">Country</th><th className="px-4 py-3 text-left">Total</th><th className="px-4 py-3 text-left">Delivered</th><th className="px-4 py-3 text-left">Failed</th><th className="px-4 py-3 text-left">Cost</th></tr></thead><tbody>{mccStats.map((s,i) => (<tr key={i} className="border-b"><td className="px-4 py-3 font-mono">{s.mcc}</td><td className="px-4 py-3">{s.country_name}</td><td className="px-4 py-3">{(s.total_msgs||0).toLocaleString()}</td><td className="px-4 py-3 text-green-600">{(s.delivered||0).toLocaleString()}</td><td className="px-4 py-3 text-red-600">{(s.failed||0).toLocaleString()}</td><td className="px-4 py-3 font-mono">${parseFloat(s.total_cost||"0").toFixed(6)}</td></tr>))}</tbody></table></div>
          </div>
        </div>
      )}

      {/* Tenants Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left px-4 py-3">Company</th><th className="text-left px-4 py-3">Email</th><th className="text-left px-4 py-3">Package</th><th className="text-left px-4 py-3">SMS Used</th><th className="text-left px-4 py-3">TPS</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Actions</th></tr></thead>
          <tbody>
            {tenants.map(t => {
              const isSuspended = t.status === "suspended";
              const isInactive = !t.isActive && !isSuspended;
              const statusLabel = isSuspended ? "Suspended" : t.isActive ? "Active" : "Inactive";
              const statusColor = isSuspended ? "bg-amber-100 text-amber-700" : t.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
              return (
              <tr key={t.id} className="border-b hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{t.companyName}</td>
                <td className="px-4 py-3 text-xs">{t.email}</td>
                <td className="px-4 py-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs capitalize">{t.packageType}</span></td>
                <td className="px-4 py-3 font-mono text-xs">{t.smsCounter.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs">{t.maxTps || "∞"}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${statusColor}`}>{statusLabel}</span></td>
                <td className="px-4 py-3 flex gap-2 flex-wrap">
                  <button onClick={() => setEditing(t)} className="text-blue-600 hover:underline text-xs">Edit</button>
                  <button onClick={() => setResetModal({email: t.email})} className="text-amber-600 hover:underline text-xs">Reset PW</button>
                  <button onClick={() => viewMccTraffic(t.id, t.companyName)} className="text-purple-600 hover:underline text-xs">MCC</button>
                  {isSuspended ? (
                    <button onClick={() => handleUnsuspend(t)} className="text-green-600 hover:underline text-xs">Unsuspend</button>
                  ) : (
                    <button onClick={() => setSuspendConfirm(t)} className="text-amber-600 hover:underline text-xs">Suspend</button>
                  )}
                  {!isSuspended && <button onClick={() => setDeleteConfirm(t)} className="text-red-600 hover:underline text-xs">Deactivate</button>}
                  <button onClick={() => setHardDeleteConfirm(t)} className="text-red-800 hover:underline text-xs font-bold">💀 Delete</button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
