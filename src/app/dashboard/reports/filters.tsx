"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

export default function ReportFilters({
  defaultType,
  defaultStart,
  defaultEnd,
}: {
  defaultType: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(window.location.search);
      params.set(key, value);
      params.delete(""); // clean empty keys
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname]
  );

  return (
    <div className="flex gap-2">
      <select
        defaultValue={defaultType}
        onChange={(e) => updateParam("type", e.target.value)}
        className="border rounded-lg px-3 py-2 text-sm"
      >
        <option value="hourly">Hourly</option>
        <option value="daily">Daily</option>
        <option value="monthly">Monthly</option>
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
