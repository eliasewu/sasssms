"use client";

import { useState, useEffect, useCallback } from "react";
import { useConfirmModal } from "@/components/confirm-modal";

interface OttDevice {
  id: number; name: string; device_type: string; phone_number: string;
  qr_code: string | null; qr_session: string | null; qr_expires_at: string | null;
  proxy_id: number | null; status: string; last_seen: string; is_active: boolean;
}
interface ProxyConfig {
  id: number; name: string; host: string; port: number; protocol: string; proxy_type: string; is_active: boolean;
}

export default function OttDevicesPage() {
  const [devices, setDevices] = useState<OttDevice[]>([]);
  const [proxies, setProxies] = useState<ProxyConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [qrModal, setQrModal] = useState<OttDevice | null>(null);
  const [form, setForm] = useState({
    name: "", deviceType: "whatsapp", phoneNumber: "", proxyId: "",
  });

  const load = useCallback(async () => {
    const [dr, pr] = await Promise.all([
      fetch("/api/tenant/ott-devices").then(r => r.json()),
      fetch("/api/tenant/proxy-config").then(r => r.json()).catch(() => ({ configs: [] })),
    ]);
    setDevices(dr.devices || []);
    setProxies(pr.configs || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pairDevice = async (device: OttDevice) => {
    // eslint-disable-next-line react-hooks/purity
    const ts = Date.now();
    // eslint-disable-next-line react-hooks/purity
    const qrSession = "QR_" + ts + "_" + Math.random().toString(36).slice(2, 10);
    const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      device.device_type === "whatsapp"
        ? `https://web.whatsapp.com/qr/${qrSession}`
        : `tg://login?token=${qrSession}`
    )}`;

    await fetch(`/api/tenant/ott-devices/${device.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qrCode, qrSession,
        qrExpiresAt: new Date(ts + 120000).toISOString(),
        status: "AWAITING_SCAN",
      }),
    });

    setQrModal({ ...device, qr_code: qrCode, qr_session: qrSession, qr_expires_at: new Date(ts + 120000).toISOString(), status: "AWAITING_SCAN" });
    load();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.proxyId) {
      alert("Residential proxy is mandatory for OTT/WhatsApp/Telegram");
      return;
    }
    await fetch("/api/tenant/ott-devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, proxyId: parseInt(form.proxyId) || null }),
    });
    setShowForm(false);
    load();
  };

  const { confirm: confirmDelete, modal: confirmModal } = useConfirmModal();

  const deleteDevice = async (id: number) => {
    if (!await confirmDelete("Delete this OTT device?")) return;
    await fetch(`/api/tenant/ott-devices/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">OTT Devices</h2>
          <p className="text-sm text-slate-500">Pair WhatsApp/Telegram devices via QR code • Residential proxy mandatory</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
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

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Add OTT Device</h3>
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
              <select value={form.deviceType} onChange={e => setForm({...form, deviceType: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="signal">Signal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <input value={form.phoneNumber} onChange={e => setForm({...form, phoneNumber: e.target.value})} placeholder="+1234567890" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Residential Proxy *</label>
              <select value={form.proxyId} onChange={e => setForm({...form, proxyId: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select Proxy</option>
                {proxies.filter(p => p.is_active).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.host}:{p.port} - {p.proxy_type})</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm">Create & Pair</button>
              <button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
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
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                d.status === "ONLINE" ? "bg-green-100 text-green-700" :
                d.status === "AWAITING_SCAN" ? "bg-blue-100 text-blue-700" :
                "bg-slate-100 text-slate-600"
              }`}>{d.status}</span>
            </div>
            {d.phone_number && <p className="text-sm text-slate-600 mb-2">{d.phone_number}</p>}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-slate-400">Proxy:</span>
              <span className={`text-xs px-2 py-0.5 rounded ${d.proxy_id ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {d.proxy_id ? proxies.find(p => p.id === d.proxy_id)?.name || `#${d.proxy_id}` : "None ⚠️"}
              </span>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <button onClick={() => pairDevice(d)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 flex-1">
                {d.status === "AWAITING_SCAN" ? "View QR" : "Pair Now"}
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

      {/* QR Code Modal */}
      {qrModal && qrModal.qr_code && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setQrModal(null)}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-xl mb-2">Scan QR Code</h3>
            <p className="text-slate-500 mb-4">
              {qrModal.device_type === "whatsapp"
                ? "Open WhatsApp → Settings → Linked Devices → Scan QR"
                : "Open Telegram → Settings → Devices → Scan QR"}
            </p>
            <img src={qrModal.qr_code} alt="QR Code" className="w-72 h-72 mx-auto border rounded-xl" />
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>Session: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">{qrModal.qr_session}</code></p>
              <p>Expires: {qrModal.qr_expires_at ? new Date(qrModal.qr_expires_at).toLocaleTimeString() : "N/A"}</p>
            </div>
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                <strong>⚠️ Proxy Required:</strong> This OTT session routes through residential proxy for compliance.
              </p>
            </div>
            <button onClick={() => setQrModal(null)} className="mt-4 bg-slate-100 text-slate-700 px-6 py-2 rounded-lg text-sm hover:bg-slate-200">Close</button>
          </div>
        </div>
      )}
      {confirmModal}
    </div>
  );
}

