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

// Unicode decimal-digit blocks (Nd). Each block is a contiguous run of 10
// codepoints whose value is `codepoint - blockStart`, i.e. the ASCII digit
// is `0x30 + (codepoint - blockStart)`.
const UNICODE_DIGIT_BLOCKS: Array<[number, number]> = [
  [0x0030, 0x0039], // ASCII (no-op)
  [0x0660, 0x0669], // Arabic-Indic ٠-٩
  [0x06f0, 0x06f9], // Extended Arabic-Indic (Persian/Urdu) ۰-۹
  [0x07c0, 0x07c9], // Nko
  [0x0966, 0x096f], // Devanagari ०-९
  [0x09e6, 0x09ef], // Bengali
  [0x0a66, 0x0a6f], // Gurmukhi
  [0x0ae6, 0x0aef], // Gujarati
  [0x0b66, 0x0b6f], // Oriya
  [0x0be6, 0x0bef], // Tamil
  [0x0c66, 0x0c6f], // Telugu
  [0x0ce6, 0x0cef], // Kannada
  [0x0d66, 0x0d6f], // Malayalam
  [0x0de6, 0x0def], // Sinhala Lith
  [0x0e50, 0x0e59], // Thai
  [0x0ed0, 0x0ed9], // Lao
  [0x0f20, 0x0f29], // Tibetan
  [0x1040, 0x1049], // Myanmar
  [0x1090, 0x1099], // Myanmar Shan
  [0x17e0, 0x17e9], // Khmer
  [0x1810, 0x1819], // Mongolian
  [0x1946, 0x194f], // Limbu
  [0x19d0, 0x19d9], // New Tai Lue
  [0x1a80, 0x1a89], // Tai Tham Hora
  [0x1a90, 0x1a99], // Tai Tham Tham
  [0x1b50, 0x1b59], // Balinese
  [0x1bb0, 0x1bb9], // Sundanese
  [0x1c40, 0x1c49], // Lepcha
  [0x1c50, 0x1c59], // Ol Chiki
  [0xa620, 0xa629], // Vai
  [0xa8d0, 0xa8d9], // Saurashtra
  [0xa900, 0xa909], // Kayah Li
  [0xa9d0, 0xa9d9], // Javanese
  [0xa9f0, 0xa9f9], // Myanmar Tai Laing
  [0xaa50, 0xaa59], // Cham
  [0xabf0, 0xabf9], // Meetei Mayek
  [0xff10, 0xff19], // Fullwidth ０-９
];

/**
 * Convert Unicode (non-ASCII) decimal digits in a string to ASCII digits.
 * "٠١٢٣٤٥٦٧٨٩" / "۰۱۲۳۴۵۶۷۸۹" / "०१२३४५६७८९" / "０１２３…" all become
 * "0123456789". Useful for normalizing phone numbers before SMPP routing.
 */
export function normalizeUnicodeDigits(input: string): string {
  if (!input) return input;
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0) as number;
    let mapped: string | null = null;
    for (const [start, end] of UNICODE_DIGIT_BLOCKS) {
      if (cp >= start && cp <= end) {
        mapped = String.fromCharCode(0x30 + (cp - start));
        break;
      }
    }
    out += mapped ?? ch;
  }
  return out;
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
