/**
 * Package-aware server assignment.
 *
 * Every server in `server_locations` is categorized by a package:
 *   development | starter | professional | enterprise
 *
 * Assignment rules:
 *   - Starter clients  → auto-assigned at registration to a `starter` server,
 *     preferring the server whose countryCodes match the client's region
 *     (derived from the phone dialing code — Europe/Africa → European/US
 *     servers, Asia/Australia → Sydney/Singapore servers) and picking the
 *     least-loaded server first ("ascending order").
 *   - Professional/Enterprise clients → assigned MANUALLY by a super admin
 *     (auto-assignment returns null so the tenant stays unassigned until the
 *     admin picks a server in the tenant editor).
 *   - Development servers are never assignable.
 */

export type ServerPackage = "development" | "starter" | "professional" | "enterprise";

export const SERVER_PACKAGES: ServerPackage[] = [
  "development",
  "starter",
  "professional",
  "enterprise",
];

export interface ServerLocation {
  id: string;
  country: string;
  city: string;
  countryCodes: string;
  ipAddress: string;
  port: number;
  isActive: boolean;
  role?: string;
  sshUser?: string;
  package?: ServerPackage;
  /** Max number of tenants this server can host. Unset/0 = unlimited. */
  capacity?: number;
  /** Descriptive hardware specs (display only — not used for assignment). */
  cores?: number;
  ramGb?: number;
}

/** Default package for legacy entries that predate the package field. */
export function defaultPackageFor(loc: Pick<ServerLocation, "role" | "ipAddress">): ServerPackage {
  if (loc.role === "development" || isDevIp(loc.ipAddress)) return "development";
  return "starter";
}

/** Packages that are always assigned manually by a super admin (never auto). */
export const MANUAL_PACKAGES: ServerPackage[] = ["professional", "enterprise"];

// ── Server capacity ──

/**
 * Remaining tenant capacity of a server, given its current load (tenant count).
 * Returns Infinity when the server has no capacity configured (unlimited).
 */
export function remainingCapacity(loc: Pick<ServerLocation, "capacity">, load: number): number {
  const cap = loc.capacity;
  if (!cap || cap <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, cap - load);
}

/** True when a server has a capacity configured and is already full. */
export function isServerFull(loc: Pick<ServerLocation, "capacity">, load: number): boolean {
  return remainingCapacity(loc, load) <= 0;
}

// ── Country detection from phone dialing code ──

/**
 * International dialing code → ISO-3166 alpha-2 country code.
 * Covers the markets Net2APP routes to (Europe, Africa, Americas, Asia, Oceania).
 */
const DIALING_TO_COUNTRY: Record<string, string> = {
  "93": "AF", "355": "AL", "213": "DZ", "1684": "AS", "376": "AD", "244": "AO",
  "1264": "AI", "672": "AQ", "1268": "AG", "54": "AR", "374": "AM", "297": "AW",
  "61": "AU", "43": "AT", "994": "AZ", "1242": "BS", "973": "BH", "880": "BD",
  "1246": "BB", "375": "BY", "32": "BE", "501": "BZ", "229": "BJ", "1441": "BM",
  "975": "BT", "591": "BO", "387": "BA", "267": "BW", "55": "BR", "1284": "VG",
  "673": "BN", "359": "BG", "226": "BF", "257": "BI", "855": "KH", "237": "CM",
  "238": "CV", "1345": "KY", "236": "CF", "235": "TD", "56": "CL",
  "86": "CN", "57": "CO", "269": "KM", "242": "CG", "243": "CD", "682": "CK",
  "506": "CR", "385": "HR", "53": "CU", "357": "CY", "420": "CZ", "45": "DK",
  "253": "DJ", "1767": "DM", "1809": "DO", "593": "EC", "20": "EG", "503": "SV",
  "240": "GQ", "291": "ER", "372": "EE", "251": "ET", "298": "FO", "679": "FJ",
  "358": "FI", "33": "FR", "594": "GF", "689": "PF", "241": "GA", "220": "GM",
  "995": "GE", "49": "DE", "233": "GH", "350": "GI", "30": "GR", "299": "GL",
  "1473": "GD", "590": "GP", "1671": "GU", "502": "GT", "224": "GN", "245": "GW",
  "592": "GY", "509": "HT", "504": "HN", "852": "HK", "36": "HU", "354": "IS",
  "91": "IN", "62": "ID", "98": "IR", "964": "IQ", "353": "IE", "972": "IL",
  "39": "IT", "1876": "JM", "81": "JP", "962": "JO", "254": "KE", "686": "KI",
  "82": "KR", "965": "KW", "996": "KG", "856": "LA", "371": "LV", "961": "LB",
  "266": "LS", "231": "LR", "218": "LY", "423": "LI", "370": "LT", "352": "LU",
  "853": "MO", "389": "MK", "261": "MG", "265": "MW", "60": "MY", "960": "MV",
  "223": "ML", "356": "MT", "692": "MH", "596": "MQ", "222": "MR", "230": "MU",
  "52": "MX", "691": "FM", "373": "MD", "377": "MC", "976": "MN",
  "382": "ME", "1664": "MS", "212": "MA", "258": "MZ", "95": "MM", "264": "NA",
  "674": "NR", "977": "NP", "31": "NL", "599": "AN", "687": "NC", "64": "NZ",
  "505": "NI", "227": "NE", "234": "NG", "683": "NU", "1670": "MP", "47": "NO",
  "968": "OM", "92": "PK", "680": "PW", "970": "PS", "507": "PA", "675": "PG",
  "595": "PY", "51": "PE", "63": "PH", "48": "PL", "351": "PT", "1787": "PR",
  "974": "QA", "262": "RE", "40": "RO", "7": "RU", "250": "RW",
  "290": "SH", "1784": "VC", "685": "WS", "378": "SM", "239": "ST",
  "966": "SA", "221": "SN", "381": "RS", "248": "SC", "232": "SL", "65": "SG",
  "421": "SK", "386": "SI", "677": "SB", "252": "SO", "27": "ZA", "34": "ES",
  "94": "LK", "249": "SD", "597": "SR", "268": "SZ", "46": "SE", "41": "CH",
  "963": "SY", "886": "TW", "992": "TJ", "255": "TZ", "66": "TH", "228": "TG",
  "690": "TK", "676": "TO", "1868": "TT", "216": "TN", "90": "TR", "993": "TM",
  "1649": "TC", "688": "TV", "256": "UG", "380": "UA", "971": "AE", "44": "GB",
  "1": "US", "598": "UY", "998": "UZ", "678": "VU", "58": "VE",
  "84": "VN", "681": "WF", "967": "YE", "260": "ZM", "263": "ZW",
};

/** Longest dialing codes first so prefix matching picks the country correctly. */
const DIALING_CODES_SORTED = Object.keys(DIALING_TO_COUNTRY).sort(
  (a, b) => b.length - a.length || b.localeCompare(a)
);

/**
 * Extract an ISO country code from a phone number via its international
 * dialing code. Returns null when it can't be determined (e.g. local-format
 * numbers without a country prefix).
 */
export function countryCodeFromPhone(phone: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2); // international prefix
  if (!digits || digits.length < 7) return null; // too short to be a real number
  for (const code of DIALING_CODES_SORTED) {
    // Require a plausible national number after the country code so a bare
    // "1" or "12" prefix on a local number isn't mistaken for a country.
    if (digits.startsWith(code) && digits.length >= code.length + 6) {
      return DIALING_TO_COUNTRY[code];
    }
  }
  return null;
}

/**
 * Pick the best server for a tenant based on its package and region.
 *
 * - Starter: only `starter` servers; prefers servers whose countryCodes
 *   include the client's country (region/latency-based), then picks the
 *   least-loaded one (fewest tenants — "ascending order").
 * - Professional/Enterprise: returns null — manual assignment only.
 * - Development servers are never assignable.
 *
 * @param servers   All configured server locations.
 * @param opts.package Tenant's package (defaults to "starter").
 * @param opts.countryCode Client ISO country code (from dialing code).
 * @param opts.loads  Map of ip → number of tenants already on that server,
 *                    used for ascending-order (least-loaded) selection.
 */
export function pickServerForPackage(
  servers: ServerLocation[],
  opts: { package?: ServerPackage; countryCode?: string | null; loads?: Record<string, number> }
): ServerLocation | null {
  const pkg = opts.package || "starter";

  // Professional/Enterprise are always assigned manually by a super admin.
  if (MANUAL_PACKAGES.includes(pkg)) return null;

  const loads = opts.loads || {};

  // ── Capacity-aware: drop servers that are already full (load >= capacity)
  //    BEFORE region scoring, so a full best-region server falls through to
  //    the next available server instead of blocking assignment entirely. ──
  const pool = servers.filter(
    (s) =>
      s.isActive &&
      s.ipAddress &&
      s.ipAddress !== "0.0.0.0" &&
      (s.package || defaultPackageFor(s)) === pkg &&
      !isServerFull(s, loads[s.ipAddress] || 0)
  );
  if (pool.length === 0) return null;

  // Latency-based routing: prefer the best-matching servers for this client,
  // falling back to the full starter pool when nothing matches.
  const clientRegion = regionForCountry(opts.countryCode || null);
  const scored = pool.map((s) => ({
    s,
    score: matchScore(s, opts.countryCode || null, clientRegion),
  }));
  const bestScore = Math.max(...scored.map((x) => x.score));
  const eligible = scored
    .filter((x) => (bestScore > 0 ? x.score === bestScore : true))
    .map((x) => x.s);

  // Ascending order: least-loaded first (fewest tenants), ties broken by the
  // order servers were configured in.
  return [...eligible].sort((a, b) => {
    const la = loads[a.ipAddress] || 0;
    const lb = loads[b.ipAddress] || 0;
    if (la !== lb) return la - lb;
    return pool.indexOf(a) - pool.indexOf(b);
  })[0] || null;
}

/** True for the hardcoded development boxes (never assignable to tenants). */
export function isDevIp(ip: string | null | undefined): boolean {
  return !!ip && ["15.235.35.125"].includes(ip);
}

// ── Region classification for latency-based routing ──
// Europe/Africa clients → European + USA servers; Asia/Australia →
// Australia/Singapore servers; Americas → USA/Canada servers.

const EUROPE_COUNTRIES = new Set([
  "AL", "AD", "AT", "BY", "BE", "BA", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IS", "IE", "IT", "XK", "LV", "LI", "LT", "LU", "MT", "MD", "MC",
  "ME", "NL", "MK", "NO", "PL", "PT", "RO", "RU", "SM", "RS", "SK", "SI", "ES", "SE",
  "CH", "UA", "GB", "VA",
]);

const AFRICA_COUNTRIES = new Set([
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD", "CI",
  "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR",
  "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "ST", "SN",
  "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW",
]);

const APAC_COUNTRIES = new Set([
  "AF", "AM", "AZ", "BH", "BD", "BT", "BN", "KH", "CN", "GE", "HK", "IN", "ID", "IR",
  "IQ", "IL", "JP", "JO", "KZ", "KW", "KG", "LA", "LB", "MY", "MV", "MN", "MM", "NP",
  "KP", "OM", "PK", "PS", "PH", "QA", "SA", "SG", "KR", "LK", "SY", "TW", "TJ", "TH",
  "TL", "TR", "TM", "AE", "UZ", "VN", "YE", "AU", "NZ", "FJ", "PG", "WS", "SB", "TO",
]);

const AMERICAS_COUNTRIES = new Set([
  "CA", "US", "MX", "GT", "BZ", "SV", "HN", "NI", "CR", "PA", "CU", "HT", "DO", "JM",
  "TT", "BB", "BS", "BR", "AR", "CL", "CO", "PE", "VE", "EC", "BO", "PY", "UY", "GY",
  "SR", "GF",
]);

export type ClientRegion = "eu-af" | "apac" | "americas";

/** Classify an ISO country code into a routing region. */
export function regionForCountry(countryCode: string | null): ClientRegion | null {
  if (!countryCode) return null;
  const cc = countryCode.toUpperCase();
  if (EUROPE_COUNTRIES.has(cc) || AFRICA_COUNTRIES.has(cc)) return "eu-af";
  if (APAC_COUNTRIES.has(cc)) return "apac";
  if (AMERICAS_COUNTRIES.has(cc)) return "americas";
  return null;
}

/** Region a server primarily serves, derived from its countryCodes. */
export function serverRegion(loc: Pick<ServerLocation, "countryCodes">): ClientRegion | null {
  const codes = (loc.countryCodes || "").split(",").map((c) => c.trim().toUpperCase());
  if (codes.some((c) => EUROPE_COUNTRIES.has(c) || AFRICA_COUNTRIES.has(c))) return "eu-af";
  if (codes.some((c) => APAC_COUNTRIES.has(c))) return "apac";
  if (codes.some((c) => AMERICAS_COUNTRIES.has(c))) return "americas";
  return null;
}

/**
 * Preferred server regions for a client region (latency-based routing).
 * Europe/Africa → European + USA servers; Asia/Australia → Sydney/Singapore;
 * Americas → USA/Canada.
 */
export function preferredRegions(clientRegion: ClientRegion | null): Set<ClientRegion> {
  switch (clientRegion) {
    case "eu-af": return new Set<ClientRegion>(["eu-af", "americas"]);
    case "apac": return new Set<ClientRegion>(["apac"]);
    case "americas": return new Set<ClientRegion>(["americas"]);
    default: return new Set<ClientRegion>(["eu-af", "apac", "americas"]);
  }
}

/**
 * Score how well a server matches a client (higher = better latency):
 * 3 = countryCodes contains the client's exact country, 2 = server's region is
 * in the client's preferred region set, 1 = fallback (region unknown), 0 = no
 * match (region mismatch).
 */
export function matchScore(
  loc: Pick<ServerLocation, "countryCodes">,
  countryCode: string | null,
  clientRegion: ClientRegion | null
): number {
  const codes = (loc.countryCodes || "").split(",").map((c) => c.trim().toUpperCase());
  if (countryCode && codes.includes(countryCode.toUpperCase())) return 3;
  const sreg = serverRegion(loc);
  if (sreg && preferredRegions(clientRegion).has(sreg)) return 2;
  if (!sreg) return 1;
  return 0;
}
