"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

// Same channel list as the SMS Logs filter — kept in sync so reports can be
// scoped per connection type (incl. Business API delivery stats).
const CONNECTION_TYPES = [
  { value: "", label: "All Types" },
  { value: "SMPP", label: "SMPP" },
  { value: "WhatsApp OTT", label: "💬 WhatsApp OTT" },
  { value: "Telegram OTT", label: "✈️ Telegram OTT" },
  { value: "CUSTOM_API", label: "🔌 Custom API" },
  { value: "Business API", label: "📨 Business API" },
  { value: "VOICE_OTP", label: "📞 Voice OTP" },
];

export default function ReportFilters({
  defaultType,
  defaultStart,
  defaultEnd,
  defaultConnectionType,
}: {
  defaultType: string;
  defaultStart: string;
  defaultEnd: string;
  defaultConnectionType: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(window.location.search);
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key); // "All Types" etc. → drop the param entirely
      }
      params.delete(""); // clean empty keys
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname]
  );

  return (
    <div className="flex gap-2 flex-wrap">
      <select
        defaultValue={defaultType}
        onChange={(e) => updateParam("type", e.target.value)}
        className="border rounded-lg px-3 py-2 text-sm"
      >
        <option value="hourly">Hourly</option>
        <option value="daily">Daily</option>
        <option value="monthly">Monthly</option>
      </select>
      <select
        defaultValue={defaultConnectionType}
        onChange={(e) => updateParam("connectionType", e.target.value)}
        className="border rounded-lg px-3 py-2 text-sm max-w-[180px]"
        title="Scope all charts to a single connection type"
      >
        {CONNECTION_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        type="date"
        defaultValue={defaultStart}
        onChange={(e) => updateParam("startDate", e.target.value)}
        className="border rounded-lg px-3 py-2 text-sm"
      />
      <input
        type="date"
        defaultValue={defaultEnd}
        onChange={(e) => updateParam("endDate", e.target.value)}
        className="border rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}
