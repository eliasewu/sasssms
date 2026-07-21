"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useColumnFilters, FilterRow, FilterToggle, type ColumnFilterDef } from "@/components/column-filters";

interface Connector {
  id: number;
  name: string;
  type: string;
  send_url_template?: string;
  send_method?: string;
  send_headers?: string;
  send_body_template?: string;
  send_success_condition?: string;
  send_message_id_path?: string;
  dlr_url_template?: string;
  dlr_method?: string;
  dlr_success_condition?: string;
  dlr_status_path?: string;
  dlr_delivered_value?: string;
  dlr_poll_seconds?: number;
  dlr_timeout_seconds?: number;
  is_active: boolean;
  provider?: string;
  region?: string;
  api_url?: string;
  auth_method?: string;
  source?: string;
  realId?: number;
}

interface TestResult {
  success: boolean;
  statusCode: number;
  responseBody: string;
  parsed: Record<string, unknown>;
  extractedMessageId: string | null;
  error?: string;
}

const TYPES = ["HTTP_API", "RCS_API", "WHATSAPP", "TELEGRAM"];

export default function CustomApiConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [globalConnectors, setGlobalConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"custom" | "global">("custom");
  const [aiRaw, setAiRaw] = useState("");
  const [aiResult, setAiResult] = useState<Record<string, string> | null>(null);
  const [aiParsing, setAiParsing] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ type: "HTTP_API", send_method: "GET", dlr_method: "GET", dlr_poll_seconds: "30", dlr_timeout_seconds: "3600" });
  const [saving, setSaving] = useState(false);

  // Test state
  const [testingId, setTestingId] = useState<number | null>(null);
  const [lastTestedId, setLastTestedId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testDestination, setTestDestination] = useState("+8801700000000");
  const [testMessage, setTestMessage] = useState("Test from Net2APP");

  const fetchConnectors = useCallback(async () => {
    try {
      // Fetch tenant custom connectors
      const res = await fetch("/api/tenant/custom-api-connectors", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setConnectors(data.connectors);
      }
      // Fetch global connectors
      const gr = await fetch("/api/tenant/connectors", { credentials: "include" });
      if (gr.ok) {
        const gdata = await gr.json();
        setGlobalConnectors(gdata.connectors.filter((c: Connector) => c.source === "global"));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConnectors(); }, [fetchConnectors]);

  const handleAiParse = async () => {
    if (!aiRaw.trim()) return;
    setAiParsing(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/tenant/custom-api-connectors/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rawCode: aiRaw }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiResult(data.parsed);
      }
    } catch { /* ignore */ }
    finally { setAiParsing(false); }
  };

  const applyAiResult = () => {
    if (!aiResult) return;
    setForm({
      ...aiResult,
      type: form.type || "HTTP_API",
      send_method: aiResult.sendMethod || "GET",
      send_headers: aiResult.sendHeaders || "",
      send_body_template: aiResult.sendBodyTemplate || "",
      send_success_condition: aiResult.sendSuccessCondition || "",
      send_message_id_path: aiResult.sendMessageIdPath || "",
      dlr_url_template: aiResult.dlrUrlTemplate || "",
      dlr_method: aiResult.dlrMethod || "GET",
      dlr_success_condition: aiResult.dlrSuccessCondition || "",      dlr_status_path: aiResult.dlrStatusPath || "", dlr_delivered_value: aiResult.dlrDeliveredValue || "Delivered",
      dlr_poll_seconds: aiResult.dlrPollSeconds || "30",
      dlr_timeout_seconds: aiResult.dlrTimeoutSeconds || "3600",
      name: aiResult.name || "",
    });
    setAiRaw("");
    setAiResult(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.send_url_template) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {
        name: form.name, type: form.type || "HTTP_API",
        sendUrlTemplate: form.send_url_template, sendMethod: form.send_method || "GET",
        sendHeaders: form.send_headers || "", sendBodyTemplate: form.send_body_template || "",
        sendSuccessCondition: form.send_success_condition || "",
        sendMessageIdPath: form.send_message_id_path || "",
        dlrUrlTemplate: form.dlr_url_template || "", dlrMethod: form.dlr_method || "GET",
        dlrSuccessCondition: form.dlr_success_condition || "",
        dlrStatusPath: form.dlr_status_path || "", dlrDeliveredValue: form.dlr_delivered_value || "Delivered",
        dlrPollSeconds: form.dlr_poll_seconds || "30",
        dlrTimeoutSeconds: form.dlr_timeout_seconds || "3600",
      };
      const method = editingId ? "PUT" : "POST";
      const url = editingId
        ? `/api/tenant/custom-api-connectors/${editingId}`
        : "/api/tenant/custom-api-connectors";
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      setShowForm(false);
      setEditingId(null);
      setForm({ type: "HTTP_API", send_method: "GET", dlr_method: "GET", dlr_poll_seconds: "30", dlr_timeout_seconds: "3600" });
      fetchConnectors();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleEdit = (conn: Connector) => {
    setEditingId(conn.id);
    setForm({
      name: conn.name, type: conn.type,
      send_url_template: conn.send_url_template || "", send_method: conn.send_method || "GET",
      send_headers: conn.send_headers || "", send_body_template: conn.send_body_template || "",
      send_success_condition: conn.send_success_condition || "",
      send_message_id_path: conn.send_message_id_path || "",
      dlr_url_template: conn.dlr_url_template || "", dlr_method: conn.dlr_method || "GET",
      dlr_success_condition: conn.dlr_success_condition || "",
      dlr_status_path: conn.dlr_status_path || "", dlr_delivered_value: conn.dlr_delivered_value || "Delivered",
      dlr_poll_seconds: String(conn.dlr_poll_seconds ?? 30),
      dlr_timeout_seconds: String(conn.dlr_timeout_seconds ?? 3600),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this connector?")) return;
    await fetch(`/api/tenant/custom-api-connectors/${id}`, { method: "DELETE", credentials: "include" });
    fetchConnectors();
  };

  const customFilters: ColumnFilterDef[] = useMemo(() => [
    { key: "name", placeholder: "Name..." },
    { key: "type", placeholder: "HTTP API / RCS..." },
    { key: "send_url_template", placeholder: "Send URL..." },
    { key: "is_active", placeholder: "Active / Inactive..." },
  ], []);
  const { values, set, toggle, showFilters, hasActive, filterData } = useColumnFilters(customFilters);
  const activeFilterCount = useMemo(() => Object.values(values).filter(v => v.trim()).length, [values]);
  const filteredConnectors = useMemo(() => filterData(connectors), [connectors, filterData]);

  const handleToggle = async (conn: Connector) => {
    await fetch(`/api/tenant/custom-api-connectors/${conn.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isActive: !conn.is_active }),
    });
    fetchConnectors();
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    setLastTestedId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/tenant/custom-api-connectors/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ testDestination, testMessage }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch { /* ignore */ }
    finally { setTestingId(null); }
  };

  // Clone a global connector into a custom one
  const cloneGlobal = (g: Connector) => {
    setEditingId(null);
    setForm({
      name: g.name,
      type: g.type,
      send_url_template: "",
      send_method: "GET",
      send_headers: "",
      send_body_template: "",
      send_success_condition: "",
      send_message_id_path: "",
      dlr_url_template: "",
      dlr_method: "GET",
      dlr_success_condition: "",
      dlr_status_path: "",
      dlr_delivered_value: "Delivered",
      dlr_poll_seconds: "30",
      dlr_timeout_seconds: "3600",
    });
    setShowForm(true);
    setTab("custom");
  };

  if (loading) return <div className="text-slate-400 text-sm py-12 text-center">Loading...</div>;

  const typeColors: Record<string, string> = {
    HTTP_API: "bg-green-100 text-green-700", RCS: "bg-purple-100 text-purple-700",
    RCS_API: "bg-purple-100 text-purple-700", FLASH_SMS: "bg-amber-100 text-amber-700",
    "Flash SMS": "bg-amber-100 text-amber-700", WHATSAPP: "bg-emerald-100 text-emerald-700",
    TELEGRAM: "bg-cyan-100 text-cyan-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">🔌 API Connectors</h2>
          <p className="text-sm text-slate-500 mt-1">153+ pre-loaded APIs + your custom connectors. AI parses your docs into connector config.</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); }} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium">+ Add Connector</button>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 items-center">
        <button onClick={() => setTab("custom")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium ${tab === "custom" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>
          ⚡ My Custom ({connectors.length})
        </button>
        <FilterToggle showFilters={showFilters && tab === "custom"} hasActive={hasActive} activeCount={activeFilterCount} onClick={toggle} />
        <button onClick={() => setTab("global")} className={`flex-1 py-2.5 rounded-lg text-sm font-medium ${tab === "global" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>
          🌍 Pre-Loaded APIs ({globalConnectors.length})
        </button>
      </div>

      {/* AI Auto-Config */}
      {tab === "custom" && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
          <h3 className="font-semibold text-lg mb-2">🤖 AI Auto-Config</h3>
          <p className="text-sm text-purple-100 mb-4">Paste your API documentation, cURL command, or Python code snippet — AI extracts send URL, DLR URL, and response parsing rules.</p>
          <textarea
            value={aiRaw}
            onChange={e => setAiRaw(e.target.value)}
            className="w-full rounded-lg p-4 text-sm font-mono text-slate-800 bg-white/95 min-h-[140px] placeholder:text-slate-400"
            placeholder={`Paste your API code here, e.g.:\n\nSend:\nhttps://api.provider.com/send?apiKey=xxx&to={{dst}}&text={{message}}\nif response.code == 200: message_id = response.info.trans_id\n\nDLR:\nhttps://api.provider.com/dlr?apiKey=xxx&trans_id={{message_id}}\nif response.info.status == "Delivered": return 2`}
          />
          <div className="flex gap-3 mt-3">
            <button onClick={handleAiParse} disabled={aiParsing || !aiRaw.trim()} className="px-4 py-2 bg-white text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50 disabled:opacity-50 transition">
              {aiParsing ? "🤖 Analyzing..." : "🤖 Parse with AI"}
            </button>
            {aiResult && (
              <button onClick={applyAiResult} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition">
                ✅ Apply to Form
              </button>
            )}
          </div>
          {aiResult && (
            <div className="mt-4 bg-white/10 rounded-lg p-4 text-xs font-mono space-y-1 max-h-[200px] overflow-y-auto">
              {Object.entries(aiResult).filter(([_, v]) => v).map(([k, v]) => (
                <p key={k}><span className="text-purple-200">{k}:</span> {String(v).slice(0, 120)}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Form */}
      {tab === "custom" && showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-4">{editingId ? "Edit" : "Add"} Connector</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Name *", field: "name" },
              { label: "Send URL Template *", field: "send_url_template", placeholder: "https://api.example.com/send?to={{dst}}&text={{message}}" },
              { label: "Send Method", field: "send_method" },
              { label: "Send Headers", field: "send_headers", placeholder: "Content-Type: application/json" },
              { label: "Send Body Template", field: "send_body_template" },
              { label: "Success Condition", field: "send_success_condition", placeholder: "response.code == 200" },
              { label: "Message ID Path", field: "send_message_id_path", placeholder: "info.trans_id" },
              { label: "DLR URL Template", field: "dlr_url_template" },
              { label: "DLR Method", field: "dlr_method" },
              { label: "DLR Success Condition", field: "dlr_success_condition", placeholder: "response.code == 200" },
              { label: "DLR Status Path", field: "dlr_status_path", placeholder: "info.status" },
              { label: "DLR Delivered Value", field: "dlr_delivered_value", placeholder: "Delivered" },
              { label: "DLR Poll Seconds", field: "dlr_poll_seconds", placeholder: "30" },
              { label: "DLR Timeout Seconds", field: "dlr_timeout_seconds", placeholder: "3600" },
            ].map(({ label, field, placeholder }) => (
              <div key={field} className={field === "send_url_template" || field === "dlr_url_template" ? "col-span-2" : ""}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input type="text" value={form[field] || ""} onChange={e => setForm({ ...form, [field]: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" placeholder={placeholder} />
              </div>
            ))}
            <div className="col-span-2 flex gap-3">
              <button onClick={handleSave} disabled={saving || !form.name || !form.send_url_template} className="px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition">
                {saving ? "Saving..." : (editingId ? "Update" : "Create")}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm({ type: "HTTP_API", send_method: "GET", dlr_method: "GET" }); }} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Connectors Table */}
      {tab === "custom" && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {connectors.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <div className="text-4xl mb-3">🔌</div>
              <p className="font-medium">No custom API connectors yet</p>
              <p className="text-sm mt-1">Paste your API docs in the AI box above, clone from Pre-Loaded APIs, or click "Add Connector".</p>
              <button onClick={() => setShowForm(true)} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition">+ Add Connector</button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Name</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Type</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Send URL</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Actions</th>
                </tr>
                {showFilters && <FilterRow filters={customFilters} values={values} onChange={set} colSpan={1} />}
              </thead>
              <tbody>
                {filteredConnectors.map((conn) => (
                  <tr key={conn.id} className="border-t hover:bg-purple-50 transition">
                    <td className="px-5 py-3 font-medium text-slate-800">{conn.name}</td>
                    <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[conn.type] || "bg-purple-100 text-purple-700"}`}>{conn.type}</span></td>
                    <td className="px-5 py-3 text-xs text-slate-500 max-w-[300px] truncate font-mono">{conn.send_url_template}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => handleToggle(conn)} className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${conn.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {conn.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleTest(conn.id)} disabled={testingId === conn.id} className="text-xs px-3 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium">
                          {testingId === conn.id ? "Testing..." : "🧪 Test"}
                        </button>
                        <button onClick={() => handleEdit(conn)} className="text-xs px-3 py-1 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 font-medium">✏️ Edit</button>
                        <button onClick={() => handleDelete(conn.id)} className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium">🗑 Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Global Connectors Table */}
      {tab === "global" && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-slate-50 flex items-center justify-between">
            <span className="text-sm text-slate-500">{globalConnectors.length} pre-loaded API connectors from global catalog</span>
            <span className="text-xs text-slate-400">Click "Clone" to create a custom connector from a template</span>
          </div>
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Name</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Type</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Provider</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Region</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Auth</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {globalConnectors.map((g) => (
                  <tr key={g.id} className="border-t hover:bg-blue-50 transition">
                    <td className="px-5 py-2.5 font-medium text-slate-800">{g.name}</td>
                    <td className="px-5 py-2.5"><span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[g.type] || "bg-slate-100 text-slate-600"}`}>{g.type}</span></td>
                    <td className="px-5 py-2.5 text-xs text-slate-600">{g.provider || "—"}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-500">{g.region || "—"}</td>
                    <td className="px-5 py-2.5"><span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600">{g.auth_method || "API_KEY"}</span></td>
                    <td className="px-5 py-2.5">
                      <button onClick={() => cloneGlobal(g)} className="text-xs px-3 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium transition">📋 Clone</button>
                    </td>
                  </tr>
                ))}
                {globalConnectors.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No pre-loaded connectors available. Run the connector seed script.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Test Result Modal */}
      {testResult && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">🧪 Test Result</h3>
            <button onClick={() => setTestResult(null)} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <div className="space-y-2 text-sm">
            <div className={`px-4 py-2 rounded-lg text-sm font-medium ${testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {testResult.success ? "✅ Success" : "❌ Failed"} (HTTP {testResult.statusCode})
            </div>
            {testResult.error && <p className="text-red-600 text-xs">{testResult.error}</p>}
            {testResult.extractedMessageId && (
              <p className="text-xs text-slate-600"><strong>Message ID:</strong> <code className="bg-slate-100 px-1 rounded">{testResult.extractedMessageId}</code></p>
            )}
            <details className="mt-2">
              <summary className="text-xs text-slate-500 cursor-pointer">Raw Response</summary>
              <pre className="mt-2 bg-slate-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto max-h-[300px]">{JSON.stringify(testResult.parsed, null, 2)}</pre>
            </details>
          </div>
          <div className="flex gap-3 mt-4">
            <input value={testDestination} onChange={e => setTestDestination(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm w-48" placeholder="Destination" />
            <input value={testMessage} onChange={e => setTestMessage(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm flex-1" placeholder="Test message" />
            <button onClick={() => lastTestedId && handleTest(lastTestedId)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs">Retry</button>
          </div>
        </div>
      )}
    </div>
  );
}
