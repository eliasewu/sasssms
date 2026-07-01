"use client";

import { useState, useEffect, useCallback } from "react";

interface EmailAccount {
  id: number;
  email: string;
  name: string;
  department: string | null;
  disk_quota_mb: number;
  is_active: boolean;
  created_at: string;
}

const DEPARTMENTS = ["Finance", "Support", "Sales", "Engineering", "Management", "Operations", "Marketing", "HR"];

export default function EmailAccountsPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EmailAccount | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    department: "",
    diskQuotaMB: "500",
  });
  const [deleteConfirm, setDeleteConfirm] = useState<EmailAccount | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkNames, setBulkNames] = useState("");
  const [bulkDept, setBulkDept] = useState("");
  const [bulkResults, setBulkResults] = useState<Array<{ email: string; password: string }>>([]);
  const [showBulkResults, setShowBulkResults] = useState(false);
  const [resetPassword, setResetPassword] = useState(false);
  const [resetPwValue, setResetPwValue] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/super/email-accounts").then(r => r.json());
    setAccounts(r.accounts || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$";
    let pw = "";
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setForm(prev => ({ ...prev, password: pw }));
    setGeneratedPassword(pw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      const updateBody: Record<string, unknown> = {
        name: form.name,
        department: form.department || null,
        diskQuotaMB: parseInt(form.diskQuotaMB) || 500,
        isActive: editing.is_active,
      };
      if (resetPassword && resetPwValue.length >= 8) {
        updateBody.password = resetPwValue;
      }
      await fetch(`/api/super/email-accounts?id=${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateBody),
      });
      setMsg(`Account ${editing.email} updated${updateBody.password ? " — password reset" : ""}`);
      setResetPassword(false);
      setResetPwValue("");
    } else {
      const res = await fetch("/api/super/email-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          password: form.password,
          department: form.department || null,
          diskQuotaMB: parseInt(form.diskQuotaMB) || 500,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || "Failed"); setTimeout(() => setMsg(""), 3000); return; }
      setMsg(`Account ${form.email} created${generatedPassword ? ". Password shown below." : ""}`);
    }
    setShowForm(false); setEditing(null);
    setForm({ email: "", name: "", password: "", department: "", diskQuotaMB: "500" });
    setTimeout(() => { setMsg(""); setGeneratedPassword(""); }, 6000);
    load();
  };

  const handleBulkCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const names = bulkNames.split("\n").map(n => n.trim()).filter(Boolean);
    if (names.length === 0) { setMsg("Enter at least one name"); setTimeout(() => setMsg(""), 3000); return; }
    let created = 0, failed = 0;
    const results: Array<{ email: string; password: string }> = [];
    for (const name of names) {
      const username = name.toLowerCase().replace(/[^a-z0-9]/g, ".").replace(/\.+/g, ".");
      const email = `${username}@net2app.com`;
      const pw = Array.from({ length: 12 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]).join("");
      const res = await fetch("/api/super/email-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password: pw, department: bulkDept || null, diskQuotaMB: 500 }),
      });
      if (res.ok) { created++; results.push({ email, password: pw }); } else failed++;
    }
    setMsg(`Bulk created: ${created} accounts${failed > 0 ? `, ${failed} failed` : ""}`);
    setBulkResults(results);
    setShowBulkResults(true);
    setBulkMode(false); setBulkNames(""); setBulkDept("");
    setTimeout(() => setMsg(""), 4000);
    load();
  };

  const toggleActive = async (account: EmailAccount) => {
    await fetch(`/api/super/email-accounts?id=${account.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !account.is_active }),
    });
    load();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await fetch(`/api/super/email-accounts?id=${deleteConfirm.id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    setMsg(`Account ${deleteConfirm.email} deleted`);
    setTimeout(() => setMsg(""), 3000);
    load();
  };

  const editAccount = (a: EmailAccount) => {
    setEditing(a);
    setResetPassword(false);
    setResetPwValue("");
    setForm({
      email: a.email,
      name: a.name,
      password: "",
      department: a.department || "",
      diskQuotaMB: String(a.disk_quota_mb || 500),
    });
    setShowForm(true);
  };

  const closeModal = () => {
    setShowForm(false);
    setEditing(null);
    setGeneratedPassword("");
    setResetPassword(false);
    setResetPwValue("");
  };

  const statsByDept = accounts.reduce((acc, a) => {
    const d = a.department || "Unassigned";
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">📧 Email Accounts</h2>
          <p className="text-sm text-slate-500">{accounts.length} accounts on @net2app.com domain</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setBulkMode(true)} className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            📋 Bulk Create
          </button>
          <button onClick={() => { setShowForm(true); setEditing(null); setGeneratedPassword(""); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            + Create Account
          </button>
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm ${msg.includes("failed") || msg.includes("Failed") ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
          {msg}
          {generatedPassword && (
            <div className="mt-2 p-3 bg-white rounded border">
              <p className="text-xs text-slate-500 mb-1">Generated Password (copy now — won't be shown again):</p>
              <code className="text-sm font-mono font-bold text-slate-800 select-all">{generatedPassword}</code>
            </div>
          )}
        </div>
      )}

      {/* Department Stats */}
      {Object.keys(statsByDept).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {Object.entries(statsByDept).map(([dept, count]) => (
            <div key={dept} className="bg-white rounded-lg border p-3 text-center">
              <p className="text-lg font-bold text-slate-800">{count}</p>
              <p className="text-[10px] text-slate-500 truncate">{dept}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex justify-between">
              <h3 className="font-semibold text-lg">{editing ? "Edit Account" : "Create Email Account"}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-xl">X</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="John Doe" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email Address *</label>
                <div className="flex">
                  <input value={form.email.replace("@net2app.com", "")} onChange={e => setForm({...form, email: e.target.value.replace("@net2app.com", "") + "@net2app.com"})} required placeholder="john.doe" disabled={!!editing} className="w-full border rounded-l-lg px-3 py-2 text-sm disabled:bg-slate-100" />
                  <span className="bg-slate-100 border-y border-r rounded-r-lg px-3 py-2 text-sm text-slate-600 font-mono">@net2app.com</span>
                </div>
              </div>
              {!editing && (
                <div>
                  <label className="block text-sm font-medium mb-1">Password *</label>
                  <div className="flex gap-2">
                    <input value={form.password} onChange={e => setForm({...form, password: e.target.value})} required placeholder="Min 8 characters" type="text" className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono" />
                    <button type="button" onClick={generatePassword} className="bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg text-xs transition whitespace-nowrap">Generate</button>
                  </div>
                </div>
              )}
              {editing && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                  {!resetPassword ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-amber-800">Password: ********</span>
                      <button type="button" onClick={() => setResetPassword(true)} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-xs font-medium transition">
                        Reset Password
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-amber-800">New Password (min 8 chars)</label>
                        <button type="button" onClick={() => { setResetPassword(false); setResetPwValue(""); }} className="text-amber-600 hover:text-amber-800 text-xs">Cancel</button>
                      </div>
                      <div className="flex gap-2">
                        <input value={resetPwValue} onChange={e => setResetPwValue(e.target.value)} type="text" placeholder="Enter new password" className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono" />
                        <button type="button" onClick={() => {
                          const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$";
                          let pw = "";
                          for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
                          setResetPwValue(pw);
                        }} className="bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg text-xs transition whitespace-nowrap">Generate</button>
                      </div>
                      {resetPwValue && resetPwValue.length >= 8 && (
                        <p className="text-xs text-green-700">Password will be reset on save. Current password in Dovecot will be updated.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Department</label>
                  <select value={form.department} onChange={e => setForm({...form, department: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">None</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Disk Quota (MB)</label>
                  <input type="number" value={form.diskQuotaMB} onChange={e => setForm({...form, diskQuotaMB: e.target.value})} min="100" max="10000" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium">{editing ? "Update" : "Create"}</button>
                <button type="button" onClick={closeModal} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Create Modal */}
      {bulkMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBulkMode(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex justify-between">
              <h3 className="font-semibold text-lg">Bulk Create Accounts</h3>
              <button onClick={() => setBulkMode(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleBulkCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Names (one per line)</label>
                <textarea value={bulkNames} onChange={e => setBulkNames(e.target.value)} rows={8} placeholder="John Doe&#10;Jane Smith&#10;Bob Wilson" required className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
                <p className="text-xs text-slate-400 mt-1">{(bulkNames.split("\n").filter(Boolean).length)} accounts will be created with auto-generated passwords</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select value={bulkDept} onChange={e => setBulkDept(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">None</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium">Create All</button>
                <button type="button" onClick={() => setBulkMode(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3"><span className="text-2xl">🗑️</span></div>
              <h3 className="font-semibold text-lg">Delete {deleteConfirm.email}?</h3>
              <p className="text-sm text-slate-500 mt-1">This cannot be undone. The mailbox will be removed.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition">Delete</button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 border hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Results Modal */}
      {showBulkResults && bulkResults.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBulkResults(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex justify-between">
              <h3 className="font-semibold text-lg">📋 Created {bulkResults.length} Accounts</h3>
              <button onClick={() => setShowBulkResults(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4">Save these credentials — passwords won't be shown again.</p>
              <div className="bg-slate-50 rounded-lg overflow-hidden border">
                <table className="w-full text-xs">
                  <thead className="bg-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2">Email</th>
                      <th className="text-left px-3 py-2">Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResults.map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-2 font-mono">{r.email}</td>
                        <td className="px-3 py-2 font-mono text-amber-700">{r.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    const csv = "Email,Password\n" + bulkResults.map(r => `${r.email},${r.password}`).join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = "email-accounts.csv"; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  📥 Download CSV
                </button>
                <button onClick={() => setShowBulkResults(false)} className="border px-4 py-2 rounded-lg text-sm">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accounts Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Department</th>
                <th className="text-left px-4 py-3">Quota</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id} className={`border-b hover:bg-slate-50 ${!a.is_active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{a.email}</td>
                  <td className="px-4 py-3">
                    {a.department ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{a.department}</span> : <span className="text-slate-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{a.disk_quota_mb} MB</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${a.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {a.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(a.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => editAccount(a)} className="text-blue-600 hover:underline text-xs">Edit</button>
                      <button onClick={() => toggleActive(a)} className="text-amber-600 hover:underline text-xs">{a.is_active ? "Disable" : "Enable"}</button>
                      <button onClick={() => setDeleteConfirm(a)} className="text-red-600 hover:underline text-xs">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No email accounts yet. Create one or use Bulk Create for teams.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mail Server Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800">
        <h4 className="font-semibold mb-2">📬 Mail Server Connection Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="font-medium text-blue-700">SMTP (Outgoing)</p>
            <p className="font-mono">mail.net2app.com:587</p>
            <p className="text-blue-600">STARTTLS required</p>
          </div>
          <div>
            <p className="font-medium text-blue-700">IMAP (Incoming)</p>
            <p className="font-mono">mail.net2app.com:993</p>
            <p className="text-blue-600">SSL required</p>
          </div>
          <div>
            <p className="font-medium text-blue-700">POP3 (Incoming)</p>
            <p className="font-mono">mail.net2app.com:995</p>
            <p className="text-blue-600">SSL required</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-blue-600">
          Run <code className="bg-blue-100 px-1 rounded">sudo bash setup-mail-server.sh</code> to install the mail server if not already set up.
        </p>
      </div>
    </div>
  );
}
