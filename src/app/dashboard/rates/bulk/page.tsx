"use client";

import { useState } from "react";

export default function BulkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Bulk Rate Upload</h2>
        <p className="text-sm text-slate-500">Import rates from CSV or Excel files</p>
      </div>

      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <div className="max-w-xl">
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-500 transition">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-slate-600 mb-2">Drag and drop your CSV file here, or click to browse</p>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition text-sm font-medium">
              Select File
            </label>
            {file && <p className="mt-3 text-sm text-green-600">Selected: {file.name}</p>}
          </div>

          <div className="mt-6">
            <h4 className="font-medium mb-2">CSV Format</h4>
            <div className="bg-slate-50 rounded-lg p-4 font-mono text-xs overflow-x-auto">
              <p className="text-slate-500"># For Client Rates:</p>
              <p>client_id,country_code,mcc,mnc,rate</p>
              <p>1,+91,404,,0.0005</p>
              <p>1,+1,310,,0.0003</p>
              <p className="mt-3 text-slate-500"># For Supplier Rates:</p>
              <p>supplier_id,country_code,mcc,mnc,cost</p>
              <p>1,+91,404,,0.0002</p>
            </div>
          </div>

          <button
            disabled={!file || uploading}
            className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition"
          >
            {uploading ? "Uploading..." : "Upload & Process"}
          </button>
        </div>
      </div>
    </div>
  );
}
