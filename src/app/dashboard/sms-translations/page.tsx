"use client";

import { useState, useEffect, useCallback } from "react";

interface PoolItem { id: number; replacementValue: string; }
interface Assignment { id: number; clientId: number | null; supplierId: number | null; priority: number; isActive: boolean; }
interface Profile {
  id: number; name: string; targetField: string; mode: string;
  matchPattern: string; replacementFixed: string | null; isActive: boolean;
  createdAt: string; pool_items: PoolItem[]; assignments: Assignment[];
}
interface Client { id: number; name: string; }
interface Supplier { id: number; name: string; }

export default function SmsTranslationPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState({ name: "", targetField: "SENDER", mode: "FIXED", matchPattern: ".*", replacementFixed: "" });
  const [poolText, setPoolText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [replacePool, setReplacePool] = useState(true);
  const [assignClients, setAssignClients] = useState<number[]>([]);
  const [assignSuppliers, setAssignSuppliers] = useState<number[]>([]);
  const [sampleInput, setSampleInput] = useState({ sender: "TEST", destination: "+1234567890", content: "Your code is 123456" });
  const [sampleResult, setSampleResult] = useState<any>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [pr, cr, sr] = await Promise.all([
      fetch("/api/tenant/sms-translations").then(r => r.json()),
      fetch("/api/tenant/clients").then(r => r.json()).catch(() => ({ clients: [] })),
      fetch("/api/tenant/suppliers").then(r => r.json()).catch(() => ({ suppliers: [] })),
    ]);
    setProfiles(pr.profiles || []);
    setClients(cr.clients || []);
    setSuppliers(sr.suppliers || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/tenant/sms-translations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.profile) {
      setMsg("Profile created!");
      setTimeout(() => setMsg(""), 3000);
      setShowForm(false);
      setEditing(null);
      load();
    } else {
      setMsg("Error: " + (data.error || "Failed"));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const res = await fetch(`/api/tenant/sms-translations/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.profile) {
      setMsg("Profile updated!");
      setTimeout(() => setMsg(""), 3000);
      setShowForm(false);
      setEditing(null);
      load();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this profile and all its pool items and assignments?")) return;
    await fetch(`/api/tenant/sms-translations/${id}`, { method: "DELETE" });
    setSelected(null);
    setMsg("Profile deleted");
    setTimeout(() => setMsg(""), 3000);
    load();
  };

  const handleUploadPool = async (profileId: number) => {
    if (!poolText && !uploadFile) return;
    const headers: Record<string, string> = {};
    if (replacePool) headers["x-replace-all"] = "true";

    let res: Response;

    if (uploadFile) {
      const fd = new FormData();
      fd.append("file", uploadFile);
      res = await fetch(`/api/tenant/sms-translations/${profileId}/upload`, { method: "POST", headers, body: fd });
    } else {
      res = await fetch(`/api/tenant/sms-translations/${profileId}/upload`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ entries: poolText }),
      });
    }
    const data = await res.json();
    setMsg(`Uploaded ${data.count || 0} entries`);
    setTimeout(() => setMsg(""), 3000);
    setPoolText("");
    setUploadFile(null);
    load();
  };

  const handleAssign = async (profileId: number) => {
    const assignments = [
      ...assignClients.map(cId => ({ clientId: cId, priority: 1 })),
      ...assignSuppliers.map(sId => ({ supplierId: sId, priority: 1 })),
    ];
    await fetch(`/api/tenant/sms-translations/${profileId}/assign`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignments }),
    });
    setMsg("Assignments saved!");
    setTimeout(() => setMsg(""), 3000);
    load();
  };

  const handlePreview = async (profileId: number) => {
    const res = await fetch("/api/tenant/sms-translations/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, sampleSender: sampleInput.sender, sampleDestination: sampleInput.destination, sampleContent: sampleInput.content }),
    });
    setSampleResult(await res.json());
  };

  const startEdit = (p: Profile) => {
    setEditing(p);
    setForm({ name: p.name, targetField: p.targetField, mode: p.mode, matchPattern: p.matchPattern, replacementFixed: p.replacementFixed || "" });
    setShowForm(true);
  };

  const fieldLabels: Record<string, string> = { SENDER: "Sender ID (SID)", BODY: "Content / Body", DESTINATION: "Destination Number" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">SMS Translation</h2>
          <p className="text-sm text-slate-500">Transform SID, content, and numbers with fixed or random rules</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: "", targetField: "SENDER", mode: "FIXED", matchPattern: ".*", replacementFixed: "" }); setShowForm(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">
          + New Profile
        </button>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile List */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <h3 className="font-semibold mb-3">Profiles ({profiles.length})</h3>
          {profiles.length === 0 && <p className="text-sm text-slate-400">No profiles yet.</p>}
          {profiles.map(p => (
            <div key={p.id} onClick={() => setSelected(selected?.id === p.id ? null : p)}
              className={`p-3 rounded-lg cursor-pointer mb-1 transition ${selected?.id === p.id ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{p.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${p.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{p.isActive ? "Active" : "Inactive"}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{fieldLabels[p.targetField]} | {p.mode} | {(p.pool_items || []).length} items</p>
            </div>
          ))}
        </div>

        {/* Profile Detail */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm p-4">
          {!selected ? (
            <p className="text-slate-400 text-sm p-8 text-center">Select a profile to manage</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{selected.name}</h3>
                  <p className="text-xs text-slate-500">{fieldLabels[selected.targetField]} | {selected.mode} | Pattern: <code className="bg-slate-100 px-1 rounded">{selected.matchPattern}</code></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(selected)} className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-slate-50">Edit</button>
                  <button onClick={() => handleDelete(selected.id)} className="px-3 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
                </div>
              </div>

              {/* Pool Items */}
              <div className="border rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Pool Items ({(selected.pool_items || []).length})</h4>
                {selected.mode === "RANDOM" ? (
                  <>
                    {(selected.pool_items || []).length > 0 ? (
                      <div className="max-h-32 overflow-y-auto space-y-1 mb-3">
                        {(selected.pool_items || []).map(item => (
                          <div key={item.id} className="bg-slate-50 rounded px-2 py-1 text-xs font-mono">{item.replacementValue}</div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mb-3">No pool items. Upload below.</p>
                    )}
                    <div className="space-y-2">
                      <textarea value={poolText} onChange={e => setPoolText(e.target.value)} placeholder="Enter values, one per line...&#10;BRAND1&#10;BRAND2&#10;BRAND3"
                        className="w-full border rounded-lg px-3 py-2 text-xs font-mono h-24" />
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">or upload file:</span>
                        <input type="file" accept=".csv,.txt" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="text-xs" />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={replacePool} onChange={e => setReplacePool(e.target.checked)} /> Replace all</label>
                        <button onClick={() => handleUploadPool(selected.id)} disabled={!poolText && !uploadFile}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50">Upload</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="text-xs text-slate-500">Fixed replacement:</p>
                    <p className="text-sm font-mono bg-slate-50 rounded px-3 py-2 mt-1">{selected.replacementFixed || "(not set)"}</p>
                  </div>
                )}
              </div>

              {/* Assignments */}
              <div className="border rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Assignments</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Clients:</p>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {clients.map(c => (
                        <label key={c.id} className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={assignClients.includes(c.id)} onChange={e => {
                            setAssignClients(e.target.checked ? [...assignClients, c.id] : assignClients.filter(x => x !== c.id));
                          }} /> {c.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Suppliers:</p>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {suppliers.map(s => (
                        <label key={s.id} className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={assignSuppliers.includes(s.id)} onChange={e => {
                            setAssignSuppliers(e.target.checked ? [...assignSuppliers, s.id] : assignSuppliers.filter(x => x !== s.id));
                          }} /> {s.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleAssign(selected.id)} className="mt-2 bg-slate-600 text-white px-3 py-1.5 rounded text-xs font-medium">Save Assignments</button>
                {(selected.assignments || []).length > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    Current: {(selected.assignments || []).map(a => {
                      const name = a.clientId ? clients.find(c => c.id === a.clientId)?.name : suppliers.find(s => s.id === a.supplierId)?.name;
                      return `${a.clientId ? "[Client]" : "[Supplier]"} ${name || a.clientId || a.supplierId}`;
                    }).join(", ")}
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="border rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Sample Preview</h4>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div>
                    <label className="text-xs text-slate-500">Sender</label>
                    <input value={sampleInput.sender} onChange={e => setSampleInput({...sampleInput, sender: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Destination</label>
                    <input value={sampleInput.destination} onChange={e => setSampleInput({...sampleInput, destination: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Content</label>
                    <input value={sampleInput.content} onChange={e => setSampleInput({...sampleInput, content: e.target.value})}
                      className="w-full border rounded px-2 py-1 text-xs" />
                  </div>
                </div>
                <button onClick={() => handlePreview(selected.id)} className="bg-purple-600 text-white px-3 py-1.5 rounded text-xs font-medium">Generate Sample</button>
                {sampleResult && (
                  <div className="mt-3 bg-slate-50 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500">Original:</p>
                        <p className="font-mono">Sender: {sampleResult.sample?.original?.sender}</p>
                        <p className="font-mono">Dest: {sampleResult.sample?.original?.destination}</p>
                        <p className="font-mono">Content: {sampleResult.sample?.original?.content}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Translated:</p>
                        <p className="font-mono text-green-700">Sender: {sampleResult.sample?.translated?.sender}</p>
                        <p className="font-mono text-green-700">Dest: {sampleResult.sample?.translated?.destination}</p>
                        <p className="font-mono text-green-700">Content: {sampleResult.sample?.translated?.content}</p>
                      </div>
                    </div>
                    {sampleResult.randomSamples?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-500 mb-1">Random variants:</p>
                        <div className="space-y-1">
                          {sampleResult.randomSamples.map((s: string, i: number) => (
                            <p key={i} className="text-xs font-mono bg-white rounded px-2 py-1">{s}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">{editing ? "Edit Profile" : "New Profile"}</h3>
            <form onSubmit={editing ? handleUpdate : handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Brand SID Override" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Target Field</label>
                  <select value={form.targetField} onChange={e => setForm({...form, targetField: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="SENDER">Sender (SID)</option>
                    <option value="BODY">Body / Content</option>
                    <option value="DESTINATION">Destination</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Mode</label>
                  <select value={form.mode} onChange={e => setForm({...form, mode: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="FIXED">Fixed</option>
                    <option value="RANDOM">Random</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Match Pattern (Regex)</label>
                <input value={form.matchPattern} onChange={e => setForm({...form, matchPattern: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder=".*" />
                <p className="text-xs text-slate-400 mt-1">Use .* to match all, or a regex to selectively apply</p>
              </div>
              {form.mode === "FIXED" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Replacement Value</label>
                  <input value={form.replacementFixed} onChange={e => setForm({...form, replacementFixed: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="e.g. BRAND1 or Your OTP is $1" />
                  <p className="text-xs text-slate-400 mt-1">Use $1, $2 for regex capture groups</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700">{editing ? "Update" : "Create"}</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
