"use client";

import { useEffect, useState } from "react";

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // localStorage can be unavailable (private mode / quota exceeded) — the
    // sidebar simply won't be remembered, which is acceptable degradation.
  }
}

/**
 * Sidebar section state that remembers the last-opened section per user
 * (persisted in localStorage) so it stays expanded across page reloads.
 *
 * - Restored on mount AFTER hydration, so the SSR-rendered default never
 *   causes a hydration mismatch.
 * - Persisted on every change; the key is removed when the section is
 *   collapsed (null), so the default applies again on the next visit.
 * - Only values present in `validTitles` are restored — a stale or corrupted
 *   value can never leave the sidebar empty.
 */
export function usePersistedExpandedSection(
  key: string,
  fallback: string,
  validTitles: string[]
) {
  const [expandedSection, setExpandedSection] = useState<string | null>(fallback);

  // Restore the remembered section once, after hydration. Deliberate
  // post-hydration restore: reading localStorage during the initial render
  // would mismatch the SSR output (server always renders the fallback).
  useEffect(() => {
    const stored = readStored(key);
    if (stored && validTitles.includes(stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpandedSection(stored);
    }
  }, [key, validTitles]);

  // Persist every change (drop the key when everything is collapsed).
  useEffect(() => {
    writeStored(key, expandedSection);
  }, [key, expandedSection]);

  return [expandedSection, setExpandedSection] as const;
}
