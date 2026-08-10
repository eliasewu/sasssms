/**
 * Lightweight MSISDN validity check.
 *
 * Used by WhatsApp/Telegram OTT and Business API delivery paths to reject
 * invalid destinations BEFORE sending. Invalid numbers are never charged and
 * surface as REJECTED / FAILED DLR (per Custom Server Billing Matrix rule 5 —
 * "Immediate Rejection Handling").
 *
 * Rules:
 *  - Must be purely numeric (after stripping +, spaces, dashes).
 *  - Total length between 7 and 15 digits (E.164).
 *  - Must resolve to a known country dial code (MCC lookup).
 */
import { lookupMccSync } from "@/lib/mcc-lookup-client";

export function isValidDestinationNumber(destination: string): boolean {
  if (!destination) return false;

  const cleaned = destination.replace(/[^0-9]/g, "");
  if (cleaned.length < 7 || cleaned.length > 15) return false;

  // Resolves to a recognized country dial code → valid MSISDN
  const { mcc } = lookupMccSync(destination);
  return !!mcc;
}
