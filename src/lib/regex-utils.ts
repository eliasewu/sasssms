/**
 * Build a RegExp from a stored pattern string, supporting inline flags like (?i).
 *
 * JavaScript's RegExp constructor does NOT support inline flags like (?i) or (?ims).
 * These are commonly used in database-stored regex patterns (originating from PCRE/MySQL).
 * This helper strips recognized inline flags and passes them as the constructor's flags argument.
 *
 * Supported inline flags: i (case-insensitive), m (multiline), s (dotAll)
 *
 * Example:
 *   buildRegex('(?i)(spam|scam)') → /(spam|scam)/i
 *   buildRegex('^8801[3-9]')     → /^8801[3-9]/
 *   buildRegex('(?ims)^pattern')  → /^pattern/mis
 */
export function buildRegex(pattern: string, extraFlags?: string): RegExp {
  let flags = extraFlags || "";
  let cleanPattern = pattern;

  // Strip leading inline flags: (?i), (?im), (?ims), etc.
  const inlineMatch = pattern.match(/^\(\?([ims]+)\)/);
  if (inlineMatch) {
    flags += inlineMatch[1];
    cleanPattern = pattern.slice(inlineMatch[0].length);
  }

  // Deduplicate flags
  const uniqueFlags = [...new Set(flags.split(""))].join("");

  return new RegExp(cleanPattern, uniqueFlags);
}

/**
 * Quick check if a regex pattern is safe (no exponential backtracking risk).
 * Uses buildRegex to also validate the pattern syntax.
 */
export function isSafeRegex(pattern: string): boolean {
  if (!pattern || pattern.trim() === "") return false;
  // Reject patterns with nested quantifiers like (a+)+b
  const nestedQuantifier = /\([^)]*[+*{][^)]*\)[+*{]/;
  if (nestedQuantifier.test(pattern)) return false;
  // Validate syntax by attempting to build the regex
  try {
    buildRegex(pattern);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert PCRE-style backreferences (\1, \2, …) in a replacement string to
 * JavaScript's `$1, $2, …` form so `String.replace(regex, replacement)` fills
 * in capture groups. `\0` maps to `$&` (the whole match).
 *
 * This lets users write rules like:
 *   match `(\d+)\s(\d+)` → replace `\1\2`   ("123 456" → "123456")
 *   match `(.*\d+)-(\d+)` → replace `\1\2`  ("123-456" → "123456")
 *   match `\D*(\d{4,})\D*` → replace `Your activation key is \1`
 *
 * Existing `$1` style references are left untouched.
 */
export function convertBackrefs(replacement: string): string {
  if (!replacement) return replacement;
  return replacement.replace(/\\([0-9])/g, (_m, d: string) =>
    d === "0" ? "$&" : "$" + d
  );
}

/** Determine TON (Type of Number) from an address. 1=International, 5=Alphanumeric, 0=Unknown */
export function determineTon(address: string): number {
  if (!address) return 0;
  // Alphanumeric sender IDs (non-numeric)
  if (!/^[\d+]+$/.test(address)) return 5;
  // International numbers (start with +)
  if (address.startsWith("+")) return 1;
  // Numeric-only: assume international if long enough, otherwise unknown
  return address.length >= 10 ? 1 : 0;
}

/** Determine NPI (Numbering Plan Indicator). 1=ISDN/E.164, 0=Unknown */
export function determineNpi(address: string): number {
  if (!address) return 0;
  // Alphanumeric → unknown NPI
  if (!/^[\d+]+$/.test(address)) return 0;
  // Numeric/international → ISDN
  return 1;
}
