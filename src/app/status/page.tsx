"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ServerInfo {
  id: string;
  country: string;
  city: string;
  countryCodes: string;
  ipAddress: string;
  port: number;
  isActive: boolean;
  status: "online" | "offline" | "unknown";
  lastChecked: string | null;
}

interface StatusData {
  servers: ServerInfo[];
  cached: boolean;
  nextUpdate: string;
}

const COUNTRY_FLAGS: Record<string, string> = {
  Canada: "🇨🇦", Poland: "🇵🇱", France: "🇫🇷", USA: "🇺🇸",
  Germany: "🇩🇪", "United Kingdom": "🇬🇧", Singapore: "🇸🇬",
};

function getFlag(loc: ServerInfo): string {
  const firstCC = (loc.countryCodes || "").split(",")[0]?.trim().toUpperCase();
  if (firstCC && firstCC.length === 2) {
    return String.fromCodePoint(...[...firstCC].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  }
  return COUNTRY_FLAGS[loc.country] || "🌍";
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function ServerStatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [liveConnected, setLiveConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [transport, setTransport] = useState<"sse" | "poll" | null>(null);
  const [pollErrors, setPollErrors] = useState(0);

  // Initial fetch for immediate data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/public/server-status");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Server error (${res.status})`);
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setLastRefresh(new Date());
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Unable to load server status.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Live updates — transport-agnostic: EventSource (SSE) preferred, polling fallback
  useEffect(() => {
    // Check if browser supports EventSource (SSE)
    const supportsSSE = typeof EventSource !== "undefined";

    if (supportsSSE) {
      // ── Primary: SSE via EventSource ──
      setTransport("sse");
      const eventSource = new EventSource("/api/public/server-status/stream");

      eventSource.addEventListener("open", () => {
        setLiveConnected(true);
        setReconnecting(false);
      });

      eventSource.addEventListener("connected", () => {
        setLiveConnected(true);
      });

      eventSource.addEventListener("update", (e) => {
        try {
          const payload = JSON.parse(e.data);
          setData({
            servers: payload.servers,
            cached: false,
            nextUpdate: new Date(Date.now() + 30_000).toISOString(),
          });
          setLastRefresh(new Date(payload.timestamp));
          setLiveConnected(true);
          setReconnecting(false);
        } catch {}
      });

      eventSource.addEventListener("heartbeat", () => {
        setLiveConnected(true);
      });

      eventSource.addEventListener("error", () => {
        setLiveConnected(false);
        if (eventSource.readyState !== EventSource.CLOSED) {
          setReconnecting(true);
        }
      });

      return () => { eventSource.close(); };
    } else {
      // ── Fallback: HTTP polling every 15s ──
      setTransport("poll");
      setLiveConnected(true); // polling is always "connected"

      const poll = async () => {
        try {
          const res = await fetch("/api/public/server-status");
          if (res.ok) {
            const json = await res.json();
            setData(json);
            setLastRefresh(new Date());
            setPollErrors(0);
          } else {
            setPollErrors((n) => n + 1);
          }
        } catch {
          setPollErrors((n) => n + 1);
        }
      };

      // Initial poll immediately (SSE also does immediate push, so keep parity)
      poll();

      const interval = setInterval(poll, 15_000);
      return () => { clearInterval(interval); };
    }
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/public/server-status");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error (${res.status})`);
      }
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || "Unable to load server status.");
    } finally {
      setLoading(false);
    }
  };

  const servers = data?.servers || [];
  const onlineCount = servers.filter((s) => s.status === "online").length;
  const offlineCount = servers.filter((s) => s.status === "offline").length;
  // Use status !== "unknown" instead of ipAddress since IPs are sanitized in public API
  const totalDeployed = servers.filter((s) => s.status !== "unknown").length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div>
            <span className="text-lg font-bold text-gray-900">Net2APP</span>
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition disabled:opacity-50"
            >
              <span className={`${loading ? "animate-spin" : ""}`}>🔄</span>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 transition">
              ← Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1 mb-4">
            <span className={`w-2 h-2 rounded-full ${liveConnected ? "bg-green-500 animate-pulse" : reconnecting ? "bg-amber-400 animate-pulse" : onlineCount === totalDeployed && totalDeployed > 0 ? "bg-green-500" : "bg-amber-500"}`}></span>
            <span className="text-sm font-medium text-green-700">
              {totalDeployed === 0 ? "No servers deployed" : reconnecting ? "Reconnecting..." : `${onlineCount}/${totalDeployed} servers online`}
            </span>
            {liveConnected && transport === "sse" && <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold">LIVE (SSE)</span>}
            {liveConnected && transport === "poll" && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">LIVE (Poll)</span>}
            {reconnecting && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse">RECONNECTING</span>}
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">System Status</h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            Real-time health of all Net2APP server locations.{" "}
            {transport === "sse"
              ? "Status updates every 30 seconds via live stream."
              : transport === "poll"
              ? "Updates every 15 seconds via polling."
              : "Live updates loading..."}
          </p>
          {liveConnected && transport === "sse" ? (
            <p className="text-xs text-green-600 mt-2 flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              SSE Connected • Live updates active • Last update: {timeAgo(lastRefresh.toISOString())}
            </p>
          ) : liveConnected && transport === "poll" ? (
            <p className="text-xs text-blue-600 mt-2 flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
              Polling • Updates every 15s • Last refresh: {timeAgo(lastRefresh.toISOString())}
              {pollErrors >= 3 && <span className="text-red-500 ml-1">({pollErrors} failures)</span>}
            </p>
          ) : reconnecting ? (
            <p className="text-xs text-amber-600 mt-2 flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
              Reconnecting to live stream... • Last update: {timeAgo(lastRefresh.toISOString())}
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-2">
              Last refresh: {timeAgo(lastRefresh.toISOString())}
              {data?.cached && ` • Next update: ${new Date(data.nextUpdate).toLocaleTimeString()}`}
            </p>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-8">
            <p className="text-red-700 font-medium">{error}</p>
            <button onClick={fetchStatus} className="mt-3 text-sm text-red-600 hover:text-red-800 underline">Try again</button>
          </div>
        )}

        {/* Loading state */}
        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-500">Checking server status...</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && servers.length === 0 && !error && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">🖥️</div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No Server Locations Configured</h3>
            <p className="text-slate-500 text-sm">Server locations will appear here once configured by the administrator.</p>
          </div>
        )}

        {/* Server Grid */}
        {servers.length > 0 && (
          <div className="space-y-8">
            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
                <p className="text-3xl font-bold text-gray-900">{totalDeployed}</p>
                <p className="text-xs text-slate-500 mt-1">Total Servers</p>
              </div>
              <div className="bg-white rounded-xl border border-green-200 p-4 text-center shadow-sm">
                <p className="text-3xl font-bold text-green-600">{onlineCount}</p>
                <p className="text-xs text-green-600 mt-1">Online</p>
              </div>
              <div className={`bg-white rounded-xl border p-4 text-center shadow-sm ${offlineCount > 0 ? "border-red-200" : "border-slate-200"}`}>
                <p className={`text-3xl font-bold ${offlineCount > 0 ? "text-red-500" : "text-gray-400"}`}>{offlineCount}</p>
                <p className={`text-xs mt-1 ${offlineCount > 0 ? "text-red-500" : "text-slate-500"}`}>Offline</p>
              </div>
            </div>

            {/* Server cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {servers.map((server) => {
                const isDeployed = server.status !== "unknown";
                const isOnline = server.status === "online";
                const isOffline = server.status === "offline";

                return (
                  <div
                    key={server.id}
                    className={`rounded-2xl border shadow-sm transition ${
                      isDeployed
                        ? isOnline
                          ? "bg-white border-green-200"
                          : isOffline
                          ? "bg-white border-red-200"
                          : "bg-white border-slate-200"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="p-5">
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getFlag(server)}</span>
                          <div>
                            <p className="font-semibold text-gray-900">{server.country}</p>
                            <p className="text-xs text-slate-400">{server.city || "No city"}</p>
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            !isDeployed
                              ? "bg-slate-100 text-slate-500 border-slate-200"
                              : isOnline
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {!isDeployed ? "⚪ Not Deployed" : isOnline ? "🟢 Online" : "🔴 Offline"}
                        </span>
                      </div>

                      {/* Server details — IP addresses hidden for security */}
                      {isDeployed ? (
                        <div className="bg-slate-50 rounded-xl p-3 mb-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Location</span>
                            <span className="font-medium text-slate-700">{server.city || server.country}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Last Checked</span>
                            <span className="text-slate-500">{timeAgo(server.lastChecked)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Connection</span>
                            <span className={`flex items-center gap-1 ${isOnline ? "text-green-600" : "text-red-500"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-red-400"}`}></span>
                              {isOnline ? "Reachable" : "Unreachable"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-100 rounded-xl p-4 mb-3 text-center">
                          <p className="text-sm text-slate-400">Server not yet deployed</p>
                          <p className="text-xs text-slate-400 mt-1">Check back soon</p>
                        </div>
                      )}

                      {/* Status indicator bar */}
                      {isDeployed && (
                        <div className={`h-1.5 rounded-full ${
                          isOnline ? "bg-gradient-to-r from-green-400 to-green-500" : "bg-gradient-to-r from-red-300 to-red-400"
                        }`}>
                          <div className={`h-full rounded-full transition-all duration-1000 ${
                            isOnline ? "w-full" : "w-1/3"
                          }`} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
              <p className="text-sm text-blue-700">
                <strong>💡 What this means:</strong> TCP connectivity to the SMPP port (2775) is checked every 30 seconds.
                {onlineCount === totalDeployed && totalDeployed > 0
                  ? " All systems are healthy. Tenants can connect and send SMS normally."
                  : " Some servers may be experiencing issues. Affected tenants may experience connectivity problems."}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved. •{" "}
            <Link href="/" className="hover:text-slate-600 transition">net2app.com</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
