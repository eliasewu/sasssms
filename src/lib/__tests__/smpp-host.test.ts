/**
 * Unit tests for normalizeSmpHost — the guard that prevents "1.2.3.4:2775:2775"
 * DNS churn when a supplier's Host field contains an embedded ":port".
 *
 * Run: npm run test:smpp-host   (tsx src/lib/__tests__/smpp-host.test.ts)
 */
import assert from "node:assert/strict";
import { normalizeSmpHost } from "@/lib/smpp-client";

function check(name: string, host: string, port: number, expectHost: string, expectPort: number) {
  const r = normalizeSmpHost(host, port);
  assert.equal(r.host, expectHost, `${name}: host`);
  assert.equal(r.port, expectPort, `${name}: port`);
  console.log(`  ✓ ${name} → "${r.host}":${r.port}`);
}

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; };

t("strips embedded :port (host without port)", () => check("embedded port", "0.0.0.0:2775", 2775, "0.0.0.0", 2775));
t("strips embedded :port (host without explicit port)", () => check("embedded port w/o arg", "1.2.3.4:2775", 0, "1.2.3.4", 2775));
t("explicit port arg wins over embedded", () => check("explicit port wins", "1.2.3.4:2775", 5555, "1.2.3.4", 5555));
t("plain IPv4 untouched", () => check("plain IPv4", "1.1.1.1", 2775, "1.1.1.1", 2775));
t("hostname untouched", () => check("hostname", "smsgw.example.com", 2775, "smsgw.example.com", 2775));
t("leading whitespace trimmed", () => check("whitespace", "  host:2775 ", 0, "host", 2775));
t("IPv6-like value not mangled", () => check("ipv6 guard", "::1", 2775, "::1", 2775));
t("empty host passes through for null-guard", () => check("empty", "", 2775, "", 2775));

console.log(`\n✅ smpp-host: all ${passed} assertions passed`);
process.exit(0);
