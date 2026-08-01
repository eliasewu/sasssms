"use client";

import { useState, useEffect, useCallback } from "react";
import { useConfirmModal } from "@/components/confirm-modal";

interface ServerLocation {
  id: string; country: string; city: string; countryCodes: string;
  ipAddress: string; port: number; isActive: boolean;
  sshUser?: string; lastDeployed?: string; healthStatus?: string;
}

interface HealthInfo {
  healthStatus: string; details: string;
  uptime?: string; pm2Status?: string; ports?: string;
}

const FLAG_MAP: Record<string, string> = {
  Canada: "🇨🇦", France: "🇫🇷", Germany: "🇩🇪",
  "United Kingdom": "🇬🇧", Singapore: "🇸🇬", Australia: "🇦🇺",
};

export default function ServersPage() {
  const [servers, setServers] = useState<ServerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [healthChecking, setHealthChecking] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<Record<string, HealthInfo>>({});

  // Form state
  const [form, setForm] = useState({
    locationId: "canada",
    ipAddress: "",
    sshUser: "ubuntu",
    sshPass: "",
    suPass: "",
    port: 2775,
  });

  const { confirm: confirmDelete, modal: confirmModal } = useConfirmModal();

  const loadServers = useCallback(async () => {
    try {
      const res = await fetch("/api/super/servers");
      const data = await res.json();
      setServers(data.servers || []);
    } catch (err) {
      setMsg("Failed to load servers");
      setTimeout(() => setMsg(""), 3000);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadServers(); }, [loadServers]);

  const checkHealth = async (locationId: string) => {
    setHealthChecking(locationId);
    try {
      const res = await fetch(`/api/super/servers?check=${locationId}`);
      const data = await res.json();
      setHealthData((prev) => ({ ...prev, [locationId]: data.health }));
    } catch {
      setHealthData((prev) => ({
        ...prev,
        [locationId]: { healthStatus: "offline", details: "Check failed — network error" },
      }));
    } finally {
      setHealthChecking(null);
    }
  };

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ipAddress || !form.sshPass) {
      setMsg("IP Address and SSH Password are required");
      setTimeout(() => setMsg(""), 3000);
      return;
    }

    setDeploying(form.locationId);
    setMsg("");

    try {
      const res = await fetch("/api/super/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, deploy: true }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMsg(data.error || "Deployment failed");
        setTimeout(() => setMsg(""), 5000);
        return;
      }

      if (data.deployResult?.success) {
        setMsg(`✅ Server deployed to ${form.locationId} (${form.ipAddress})`);
      } else {
        setMsg(`⚠️ Deployed with warnings: ${data.deployResult?.message?.substring(0, 200)}`);
      }

      setTimeout(() => setMsg(""), 8000);
      setShowForm(false);
      loadServers();

      // Auto health check after 30 seconds
      setTimeout(() => checkHealth(form.locationId), 30000);
    } catch {
      setMsg("Network error during deployment");
      setTimeout(() => setMsg(""), 5000);
    } finally {
      setDeploying(null);
    }
  };

  const handleRemove = async (locationId: string, country: string) => {
    if (!await confirmDelete(`Remove server from "${country}"? This clears the IP and credentials but keeps the location.`)) return;
    try {
      const res = await fetch(`/api/super/servers?id=${locationId}`, { method: "DELETE" });
      if (res.ok) {
        setMsg(`Server removed from ${country}`);
        setTimeout(() => setMsg(""), 3000);
        loadServers();
      }
    } catch {
      setMsg("Failed to remove server");
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const getStatusBadge = (loc: ServerLocation) => {
    const h = healthData[loc.id];
    const status = h?.healthStatus || loc.healthStatus || "unknown";

    const styles: Record<string, string> = {
      online: "bg-green-100 text-green-700 border-green-200",
      offline: "bg-red-100 text-red-700 border-red-200",
      deploying: "bg-amber-100 text-amber-700 border-amber-200 animate-pulse",
      unknown: "bg-slate-100 text-slate-500 border-slate-200",
    };

    const labels: Record<string, string> = {
      online: "🟢 Online",
      offline: "🔴 Offline",
      deploying: "🟡 Deploying...",
      unknown: "⚪ Unknown",
    };

    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.unknown}`}>
        {labels[status] || labels.unknown}
      </span>
    );
  };

  const getFlag = (loc: ServerLocation) => {
    const firstCC = (loc.countryCodes || "").split(",")[0]?.trim().toUpperCase();
    if (firstCC && firstCC.length === 2) {
      return String.fromCodePoint(...[...firstCC].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
    }
    return FLAG_MAP[loc.country] || "🌍";
  };

  // Available locations for the deploy dropdown come from the API
  const availableLocations = servers;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading servers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🖥️ Server Manager</h2>
          <p className="text-sm text-slate-500">Deploy and manage servers across all locations</p>
        </div>
        <button
          onClick={() => {
            setForm({ locationId: "canada", ipAddress: "", sshUser: "ubuntu", sshPass: "", suPass: "", port: 2775 });
            setShowForm(true);
          }}
          className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow transition"
        >
          + Deploy New Server
        </button>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          msg.startsWith("✅") ? "bg-green-50 border border-green-200 text-green-700"
          : msg.startsWith("⚠️") ? "bg-amber-50 border border-amber-200 text-amber-700"
          : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {msg}
        </div>
      )}

      {/* Deploy Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">🚀 Deploy New Server</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            <form onSubmit={handleDeploy} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Server Location</label>
                <select
                  value={form.locationId}
                  onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm"
                >
                  {availableLocations.map((loc) => {
                    const alreadyDeployed = loc.ipAddress && loc.healthStatus === "online";
                    return (
                      <option key={loc.id} value={loc.id}>
                        {loc.country} — {loc.city || "No city"}{loc.ipAddress ? ` (${loc.ipAddress})` : " (no server)"}{alreadyDeployed ? " ⚠️ active" : ""}
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-slate-400 mt-1">Choose a location. Servers with active IPs are marked — deploying will overwrite.</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Server IP Address *</label>
                <input
                  value={form.ipAddress}
                  onChange={(e) => setForm({ ...form, ipAddress: e.target.value })}
                  placeholder="e.g. 149.56.22.232"
                  required
                  className="w-full border rounded-lg px-3 py-2.5 text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">SSH User *</label>
                  <input
                    value={form.sshUser}
                    onChange={(e) => setForm({ ...form, sshUser: e.target.value })}
                    placeholder="ubuntu"
                    required
                    className="w-full border rounded-lg px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">SMPP Port</label>
                  <input
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 2775 })}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">SSH Password *</label>
                <input
                  type="password"
                  value={form.sshPass}
                  onChange={(e) => setForm({ ...form, sshPass: e.target.value })}
                  placeholder="Server SSH password"
                  required
                  className="w-full border rounded-lg px-3 py-2.5 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Sudo Password</label>
                <input
                  type="password"
                  value={form.suPass}
                  onChange={(e) => setForm({ ...form, suPass: e.target.value })}
                  placeholder="Same as SSH if not different"
                  className="w-full border rounded-lg px-3 py-2.5 text-sm font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">Required for installing system packages. Leave blank to use SSH password.</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>📋 What gets installed:</strong> Node.js 22, PostgreSQL, Redis, Nginx, PM2, Java 21, Asterisk 20, Tailscale, plus the full Net2APP platform with auto-start and health monitoring.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!!deploying}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition"
                >
                  {deploying ? "⏳ Deploying (5-10 min)..." : "🚀 Deploy Server"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Server Grid */}
      {servers.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="text-5xl mb-4">🖥️</div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Servers Deployed</h3>
          <p className="text-sm text-slate-500 mb-6">Deploy your first server to get started. Choose a location, enter the server credentials, and we will handle the rest.</p>
          <button
            onClick={() => {
              setForm({ locationId: "canada", ipAddress: "", sshUser: "ubuntu", sshPass: "", suPass: "", port: 2775 });
              setShowForm(true);
            }}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow transition"
          >
            + Deploy First Server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {servers.map((loc) => (
            <div
              key={loc.id}
              className={`rounded-xl border shadow-sm transition ${
                loc.isActive && loc.ipAddress
                  ? "bg-white border-slate-200"
                  : "bg-slate-50 border-slate-200 opacity-60"
              }`}
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{getFlag(loc)}</span>
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{loc.country}</p>
                      <p className="text-xs text-slate-400">{loc.city || "No city"}</p>
                    </div>
                  </div>
                  {getStatusBadge(loc)}
                </div>

                {/* Server Info */}
                {loc.ipAddress ? (
                  <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">IP</span>
                      <span className="font-mono font-medium">{loc.ipAddress}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">SMPP Port</span>
                      <span className="font-mono">{loc.port}</span>
                    </div>
                    {loc.sshUser && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">SSH User</span>
                        <span className="font-mono">{loc.sshUser}</span>
                      </div>
                    )}
                    {loc.lastDeployed && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Last Deployed</span>
                        <span>{new Date(loc.lastDeployed).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-100 rounded-lg p-4 mb-3 text-center">
                    <p className="text-sm text-slate-400">No server assigned</p>
                    <p className="text-xs text-slate-400 mt-1">Deploy a server to this location</p>
                  </div>
                )}

                {/* Health Details */}
                {healthData[loc.id] && healthData[loc.id].healthStatus !== "unknown" && (
                  <div className={`rounded-lg p-3 mb-3 text-xs ${
                    healthData[loc.id].healthStatus === "online"
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}>
                    <p className="font-medium mb-1">
                      {healthData[loc.id].healthStatus === "online" ? "✅ System Healthy" : "❌ Issues Detected"}
                    </p>
                    {healthData[loc.id].uptime && (
                      <p className="text-slate-600">Uptime: {healthData[loc.id].uptime}</p>
                    )}
                    {healthData[loc.id].pm2Status && (
                      <p className="text-slate-600">PM2: {healthData[loc.id].pm2Status}</p>
                    )}
                    {healthData[loc.id].ports && (
                      <p className="text-slate-600 font-mono mt-0.5">Ports: {healthData[loc.id].ports}</p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {loc.ipAddress && (
                    <>
                      <button
                        onClick={() => checkHealth(loc.id)}
                        disabled={healthChecking === loc.id}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1"
                      >
                        {healthChecking === loc.id ? (
                          <><span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> Checking</>
                        ) : (
                          "🩺 Health Check"
                        )}
                      </button>
                      <button
                        onClick={() => handleRemove(loc.id, loc.country)}
                        className="px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 transition"
                      >
                        Remove
                      </button>
                    </>
                  )}
                  {!loc.ipAddress && (
                    <button
                      onClick={() => {
                        setForm({ locationId: loc.id, ipAddress: "", sshUser: "ubuntu", sshPass: "", suPass: "", port: 2775 });
                        setShowForm(true);
                      }}
                      className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-700 px-3 py-2 rounded-lg text-xs font-medium transition"
                    >
                      + Deploy Here
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Health Check All */}
      {servers.filter((s) => s.ipAddress).length > 0 && (
        <div className="flex justify-center pt-2">
          <button
            onClick={async () => {
              const active = servers.filter((s) => s.ipAddress);
              for (const s of active) {
                await checkHealth(s.id);
              }
            }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-lg text-sm font-medium transition"
          >
            🩺 Check All Servers
          </button>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
        <strong>🖥️ How it works:</strong> Deploy servers to each location. When a tenant signs up and selects a location (e.g., Canada), they get the SMPP IP for that server. Server switching is only available by super admin authorization on request.
      </div>

      {confirmModal}
    </div>
  );
}
