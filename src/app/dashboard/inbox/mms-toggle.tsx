"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * MMS Forwarding toggle — per-tenant control over whether [MMS] placeholder
 * MOs (WAP_PUSH MMS notifications from the Android gateway) are stored in
 * the SMS inbox. Lives on the Inbox page since it controls inbox contents.
 */
export default function MmsForwardToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/mms-settings");
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setEnabled(data.enabled === true);
    } catch {
      setError("Could not load MMS setting");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async () => {
    if (enabled === null || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/tenant/mms-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!res.ok) throw new Error("save failed");
      const data = await res.json();
      setEnabled(data.enabled === true);
    } catch {
      setError("Could not save MMS setting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={enabled === true}
        disabled={enabled === null || saving}
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          enabled === true ? "bg-blue-600" : "bg-slate-300"
        } ${enabled === null || saving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled === true ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <div>
        <div className="text-sm font-medium text-slate-700">
          {enabled === null
            ? "Loading MMS setting..."
            : enabled
              ? "MMS notifications are forwarded to this inbox"
              : "MMS notifications are not forwarded"}
        </div>
        <div className="text-xs text-slate-500">
          [MMS] placeholder messages from Android gateways (attachments are
          never downloaded)
        </div>
      </div>
      {saving && <span className="text-xs text-slate-400">Saving…</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
