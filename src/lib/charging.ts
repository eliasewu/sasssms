/**
 * Unified charging mode resolution.
 *
 * Reads the new `charging_mode` column (preferred), falling back to legacy
 * `billing_mode` + `force_dlr` for backward compatibility.
 *
 * Modes:
 *   'on_submit'          — charge immediately on message submit
 *   'on_dlr'             — charge only on successful DLR delivery
 *   'force_dlr'          — charge immediately + push simulated DELIVERED DLR now
 *   'force_dlr_timeout'  — charge immediately + schedule timeout (dlr_timeout sec);
 *                          on expiry, if no real DLR, auto-deliver and push DLR
 */

export type ChargingMode = "on_submit" | "on_dlr" | "force_dlr" | "force_dlr_timeout";

/**
 * Resolve the effective charging mode from a row that may have
 * charging_mode, billing_mode, and force_dlr columns.
 *
 * Preference: charging_mode (new) > force_dlr=true → 'force_dlr' (old) > billing_mode='dlr' → 'on_dlr' (old) > 'on_submit'
 */
export function resolveChargingMode(row: Record<string, unknown>): ChargingMode {
  // New column takes absolute precedence
  const cm = row.charging_mode as string | null;
  if (cm && ["on_submit", "on_dlr", "force_dlr", "force_dlr_timeout"].includes(cm)) {
    return cm as ChargingMode;
  }

  // Fall back to legacy columns
  if (row.force_dlr as boolean) return "force_dlr";
  if ((row.billing_mode as string) === "dlr") return "on_dlr";

  return "on_submit";
}

/**
 * Returns true if this mode charges immediately at submit time.
 */
export function isSubmitCharged(mode: ChargingMode): boolean {
  return mode !== "on_dlr";
}

/**
 * Returns true if this mode forces an immediate DLR push.
 */
export function isForceDlr(mode: ChargingMode): boolean {
  return mode === "force_dlr";
}

/**
 * Returns true if this mode schedules a timeout-based force DLR.
 */
export function isForceDlrTimeout(mode: ChargingMode): boolean {
  return mode === "force_dlr_timeout";
}

/**
 * Returns true if this mode forces a DLR outcome (immediate or timed).
 */
export function isForceDlrOrTimeout(mode: ChargingMode | null | undefined): boolean {
  return !!mode && (mode === "force_dlr" || mode === "force_dlr_timeout");
}

/**
 * Returns true if this mode defers charging until DLR arrives.
 */
export function isDlrCharged(mode: ChargingMode): boolean {
  return mode === "on_dlr";
}

/**
 * Build a standardized DLR payload for force_dlr / force_dlr_timeout.
 */
export function buildForceDlrPayload(args: {
  messageId: string;
  supplierMessageId?: string | null;
  destination: string;
  source: string;
  cost: number;
  routeName: string;
  supplierName: string;
  forceDlr: boolean;
}) {
  return {
    message_id: args.messageId,
    destination: args.destination,
    source: args.source,
    status: "DELIVERED",
    cost: args.cost,
    timestamp: new Date().toISOString(),
    route_name: args.routeName,
    supplier_name: args.supplierName,
    supplier_message_id: args.supplierMessageId || null,
    force_dlr: args.forceDlr,
  };
}
