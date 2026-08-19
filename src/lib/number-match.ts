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

/**
 * Realistic national subscriber samples per bare dialing code.
 * Used to build a country-specific preview number (e.g. "00971" →
 * "00971506380825") so the strip/add preview looks like a real number for the
 * country the rule targets. Codes not listed here fall back to "12345678".
 */
const SAMPLE_SUBSCRIBERS: Record<string, string> = {
  // Middle East / South Asia
  "971": "506380825", // UAE
  "966": "501234567", // Saudi Arabia
  "965": "50123456", // Kuwait
  "974": "33123456", // Qatar
  "973": "33123456", // Bahrain
  "968": "92123456", // Oman
  "962": "791234567", // Jordan
  "961": "70123456", // Lebanon
  "964": "7901234567", // Iraq
  "972": "501234567", // Israel
  "91": "9876543210", // India
  "92": "3001234567", // Pakistan
  "880": "1812345678", // Bangladesh
  "94": "771234567", // Sri Lanka
  "977": "9801234567", // Nepal
  "960": "7712345", // Maldives
  "93": "701234567", // Afghanistan
  "98": "9123456789", // Iran
  // East / Southeast Asia
  "86": "13800138000", // China
  "852": "51234567", // Hong Kong
  "853": "66123456", // Macau
  "886": "912345678", // Taiwan
  "82": "1012345678", // South Korea
  "81": "9012345678", // Japan
  "62": "8123456789", // Indonesia
  "60": "123456789", // Malaysia
  "65": "81234567", // Singapore
  "66": "812345678", // Thailand
  "84": "912345678", // Vietnam
  "63": "9171234567", // Philippines
  "855": "92123456", // Cambodia
  "856": "2012345678", // Laos
  // Africa
  "20": "1001234567", // Egypt
  "234": "8031234567", // Nigeria
  "254": "712345678", // Kenya
  "27": "821234567", // South Africa
  "233": "201234567", // Ghana
  "251": "911234567", // Ethiopia
  "255": "712345678", // Tanzania
  "256": "701234567", // Uganda
  "212": "612345678", // Morocco
  "213": "551234567", // Algeria
  "216": "20123456", // Tunisia
  // Europe
  "44": "7911123456", // UK
  "49": "15123456789", // Germany
  "33": "612345678", // France
  "34": "612345678", // Spain
  "39": "3123456789", // Italy
  "31": "612345678", // Netherlands
  "32": "470123456", // Belgium
  "41": "791234567", // Switzerland
  "43": "6501234567", // Austria
  "351": "912345678", // Portugal
  "353": "851234567", // Ireland
  "46": "701234567", // Sweden
  "47": "91234567", // Norway
  "45": "20123456", // Denmark
  "358": "401234567", // Finland
  "48": "512345678", // Poland
  "420": "601234567", // Czechia
  "30": "6912345678", // Greece
  "40": "712345678", // Romania
  "36": "301234567", // Hungary
  "380": "501234567", // Ukraine
  "7": "9123456789", // Russia
  "90": "5321234567", // Turkey
  // Americas / Oceania
  "1": "2125551234", // US / Canada
  "52": "5512345678", // Mexico
  "55": "11987654321", // Brazil
  "54": "91123456789", // Argentina
  "57": "3001234567", // Colombia
  "51": "912345678", // Peru
  "56": "912345678", // Chile
  "61": "412345678", // Australia
  "64": "211234567", // New Zealand
};

/**
 * Build a country-specific sample destination from a rule name, e.g. "00971"
 * → "00971506380825", so the strip/add preview looks like a real number for
 * the country the rule targets. Non-numeric names fall back to "1234567890".
 */
export function sampleNumberForName(name: string): string {
  const prefixes = matchPrefixesForName(name);
  if (!prefixes) return "1234567890";
  const subscriber = SAMPLE_SUBSCRIBERS[prefixes[2]] || "12345678";
  return prefixes[0] + subscriber;
}
