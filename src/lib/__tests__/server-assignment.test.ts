/**
 * Unit tests for the package-aware server assignment (server-assignment.ts).
 *
 * Run: npx tsx src/lib/__tests__/server-assignment.test.ts
 */
import assert from "node:assert";
import {
  countryCodeFromPhone,
  pickServerForPackage,
  regionForCountry,
  serverRegion,
  preferredRegions,
  matchScore,
  remainingCapacity,
  isServerFull,
} from "../server-assignment";
import type { ServerLocation } from "../server-assignment";

const STARTER_SERVERS: ServerLocation[] = [
  { id: "france", country: "France", city: "Paris", countryCodes: "FR,DE,GB,ES,IT,NL,BE,CH,AT,LU,IE,PT,DK,NO,SE,FI", ipAddress: "54.37.252.5", port: 2775, isActive: true, package: "starter" },
  { id: "germany", country: "Germany", city: "Frankfurt", countryCodes: "DE,AT,CH,CZ,SK,HU", ipAddress: "145.239.1.7", port: 2775, isActive: true, package: "starter" },
  { id: "sydney", country: "Australia", city: "Sydney", countryCodes: "AU,NZ,SG,MY,ID,PH", ipAddress: "139.99.148.65", port: 2775, isActive: true, package: "starter" },
  { id: "sydney-2", country: "Australia", city: "Sydney", countryCodes: "AU,NZ,SG,MY,ID,PH", ipAddress: "139.99.148.177", port: 2775, isActive: true, package: "starter" },
];

function check() {
  // ── Dialing-code country detection ──
  assert.strictEqual(countryCodeFromPhone("+44 7911 123456"), "GB", "UK number → GB");
  assert.strictEqual(countryCodeFromPhone("+49 171 2345678"), "DE", "German number → DE");
  assert.strictEqual(countryCodeFromPhone("+61 412 345 678"), "AU", "Australian number → AU");
  assert.strictEqual(countryCodeFromPhone("+91 98765 43210"), "IN", "Indian number → IN");
  assert.strictEqual(countryCodeFromPhone("+234 803 123 4567"), "NG", "Nigerian number → NG");
  assert.strictEqual(countryCodeFromPhone("+971 50 123 4567"), "AE", "UAE number → AE");
  // +1 is shared by US/CA/Caribbean — either resolves to the americas region
  assert.ok(["US", "CA"].includes(countryCodeFromPhone("0014165551234") as string), "001 prefix → North America");
  assert.strictEqual(countryCodeFromPhone(""), null, "empty → null");
  assert.strictEqual(countryCodeFromPhone("123456"), null, "short/unknown → null");

  // ── Region classification ──
  assert.strictEqual(regionForCountry("FR"), "eu-af", "France → eu-af");
  assert.strictEqual(regionForCountry("NG"), "eu-af", "Nigeria → eu-af (Africa)");
  assert.strictEqual(regionForCountry("AU"), "apac", "Australia → apac");
  assert.strictEqual(regionForCountry("SG"), "apac", "Singapore → apac");
  assert.strictEqual(regionForCountry("US"), "americas", "USA → americas");
  assert.strictEqual(regionForCountry("CA"), "americas", "Canada → americas");
  assert.strictEqual(regionForCountry(null), null, "null → null");

  assert.strictEqual(serverRegion(STARTER_SERVERS[0]), "eu-af", "france serves eu-af");
  assert.strictEqual(serverRegion(STARTER_SERVERS[2]), "apac", "sydney serves apac");
  assert.deepStrictEqual([...preferredRegions("eu-af")], ["eu-af", "americas"], "EU/Africa prefers EU + USA");
  assert.deepStrictEqual([...preferredRegions("apac")], ["apac"], "Asia/Australia prefers APAC");

  // ── matchScore ──
  assert.strictEqual(matchScore(STARTER_SERVERS[2], "AU", "apac"), 3, "exact country match → 3");
  assert.strictEqual(matchScore(STARTER_SERVERS[0], "NG", "eu-af"), 2, "region match → 2");
  assert.strictEqual(matchScore(STARTER_SERVERS[2], "NG", "eu-af"), 0, "region mismatch → 0");

  // ── Starter: region/latency routing ──
  // European client → European server (france), not Sydney
  const eu = pickServerForPackage(STARTER_SERVERS, { package: "starter", countryCode: "DE" });
  assert.ok(eu && ["france", "germany"].includes(eu.id), `European client → European server, got ${eu?.id}`);
  // French client → exact match france
  const fr = pickServerForPackage(STARTER_SERVERS, { package: "starter", countryCode: "FR" });
  assert.strictEqual(fr?.id, "france", "French client → france");
  // Australian client → Sydney (least-loaded of the two, ascending order)
  const au = pickServerForPackage(STARTER_SERVERS, { package: "starter", countryCode: "AU" });
  assert.ok(au && au.ipAddress.startsWith("139.99.148"), `Australian client → Sydney, got ${au?.id}`);
  // African client → European/USA server (eu-af or americas region), not Sydney
  const ng = pickServerForPackage(STARTER_SERVERS, { package: "starter", countryCode: "NG" });
  assert.ok(ng && ["france", "germany"].includes(ng.id), `African client → European server, got ${ng?.id}`);
  // USA client → prefers eu-af + americas pool → Europe is acceptable
  const us = pickServerForPackage(STARTER_SERVERS, { package: "starter", countryCode: "US" });
  assert.ok(us && ["france", "germany"].includes(us.id), `USA client → European/USA pool, got ${us?.id}`);

  // ── Ascending order: least-loaded first, ties by config order ──
  const loads = { "139.99.148.65": 10, "139.99.148.177": 2 };
  const au2 = pickServerForPackage(STARTER_SERVERS, { package: "starter", countryCode: "AU", loads });
  assert.strictEqual(au2?.ipAddress, "139.99.148.177", "least-loaded Sydney box picked");
  const au3 = pickServerForPackage(STARTER_SERVERS, { package: "starter", countryCode: "AU", loads: {} });
  assert.strictEqual(au3?.ipAddress, "139.99.148.65", "equal load → first configured");

  // ── Unknown region → any starter server ──
  const any = pickServerForPackage(STARTER_SERVERS, { package: "starter", countryCode: null });
  assert.ok(any, "unknown region still gets a starter server");

  // ── Capacity-aware assignment ──
  const cappedServers: ServerLocation[] = STARTER_SERVERS.map((s) => ({ ...s, capacity: 5 }));
  // France at capacity (5/5) → falls through to Germany (region match, 0/5)
  const frFull = pickServerForPackage(cappedServers, {
    package: "starter",
    countryCode: "FR",
    loads: { "54.37.252.5": 5, "145.239.1.7": 0 },
  });
  assert.strictEqual(frFull?.id, "germany", "full best-region server skipped → next regional server picked");
  // All eu-af servers full → falls back to an APAC starter server with capacity
  const euFull = pickServerForPackage(cappedServers, {
    package: "starter",
    countryCode: "FR",
    loads: { "54.37.252.5": 5, "145.239.1.7": 5 },
  });
  assert.ok(euFull && euFull.ipAddress.startsWith("139.99.148"), `EU full → fall back to APAC, got ${euFull?.id}`);
  // Every starter server full → null (no capacity anywhere)
  const allFull = pickServerForPackage(cappedServers, {
    package: "starter",
    countryCode: "FR",
    loads: { "54.37.252.5": 5, "145.239.1.7": 5, "139.99.148.65": 5, "139.99.148.177": 5 },
  });
  assert.strictEqual(allFull, null, "all starter servers full → no auto-assignment");
  // No capacity configured = unlimited → still assigned even at high load
  const unlimited = pickServerForPackage(STARTER_SERVERS, {
    package: "starter",
    countryCode: "FR",
    loads: { "54.37.252.5": 100 },
  });
  assert.strictEqual(unlimited?.id, "france", "no capacity set → unlimited, still assigned");

  // ── remainingCapacity / isServerFull helpers ──
  assert.strictEqual(remainingCapacity({ capacity: 5 }, 3), 2, "5 - 3 = 2 remaining");
  assert.strictEqual(remainingCapacity({ capacity: 0 }, 100), Number.POSITIVE_INFINITY, "0 capacity → unlimited");
  assert.strictEqual(isServerFull({ capacity: 5 }, 5), true, "at capacity → full");
  assert.strictEqual(isServerFull({ capacity: 5 }, 4), false, "under capacity → not full");

  // ── Professional / Enterprise: manual only ──
  const pro = pickServerForPackage(STARTER_SERVERS, { package: "professional", countryCode: "AU" });
  assert.strictEqual(pro, null, "professional → no auto-assignment");
  const ent = pickServerForPackage(STARTER_SERVERS, { package: "enterprise", countryCode: "AU" });
  assert.strictEqual(ent, null, "enterprise → no auto-assignment");

  // ── Development servers excluded ──
  const withDev: ServerLocation[] = [
    ...STARTER_SERVERS,
    { id: "dev", country: "Canada", city: "Toronto", countryCodes: "US,CA,MX", ipAddress: "15.235.35.125", port: 2775, isActive: true, package: "development" },
  ];
  const pick = pickServerForPackage(withDev, { package: "starter", countryCode: "CA" });
  assert.ok(pick && pick.ipAddress !== "15.235.35.125", "dev server never assigned to starter");

  console.log("✅ server-assignment: all assertions passed");
}

try {
  check();
} catch (err) {
  console.error(err);
  process.exit(1);
}
