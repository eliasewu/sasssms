"use client";

import { useCallback, useEffect, useState } from "react";

interface ProxyReach {
  id: number; name: string; host: string; port: number; reachable: boolean;
}

interface MeshData {
  available: boolean;
  reason?: string;
  server?: { name: string; dnsName: string; ip: string; os: string } | null;
  peers?: { name: string; dnsName: string; ip: string; os: string; online: boolean }[];
  proxies?: ProxyReach[];
  authKeyConfigured?: boolean;
  checkedAt?: string;
}

const OS_ICON: Record<string, string> = { windows: "🪟", linux: "🐧", macos: "🍎", android: "🤖", ios: "📱" };

export default function TailscaleMeshPanel() {
  const [data, setData] = useState<MeshData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Same .then() structure used across the dashboard pages — keeps
  // setState strictly inside async callbacks.
  const load = useCallback(() => {
    fetch("/api/tenant/tailscale/status")
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
        return d;
      })
      .then((d) => { setData(d); setError(null); setLoading(false); })
      .catch((e) => { setError((e as Error).message); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh is event-driven (not an effect) so it may flip the loading flag.
  const refresh = () => { setLoading(true); setError(null); load(); };

  const onlinePeers = (data?.peers || []).filter(p => p.online).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-slate-800 to-indigo-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌐</span>
          <div>
            <h3 className="font-bold">Tailscale Mesh Connection</h3>
            <p className="text-xs text-slate-300">
              {data?.server?.ip
                ? `Server on mesh at ${data.server.ip}`
                : "Server → residential proxy connectivity over Tailscale"}
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Checking…" : "↻ Refresh"}
        </button>
      </div>

      <div className="p-5 space-y-5">
        {loading && !data ? (
          <div className="text-sm text-slate-400 animate-pulse">Checking Tailscale status…</div>
        ) : error ? (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">Failed to load: {error}</div>
        ) : data && !data.available ? (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="font-semibold mb-1">
              {data.reason === "not_installed" ? "Tailscale is not installed on the Net2APP server" : "This server is not connected to Tailscale"}
            </p>
            <p className="text-amber-700/90">
              Install and join the tailnet that includes your residential machines:
              <code className="block mt-2 bg-amber-100 px-2 py-1 rounded text-xs">
                curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up
              </code>
            </p>
          </div>
        ) : data && data.available ? (
          <>
            {/* Auto-connect status */}
            {data.authKeyConfigured !== undefined && (
              <div className={`flex items-center justify-between rounded-lg px-4 py-2.5 border ${
                data.authKeyConfigured ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-lg">⚡</span>
                  <div>
                    <span className="font-medium text-slate-800">Auto-connect installers</span>
                    <p className="text-xs text-slate-500">
                      {data.authKeyConfigured
                        ? "New home PCs join the tailnet automatically — no login URL needed"
                        : "Installers use the interactive login URL — ask your provider to enable an auth key"}
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
                  data.authKeyConfigured ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"
                }`}>
                  {data.authKeyConfigured ? "Enabled" : "Disabled"}
                </span>
              </div>
            )}

            {/* Server */}
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">This server</div>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{OS_ICON[data.server?.os || ""] || "🖥️"}</span>
                  <div>
                    <div className="font-medium text-slate-800">{data.server?.name || "this server"}</div>
                    <div className="text-xs text-slate-400 font-mono">{data.server?.ip}</div>
                  </div>
                </div>
                <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-medium">● Connected</span>
              </div>
            </div>

            {/* Peers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Your mesh machines</span>
                <span className="text-xs text-slate-400">{onlinePeers}/{data.peers?.length || 0} online</span>
              </div>
              {data.peers && data.peers.length > 0 ? (
                <div className="space-y-2">
                  {data.peers.map((p, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg">{OS_ICON[p.os] || "🖥️"}</span>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 truncate">{p.name}</div>
                          <div className="text-xs text-slate-400 font-mono">{p.ip}</div>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
                        p.online ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"
                      }`}>
                        {p.online ? "Online" : "Offline"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No Tailscale peers match your configured proxies yet.</p>
              )}
            </div>

            {/* Proxy reachability */}
            {data.proxies && data.proxies.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Proxy reachability (server → proxy)</span>
                  <span className="text-xs text-slate-400">TCP {data.proxies.filter(p => p.reachable).length}/{data.proxies.length} reachable</span>
                </div>
                <div className="space-y-2">
                  {data.proxies.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 truncate">{p.name}</div>
                        <div className="text-xs text-slate-400 font-mono">{p.host}:{p.port}</div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
                        p.reachable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                      }`}>
                        {p.reachable ? "● Reachable" : "○ Unreachable"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
