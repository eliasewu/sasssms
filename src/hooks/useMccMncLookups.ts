"use client";

import { useMemo } from "react";

/** MCC/MNC database entry (shared across rate pages) */
export interface MccMncEntry {
  id: number;
  mcc: string;
  mnc: string;
  countryCode: string;
  countryName: string;
  networkName: string;
}

/**
 * Derives 3 O(1) lookup structures from an MCC/MNC database dump:
 *  - countryNameMap:   countryCode → countryName
 *  - networkNameMap:   mcc         → networkName
 *  - countries:        sorted unique country names
 */
export function useMccMncLookups(list: MccMncEntry[]) {
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

  return { countryNameMap, networkNameMap, countries } as const;
}
