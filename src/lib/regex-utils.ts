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
