"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Client {
  id: number;
  name: string;
  smpp_username: string;
  smpp_password: string;
  http_api_key: string;
  enable_http_api: boolean;
  smpp_port: number;
  dlr_callback_url: string;
  max_tps: number;
}

const TABS = ["HTTP API", "DLR Documentation", "SMPP Settings", "Code Examples", "Platform Guide"];

export default function ApiSettingsPage() {
  const [tab, setTab] = useState("HTTP API");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/tenant/clients").then((r) => r.json());
    const list = r.clients || [];
    setClients(list);
    if (list.length > 0 && !selectedClient) setSelectedClient(list[0]);
    setLoading(false);
  }, [selectedClient]);

  useEffect(() => { load(); }, [load]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const toggleHttpApi = async (clientId: number, enable: boolean) => {
    // Toggle HTTP API via client update
    await fetch(`/api/tenant/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: clientId, enable_http_api: enable }),
    });
    load();
  };

  const regenerateApiKey = async (clientId: number) => {
    const key = "net2app_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12);
    // Update client API key via the clients endpoint
    await fetch(`/api/tenant/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: clientId, http_api_key: key }),
    });
    load();
  };

  if (loading) return <div className="text-slate-400 text-sm py-12 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">API Settings & Documentation</h2>
        <p className="text-sm text-slate-500">HTTP API credentials, SMPP settings, and integration code examples</p>
      </div>

      {/* Client Selector */}
      {clients.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">Client:</span>
          <select
            value={selectedClient?.id || ""}
            onChange={(e) => setSelectedClient(clients.find(c => c.id === parseInt(e.target.value)) || null)}
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${tab === t ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* HTTP API Tab */}
      {tab === "HTTP API" && selectedClient && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Credentials Card */}
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">API Credentials</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">API Key (Username)</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-slate-50 border rounded-lg px-3 py-2 text-sm font-mono text-slate-700 break-all">
                    {selectedClient.http_api_key || selectedClient.smpp_username || "Not configured"}
                  </code>
                  <button
                    onClick={() => copyToClipboard(selectedClient.http_api_key || selectedClient.smpp_username || "", "api_key")}
                    className="text-xs bg-blue-50 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-100 shrink-0"
                  >
                    {copiedField === "api_key" ? "✓ Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Used for both HTTP API and SMPP authentication</p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">SMPP Password</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-slate-50 border rounded-lg px-3 py-2 text-sm font-mono text-slate-700">
                    {selectedClient.smpp_password ? "••••••••" : "Not set"}
                  </code>
                  <button
                    onClick={() => copyToClipboard(selectedClient.smpp_password || "", "password")}
                    className="text-xs bg-blue-50 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-100 shrink-0"
                  >
                    {copiedField === "password" ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">SMPP Port</label>
                <code className="block bg-slate-50 border rounded-lg px-3 py-2 text-sm font-mono text-slate-700 mt-1">
                  {selectedClient.smpp_port || 2775}
                </code>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <span className="text-sm font-medium">HTTP API</span>
                  <p className="text-xs text-slate-400">Enable REST API access</p>
                </div>
                <button
                  onClick={() => toggleHttpApi(selectedClient.id, !selectedClient.enable_http_api)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                    selectedClient.enable_http_api
                      ? "bg-green-100 text-green-700 border border-green-300"
                      : "bg-slate-100 text-slate-500 border border-slate-300"
                  }`}
                >
                  {selectedClient.enable_http_api ? "Enabled" : "Disabled"}
                </button>
              </div>

              <button
                onClick={() => regenerateApiKey(selectedClient.id)}
                className="w-full bg-amber-50 text-amber-700 text-sm py-2 rounded-lg border border-amber-200 hover:bg-amber-100 transition font-medium"
              >
                🔄 Regenerate API Key
              </button>
            </div>
          </div>

          {/* Endpoint Reference */}
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">API Endpoints</h3>
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-mono font-bold">POST</span>
                  <code className="text-sm font-mono text-slate-700">/api/tenant/send-sms</code>
                </div>
                <p className="text-xs text-slate-500 mb-3">Send a single SMS message</p>
                <div className="bg-slate-900 rounded-lg p-3 text-xs font-mono text-green-400 overflow-x-auto">
                  {`curl -X POST https://net2app.com/api/tenant/send-sms \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${selectedClient.http_api_key || selectedClient.smpp_username || "YOUR_API_KEY"}" \\
  -d '{
    "clientId": ${selectedClient.id},
    "sender": "NET2APP",
    "destination": "+8801712345678",
    "content": "Hello from Net2APP API!"
  }'`}
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-mono font-bold">POST</span>
                  <code className="text-sm font-mono text-slate-700">/api/tenant/send-sms</code>
                  <span className="text-xs text-amber-600 ml-auto">Bulk</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">Send bulk SMS to multiple recipients</p>
                <div className="bg-slate-900 rounded-lg p-3 text-xs font-mono text-green-400 overflow-x-auto">
                  {`curl -X POST https://net2app.com/api/tenant/send-sms \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${selectedClient.http_api_key || selectedClient.smpp_username || "YOUR_API_KEY"}" \\
  -d '{
    "clientId": ${selectedClient.id},
    "sender": "NET2APP",
    "recipients": ["+8801712345678", "+8801812345678"],
    "content": "Bulk message from Net2APP!"
  }'`}
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-mono font-bold">DLR</span>
                  <code className="text-sm font-mono text-slate-700">Webhook Callback</code>
                </div>
                <p className="text-xs text-slate-500 mb-3">Delivery reports are pushed to your callback URL</p>
                <div className="bg-slate-50 border rounded-lg p-3 text-xs font-mono text-slate-600">
                  <span className="text-slate-400">Callback URL: </span>
                  <span>{selectedClient.dlr_callback_url || "Not configured — set via Edit Client → Routing → Webhook URL"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rate Info */}
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">Rate & Limits</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-600 font-medium">Global SMS Rate</p>
                <p className="text-2xl font-bold text-blue-800">$0.00010/SMS</p>
                <p className="text-xs text-blue-500 mt-1">Set by super admin</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-xs text-purple-600 font-medium">Max TPS</p>
                <p className="text-2xl font-bold text-purple-800">{selectedClient.max_tps || "Unlimited"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DLR Documentation Tab */}
      {tab === "DLR Documentation" && selectedClient && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">📬 DLR (Delivery Report) Documentation</h3>
            <p className="text-sm text-slate-500 mb-6">
              Net2APP automatically pushes delivery reports to your registered webhook URL. Follow this guide to set up and receive DLRs.
            </p>

            {/* Send SMS Request */}
            <div className="border rounded-xl p-5 mb-6 bg-slate-50">
              <h4 className="font-medium text-slate-800 mb-3">1. Send SMS Request</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase mb-2">Send URL (POST)</p>
                  <code className="block bg-slate-900 text-green-400 text-xs font-mono p-3 rounded-lg break-all">
                    https://net2app.com/api/tenant/send-sms
                  </code>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase mb-2">Headers</p>
                  <div className="bg-slate-900 text-green-400 text-xs font-mono p-3 rounded-lg">
                    Content-Type: application/json<br />
                    x-api-key: {selectedClient.http_api_key || selectedClient.smpp_username || "YOUR_API_KEY"}
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Response */}
            <div className="border rounded-xl p-5 mb-6">
              <h4 className="font-medium text-slate-800 mb-3">2. Submit Response (200 OK)</h4>
              <p className="text-xs text-slate-500 mb-3">The API returns this JSON on successful message submission:</p>
              <div className="bg-slate-900 text-green-400 text-xs font-mono p-4 rounded-lg overflow-x-auto">
{`{
  "success": true,
  "message": {
    "id": 12345,
    "client_id": ${selectedClient.id},
    "sender": "NET2APP",
    "destination": "+8801712345678",
    "content": "Hello World",
    "status": "SENT",
    "dlr_status": "PENDING",
    "message_id": "MSG_1234567890_abc123",
    "cost": "0.00010",
    "created_at": "2025-01-15T10:30:00.000Z"
  },
  "messageId": "MSG_1234567890_abc123",
  "routing": {
    "routePlan": 1,
    "route": "Primary SMPP Route",
    "trunk": "Main Trunk",
    "supplier": "Supplier Name",
    "connectionType": "SMPP",
    "fallbackUsed": false,
    "failedRoutes": 0
  },
  "cost": 0.00010,
  "dlr": {
    "status": "PENDING",
    "pushed_to": "${selectedClient.dlr_callback_url || "https://your-server.com/dlr-webhook"}"
  }
}`}
              </div>
            </div>

            {/* DLR Callback */}
            <div className="border rounded-xl p-5 mb-6 bg-blue-50 border-blue-200">
              <h4 className="font-medium text-slate-800 mb-3">3. DLR Callback URL (Webhook)</h4>
              <p className="text-xs text-slate-600 mb-3">
                Configure your DLR callback URL in <strong>Edit Client → Routing → Webhook URL</strong>. Net2APP will POST DLR updates to this URL.
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase mb-2">DLR Callback URL</p>
                  <code className="block bg-white border text-slate-700 text-xs font-mono p-3 rounded-lg break-all">
                    {selectedClient.dlr_callback_url || "https://your-server.com/dlr-webhook"}
                  </code>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase mb-2">HTTP Method</p>
                  <code className="block bg-white border text-slate-700 text-xs font-mono p-3 rounded-lg">
                    POST (application/json)
                  </code>
                </div>
              </div>
            </div>

            {/* DLR Response Payload */}
            <div className="border rounded-xl p-5 mb-6">
              <h4 className="font-medium text-slate-800 mb-3">4. DLR Response Payload (sent to your callback URL)</h4>
              <p className="text-xs text-slate-500 mb-3">
                When a message delivery status changes, Net2APP POSTs this JSON payload to your DLR callback URL:
              </p>
              <div className="bg-slate-900 text-green-400 text-xs font-mono p-4 rounded-lg overflow-x-auto">
{`{
  "message_id": "MSG_1234567890_abc123",
  "supplier_message_id": "SMPP_1234567890_xyz789",
  "status": "DELIVERED",
  "destination": "+8801712345678",
  "source": "NET2APP",
  "submit_date": "250115103000",
  "done_date": "250115103005",
  "error_code": "000",
  "timestamp": "2025-01-15T10:30:05.000Z",
  "cost": "0.00010",
  "route_name": "Primary SMPP Route",
  "supplier_name": "Supplier Name"
}`}
              </div>
            </div>

            {/* DLR Status Codes */}
            <div className="border rounded-xl p-5">
              <h4 className="font-medium text-slate-800 mb-3">5. DLR Status Codes</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { code: "DELIVERED", desc: "Message delivered to handset", color: "bg-green-100 text-green-700" },
                  { code: "UNDELIVERABLE", desc: "Could not deliver after all retries", color: "bg-red-100 text-red-700" },
                  { code: "EXPIRED", desc: "Message TTL expired before delivery", color: "bg-amber-100 text-amber-700" },
                  { code: "REJECTED", desc: "Rejected by carrier or supplier", color: "bg-red-100 text-red-700" },
                  { code: "PENDING", desc: "Awaiting delivery confirmation", color: "bg-blue-100 text-blue-700" },
                  { code: "ENROUTE", desc: "Accepted and queued for delivery", color: "bg-purple-100 text-purple-700" },
                  { code: "FAILED", desc: "Delivery failed permanently", color: "bg-slate-200 text-slate-700" },
                  { code: "DELETED", desc: "Deleted from queue before sending", color: "bg-gray-100 text-gray-700" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-50 border rounded-lg p-3">
                    <span className={`shrink-0 px-2.5 py-0.5 rounded text-xs font-mono font-bold ${s.color}`}>{s.code}</span>
                    <span className="text-xs text-slate-600">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* DLR Flow Summary */}
            <div className="mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 text-white">
              <h4 className="font-semibold mb-2">🔄 Fixed DLR Flow Summary</h4>
              <div className="text-sm text-blue-100 space-y-1">
                <p>1. <strong>Send SMS</strong> → API returns <code className="bg-white/20 px-1 rounded text-xs">messageId</code> with <code className="bg-white/20 px-1 rounded text-xs">dlr_status: "PENDING"</code></p>
                <p>2. <strong>Message routed</strong> → Delivered through route plan with automatic fallback</p>
                <p>3. <strong>Supplier DLR received</strong> → Real delivery status from carrier</p>
                <p>4. <strong>DLR pushed</strong> → POSTed to your callback URL with full status payload</p>
                <p>5. <strong>Your server acknowledges</strong> → Return HTTP 200 to confirm receipt</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SMPP Settings Tab */}
      {tab === "SMPP Settings" && selectedClient && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">SMPP Connection Details</h3>
            <div className="space-y-4">
              <div className="bg-slate-50 border rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">SMPP Server Host</p>
                <code className="text-sm font-mono font-bold text-slate-800">net2app.com</code>
              </div>
              <div className="bg-slate-50 border rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">SMPP Port</p>
                <code className="text-sm font-mono font-bold text-slate-800">{selectedClient.smpp_port || 2775}</code>
              </div>
              <div className="bg-slate-50 border rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">System ID (Username)</p>
                <code className="text-sm font-mono font-bold text-slate-800">{selectedClient.smpp_username || "Not set"}</code>
              </div>
              <div className="bg-slate-50 border rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">Password</p>
                <code className="text-sm font-mono font-bold text-slate-800">{selectedClient.smpp_password ? "••••••••" : "Not set"}</code>
              </div>
              <div className="bg-slate-50 border rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">Bind Type</p>
                <code className="text-sm font-mono font-bold text-slate-800">Transceiver (TRX)</code>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <strong>SMPP v3.3, v3.4, v5.0</strong> supported. Java 21 compatible. Use TRX bind for full send/receive capability.
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">SMPP Quick Connect</h3>
            <p className="text-sm text-slate-500 mb-4">Use these settings in your SMPP client (Java, Node.js, Kannel, etc.)</p>
            <div className="bg-slate-900 rounded-lg p-4 text-xs font-mono text-green-400 overflow-x-auto">
{`# SMPP Client Configuration
host = net2app.com
port = ${selectedClient.smpp_port || 2775}
system-id = ${selectedClient.smpp_username || "YOUR_USERNAME"}
password = your_smpp_password
system-type = ESME
bind-type = transceiver
smpp-version = 3.4
address-ton = 0
address-npi = 0`}
            </div>              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Note:</strong> The same username/password works for both SMPP and HTTP API. 
                Authentication is unified — configure once, use everywhere.
              </p>
            </div>

            {/* GSM Gateway Registration */}
            <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 className="font-medium text-purple-800 text-sm mb-2">📡 GSM Gateway Registration (No Public IP Required)</h4>
              <p className="text-xs text-purple-700 mb-2">
                GSM gateways without a public IP can register directly to your Net2APP SMSC server.
                Set the supplier <strong>connection_mode = SERVER</strong> and they will bind to:
              </p>
              <div className="bg-white/50 border border-purple-200 rounded-lg p-3 text-xs font-mono text-purple-800">
                <strong>Server IP:</strong> net2app.com:2775<br />
                <strong>Auth:</strong> supplier username + password<br />
                <strong>Mode:</strong> SERVER (gateway registers to us)<br />
                <strong>Note:</strong> The GSM gateway initiates the SMPP bind OUTBOUND to Net2APP's SMSC server
              </div>
              <p className="text-xs text-purple-600 mt-2">
                For device pairing or registration, configure the supplier with <code className="bg-purple-100 px-1 rounded">connection_mode = 'SERVER'</code> 
                and <code className="bg-purple-100 px-1 rounded">connection_type = 'SMPP'</code>. The gateway connects to the shared SMSC and
                delivers inbound MOs (mobile-originated) via DELIVER_SM.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Code Examples Tab */}
      {tab === "Code Examples" && selectedClient && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">Node.js Example</h3>
            <div className="bg-slate-900 rounded-lg p-4 text-xs font-mono text-green-400 overflow-x-auto">
{`// Node.js HTTP SMS API Example
const API_KEY = "${selectedClient.http_api_key || selectedClient.smpp_username || "YOUR_API_KEY"}";
const CLIENT_ID = ${selectedClient.id};

async function sendSms(to, message, sender = "NET2APP") {
  const response = await fetch("https://net2app.com/api/tenant/send-sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      sender: sender,
      destination: to,
      content: message,
    }),
  });
  return response.json();
}

// Usage
sendSms("+8801712345678", "Hello World!").then(console.log);`}
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">Python Example</h3>
            <div className="bg-slate-900 rounded-lg p-4 text-xs font-mono text-green-400 overflow-x-auto">
{`# Python HTTP SMS API Example
import requests

API_KEY = "${selectedClient.http_api_key || selectedClient.smpp_username || "YOUR_API_KEY"}"
CLIENT_ID = ${selectedClient.id}

def send_sms(to, message, sender="NET2APP"):
    response = requests.post(
        "https://net2app.com/api/tenant/send-sms",
        headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
        },
        json={
            "clientId": CLIENT_ID,
            "sender": sender,
            "destination": to,
            "content": message,
        },
    )
    return response.json()

# Usage
print(send_sms("+8801712345678", "Hello from Python!"))`}
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">PHP Example</h3>
            <div className="bg-slate-900 rounded-lg p-4 text-xs font-mono text-green-400 overflow-x-auto">
{`<?php
// PHP HTTP SMS API Example
$API_KEY = "${selectedClient.http_api_key || selectedClient.smpp_username || "YOUR_API_KEY"}";
$CLIENT_ID = ${selectedClient.id};

function sendSms($to, $message, $sender = "NET2APP") {
    global $API_KEY, $CLIENT_ID;

    $ch = curl_init("https://net2app.com/api/tenant/send-sms");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Content-Type: application/json",
        "x-api-key: $API_KEY",
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        "clientId" => $CLIENT_ID,
        "sender" => $sender,
        "destination" => $to,
        "content" => $message,
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    return json_decode(curl_exec($ch), true);
}

// Usage
print_r(sendSms("+8801712345678", "Hello from PHP!"));`}
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">Java Example (SMPP)</h3>
            <div className="bg-slate-900 rounded-lg p-4 text-xs font-mono text-green-400 overflow-x-auto">
{`// Java SMPP Client Example (Cloudhopper/jSMPP)
// Compatible with Java 21 SMPP implementations
import org.jsmpp.bean.*;
import org.jsmpp.session.*;

public class SmppClient {
    public static void main(String[] args) throws Exception {
        SMPPSession session = new SMPPSession();
        session.connectAndBind(
            "net2app.com",
            ${selectedClient.smpp_port || 2775},
            new BindParameter(
                BindType.BIND_TRX,
                "${selectedClient.smpp_username || "YOUR_USERNAME"}",
                "your_smpp_password",
                "ESME",
                TypeOfNumber.UNKNOWN,
                NumberingPlanIndicator.UNKNOWN,
                null
            )
        );

        // Send SMS
        String messageId = session.submitShortMessage(
            "ESME",
            TypeOfNumber.UNKNOWN,
            NumberingPlanIndicator.UNKNOWN,
            "NET2APP",
            TypeOfNumber.INTERNATIONAL,
            NumberingPlanIndicator.ISDN,
            "+8801712345678",
            new ESMClass(),
            (byte)0,
            (byte)1,
            null,
            null,
            new RegisteredDelivery(SMSCDeliveryReceipt.DEFAULT),
            (byte)0,
            new GeneralDataCoding(
                Alphabet.ALPHA_DEFAULT,
                MessageClass.CLASS0,
                false
            ),
            (byte)0,
            "Hello from Java SMPP!".getBytes()
        );

        session.unbindAndClose();
    }
}`}
            </div>
          </div>
        </div>
      )}

      {/* Platform Guide Tab */}
      {tab === "Platform Guide" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-2">📘 SMS Platform Operations Guide</h3>
            <p className="text-sm text-slate-500 mb-6">
              Complete walkthrough for operating the Net2APP SMS platform — creating clients, configuring SMPP, managing rates, and monitoring deliveries.
            </p>

            {/* Step 1: Create a Client */}
            <div className="border rounded-xl p-6 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h4 className="font-semibold text-slate-800 mb-2">
                <span className="bg-blue-600 text-white w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-bold mr-2">1</span>
                Create a Client
              </h4>
              <p className="text-sm text-slate-600 mb-4">
                Go to <strong>Dashboard → Clients → + Add Client</strong> and fill in the form:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-lg border p-4">
                  <h5 className="text-xs font-bold uppercase text-slate-500 mb-2">🏢 Company Information</h5>
                  <ul className="text-xs text-slate-600 space-y-1">
                    <li><strong>Client Code</strong> — Short identifier (e.g., ACME)</li>
                    <li><strong>Company Name *</strong> — Full legal company name</li>
                    <li><strong>Contact Person</strong> — Primary contact at the client</li>
                    <li><strong>Email *</strong> — For notifications & login</li>
                    <li><strong>Phone *</strong> — Contact phone number</li>
                    <li><strong>Country</strong> — Client's country of operation</li>
                  </ul>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <h5 className="text-xs font-bold uppercase text-slate-500 mb-2">⚙️ Connection Type</h5>
                  <ul className="text-xs text-slate-600 space-y-1">
                    <li><strong>SMPP</strong> — Standard SMS protocol (recommended for ESME clients connecting to your SMSC)</li>
                    <li><strong>HTTP API</strong> — RESTful API for developers who prefer HTTP</li>
                    <li><strong>RCS</strong> — Rich Communication Services</li>
                    <li><strong>WhatsApp / Telegram</strong> — OTT messaging channels</li>
                    <li><strong>Voice OTP</strong> — Voice call-based OTP delivery</li>
                    <li><strong>Flash SMS</strong> — Pop-up SMS (no storage on device)</li>
                  </ul>
                </div>
              </div>

              <div className="bg-white rounded-lg border p-4 mb-3">
                <h5 className="text-xs font-bold uppercase text-slate-500 mb-2">💰 Billing Settings</h5>
                <ul className="text-xs text-slate-600 space-y-1">
                  <li><strong>Billing Mode</strong> — Prepaid or Postpaid</li>
                  <li><strong>Currency</strong> — USD, EUR, INR, USDT supported</li>
                  <li><strong>Credit Limit</strong> — Maximum postpaid credit allowed</li>
                </ul>
              </div>

              <div className="bg-white rounded-lg border p-4">
                <h5 className="text-xs font-bold uppercase text-slate-500 mb-2">🔀 Routing Configuration</h5>
                <ul className="text-xs text-slate-600 space-y-1">
                  <li><strong>Routing Plan</strong> — Assign a pre-configured route plan to this client</li>
                  <li><strong>Enable HTTP API</strong> — Generate REST API key for HTTP access</li>
                  <li><strong>Force DLR</strong> — Always wait for delivery receipt before charging</li>
                  <li><strong>Webhook URL</strong> — DLR callback endpoint for this client</li>
                </ul>
              </div>
            </div>

            {/* Step 2: Create SMPP User & Share Credentials */}
            <div className="border rounded-xl p-6 mb-6 bg-gradient-to-r from-green-50 to-emerald-50">
              <h4 className="font-semibold text-slate-800 mb-2">
                <span className="bg-green-600 text-white w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-bold mr-2">2</span>
                Create SMPP User & Share with External Client
              </h4>
              <p className="text-sm text-slate-600 mb-3">
                For SMPP clients, fill in the <strong>SMPP Connection</strong> section in the client form:
              </p>
              <div className="bg-white rounded-lg border p-4 mb-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">SMPP Username</span>
                    <strong className="text-slate-700">Unique system ID (e.g., client_acme)</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">SMPP Password</span>
                    <strong className="text-slate-700">Secure password (auto-gen or custom)</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Allowed IP</span>
                    <strong className="text-slate-700">Client's public IP for whitelisting</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Port</span>
                    <strong className="text-slate-700">2775 (default SMPP port)</strong>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-3">
                <h5 className="font-medium text-amber-800 text-sm mb-2">📋 Share These with Your External Client</h5>
                <div className="bg-white/70 rounded-lg p-3 font-mono text-xs space-y-1 text-slate-700">
                  <p><strong>Server Host:</strong> net2app.com</p>
                  <p><strong>SMPP Port:</strong> 2775</p>
                  <p><strong>System ID (Username):</strong> [the smpp_username you created]</p>
                  <p><strong>Password:</strong> [the smpp_password you created]</p>
                  <p><strong>Bind Type:</strong> Transceiver (TRX)</p>
                  <p><strong>SMPP Version:</strong> 3.4 (auto-negotiated: 3.3, 3.4, 5.0)</p>
                </div>
              </div>

              <div className="bg-white rounded-lg border p-4">
                <h5 className="text-sm font-medium text-slate-700 mb-2">✅ How Binding Works</h5>
                <ol className="text-xs text-slate-600 space-y-1 list-decimal ml-4">
                  <li>Your client configures their SMPP client with the credentials above</li>
                  <li>Their ESME client initiates a BIND_TRANSCEIVER to net2app.com:2775</li>
                  <li>Net2APP authenticates the username/password and checks IP whitelist</li>
                  <li>If successful, the client shows as <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-xs font-bold">BOUND</span> in your dashboard</li>
                  <li>The client can now send SUBMIT_SM (outbound) and receive DELIVER_SM (DLR/inbound)</li>
                  <li>SMPP version is auto-negotiated — 3.3, 3.4, and 5.0 are all supported</li>
                  <li>Monitor bind status in <strong>Dashboard → Bind Status</strong></li>
                </ol>
              </div>
            </div>

            {/* Step 3: Set Client Rates */}
            <div className="border rounded-xl p-6 mb-6 bg-gradient-to-r from-purple-50 to-pink-50">
              <h4 className="font-semibold text-slate-800 mb-2">
                <span className="bg-purple-600 text-white w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-bold mr-2">3</span>
                Set Client Rates (Per-Country Pricing)
              </h4>
              <p className="text-sm text-slate-600 mb-3">
                Configure per-country and per-operator rates for each client. The MCC/MNC database provides all countries and operators.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div className="bg-white rounded-lg border p-4">
                  <h5 className="text-sm font-medium text-slate-700 mb-2">Method 1: Bulk Rate Management</h5>
                  <p className="text-xs text-slate-500 mb-2">
                    Go to <strong>Dashboard → Rates → Rate Management</strong>
                  </p>
                  <ol className="text-xs text-slate-600 space-y-1 list-decimal ml-4">
                    <li>Select <strong>Client Rates</strong> tab</li>
                    <li>Choose a <strong>Client</strong> from the dropdown</li>
                    <li>Select a <strong>Country</strong> from the MCC/MNC database</li>
                    <li>Check the <strong>Operators</strong> to apply rates to (or Select All)</li>
                    <li>Enter the <strong>Rate ($/SMS)</strong></li>
                    <li>Click <strong>Add Rate(s)</strong></li>
                  </ol>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <h5 className="text-sm font-medium text-slate-700 mb-2">Method 2: Individual Client Rates</h5>
                  <p className="text-xs text-slate-500 mb-2">
                    Go to <strong>Dashboard → Clients → Client Rates</strong>
                  </p>
                  <ol className="text-xs text-slate-600 space-y-1 list-decimal ml-4">
                    <li>Click <strong>+ Add Rate</strong></li>
                    <li>Select the <strong>Client</strong></li>
                    <li>Choose a <strong>Country</strong> (country name from MCC/MNC DB)</li>
                    <li>Select the specific <strong>Operator (MCC/MNC)</strong></li>
                    <li>Enter the <strong>Rate ($/SMS)</strong></li>
                    <li>Click <strong>Save Rate</strong></li>
                  </ol>
                </div>
              </div>

              <div className="bg-white rounded-lg border p-4 mb-3">
                <h5 className="text-sm font-medium text-slate-700 mb-2">📥 Download Rate Sheet with Markup</h5>
                <p className="text-xs text-slate-500 mb-2">
                  From <strong>Rate Management</strong>, you can download a CSV of all rates with your markup percentage:
                </p>
                <ol className="text-xs text-slate-600 space-y-1 list-decimal ml-4">
                  <li>Set the <strong>% markup</strong> field (e.g., 10 for 10% markup)</li>
                  <li>Click <strong>📥 Download CSV</strong></li>
                  <li>The CSV includes: Country, Operator, MCC, and Marked-Up Rate</li>
                </ol>
              </div>

              <div className="bg-white rounded-lg border p-4">
                <h5 className="text-sm font-medium text-slate-700 mb-2">💰 Rate Calculation Logic</h5>
                <ul className="text-xs text-slate-600 space-y-1">
                  <li><strong>Per-Operator Rate:</strong> If a client has a rate for the specific MCC/MNC, that rate is used</li>
                  <li><strong>Default Rate:</strong> If no per-operator rate exists, the global platform rate from super admin settings is used</li>
                  <li><strong>Supplier Cost:</strong> Each message is routed through suppliers with their own cost rates</li>
                  <li><strong>Profit = Client Rate - Supplier Cost</strong></li>
                </ul>
              </div>
            </div>

            {/* Step 4: Supplier Rates */}
            <div className="border rounded-xl p-6 mb-6 bg-gradient-to-r from-orange-50 to-amber-50">
              <h4 className="font-semibold text-slate-800 mb-2">
                <span className="bg-orange-600 text-white w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-bold mr-2">4</span>
                Set Supplier Rates (Per-Country Cost)
              </h4>
              <p className="text-sm text-slate-600 mb-3">
                Configure what each supplier charges per SMS for different countries and operators.
              </p>
              <div className="bg-white rounded-lg border p-4 mb-3">
                <h5 className="text-sm font-medium text-slate-700 mb-2">Via Bulk Rate Management</h5>
                <p className="text-xs text-slate-500 mb-2">
                  Go to <strong>Dashboard → Rates → Rate Management</strong> → <strong>Supplier Rates</strong> tab
                </p>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <h5 className="text-sm font-medium text-slate-700 mb-2">Via Individual Supplier Rates</h5>
                <p className="text-xs text-slate-500 mb-2">
                  Go to <strong>Dashboard → Suppliers → Supplier Rates</strong> → <strong>+ Add Rate</strong>
                </p>
                <ol className="text-xs text-slate-600 space-y-1 list-decimal ml-4">
                  <li>Select the <strong>Supplier</strong></li>
                  <li>Choose a <strong>Country</strong> from the MCC/MNC database</li>
                  <li>Select the specific <strong>Operator (MCC/MNC)</strong></li>
                  <li>Enter the <strong>Cost ($/SMS)</strong> that this supplier charges</li>
                  <li>Click <strong>Save Rate</strong></li>
                </ol>
              </div>
            </div>

            {/* Step 5: Monitor & Test */}
            <div className="border rounded-xl p-6 mb-6 bg-gradient-to-r from-teal-50 to-cyan-50">
              <h4 className="font-semibold text-slate-800 mb-2">
                <span className="bg-teal-600 text-white w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-bold mr-2">5</span>
                Monitor & Test Your Setup
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { page: "Bind Status", desc: "Real-time view of all SMPP connections (ESME clients and SMSC suppliers)", href: "/dashboard/bind-status" },
                  { page: "SMS Logs", desc: "Search and filter all sent messages with DLR status, cost, and routing info", href: "/dashboard/messages" },
                  { page: "SMS Inbox", desc: "View incoming MO (Mobile Originated) messages from clients", href: "/dashboard/inbox" },
                  { page: "Test SMS", desc: "Send a test message through any route plan to verify end-to-end delivery", href: "/dashboard/test-sms" },
                  { page: "Reports", desc: "Generate traffic reports, revenue analysis, and delivery statistics", href: "/dashboard/reports" },
                  { page: "Number Validation", desc: "Validate phone numbers and detect carrier/line type before sending", href: "/dashboard/number-validation" },
                ].map((item) => (
                  <Link key={item.page} href={item.href} className="bg-white rounded-lg border p-3 hover:border-teal-300 hover:shadow-sm transition group">
                    <h5 className="text-sm font-medium text-slate-700 group-hover:text-teal-700">{item.page}</h5>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Quick Reference: API Endpoints */}
            <div className="border rounded-xl p-6 bg-gradient-to-r from-slate-50 to-gray-50">
              <h4 className="font-semibold text-slate-800 mb-2">
                <span className="bg-slate-600 text-white w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-bold mr-2">📡</span>
                Quick Reference: Key Platform Pages
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {[
                  { label: "Add Client", href: "/dashboard/clients" },
                  { label: "Add Supplier", href: "/dashboard/suppliers" },
                  { label: "Bulk Rates", href: "/dashboard/rates" },
                  { label: "Client Rates", href: "/dashboard/clients/rates" },
                  { label: "Supplier Rates", href: "/dashboard/suppliers/rates" },
                  { label: "MCC/MNC Database", href: "/dashboard/mcc-mnc" },
                  { label: "Route Plans", href: "/dashboard/route-plans" },
                  { label: "Trunks & Routes", href: "/dashboard/trunks" },
                  { label: "Bind Status", href: "/dashboard/bind-status" },
                  { label: "SMS Logs", href: "/dashboard/messages" },
                  { label: "Campaigns", href: "/dashboard/campaigns" },
                  { label: "Invoices", href: "/dashboard/invoices" },
                ].map((item) => (
                  <Link key={item.label} href={item.href} className="bg-white border rounded-lg px-3 py-2 hover:border-blue-300 hover:bg-blue-50 transition text-slate-600 hover:text-blue-700 font-medium">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedClient && tab !== "Platform Guide" && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-lg">No clients configured</p>
          <p className="text-sm mt-1">Create a client first to view API settings</p>
        </div>
      )}
    </div>
  );
}
