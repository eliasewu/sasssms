"use client";

import { useState, useEffect, useCallback } from "react";
import { isDevServer } from "@/lib/server-ips";
import AuditActor from "@/components/audit-actor";

interface Tenant {
  id: number; companyName: string; email: string;
  schemaName: string; isActive: boolean; status: string; balance: string; packageType: string;
  smppEnabled: boolean; httpEnabled: boolean; rcsEnabled: boolean;
  flashSmsEnabled: boolean; voiceOtpEnabled: boolean; ottEnabled: boolean;
  businessApiEnabled: boolean; emailEnabled: boolean; autoRenewEnabled: boolean;
  autoConnectEnabled: boolean;
  smsCounter: number; smsLimit: number; smsValidUntil: string | null;
  packageExpiresAt: string | null;
  maxTps: number; maxConcurrentCalls: number; costPerSms: string; smppServerIp: string; smppServerPort: number;
  serverLocation: string;
  createdAt: string;
  usage: { requestsToday: number; requests7d: number; avgMsToday: number; avgMs7d: number; maxMs7d: number } | null;
  storageBytes: number | null;
  lastInstallerDownload: { at: string; os: string | null; filename: string | null; embeddedAuthKey: boolean } | null;
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

function formatCount(n: number | null): string {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

interface MccStat {
  mcc: string; country_code: string; country_name: string;
  total_msgs: number; delivered: number; failed: number;
  total_cost: string;
}

interface ServerLocation {
  id: string; country: string; city: string; ipAddress: string; role?: string; isActive: boolean;
  package?: string; capacity?: number;
}

interface AutoConnectAuditEntry {
  id: number;
  action: string;
  enabled: boolean;
  changedBy: string;
  ip: string | null;
  at: string;
}

/** Production locations the super admin may assign a tenant to, filtered by
 *  the tenant's package: starter → starter servers, professional → professional
 *  servers, enterprise → enterprise servers. Falls back to all production
 *  servers when the package has no configured servers yet (e.g. enterprise
 *  before its high-config boxes are added). */
function assignableServers(locations: ServerLocation[], packageType?: string): ServerLocation[] {
  const prod = locations.filter(l =>
    l.isActive && l.ipAddress && l.ipAddress !== "0.0.0.0" &&
    (l.package || "starter") !== "development" &&
    l.role !== "development" && !isDevServer(l.ipAddress)
  );
  if (!packageType) return prod;
  const matched = prod.filter(l => (l.package || "starter") === packageType);
  return matched.length > 0 ? matched : prod;
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
  const [serverLocations, setServerLocations] = useState<ServerLocation[]>([]);
  const [autoConnectAudit, setAutoConnectAudit] = useState<AutoConnectAuditEntry[]>([]);

  const loadAutoConnectAudit = async (tenantId: number) => {
    try {
      const r = await fetch(`/api/super/auto-connect-audit?tenantId=${tenantId}&limit=6`).then(r => r.json());
      setAutoConnectAudit(r.entries || []);
    } catch {
      setAutoConnectAudit([]);
    }
  };

  const load = useCallback(async () => {
    const r = await fetch("/api/super/tenants").then(r => r.json());
    setTenants(r.tenants || []);
  }, []);

  // Load assignable server locations (dev servers excluded) for the edit form
  const loadServers = useCallback(async () => {
    try {
      const r = await fetch("/api/super/settings").then(r => r.json());
      if (r.settings?.server_locations) {
        try { setServerLocations(JSON.parse(r.settings.server_locations)); } catch {}
      }
    } catch { /* non-fatal — edit form falls back to free text */ }
  }, []);

  useEffect(() => { loadServers(); }, [loadServers]);

  // Scale API-load bars relative to the busiest tenant so "who uses how much"
  // is comparable across rows.
  const maxRequests7d = tenants.reduce((m, t) => Math.max(m, t.usage?.requests7d ?? 0), 0);

  // Tenant load per server (for the capacity display in the assignment dropdown)
  const serverLoads: Record<string, number> = {};
  tenants.forEach(t => {
    const ip = t.smppServerIp;
    if (ip && ip !== "0.0.0.0") serverLoads[ip] = (serverLoads[ip] || 0) + 1;
  });

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (tenant: Tenant) => {
    const res = await fetch(`/api/super/tenants/${tenant.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tenant),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error || "Failed to update tenant");
      setTimeout(() => setMsg(""), 5000);
      return; // keep the modal open so the admin can fix the issue
    }
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

  const [accessingId, setAccessingId] = useState<number | null>(null);
  const handleAccessTenant = async (tenant: Tenant) => {
    setAccessingId(tenant.id);
    try {
      const res = await fetch("/api/super/auth/access-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || "Failed to access tenant");
        setTimeout(() => setMsg(""), 5000);
        return;
      }
      // Open the tenant dashboard in a new tab — the impersonation cookie is
      // scoped to this domain, so the dashboard loads as that tenant.
      window.open("/dashboard", "_blank");
    } finally {
      setAccessingId(null);
    }
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
                <div>
                  <label className="block text-sm font-medium mb-1">SMPP Server</label>
                  {assignableServers(serverLocations, editing.packageType).length > 0 ? (
                    <select
                      value={editing.smppServerIp || "0.0.0.0"}
                      onChange={e => {
                        const picked = assignableServers(serverLocations, editing.packageType).find(s => s.ipAddress === e.target.value);
                        setEditing({
                          ...editing,
                          smppServerIp: e.target.value,
                          serverLocation: picked ? picked.id : editing.serverLocation,
                        });
                      }}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="0.0.0.0">0.0.0.0 (Not assigned)</option>
                      {assignableServers(serverLocations, editing.packageType).map(s => {
                        const load = serverLoads[s.ipAddress] || 0;
                        const cap = s.capacity || 0;
                        return (
                          <option key={s.id} value={s.ipAddress}>
                            {s.country}{s.city ? ` — ${s.city}` : ""} ({s.ipAddress}) · {(s.package || "starter").replace(/^./, c => c.toUpperCase())}
                            {cap ? ` · ${load}/${cap} tenants${load >= cap ? " (FULL)" : ""}` : ` · ${load} tenants`}
                          </option>
                        );
                      })}
                      {/* Always include the tenant's current IP so existing
                          dev-server tenants can be edited and migrated, and the
                          field never renders blank. */}
                      {editing.smppServerIp &&
                        editing.smppServerIp !== "0.0.0.0" &&
                        !assignableServers(serverLocations, editing.packageType).some(s => s.ipAddress === editing.smppServerIp) && (
                          <option value={editing.smppServerIp}>
                            {editing.smppServerIp} (current — dev server, not assignable)
                          </option>
                        )}
                    </select>
                  ) : (
                    <input value={editing.smppServerIp || ""} onChange={e => setEditing({...editing, smppServerIp: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="Server IP" />
                  )}
                  {editing.smppServerIp && isDevServer(editing.smppServerIp) && (
                    <p className="text-[11px] text-red-500 mt-1">
                      ⚠️ This tenant is on the dev server — pick a production server above to migrate it.
                    </p>
                  )}
                  {serverLocations.some(l => l.role === "development" || isDevServer(l.ipAddress || "")) && (
                    <p className="text-[11px] text-red-500 mt-1">Dev servers are excluded from tenant assignment.</p>
                  )}
                </div>
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
              <div className="border rounded-lg">
                <label className="flex items-center gap-3 p-3 rounded-lg bg-amber-50/40 hover:bg-amber-50 cursor-pointer transition">
                  <input type="checkbox" checked={editing.autoConnectEnabled} onChange={() => toggleService(editing, "autoConnectEnabled")} className="accent-amber-600 w-5 h-5" />
                  <div>
                    <span className="text-sm font-medium">⚡ Auto-Connect Installer</span>
                    <p className="text-xs text-slate-500">
                      Embed the Tailscale auto-connect key in this tenant&apos;s 3proxy installers so their home PCs join the tailnet
                      automatically. Off = plain installers with the interactive login URL. Approve only tenants you trust.
                    </p>
                  </div>
                </label>
                <div className="px-3 pb-3">
                  <div className="border-t border-amber-200/60 pt-2">
                    <p className="text-[11px] font-medium text-amber-800 mb-1">🗒️ Approval history</p>
                    {autoConnectAudit.length === 0 ? (
                      <p className="text-[11px] text-slate-400">No approval changes recorded yet — every toggle from now on is logged.</p>
                    ) : (
                      <ul className="space-y-1">
                        {autoConnectAudit.map(e => (
                          <li key={e.id} className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${e.enabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                              {e.enabled ? "ON" : "OFF"}
                            </span>
                            by <AuditActor actor={e.changedBy} className="font-medium" />
                            <span className="text-slate-400">· {timeAgo(e.at)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
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
                This will deactivate <strong>{deleteConfirm.companyName}</strong>.
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
                This will suspend <strong>{suspendConfirm.companyName}</strong>.
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
                This will <strong className="text-red-600">permanently delete</strong> {hardDeleteConfirm.companyName}
                and all their data including schema &quot;{hardDeleteConfirm.schemaName}&quot;.
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
            <h3 className="font-semibold text-lg mb-4">Reset Password for {resetModal.email}</h3>
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

      {/* Resource usage legend */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500 flex flex-wrap items-center gap-x-5 gap-y-1">
        <span>📊 All tenants share one server — CPU/RAM are shown as real API load share; storage is exact per-tenant DB size.</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>API Load (7d)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>Avg latency</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>Storage</span>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-slate-50"><tr><th className="text-left px-4 py-3">Company</th><th className="text-left px-4 py-3">Package</th><th className="text-left px-4 py-3">SMS Used</th><th className="text-left px-4 py-3">TPS</th><th className="text-left px-4 py-3">API Load (7d)</th><th className="text-left px-4 py-3">Avg Latency</th><th className="text-left px-4 py-3">Storage</th><th className="text-left px-4 py-3">⚡ Installer</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Actions</th></tr></thead>
          <tbody>
            {tenants.map(t => {
              const isSuspended = t.status === "suspended";
              const isInactive = !t.isActive && !isSuspended;
              const statusLabel = isSuspended ? "Suspended" : t.isActive ? "Active" : "Inactive";
              const statusColor = isSuspended ? "bg-amber-100 text-amber-700" : t.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
              const usage = t.usage;
              return (
              <tr key={t.id} className="border-b hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{t.companyName}</td>
                <td className="px-4 py-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs capitalize">{t.packageType}</span></td>
                <td className="px-4 py-3 font-mono text-xs">{t.smsCounter.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs">{t.maxTps || "∞"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${maxRequests7d > 0 ? Math.max(4, ((usage?.requests7d || 0) / maxRequests7d) * 100) : 0}%` }} />
                    </div>
                    <span className="font-mono text-xs text-slate-700">{formatCount(usage?.requests7d ?? 0)} req</span>
                  </div>
                  {usage ? <div className="text-[10px] text-slate-400 mt-0.5">{formatCount(usage.requestsToday)} today</div> : <div className="text-[10px] text-slate-400 mt-0.5">no data yet</div>}
                </td>
                <td className="px-4 py-3">
                  {usage ? (
                    <div>
                      <span className="font-mono text-xs text-emerald-600">{usage.avgMs7d} ms</span>
                      <div className="text-[10px] text-slate-400 mt-0.5">peak {usage.maxMs7d} ms</div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3"><span className="font-mono text-xs text-purple-700">{formatBytes(t.storageBytes)}</span></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${t.autoConnectEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {t.autoConnectEnabled ? "⚡ Approved" : "Off"}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {t.lastInstallerDownload ? (
                      <span title={`${t.lastInstallerDownload.filename || "installer"} · ${t.lastInstallerDownload.os || "?"}`}>
                        Last dl {timeAgo(t.lastInstallerDownload.at)}
                        <span className={t.lastInstallerDownload.embeddedAuthKey ? "text-amber-600" : "text-slate-400"}>
                          {" · "}{t.lastInstallerDownload.embeddedAuthKey ? "⚡ key" : "plain"}
                        </span>
                      </span>
                    ) : (
                      "No downloads yet"
                    )}
                  </div>
                </td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${statusColor}`}>{statusLabel}</span></td>
                <td className="px-4 py-3 flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleAccessTenant(t)}
                    disabled={accessingId === t.id}
                    className="text-green-600 hover:underline text-xs font-medium"
                    title="Open this tenant's dashboard as them (no password needed)"
                  >
                    {accessingId === t.id ? "Opening…" : "Access"}
                  </button>
                  <button onClick={() => { setEditing(t); loadAutoConnectAudit(t.id); }} className="text-blue-600 hover:underline text-xs">Edit</button>
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
    </div>
  );
}
