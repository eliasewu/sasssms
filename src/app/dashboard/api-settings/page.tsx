"use client";

import { useState, useEffect, useCallback } from "react";

interface Client {
  id: number;
  name: string;
  smpp_username: string;
  smpp_password: string;
  http_api_key: string;
  enable_http_api: boolean;
  smpp_port: number;
  dlr_callback_url: string;
  rate_per_sms: string;
  max_tps: number;
}

const TABS = ["HTTP API", "SMPP Settings", "Code Examples"];

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
                  <span>{selectedClient.dlr_callback_url || "Not configured"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rate Info */}
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">Rate & Limits</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-600 font-medium">Rate per SMS</p>
                <p className="text-2xl font-bold text-blue-800">${parseFloat(selectedClient.rate_per_sms || "0").toFixed(6)}</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-xs text-purple-600 font-medium">Max TPS</p>
                <p className="text-2xl font-bold text-purple-800">{selectedClient.max_tps || "Unlimited"}</p>
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
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Note:</strong> The same username/password works for both SMPP and HTTP API. 
                Authentication is unified — configure once, use everywhere.
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

      {!selectedClient && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-lg">No clients configured</p>
          <p className="text-sm mt-1">Create a client first to view API settings</p>
        </div>
      )}
    </div>
  );
}
