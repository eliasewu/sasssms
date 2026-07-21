"use client";

import { useMemo } from "react";

/** MCC/MNC database entry (shared across rate pages) */
export interface MccMncEntry {
  id: number;
  mcc: string;
  mnc: string;
  mccmnc: string;
  countryCode: string;
  countryName: string;
  networkName: string;
}

/**
 * Derives O(1) lookup structures from an MCC/MNC database dump:
 *  - countryByMcc:     mcc           → countryName (MCC uniquely identifies a country)
 *  - countryNameMap:   countryCode   → countryName (fallback, may be ambiguous)
 *  - networkNameMap:   mcc           → networkName
 *  - countries:        sorted unique country names
 *
 * NOTE: countryByMcc is the PRIMARY lookup for country name because
 * country_code values in mcc_mnc_database are non-standard abbreviations
 * that collide across countries (e.g. "Al" = Albania AND Algeria).
 * MCC codes are globally unique and always identify the correct country.
 */
export function useMccMncLookups(list: MccMncEntry[]) {
  const countryByMcc = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of list) {
      if (!map.has(d.mcc)) map.set(d.mcc, d.countryName);
    }
    return map;
  }, [list]);

  const countryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of list) {
      if (!map.has(d.countryCode)) map.set(d.countryCode, d.countryName);
    }
    return map;
  }, [list]);

  const networkNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of list) {
      if (!map.has(d.mcc)) map.set(d.mcc, d.networkName);
    }
    return map;
  }, [list]);

  const countries = useMemo(
    () => [...new Set(list.map((d) => d.countryName))].sort(),
    [list],
  );

  return { countryByMcc, countryNameMap, networkNameMap, countries } as const;
}
