"use client";

import { useState, useEffect, useCallback } from "react";

interface Client {
  id: number;
  name: string;
  balance: string;
  route_plan_id: number | null;
}

interface SendResult {
  message: Record<string, unknown>;
  routing: { routePlan: number; route: string; trunk: string; supplier: string; connectionType: string };
  voiceOtp: { otpCode: string; language: string; status: string } | null;
}

export default function SendSmsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ clientId: "", sender: "", destination: "", content: "" });
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/clients").then((r) => r.json());
    setClients(r.clients || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    const res = await fetch("/api/tenant/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, clientId: parseInt(form.clientId) }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setResult(data);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Send SMS</h2>
        <p className="text-sm text-gray-500">Send messages through the routing hierarchy</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Compose Message</h3>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
              <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- Select Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Balance: ${parseFloat(c.balance).toFixed(4)}) {!c.route_plan_id ? "⚠️ No Route Plan" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sender ID *</label>
              <input value={form.sender} onChange={(e) => setForm({ ...form, sender: e.target.value })} required placeholder="MYSMS" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination Number *</label>
              <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required placeholder="+919876543210" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message Content *</label>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required rows={4} placeholder="Your OTP is 1234. Valid for 5 minutes." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">For Voice OTP: include a 4-8 digit code in the message</p>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

            <button disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50">
              {loading ? "Processing..." : "Send SMS"}
            </button>
          </form>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <span className="text-green-600">✓</span> Message Sent Successfully
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium">Routing Path</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="bg-blue-50 px-2 py-1 rounded text-xs text-blue-700">Plan #{result.routing.routePlan}</span>
                    <span className="text-gray-300">→</span>
                    <span className="bg-green-50 px-2 py-1 rounded text-xs text-green-700">{result.routing.route}</span>
                    <span className="text-gray-300">→</span>
                    <span className="bg-purple-50 px-2 py-1 rounded text-xs text-purple-700">{result.routing.trunk}</span>
                    <span className="text-gray-300">→</span>
                    <span className="bg-amber-50 px-2 py-1 rounded text-xs text-amber-700">{result.routing.supplier}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Connection Type:</span>
                  <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">{result.routing.connectionType}</span>
                </div>
              </div>
            </div>

            {result.voiceOtp && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="font-semibold mb-3 flex items-center gap-2">📞 Voice OTP Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">OTP Code:</span>
                    <span className="font-mono font-bold text-lg">{result.voiceOtp.otpCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Language:</span>
                    <span>{result.voiceOtp.language}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Call Status:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${result.voiceOtp.status === "DELIVERED" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {result.voiceOtp.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    System attempted up to 3 calls via Asterisk/SIP. {result.voiceOtp.status === "DELIVERED" ? "Call connected successfully." : "All 3 attempts failed."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Flow explanation */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="font-semibold mb-4">SMS Processing Flow</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">📤 Outbound (SMS Send)</h4>
            <ol className="space-y-1.5 text-gray-600">
              <li className="flex gap-2"><span className="text-blue-600 font-bold">1.</span> Client submits SMS via form/API</li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">2.</span> System verifies client&apos;s route plan</li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">3.</span> Route plan selects appropriate route</li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">4.</span> Route points to trunk</li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">5.</span> Trunk forwards to supplier gateway</li>
              <li className="flex gap-2"><span className="text-blue-600 font-bold">6.</span> Supplier delivers to mobile</li>
            </ol>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">📥 DLR (Delivery Receipt)</h4>
            <ol className="space-y-1.5 text-gray-600">
              <li className="flex gap-2"><span className="text-green-600 font-bold">1.</span> Mobile confirms delivery</li>
              <li className="flex gap-2"><span className="text-green-600 font-bold">2.</span> Supplier receives DLR</li>
              <li className="flex gap-2"><span className="text-green-600 font-bold">3.</span> Routed back through trunk</li>
              <li className="flex gap-2"><span className="text-green-600 font-bold">4.</span> Route processes DLR</li>
              <li className="flex gap-2"><span className="text-green-600 font-bold">5.</span> Pushed to ESME/HTTP client callback</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
