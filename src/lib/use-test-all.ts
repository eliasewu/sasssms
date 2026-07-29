"use client";

import { useState } from "react";

/**
 * Generic hook for "Test All" functionality used across translation dashboard pages.
 *
 * Provides:
 * - testAllResults: typed results array (or null when not shown)
 * - runTestAll(testValue): builds and displays per-rule results
 * - copyResultsAsCsv(): copies results to clipboard as CSV
 * - clearTestAll(): hides the results panel
 * - copied: boolean for "✅ Copied!" feedback
 *
 * @param buildResults - Called by runTestAll to compute per-rule results from testValue.
 *   Receives the raw test input and must return an array of result objects.
 * @param csvHeader - First row of CSV output (comma-separated column names).
 * @param csvRow - Converts a single result item into a CSV row string.
 *   Responsible for escaping quotes and formatting cell values.
 */
export function useTestAll<T>(
  buildResults: (testValue: string) => T[],
  csvHeader: string,
  csvRow: (result: T) => string,
) {
  const [testAllResults, setTestAllResults] = useState<T[] | null>(null);
  const [copied, setCopied] = useState(false);

  const runTestAll = (testValue: string) => {
    if (!testValue.trim()) return;
    setTestAllResults(buildResults(testValue));
  };

  const copyResultsAsCsv = () => {
    if (!testAllResults) return;
    const rows = testAllResults.map(csvRow);
    const csv = [csvHeader, ...rows].join("\n");
    navigator.clipboard.writeText(csv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const clearTestAll = () => setTestAllResults(null);

  return {
    testAllResults,
    setTestAllResults,
    copied,
    runTestAll,
    copyResultsAsCsv,
    clearTestAll,
  };
}
