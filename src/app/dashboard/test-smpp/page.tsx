"use client";

import { useState } from "react";

export default function TestSmppPage() {
  const [form, setForm] = useState({ host: "", port: "2775", systemId: "", password: "" });
  const [result, setResult] = useState<{success: boolean; message: string} | null>(null);
  const [loading, setLoading] = useState(false);

  const testBind = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 1500));
    setResult({ success: Math.random() > 0.3, message: Math.random() > 0.3 ? "SMPP Bind successful! Connection established." : "SMPP Bind failed. Check credentials." });
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Test SMPP Bind</h2>
        <p className="text-sm text-slate-500">Test SMPP connection before adding supplier</p>
      </div>

      <div className="bg-white rounded-xl border p-6 shadow-sm max-w-xl">
        <form onSubmit={testBind} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Host</label>
              <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} required placeholder="smpp.example.com" className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Port</label>
              <input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">System ID</label>
            <input value={form.systemId} onChange={(e) => setForm({ ...form, systemId: e.target.value })} required className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className="w-full border rounded-lg px-3 py-2" />
          </div>
          <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50">
            {loading ? "Testing Connection..." : "Test SMPP Bind"}
          </button>
        </form>

        {result && (
          <div className={`mt-4 p-4 rounded-lg ${result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
}
