"use client";

import { useState, useEffect } from "react";

type Status = "loading" | "healthy" | "degraded" | "error";

export default function StatusBadge() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/public/health");
        if (!cancelled) {
          setStatus(res.ok ? "healthy" : "degraded");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    check(); // initial check
    const interval = setInterval(check, 60_000); // refresh every 60s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const config = {
    loading:  { dot: "bg-gray-400", text: "Checking...",        label: "Checking system status" },
    healthy:  { dot: "bg-green-500 animate-pulse", text: "All Systems Operational", label: "All systems operational — view status page" },
    degraded: { dot: "bg-red-500 animate-pulse",  text: "Service Degraded",        label: "Some servers are offline — view details" },
    error:    { dot: "bg-amber-500",              text: "Status Unavailable",       label: "Cannot reach health endpoint" },
  }[status];

  return (
    <span
      title={config.label}
      className="inline-flex items-center gap-2 text-xs"
    >
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      <span className={status === "healthy" ? "text-green-300" : status === "degraded" ? "text-red-300" : status === "error" ? "text-amber-300" : "text-gray-400"}>
        {config.text}
      </span>
    </span>
  );
}
