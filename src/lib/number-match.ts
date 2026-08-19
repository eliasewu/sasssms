/**
 * Number Translation — destination match-pattern builder.
 *
 * In the Number Translation UI the rule "Name" doubles as the country prefix
 * to match: a rule named "0091" applies to Indian destinations, "00880" to
 * Bangladesh, and so on. The stored match_pattern is derived from that name so
 * each country's rule only transforms its own numbers instead of matching
 * every number with the old hardcoded "^.*$".
 *
 * A destination may arrive in any of three equivalent dialing forms:
 *   "0091…"  (international "00" prefix)
 *   "+91…"   (international "+" prefix)
 *   "91…"    (bare, E.164 without "+")
 * A single prefix therefore expands into all three forms so the match works
 * universally regardless of how the number was dialled.
 *
 * Non-numeric names (e.g. a descriptive label or a seeded sample rule) fall
 * back to match-all ("^.*$") to preserve their global behaviour.
 */

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const escapeRegex = (s: string): string => s.replace(REGEX_SPECIALS, "\\$&");

/**
 * Split a rule name into the list of destination prefixes it should match.
 * Returns null when the name is not a pure dialing prefix (the caller should
 * fall back to a global match-all pattern).
 *
 * Examples:
 *   "0091"  → ["0091", "+91", "91"]
 *   "+880"  → ["00880", "+880", "880"]
 *   "91"    → ["0091", "+91", "91"]
 *   "00880" → ["00880", "+880", "880"]
 */
export function matchPrefixesForName(name: string): string[] | null {
  const trimmed = (name || "").trim();
  const m = trimmed.match(/^(\+?)(\d+)$/);
  if (!m || !m[2]) return null;

  // Reduce to the bare country code (drop a leading "+" and/or "00").
  let bare = m[2];
  if (bare.startsWith("00")) bare = bare.slice(2);
  if (!bare) return null;

  return [`00${bare}`, `+${bare}`, bare];
}

/**
 * Build the stored match_pattern for a Number Translation rule from its name.
 * Example: "0091" → "^(?:0091|\\+91|91)"; a non-numeric name → "^.*$".
 */
export function matchPatternForName(name: string): string {
  const prefixes = matchPrefixesForName(name);
  if (!prefixes) return "^.*$";
  return `^(?:${prefixes.map(escapeRegex).join("|")})`;
}
