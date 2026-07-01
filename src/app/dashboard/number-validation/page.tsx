"use client";

import { useState } from "react";

export default function NumberValidationPage() {
  const [number, setNumber] = useState("");
  const [result, setResult] = useState<{valid: boolean; countryCode: string; lineType: string} | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = async () => {
    setLoading(true);
    // Simulate validation
    await new Promise((r) => setTimeout(r, 500));
    const countryCode = number.startsWith("+91") ? "IN" : number.startsWith("+1") ? "US" : "XX";
    setResult({ valid: number.length >= 10, countryCode, lineType: "Mobile" });
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Number Validation</h2>
        <p className="text-sm text-slate-500">Validate phone numbers and lookup carrier info</p>
      </div>

      <div className="bg-white rounded-xl border p-6 shadow-sm max-w-xl">
        <div className="flex gap-3">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="+919876543210"
            className="flex-1 border rounded-lg px-4 py-3 text-lg font-mono"
          />
          <button onClick={validate} disabled={loading} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50">
            {loading ? "..." : "Validate"}
          </button>
        </div>

        {result && (
          <div className="mt-6 bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-2xl ${result.valid ? "text-green-500" : "text-red-500"}`}>{result.valid ? "✓" : "✗"}</span>
              <span className="font-semibold">{result.valid ? "Valid Number" : "Invalid Number"}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Country</p>
                <p className="font-medium">{result.countryCode}</p>
              </div>
              <div>
                <p className="text-slate-500">Line Type</p>
                <p className="font-medium">{result.lineType}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
