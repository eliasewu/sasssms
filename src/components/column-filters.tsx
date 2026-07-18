"use client";

import { useState, useMemo, useCallback } from "react";

/**
 * Filter configuration for a single column
 */
export interface ColumnFilterDef {
  /** Unique key matching the data property */
  key: string;
  /** Placeholder text shown in the filter input */
  placeholder?: string;
  /** Optional: custom filter function. Default: case-insensitive substring match */
  filterFn?: (value: unknown, filterText: string) => boolean;
}

/**
 * Hook: manages per-column filter state and provides a filter function
 */
export function useColumnFilters(filters: ColumnFilterDef[]) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const set = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearAll = useCallback(() => {
    setValues({});
  }, []);

  const toggle = useCallback(() => {
    setShowFilters((prev) => !prev);
    if (showFilters) setValues({}); // clear when hiding
  }, [showFilters]);

  /** Returns true if any filter is active */
  const hasActive = useMemo(() => {
    return Object.values(values).some((v) => v.trim() !== "");
  }, [values]);

  /**
   * Filter an array of data objects against all active column filters.
   * A row matches if it passes ALL active filters (AND logic).
   */
  const filterData = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: any[]): any[] => {
      const activeFilters = filters.filter((f) => {
        const v = values[f.key];
        return v && v.trim() !== "";
      });

      if (activeFilters.length === 0) return data;

      return data.filter((row) => {
        return activeFilters.every((f) => {
          const rawValue = row[f.key];
          const filterText = values[f.key].toLowerCase().trim();

          if (f.filterFn) {
            return f.filterFn(rawValue, filterText);
          }

          // Default: case-insensitive substring match
          if (rawValue == null) return false;
          const str = String(rawValue).toLowerCase();
          return str.includes(filterText);
        });
      });
    },
    [filters, values]
  );

  return { values, set, clearAll, toggle, showFilters, hasActive, filterData };
}

/**
 * Renders a row of inline filter inputs below the table header row.
 * Designed to be placed inside <thead> after the header <tr>.
 */
export function FilterRow({
  filters,
  values,
  onChange,
  colSpan,
}: {
  filters: ColumnFilterDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  colSpan?: number;
}) {
  return (
    <tr className="bg-slate-50 border-b">
      {filters.map((f) => (
        <th key={f.key} className="px-2 py-1.5">
          <input
            type="text"
            value={values[f.key] || ""}
            onChange={(e) => onChange(f.key, e.target.value)}
            placeholder={f.placeholder || `Filter...`}
            className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] font-normal outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 placeholder:text-slate-300 transition-colors"
          />
        </th>
      ))}
      {colSpan !== undefined && colSpan > 0 && (
        <th colSpan={colSpan} className="px-2 py-1.5" />
      )}
    </tr>
  );
}

/**
 * Compact filter toggle button — shows a magnifying glass with filter count badge
 */
export function FilterToggle({
  showFilters,
  hasActive,
  activeCount,
  onClick,
}: {
  showFilters: boolean;
  hasActive: boolean;
  activeCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={showFilters ? "Hide column filters" : "Show column filters"}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        showFilters || hasActive
          ? "bg-blue-600 text-white shadow-sm"
          : "bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600"
      }`}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span>Filter{showFilters ? "s" : ""}</span>
      {hasActive && !showFilters && (
        <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
          {activeCount}
        </span>
      )}
      {showFilters && (
        <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
    </button>
  );
}
