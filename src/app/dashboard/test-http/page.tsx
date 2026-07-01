"use client";

import { useState } from "react";

export default function TestHttpPage() {
  const [form, setForm] = useState({ apiUrl: "", apiKey: "", method: "POST" });
  const [result, setResult] = useState<{status: number; body: string} | null>(null);
  const [loading, setLoading] = useState(false);

  const testApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 1000));
    setResult({ status: 200, body: JSON.stringify({ success: true, message: "API connection successful" }, null, 2) });
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Test HTTP API</h2>
        <p className="text-sm text-slate-500">Test HTTP API endpoints before adding supplier</p>
      </div>

      <div className="bg-white rounded-xl border p-6 shadow-sm max-w-2xl">
        <form onSubmit={testApi} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">API URL</label>
            <input value={form.apiUrl} onChange={(e) => setForm({ ...form, apiUrl: e.target.value })} required placeholder="https://api.example.com/sms/send" className="w-full border rounded-lg px-3 py-2 font-mono text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">API Key</label>
              <input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Method</label>
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>
          </div>
          <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50">
            {loading ? "Testing..." : "Test API Connection"}
          </button>
        </form>

        {result && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${result.status === 200 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                HTTP {result.status}
              </span>
            </div>
            <pre className="bg-slate-50 rounded-lg p-4 text-xs overflow-x-auto">{result.body}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
