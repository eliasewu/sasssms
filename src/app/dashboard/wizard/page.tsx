"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { genCode, genId, genPwd } from "@/lib/id-generators";

// ── Types ──
type EntityType = "client" | "supplier" | "both";
type WizardMode = "single" | "bulk";

interface RoutePlan { id: number; name: string; }
interface SmppServer { id: number; name: string; host: string; port: number; }

const CONNECTION_TYPES_CLIENT = ["SMPP", "HTTP API", "RCS", "Flash SMS", "WhatsApp", "Telegram", "Voice OTP"];
const CONNECTION_TYPES_SUPPLIER = ["SMPP", "HTTP API", "Email", "WhatsApp OTT", "Telegram OTT", "Voice OTP", "Local Bypass", "RCS", "Flash SMS"];

// Static color map — Tailwind JIT can't resolve dynamic class interpolation
const COLOR_STYLES: Record<string, { border: string; bg: string; bgLight: string; text: string; bgBadge: string }> = {
  blue:   { border: "border-blue-500", bg: "bg-blue-50", bgLight: "bg-blue-100", text: "text-blue-700", bgBadge: "bg-blue-500" },
  purple: { border: "border-purple-500", bg: "bg-purple-50", bgLight: "bg-purple-100", text: "text-purple-700", bgBadge: "bg-purple-500" },
  green:  { border: "border-green-500", bg: "bg-green-50", bgLight: "bg-green-100", text: "text-green-700", bgBadge: "bg-green-500" },
};

// ── CSV Column Definitions ──
interface CsvColumn {
  key: string;
  label: string;
  required: boolean;
  autoGen?: () => string;
  defaultValue?: string;
}

const CLIENT_CSV_COLUMNS: CsvColumn[] = [
  { key: "name", label: "Name", required: true },
  { key: "companyName", label: "Company Name", required: false },
  { key: "contactPerson", label: "Contact Person", required: false },
  { key: "email", label: "Email", required: true },
  { key: "phone", label: "Phone", required: true },
  { key: "country", label: "Country", required: false },
  { key: "connectionType", label: "Connection Type", required: false, defaultValue: "SMPP" },
  { key: "smppUsername", label: "SMPP Username", required: false, autoGen: () => genId() },
  { key: "smppPassword", label: "SMPP Password", required: false, autoGen: () => genPwd() },
  { key: "smppAllowedIp", label: "SMPP Allowed IP", required: false, defaultValue: "0.0.0.0/0" },
  { key: "smppPort", label: "SMPP Port", required: false, defaultValue: "2775" },
  { key: "maxTps", label: "Max TPS", required: false, defaultValue: "10" },
  { key: "billingMode", label: "Billing Mode", required: false, defaultValue: "prepaid" },
  { key: "currency", label: "Currency", required: false, defaultValue: "USD" },
  { key: "forceDlr", label: "Force DLR", required: false, defaultValue: "false" },
  { key: "enableHttpApi", label: "Enable HTTP API", required: false, defaultValue: "false" },
  { key: "webhookUrl", label: "Webhook URL", required: false },
];

const SUPPLIER_CSV_COLUMNS: CsvColumn[] = [
  { key: "name", label: "Name", required: true },
  { key: "companyName", label: "Company Name", required: false },
  { key: "contactPerson", label: "Contact Person", required: false },
  { key: "email", label: "Email", required: false },
  { key: "phone", label: "Phone", required: false },
  { key: "connectionType", label: "Connection Type", required: true, defaultValue: "SMPP" },
  { key: "host", label: "SMPP Host", required: false },
  { key: "port", label: "Port", required: false, defaultValue: "2775" },
  { key: "username", label: "Username", required: false, autoGen: () => genId() },
  { key: "password", label: "Password", required: false, autoGen: () => genPwd() },
  { key: "systemId", label: "System ID", required: false, autoGen: () => genId() },
  { key: "smppVersion", label: "SMPP Version", required: false, defaultValue: "3.4" },
  { key: "bindType", label: "Bind Type", required: false, defaultValue: "TRX" },
  { key: "connectionMode", label: "Connection Mode", required: false, defaultValue: "CLIENT" },
  { key: "currency", label: "Currency", required: false, defaultValue: "USD" },
  { key: "forceDlr", label: "Force DLR", required: false, defaultValue: "false" },
];

// ── Parsed CSV Row ──
interface CsvRow {
  index: number;
  data: Record<string, string>;
  errors: string[];
  status: "pending" | "importing" | "success" | "error";
  resultMessage?: string;
  createdId?: number;
}

const STEPS = ["Entity Type", "Company Info", "Connection", "Review & Submit"];

// ── Step Indicator ──
function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
            i < current ? "bg-green-100 text-green-700" :
            i === current ? "bg-blue-100 text-blue-700 ring-2 ring-blue-500" :
            "bg-slate-100 text-slate-400"
          }`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              i < current ? "bg-green-500 text-white" :
              i === current ? "bg-blue-600 text-white" :
              "bg-slate-300 text-slate-500"
            }`}>
              {i < current ? "✓" : i + 1}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 rounded ${
              i < current ? "bg-green-400" : "bg-slate-200"
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Shared Input Components ──
function F({ label, value, onChange, type = "text", required, placeholder, disabled, suffix }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  required?: boolean; placeholder?: string; disabled?: boolean; suffix?: React.ReactNode;
}) {
  const input = (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      required={required} placeholder={placeholder} disabled={disabled}
      className={`border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500 ${suffix ? "flex-1" : "w-full"}`}
    />
  );
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {suffix ? <div className="flex gap-1.5">{input}{suffix}</div> : input}
    </div>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-slate-50 rounded-xl p-5 border border-slate-100">
      <h4 className="font-semibold text-slate-700 mb-4">{icon} {title}</h4>
      {children}
    </section>
  );
}

// ── CSV Parser ──
function parseCsv(text: string, columns: CsvColumn[]): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Split a CSV line respecting quoted fields
  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if ((ch === ',' || ch === '\t') && !inQuotes) { result.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  };

  // Build header → index map (case-insensitive)
  const headers = splitLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const headerIndex: Record<string, number> = {};
  headers.forEach((h, i) => { headerIndex[h] = i; });

  // Build column key → header variants map
  const colVariants: Record<string, string[]> = {};
  columns.forEach(col => {
    colVariants[col.key] = [col.key.toLowerCase(), col.label.toLowerCase().replace(/[^a-z0-9]/g, "")];
  });

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i]);
    // Skip rows where all cell values are empty
    const allEmpty = values.every(v => v === "");
    if (allEmpty) continue;

    const data: Record<string, string> = {};
    const errors: string[] = [];

    for (const col of columns) {
      let raw: string | undefined;
      // Try each variant to find the column index
      for (const variant of colVariants[col.key]) {
        if (headerIndex[variant] !== undefined) {
          const v = values[headerIndex[variant]];
          if (v !== undefined && v !== "") raw = v;
          break;
        }
      }

      if (raw !== undefined) {
        data[col.key] = raw;
      } else if (col.autoGen) {
        data[col.key] = col.autoGen();
      } else if (col.defaultValue !== undefined) {
        data[col.key] = col.defaultValue;
      } else if (col.required) {
        errors.push(`Missing required: ${col.label}`);
      } else {
        data[col.key] = "";
      }
    }

    rows.push({ index: i, data, errors, status: "pending" });
  }

  return rows;
}

// ── Main Wizard ──
export default function QuickWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [entityType, setEntityType] = useState<EntityType>("both");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ client?: { id: number; name: string }; supplier?: { id: number; name: string } } | null>(null);

  // ── Wizard Mode (Single vs Bulk) ──
  const [mode, setMode] = useState<WizardMode>("single");

  // Reference data
  const [routePlans, setRoutePlans] = useState<RoutePlan[]>([]);
  const [smppServers, setSmppServers] = useState<SmppServer[]>([]);

  // ── Form State (covers both client and supplier) ──
  // Company
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [supplierCode, setSupplierCode] = useState("");

  // Connection
  const [clientConnType, setClientConnType] = useState("SMPP");
  const [supplierConnType, setSupplierConnType] = useState("SMPP");
  const [connectionMode, setConnectionMode] = useState("CLIENT");

  // SMPP - Client
  const [cSmppUser, setCSmppUser] = useState("");
  const [cSmppPwd, setCSmppPwd] = useState("");
  const [cSmppIp, setCSmppIp] = useState("0.0.0.0/0");
  const [cSmppPort, setCSmppPort] = useState("2775");
  const [cMaxTps, setCMaxTps] = useState("10");

  // SMPP - Supplier
  const [sHost, setSHost] = useState("");
  const [sPort, setSPort] = useState("2775");
  const [sSysId, setSSysId] = useState("");
  const [sPassword, setSPassword] = useState("");
  const [sBindType, setSBindType] = useState("TRX");
  const [sSmppVer, setSSmppVer] = useState("3.4");

  // Billing
  const [billingMode, setBillingMode] = useState("prepaid");
  const [currency, setCurrency] = useState("USD");
  const [routePlanId, setRoutePlanId] = useState("");
  const [forceDlr, setForceDlr] = useState(false);
  const [enableHttpApi, setEnableHttpApi] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  // Has user generated auto-values?
  const [autoGenerated, setAutoGenerated] = useState(false);

  const generateAutoValues = useCallback(() => {
    setClientCode(genCode());
    setSupplierCode(genCode());
    setCSmppUser(genId());
    setCSmppPwd(genPwd());
    setSSysId(genId());
    setSPassword(genPwd());
    setAutoGenerated(true);
  }, []);

  // Auto-generate on mount
  useEffect(() => {
    if (!autoGenerated) generateAutoValues();
  }, [autoGenerated, generateAutoValues]);

  // Load reference data
  useEffect(() => {
    Promise.all([
      fetch("/api/tenant/route-plans", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/tenant/smpp-servers", { cache: "no-store" }).then(r => r.json()).catch(() => ({ servers: [] })),
    ]).then(([rr, sr]) => {
      setRoutePlans(rr.routePlans || []);
      setSmppServers(sr.servers || []);
    });
  }, []);

  // ── Navigation ──
  const canNext = (): boolean => {
    if (step === 0) return true; // Can always pick entity type
    if (step === 1) {
      if (entityType === "supplier") return companyName.trim().length > 0;
      return companyName.trim().length > 0 && email.trim().length > 0 && phone.trim().length > 0;
    }
    if (step === 2) {
      // SMPP requires some connection details for supplier CLIENT mode
      if (entityType !== "client" && supplierConnType === "SMPP" && connectionMode === "CLIENT") {
        return sHost.trim().length > 0;
      }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (!canNext()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
  };
  const goBack = () => { if (step > 0) setStep(step - 1); };

  // ── Submit ──
  const handleSubmit = async () => {
    setSaving(true);
    setError("");

    const results: any = {};
    const clientPayload: Record<string, unknown> = {
      clientCode: clientCode || null,
      name: companyName,
      companyName: companyName,
      contactPerson: contactPerson || null,
      email: email || `${clientCode}@example.com`,
      phone: phone || "0000000000",
      country: country || null,
      connectionType: clientConnType,
      smppUsername: clientConnType === "SMPP" ? cSmppUser : null,
      smppPassword: clientConnType === "SMPP" ? cSmppPwd : null,
      smppAllowedIp: clientConnType === "SMPP" ? cSmppIp : null,
      smppPort: parseInt(cSmppPort) || 2775,
      smppSystemType: "ESME",
      maxTps: parseInt(cMaxTps) || 10,
      billingMode,
      currency,
      routePlanId: routePlanId ? parseInt(routePlanId) : null,
      enableHttpApi,
      forceDlr,
      webhookUrl: webhookUrl || null,
    };

    const supplierPayload: Record<string, unknown> = {
      supplierCode: supplierCode || null,
      name: companyName + (entityType === "both" ? " (Supplier)" : ""),
      companyName: companyName,
      contactPerson: contactPerson || null,
      email: email || null,
      phone: phone || null,
      connectionType: supplierConnType,
      connectionMode,
      host: supplierConnType === "SMPP" ? (sHost || null) : null,
      port: parseInt(sPort) || 2775,
      username: supplierConnType === "SMPP" ? sSysId : null,
      password: supplierConnType === "SMPP" ? sPassword : null,
      systemId: supplierConnType === "SMPP" ? sSysId : null,
      systemType: "ESME",
      smppVersion: sSmppVer,
      bindType: sBindType,
      currency,
      forceDlr,
    };

    try {
      // Create client if needed
      if (entityType === "client" || entityType === "both") {
        const cRes = await fetch("/api/tenant/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clientPayload),
        });
        const cData = await cRes.json();
        if (!cRes.ok) throw new Error(cData.error || "Failed to create client");
        results.client = { id: cData.client.id, name: cData.client.name };
      }

      // Create supplier if needed
      if (entityType === "supplier" || entityType === "both") {
        const sRes = await fetch("/api/tenant/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(supplierPayload),
        });
        const sData = await sRes.json();
        if (!sRes.ok) throw new Error(sData.error || "Failed to create supplier");
        results.supplier = { id: sData.supplier.id, name: sData.supplier.name };
      }

      setResult(results);
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
    setSaving(false);
  };

  // ── Bulk Import State ──
  const [bulkEntityType, setBulkEntityType] = useState<"client" | "supplier">("client");
  const [csvText, setCsvText] = useState("");
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvParsed, setCsvParsed] = useState(false);
  const [csvSummary, setCsvSummary] = useState<{ total: number; success: number; failed: number } | null>(null);
  const cancelRef = useRef(false);

  const handleParseCsv = () => {
    const cols = bulkEntityType === "client" ? CLIENT_CSV_COLUMNS : SUPPLIER_CSV_COLUMNS;
    const rows = parseCsv(csvText, cols);
    setCsvRows(rows);
    setCsvParsed(true);
    setCsvSummary(null);
  };

  const handleBulkImport = async () => {
    const validRows = csvRows.filter(r => r.errors.length === 0);
    if (validRows.length === 0) return;

    cancelRef.current = false;
    const endpoint = bulkEntityType === "client" ? "/api/tenant/clients" : "/api/tenant/suppliers";
    const cols = bulkEntityType === "client" ? CLIENT_CSV_COLUMNS : SUPPLIER_CSV_COLUMNS;

    let success = 0;
    let failed = 0;
    const updatedRows = [...csvRows];
    const BATCH_SIZE = 5;
    let batchCounter = 0;

    for (const row of updatedRows) {
      if (cancelRef.current) break;
      if (row.errors.length > 0) { failed++; continue; }
      row.status = "importing";
      batchCounter++;
      if (batchCounter % BATCH_SIZE === 0) setCsvRows([...updatedRows]);

      try {
        const payload: Record<string, unknown> = {};
        for (const col of cols) {
          payload[col.key] = row.data[col.key];
          // Map camelCase to snake_case for the API
          const snakeKey = col.key.replace(/([A-Z])/g, "_$1").toLowerCase();
          if (snakeKey === "force_dlr" || snakeKey === "enable_http_api" || snakeKey === "inbound_mode") {
            payload[col.key] = row.data[col.key]?.toLowerCase() === "true";
          }
        }

        // Ensure required fields are mapped for the API
        if (bulkEntityType === "client") {
          payload.clientCode = row.data.name ? genCode() : undefined;
          payload.smppSystemType = "ESME";
          payload.billingMode = row.data.billingMode || "prepaid";
        } else {
          payload.supplierCode = row.data.name ? genCode() : undefined;
          payload.systemType = "ESME";
          payload.connectionMode = row.data.connectionMode || "CLIENT";
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const resData = await res.json();
        if (!res.ok) {
          row.status = "error";
          row.resultMessage = resData.error || `HTTP ${res.status}`;
          failed++;
        } else {
          row.status = "success";
          row.resultMessage = "Created";
          row.createdId = bulkEntityType === "client" ? resData.client?.id : resData.supplier?.id;
          success++;
        }
      } catch (err: any) {
        row.status = "error";
        row.resultMessage = err.message || "Network error";
        failed++;
      }
      // Final state flush
      if (batchCounter % BATCH_SIZE !== 0) setCsvRows([...updatedRows]);
    }

    // Handle cancellation: remaining importing rows become pending
    for (const row of updatedRows) {
      if (row.status === "importing") row.status = "pending";
    }
    setCsvRows([...updatedRows]);
    setCsvSummary({ total: updatedRows.length, success, failed });
  };

  // ── Render ──
  if (mode === "bulk" && csvSummary) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center py-10">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${csvSummary.failed === 0 ? "bg-green-100" : "bg-amber-100"}`}>
            <span className="text-4xl">{csvSummary.failed === 0 ? "✅" : "⚠️"}</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Bulk Import Complete</h2>
          <p className="text-slate-500 mb-6">
            {csvSummary.success} of {csvSummary.total} {bulkEntityType}s imported successfully
            {csvSummary.failed > 0 && <span className="text-red-600"> ({csvSummary.failed} failed)</span>}
          </p>

          {/* Per-row results */}
          <div className="max-h-60 overflow-y-auto border rounded-lg mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Detail</th>
                </tr>
              </thead>
              <tbody>
                {csvRows.map(row => (
                  <tr key={row.index} className={`border-t ${row.status === "success" ? "bg-green-50/50" : row.status === "error" ? "bg-red-50/50" : ""}`}>
                    <td className="px-3 py-2 text-xs text-slate-400">{row.index}</td>
                    <td className="px-3 py-2 text-xs font-mono">{row.data.name || "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.status === "success" ? <span className="text-green-600 font-medium">✓ OK</span> :
                       row.status === "error" ? <span className="text-red-600 font-medium">✗ Failed</span> :
                       <span className="text-slate-400">Cancelled</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{row.resultMessage || row.errors.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push(`/dashboard/${bulkEntityType}s`)}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              View {bulkEntityType === "client" ? "Clients" : "Suppliers"} →
            </button>
            <button
              onClick={() => { setCsvText(""); setCsvRows([]); setCsvParsed(false); setCsvSummary(null); }}
              className="border border-slate-300 px-6 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition"
            >
              New Import
            </button>
            <button
              onClick={() => { setMode("single"); setCsvText(""); setCsvRows([]); setCsvParsed(false); setCsvSummary(null); }}
              className="text-sm text-slate-500 hover:text-slate-700 transition"
            >
              Switch to Single Wizard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (done && result) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Setup Complete!</h2>
          <p className="text-slate-500 mb-8">
            {entityType === "both" ? "Client and supplier created successfully." :
             entityType === "client" ? "Client created successfully." : "Supplier created successfully."}
          </p>

          <div className="grid gap-3 max-w-sm mx-auto mb-8">
            {result.client && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
                <p className="text-xs text-blue-500 font-medium mb-1">👤 CLIENT</p>
                <p className="font-semibold text-blue-800">{result.client.name}</p>
                <p className="text-xs text-blue-600 mt-1">ID: {result.client.id}</p>
                {cSmppUser && <p className="text-xs font-mono text-blue-600 mt-1">SMPP User: {cSmppUser}</p>}
              </div>
            )}
            {result.supplier && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-left">
                <p className="text-xs text-purple-500 font-medium mb-1">🏭 SUPPLIER</p>
                <p className="font-semibold text-purple-800">{result.supplier.name}</p>
                <p className="text-xs text-purple-600 mt-1">ID: {result.supplier.id}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                if (result.client) router.push("/dashboard/clients");
                else router.push("/dashboard/suppliers");
              }}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              View {result.client ? "Clients" : "Suppliers"} →
            </button>
            <button
              onClick={() => {
                setStep(0); setEntityType("both"); setDone(false); setResult(null);
                setError(""); setAutoGenerated(false); generateAutoValues();
              }}
              className="border border-slate-300 px-6 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition"
            >
              Start New Wizard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Bulk Import View ──
  if (mode === "bulk") {
    const columns = bulkEntityType === "client" ? CLIENT_CSV_COLUMNS : SUPPLIER_CSV_COLUMNS;
    const templateHeaders = columns.map(c => c.label).join(",");
    const templateRow = columns.map(c => c.required ? `"example ${c.label}"` : `""`).join(",");
    const hasErrors = csvRows.some(r => r.errors.length > 0);
    const validCount = csvRows.filter(r => r.errors.length === 0).length;
    const importing = csvRows.some(r => r.status === "importing");

    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">📋 Bulk CSV Import</h2>
            <p className="text-sm text-slate-500">Paste CSV data to create multiple {bulkEntityType}s at once.</p>
          </div>
          {/* Mode Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setMode("single")}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition text-slate-500 hover:text-slate-700"
            >
              Single
            </button>
            <span
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-white shadow text-slate-800"
            >
              📋 Bulk CSV
            </span>
          </div>
        </div>

        {/* Entity Type Selector */}
        <div className="flex gap-2 mb-6">
          {([{ type: "client" as const, icon: "👤", label: "Clients" }, { type: "supplier" as const, icon: "🏭", label: "Suppliers" }]).map(opt => (
            <button
              key={opt.type}
              onClick={() => { setBulkEntityType(opt.type); setCsvRows([]); setCsvParsed(false); setCsvSummary(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                bulkEntityType === opt.type
                  ? "bg-blue-600 text-white shadow"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>

        {/* CSV Input */}
        <div className="bg-white rounded-xl border shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Paste CSV Data</h3>
            <button
              onClick={() => {
                if (csvText.trim() && !confirm("This will replace your current CSV data. Continue?")) return;
                setCsvText(`${templateHeaders}\n${templateRow}`);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 transition"
            >
              📝 Insert template
            </button>
          </div>
          <textarea
            value={csvText}
            onChange={e => { setCsvText(e.target.value); setCsvParsed(false); }}
            placeholder={`Paste CSV here... first row = headers\n\n${templateHeaders}\n${templateRow}\n...`}
            rows={8}
            className="w-full border rounded-lg px-4 py-3 text-sm font-mono resize-y outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-slate-400">
              <span className="font-medium">Supported columns:</span>{" "}
              {columns.map(c => (
                <span key={c.key} className={`mr-1.5 ${c.required ? "font-semibold text-slate-600" : ""}`}>
                  {c.label}{c.required ? "*" : ""}
                </span>
              ))}
            </div>
            <button
              onClick={handleParseCsv}
              disabled={!csvText.trim() || importing}
              className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              🔍 Parse CSV
            </button>
          </div>
        </div>

        {/* Preview Table */}
        {csvParsed && csvRows.length > 0 && (
          <div className="bg-white rounded-xl border shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">
                Preview: {csvRows.length} row{csvRows.length !== 1 ? "s" : ""}
                {hasErrors && <span className="text-red-500 ml-2 text-sm font-normal">({csvRows.filter(r => r.errors.length > 0).length} with errors)</span>}
              </h3>
              {validCount > 0 && !importing && (
                <button
                  onClick={handleBulkImport}
                  className="px-5 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition flex items-center gap-2"
                >
                  🚀 Import {validCount} {bulkEntityType}{validCount !== 1 ? "s" : ""}
                </button>
              )}
              {importing && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 text-blue-600">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Importing... {csvRows.filter(r => r.status !== "pending").length}/{validCount}
                  </div>
                  <button
                    onClick={() => { cancelRef.current = true; }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium transition"
                  >
                    ✕ Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="max-h-[500px] overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-10">#</th>
                    {columns.slice(0, 8).map(c => (
                      <th key={c.key} className="px-3 py-2 text-left text-xs font-medium text-slate-500 whitespace-nowrap">
                        {c.label}{c.required ? "*" : ""}
                      </th>
                    ))}
                    {columns.length > 8 && <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">+{columns.length - 8} more</th>}
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map(row => (
                    <tr key={row.index} className={`border-t ${
                      row.status === "importing" ? "bg-blue-50/50" :
                      row.status === "success" ? "bg-green-50/50" :
                      row.status === "error" ? "bg-red-50/50" :
                      row.errors.length > 0 ? "bg-amber-50/50" : ""
                    }`}>
                      <td className="px-3 py-2 text-xs text-slate-400">{row.index}</td>
                      {columns.slice(0, 8).map(c => (
                        <td key={c.key} className="px-3 py-2 text-xs font-mono max-w-[120px] truncate" title={row.data[c.key] || ""}>
                          {row.data[c.key] || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                      {columns.length > 8 && <td className="px-3 py-2 text-xs text-slate-400">...</td>}
                      <td className="px-3 py-2 text-xs">
                        {row.status === "success" ? <span className="text-green-600 font-medium">✓ OK</span> :
                         row.status === "error" ? <span className="text-red-600 font-medium cursor-help" title={row.resultMessage}>✗ Fail</span> :
                         row.status === "importing" ? <span className="text-blue-600 animate-pulse">⏳</span> :
                         row.errors.length > 0 ? <span className="text-amber-600 cursor-help" title={row.errors.join(", ")}>⚠ {row.errors.length} err</span> :
                         <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Error summary */}
            {hasErrors && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-800 mb-2">⚠ Issues to fix before import:</p>
                <ul className="text-xs text-amber-700 space-y-0.5">
                  {csvRows.filter(r => r.errors.length > 0).map(row => (
                    <li key={row.index}>
                      Row {row.index}: {row.errors.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Single Wizard View ──
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">⚡ Quick Setup Wizard</h2>
          <p className="text-sm text-slate-500">Create clients and suppliers in seconds with smart defaults.</p>
        </div>
        {/* Mode Toggle */}
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          <span
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-white shadow text-slate-800"
          >
            Single
          </span>
          <button
            onClick={() => setMode("bulk")}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition text-slate-500 hover:text-slate-700"
          >
            📋 Bulk CSV
          </button>
        </div>
      </div>

      <StepIndicator current={step} steps={STEPS} />

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-lg p-6">
        {/* ── Step 0: Entity Type ── */}
        {step === 0 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-800">What would you like to create?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {([
                { type: "client" as EntityType, icon: "👤", title: "Client Only", desc: "Create an SMPP/HTTP client that connects to your platform to send messages.", color: "blue" },
                { type: "supplier" as EntityType, icon: "🏭", title: "Supplier Only", desc: "Add an SMS supplier/gateway to route messages through.", color: "purple" },
                { type: "both" as EntityType, icon: "🔗", title: "Both (Paired)", desc: "Create a client AND supplier together — ideal for new setups.", color: "green" },
              ]).map(opt => {
                const cs = COLOR_STYLES[opt.color];
                const isSelected = entityType === opt.type;
                return (
                <button
                  key={opt.type}
                  onClick={() => setEntityType(opt.type)}
                  className={`relative p-5 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? `${cs.border} ${cs.bg} shadow-md scale-[1.02]`
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg ${cs.bgLight} flex items-center justify-center text-xl mb-3`}>
                    {opt.icon}
                  </div>
                  <h4 className={`font-semibold text-sm ${cs.text}`}>{opt.title}</h4>
                  <p className="text-xs text-slate-500 mt-1.5">{opt.desc}</p>
                  {isSelected && (
                    <span className={`absolute top-3 right-3 w-5 h-5 rounded-full ${cs.bgBadge} text-white flex items-center justify-center text-xs`}>✓</span>
                  )}
                </button>
              )})}
            </div>
          </div>
        )}

        {/* ── Step 1: Company Info ── */}
        {step === 1 && (
          <div className="space-y-5">
            <Section icon="🏢" title="Company Information">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <F label="Company Name" value={companyName} onChange={setCompanyName} required placeholder="Acme Corp" />
                <F label="Contact Person" value={contactPerson} onChange={setContactPerson} placeholder="John Doe" />
                <F label="Country" value={country} onChange={setCountry} placeholder="US" />
                {(entityType === "client" || entityType === "both") && (
                  <>
                    <F label="Email" type="email" value={email} onChange={setEmail} required placeholder="client@example.com" />
                    <F label="Phone" value={phone} onChange={setPhone} required placeholder="+1234567890" />
                    <F
                      label="Client Code"
                      value={clientCode}
                      onChange={setClientCode}
                      placeholder="Auto-generated"
                      suffix={
                        <button type="button" onClick={() => setClientCode(genCode())}
                          className="shrink-0 px-2.5 py-0.5 text-xs font-medium rounded bg-slate-600 text-white hover:bg-slate-700 transition" title="Regenerate code">
                          🎲
                        </button>
                      }
                    />
                  </>
                )}
                {(entityType === "supplier" || entityType === "both") && (
                  <F
                    label="Supplier Code"
                    value={supplierCode}
                    onChange={setSupplierCode}
                    placeholder="Auto-generated"
                    suffix={
                      <button type="button" onClick={() => setSupplierCode(genCode())}
                        className="shrink-0 px-2.5 py-0.5 text-xs font-medium rounded bg-slate-600 text-white hover:bg-slate-700 transition" title="Regenerate code">
                        🎲
                      </button>
                    }
                  />
                )}
              </div>
            </Section>

            <Section icon="💰" title="Billing Defaults">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Billing Mode</label>
                  <select value={billingMode} onChange={e => setBillingMode(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="prepaid">Prepaid</option>
                    <option value="dlr">DLR-Based</option>
                    <option value="postpaid">Postpaid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="INR">INR</option>
                    <option value="USDT">USDT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Route Plan</label>
                  <select value={routePlanId} onChange={e => setRoutePlanId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">-- None --</option>
                    {routePlans.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 mt-3">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={forceDlr} onChange={e => setForceDlr(e.target.checked)} className="accent-blue-600" /> Force DLR</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enableHttpApi} onChange={e => setEnableHttpApi(e.target.checked)} className="accent-blue-600" /> Enable HTTP API</label>
              </div>
            </Section>
          </div>
        )}

        {/* ── Step 2: Connection ── */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Client Connection */}
            {(entityType === "client" || entityType === "both") && (
              <Section icon="👤" title="Client Connection">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {CONNECTION_TYPES_CLIENT.map(t => (
                    <label key={t} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs transition ${
                      clientConnType === t ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-white"
                    }`}>
                      <input type="radio" checked={clientConnType === t} onChange={() => setClientConnType(t)} className="accent-blue-600" />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>

                {clientConnType === "SMPP" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-700">
                    <strong>Client connects to:</strong> {smppServers[0]?.host || "your-server"}:{smppServers[0]?.port || "2775"}
                  </div>
                )}

                {clientConnType === "SMPP" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <F
                      label="SMPP Username" value={cSmppUser} onChange={setCSmppUser} placeholder="gsm_..."
                      suffix={<button type="button" onClick={() => setCSmppUser(genId())} className="shrink-0 px-2.5 py-0.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition">🎲</button>}
                    />
                    <F
                      label="SMPP Password" value={cSmppPwd} onChange={setCSmppPwd} placeholder="Auto-generated"
                      suffix={<button type="button" onClick={() => setCSmppPwd(genPwd())} className="shrink-0 px-2.5 py-0.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition">🎲</button>}
                    />
                    <F label="Allowed IP" value={cSmppIp} onChange={setCSmppIp} placeholder="0.0.0.0/0" />
                    <F label="Port" type="number" value={cSmppPort} onChange={setCSmppPort} placeholder="2775" />
                    <F label="Max TPS" type="number" value={cMaxTps} onChange={setCMaxTps} placeholder="10" />
                  </div>
                )}
                {clientConnType !== "SMPP" && (
                  <p className="text-xs text-slate-400 italic">Non-SMPP clients require additional API configuration after creation.</p>
                )}
              </Section>
            )}

            {/* Supplier Connection */}
            {(entityType === "supplier" || entityType === "both") && (
              <Section icon="🏭" title="Supplier Connection">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Connection Mode</label>
                  <select value={connectionMode} onChange={e => setConnectionMode(e.target.value)} className="w-full md:w-64 border rounded-lg px-3 py-2 text-sm">
                    <option value="CLIENT">Client (ESME) — connect to external SMSC</option>
                    <option value="SERVER">Server (SMSC) — accept incoming connections</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {CONNECTION_TYPES_SUPPLIER.map(t => (
                    <label key={t} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs transition ${
                      supplierConnType === t ? "border-purple-500 bg-purple-50" : "border-slate-200 hover:bg-white"
                    }`}>
                      <input type="radio" checked={supplierConnType === t} onChange={() => setSupplierConnType(t)} className="accent-purple-600" />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>

                {supplierConnType === "SMPP" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {connectionMode === "CLIENT" && (
                      <F label="SMPP Host" value={sHost} onChange={setSHost} required placeholder="145.239.1.103" />
                    )}
                    <F label="Port" type="number" value={sPort} onChange={setSPort} disabled={connectionMode === "SERVER"} />
                    <F
                      label="System ID / Username" value={sSysId} onChange={setSSysId} placeholder="gsm_..."
                      suffix={<button type="button" onClick={() => setSSysId(genId())} className="shrink-0 px-2.5 py-0.5 text-xs font-medium rounded bg-purple-600 text-white hover:bg-purple-700 transition">🎲</button>}
                    />
                    <F
                      label="Password" value={sPassword} onChange={setSPassword} placeholder="Auto-generated"
                      suffix={<button type="button" onClick={() => setSPassword(genPwd())} className="shrink-0 px-2.5 py-0.5 text-xs font-medium rounded bg-purple-600 text-white hover:bg-purple-700 transition">🎲</button>}
                    />
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Bind Type</label>
                      <select value={sBindType} onChange={e => setSBindType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                        <option value="TRX">TRX (transceiver)</option>
                        <option value="TX_RX">TX+RX (separate)</option>
                        <option value="TX">TX (transmit only)</option>
                        <option value="RX">RX (receive only)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">SMPP Version</label>
                      <select value={sSmppVer} onChange={e => setSSmppVer(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                        <option value="3.4">3.4</option>
                        <option value="3.3">3.3</option>
                        <option value="5.0">5.0</option>
                      </select>
                    </div>
                  </div>
                )}

                {supplierConnType === "Voice OTP" && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-sm text-indigo-700">
                    <span className="font-semibold">📞 Voice OTP</span> — calls delivered via built-in Asterisk AMI.
                    Configure SIP and audio files in the Voice OTP dashboard after creation.
                  </div>
                )}
              </Section>
            )}
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-slate-800">Review & Confirm</h3>
            <p className="text-sm text-slate-500">Review the details below before creating.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(entityType === "client" || entityType === "both") && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-800 mb-3">👤 Client</h4>
                  <ReviewRow label="Name" value={companyName} />
                  <ReviewRow label="Code" value={clientCode} />
                  <ReviewRow label="Email" value={email} />
                  <ReviewRow label="Phone" value={phone} />
                  <ReviewRow label="Type" value={clientConnType} />
                  {clientConnType === "SMPP" && (
                    <>
                      <ReviewRow label="SMPP User" value={cSmppUser} mono />
                      <ReviewRow label="IP" value={cSmppIp} />
                      <ReviewRow label="Port" value={cSmppPort} />
                      <ReviewRow label="Max TPS" value={cMaxTps} />
                    </>
                  )}
                  <ReviewRow label="Billing" value={billingMode} />
                  <ReviewRow label="Currency" value={currency} />
                  {forceDlr && <ReviewRow label="Force DLR" value="Yes" />}
                  {enableHttpApi && <ReviewRow label="HTTP API" value="Enabled" />}
                  {webhookUrl && <ReviewRow label="Webhook" value={webhookUrl} mono />}
                </div>
              )}
              {(entityType === "supplier" || entityType === "both") && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <h4 className="font-semibold text-purple-800 mb-3">🏭 Supplier</h4>
                  <ReviewRow label="Name" value={companyName + (entityType === "both" ? " (Supplier)" : "")} />
                  <ReviewRow label="Code" value={supplierCode} />
                  <ReviewRow label="Type" value={supplierConnType} />
                  <ReviewRow label="Mode" value={connectionMode} />
                  {supplierConnType === "SMPP" && (
                    <>
                      <ReviewRow label="Host" value={sHost || "(inbound server)"} mono />
                      <ReviewRow label="Port" value={sPort} />
                      <ReviewRow label="System ID" value={sSysId} mono />
                      <ReviewRow label="Bind" value={sBindType} />
                      <ReviewRow label="Version" value={sSmppVer} />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation Buttons ── */}
      <div className="flex justify-between mt-6">
        <button
          onClick={goBack}
          disabled={step === 0}
          className="px-6 py-2.5 rounded-lg text-sm font-medium border border-slate-300 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={goNext}
            disabled={!canNext()}
            className="px-8 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-8 py-2.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Creating...
              </>
            ) : (
              <>✨ Create {entityType === "both" ? "Both" : entityType === "client" ? "Client" : "Supplier"}</>
            )}
          </button>
        )}
      </div>

      {/* Quick Regenerate All */}
      {step < 3 && (
        <div className="mt-4 text-center">
          <button
            onClick={generateAutoValues}
            className="text-xs text-slate-400 hover:text-slate-600 transition"
          >
            🎲 Regenerate all auto-values (codes, usernames, passwords)
          </button>
        </div>
      )}
    </div>
  );
}

// ── Review Row Helper ──
function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-white/50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-medium ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}
