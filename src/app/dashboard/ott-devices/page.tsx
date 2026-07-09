"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConfirmModal } from "@/components/confirm-modal";

interface OttDevice {
  id: number; name: string; device_type: string; phone_number: string;
  qr_code: string | null; qr_session: string | null; qr_expires_at: string | null;
  proxy_id: number | null; status: string; last_seen: string; is_active: boolean;
  api_config: string | null;
}
interface ProxyConfig {
  id: number; name: string; host: string; port: number; protocol: string; proxy_type: string; is_active: boolean;
}
interface PairingStatus {
  status: string; qrCode: string | null; qrSession: string | null;
  qrExpiresAt: string | null; deviceType: string; lastSeen: string | null; message: string;
}

export default function OttDevicesPage() {
  const [devices, setDevices] = useState<OttDevice[]>([]);
  const [proxies, setProxies] = useState<ProxyConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [qrModal, setQrModal] = useState<{ device: OttDevice; pairingStatus: PairingStatus } | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", deviceType: "whatsapp", phoneNumber: "", proxyId: "",
    telegramApiId: "", telegramApiHash: "",
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const [dr, pr] = await Promise.all([
      fetch("/api/tenant/ott-devices").then(r => r.json()),
      fetch("/api/tenant/proxy-config").then(r => r.json()).catch(() => ({ configs: [] })),
    ]);
    setDevices(dr.devices || []);
    setProxies(pr.configs || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const resetForm = () => {
    setForm({ name: "", deviceType: "whatsapp", phoneNumber: "", proxyId: "", telegramApiId: "", telegramApiHash: "" });
    setEditingId(null);
    setShowForm(false);
  };

  /** Initiate pairing via server-side engine */
  const pairDevice = async (device: OttDevice) => {
    setPairingLoading(true);
    try {
      const res = await fetch(`/api/tenant/ott-devices/${device.id}/pair`, { method: "POST" });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Pairing initiation failed");
        setPairingLoading(false);
        return;
      }

      const status: PairingStatus = {
        status: "AWAITING_SCAN",
        qrCode: data.pairing.qrCode,
        qrSession: data.pairing.session,
        qrExpiresAt: data.pairing.expiresAt,
        deviceType: device.device_type,
        lastSeen: null,
        message: "QR code ready. Scan with your device.",
      };

      setQrModal({ device, pairingStatus: status });
      load();
      startPolling(device.id);
    } catch {
      alert("Pairing initiation failed");
    }
    setPairingLoading(false);
  };

  /** Poll pairing status every 3 seconds */
  const startPolling = (deviceId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/tenant/ott-devices/${deviceId}/pair-status`);
        const data = await res.json();
        if (!data.success) return;

        if (qrModal) {
          setQrModal(prev => prev ? { ...prev, pairingStatus: data.status } : null);

          if (data.status.status === "EXPIRED") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
          }

          if (data.status.status === "ONLINE") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            load();
            setTimeout(() => setQrModal(null), 1500);
          }
        }
      } catch { /* ignore poll errors */ }
    }, 3000);
  };

  /** Regenerate expired QR */
  const regenerateQr = async () => {
    if (!qrModal) return;
    setPairingLoading(true);
    await pairDevice(qrModal.device);
    setPairingLoading(false);
  };

  /** Unpair / disconnect device */
  const unpairDevice = async (device: OttDevice) => {
    if (!confirm(`Disconnect "${device.name}"? The session will be cleared.`)) return;
    await fetch(`/api/tenant/ott-devices/${device.id}/unpair`, { method: "POST" });
    load();
  };

  /** Start editing an existing device */
  const startEdit = (device: OttDevice) => {
    setForm({
      name: device.name,
      deviceType: device.device_type,
      phoneNumber: device.phone_number || "",
      proxyId: device.proxy_id ? String(device.proxy_id) : "",
      telegramApiId: "",
      telegramApiHash: "",
    });

    // If it's a Telegram device with stored api_config, pre-fill credentials
    if (device.device_type === "telegram" && device.api_config) {
      try {
        const cfg = JSON.parse(device.api_config);
        if (cfg.api_id) setForm(prev => ({ ...prev, telegramApiId: String(cfg.api_id) }));
        if (cfg.api_hash) setForm(prev => ({ ...prev, telegramApiHash: cfg.api_hash }));
      } catch { /* ignore parse errors */ }
    }

    setEditingId(device.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      // Update existing device via PUT
      const body: Record<string, unknown> = {
        name: form.name,
        phoneNumber: form.phoneNumber || null,
        proxyId: form.proxyId ? parseInt(form.proxyId) : null,
      };

      if (form.deviceType === "telegram" && (form.telegramApiId || form.telegramApiHash)) {
        body.apiConfig = {
          api_id: parseInt(form.telegramApiId) || 0,
          api_hash: form.telegramApiHash || "",
        };
      }

      const res = await fetch(`/api/tenant/ott-devices/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to update device");
        return;
      }
    } else {
      // Create new device
      if (!form.proxyId) {
        alert("Residential proxy is mandatory for OTT/WhatsApp/Telegram");
        return;
      }
      const body: Record<string, unknown> = {
        name: form.name,
        deviceType: form.deviceType,
        phoneNumber: form.phoneNumber || null,
        proxyId: parseInt(form.proxyId) || null,
      };

      if (form.deviceType === "telegram" && (form.telegramApiId || form.telegramApiHash)) {
        body.apiConfig = {
          api_id: parseInt(form.telegramApiId) || 0,
          api_hash: form.telegramApiHash || "",
        };
      }

      const res = await fetch("/api/tenant/ott-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to create device");
        return;
      }
    }

    resetForm();
    load();
  };

  const { confirm: confirmDelete, modal: confirmModal } = useConfirmModal();
  const deleteDevice = async (id: number) => {
    if (!await confirmDelete("Delete this OTT device?")) return;
    await fetch(`/api/tenant/ott-devices/${id}`, { method: "DELETE" });
    load();
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ONLINE: "bg-green-100 text-green-700",
      AWAITING_SCAN: "bg-blue-100 text-blue-700",
      PENDING_QR: "bg-purple-100 text-purple-700",
      PAIRING: "bg-amber-100 text-amber-700 animate-pulse",
      EXPIRED: "bg-red-50 text-red-500",
      FAILED: "bg-red-100 text-red-700",
      OFFLINE: "bg-slate-100 text-slate-600",
    };
    return `px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.OFFLINE}`;
  };

  const pairingSteps = (status: string) => {
    const steps = [
      { label: "Initialize", done: status !== "OFFLINE" },
      { label: "Generate QR", done: ["AWAITING_SCAN", "PAIRING", "ONLINE"].includes(status) },
      { label: "Scan QR", done: ["PAIRING", "ONLINE"].includes(status) },
      { label: "Connected", done: status === "ONLINE" },
    ];
    return steps;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">OTT Devices</h2>
          <p className="text-sm text-slate-500">Pair WhatsApp/Telegram devices via QR code • Residential proxy mandatory</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + Add Device
        </button>
      </div>

      {/* Proxy Status Warning */}
      {proxies.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="font-semibold text-amber-800">No Residential Proxy Configured</h4>
              <p className="text-sm text-amber-600">
                OTT devices (WhatsApp/Telegram) require a residential proxy. Configure Tailscale/3proxy first in the proxy settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Device Form */}
      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-4">{editingId ? "Edit OTT Device" : "Add OTT Device"}</h3>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-700"><strong>⚠️ Mandatory:</strong> Residential proxy (Tailscale/3proxy) required for WhatsApp/Telegram OTT</p>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Device Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Device Type *</label>
              {editingId ? (
                <input value={form.deviceType} disabled className="w-full border rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500 capitalize" />
              ) : (
                <select value={form.deviceType} onChange={e => setForm({...form, deviceType: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                  <option value="signal">Signal</option>
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <input value={form.phoneNumber} onChange={e => setForm({...form, phoneNumber: e.target.value})} placeholder="+1234567890" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Residential Proxy *</label>
              <select value={form.proxyId} onChange={e => setForm({...form, proxyId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select Proxy</option>
                {proxies.filter(p => p.is_active).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.host}:{p.port} - {p.proxy_type})</option>
                ))}
              </select>
            </div>

            {/* Telegram API credentials */}
            {form.deviceType === "telegram" && (
              <>
                <div className="col-span-2 border-t pt-4 mt-2">
                  <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 mb-3">
                    <p className="text-sm text-cyan-700">
                      <strong>Telegram API Credentials Required</strong><br />
                      Get your api_id and api_hash from{' '}
                      <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-cyan-900">my.telegram.org</a> → API Development Tools.
                      These are stored per-tenant in your device configuration.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Telegram API ID *</label>
                  <input
                    value={form.telegramApiId}
                    onChange={e => setForm({...form, telegramApiId: e.target.value})}
                    placeholder="12345678"
                    required={!editingId}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Telegram API Hash *</label>
                  <input
                    value={form.telegramApiHash}
                    onChange={e => setForm({...form, telegramApiHash: e.target.value})}
                    placeholder="a1b2c3d4..."
                    required={!editingId}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 transition">
                {editingId ? "Update Device" : "Create Device"}
              </button>
              <button type="button" onClick={resetForm} className="border px-6 py-2 rounded-lg text-sm hover:bg-slate-50 transition">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* OTT Device Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {devices.map(d => (
          <div key={d.id} className="bg-white rounded-xl border p-5 shadow-sm hover:shadow transition">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{d.device_type === "whatsapp" ? "💬" : d.device_type === "telegram" ? "✈️" : "📱"}</span>
                <div>
                  <h4 className="font-semibold">{d.name}</h4>
                  <p className="text-xs text-slate-500 capitalize">{d.device_type}</p>
                </div>
              </div>
              <span className={statusBadge(d.status)}>{d.status}</span>
            </div>
            {d.phone_number && <p className="text-sm text-slate-600 mb-2">{d.phone_number}</p>}
            {d.last_seen && d.status === "ONLINE" && (
              <p className="text-xs text-green-600 mb-2">Last seen: {new Date(d.last_seen).toLocaleString()}</p>
            )}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-slate-400">Proxy:</span>
              <span className={`text-xs px-2 py-0.5 rounded ${d.proxy_id ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {d.proxy_id ? proxies.find(p => p.id === d.proxy_id)?.name || `#${d.proxy_id}` : "None ⚠️"}
              </span>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t">
              {d.status === "ONLINE" ? (
                <button onClick={() => unpairDevice(d)} className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-600 flex-1">
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => pairDevice(d)}
                  disabled={pairingLoading}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 flex-1 disabled:opacity-50"
                >
                  {d.status === "EXPIRED" ? "Retry Pairing" : d.status === "AWAITING_SCAN" ? "View QR" : "Pair Now"}
                </button>
              )}
              <button
                onClick={() => startEdit(d)}
                className="border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50"
              >
                Edit
              </button>
              <button onClick={() => deleteDevice(d.id)} className="border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs hover:bg-red-50">
                Delete
              </button>
            </div>
          </div>
        ))}
        {devices.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border">
            <div className="text-4xl mb-3">📱</div>
            <p>No OTT devices paired yet.</p>
            <p className="text-sm mt-1">Add a WhatsApp or Telegram device and scan QR to pair.</p>
          </div>
        )}
      </div>

      {/* QR Code Modal with Pairing Progress */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setQrModal(null); }}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
            {/* Pairing Progress Steps */}
            <div className="flex items-center justify-between mb-6">
              {pairingSteps(qrModal.pairingStatus.status).map((step, i) => (
                <div key={step.label} className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    step.done ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"
                  }`}>
                    {step.done ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs hidden sm:inline ${step.done ? "text-green-600" : "text-slate-400"}`}>
                    {step.label}
                  </span>
                  {i < 3 && <div className={`w-8 h-0.5 ${step.done ? "bg-green-500" : "bg-slate-200"}`} />}
                </div>
              ))}
            </div>

            <h3 className="font-semibold text-xl mb-2 text-center">
              {qrModal.pairingStatus.status === "ONLINE" ? "✅ Connected!" : "Scan QR Code"}
            </h3>
            <p className="text-slate-500 mb-4 text-center text-sm">
              {qrModal.pairingStatus.message}
            </p>

            {/* QR Image */}
            {qrModal.pairingStatus.qrCode && qrModal.pairingStatus.status !== "EXPIRED" && (
              <div className="relative">
                <img src={qrModal.pairingStatus.qrCode} alt="QR Code" className="w-64 h-64 mx-auto border rounded-xl" />
                {qrModal.pairingStatus.status === "ONLINE" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl">
                    <span className="text-5xl">✅</span>
                  </div>
                )}
              </div>
            )}

            {/* Expired State */}
            {qrModal.pairingStatus.status === "EXPIRED" && (
              <div className="text-center py-8">
                <span className="text-5xl block mb-3">⏰</span>
                <p className="text-slate-600 text-sm mb-4">QR code has expired</p>
                <button
                  onClick={regenerateQr}
                  disabled={pairingLoading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {pairingLoading ? "Generating..." : "Generate New QR"}
                </button>
              </div>
            )}

            {/* Session Info */}
            {qrModal.pairingStatus.qrSession && (
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Session: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">{qrModal.pairingStatus.qrSession}</code></p>
                {qrModal.pairingStatus.qrExpiresAt && (
                  <p className="flex items-center gap-2">
                    Expires:
                    <CountdownTimer target={qrModal.pairingStatus.qrExpiresAt} />
                  </p>
                )}
              </div>
            )}

            {/* Instructions */}
            <div className="mt-4 space-y-2">
              {qrModal.pairingStatus.deviceType === "whatsapp" && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-xs text-emerald-700">
                    <strong>WhatsApp:</strong> Open WhatsApp → Settings → Linked Devices → Link a Device → Scan QR
                  </p>
                </div>
              )}
              {qrModal.pairingStatus.deviceType === "telegram" && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
                  <p className="text-xs text-cyan-700">
                    <strong>Telegram:</strong> Open Telegram → Settings → Devices → Scan QR
                  </p>
                </div>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">
                  <strong>⚠️ Proxy Required:</strong> OTT sessions route through residential proxy.
                </p>
              </div>
            </div>

            <button
              onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setQrModal(null); }}
              className="mt-4 w-full bg-slate-100 text-slate-700 px-6 py-2 rounded-lg text-sm hover:bg-slate-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {confirmModal}
    </div>
  );
}

/** Live countdown timer for QR expiry */
function CountdownTimer({ target }: { target: string }) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    const update = () => {
      const diff = new Date(target).getTime() - Date.now();
      setRemaining(Math.max(0, diff));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [target]);

  const sec = Math.ceil(remaining / 1000);
  if (sec <= 0) return <span className="text-red-500 font-medium">Expired</span>;

  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const color = sec < 20 ? "text-amber-600" : "text-slate-500";
  return <span className={`font-mono text-xs ${color}`}>{m}:{s.toString().padStart(2, "0")}</span>;
}
