import assert from "node:assert/strict";
import { convertBackrefs, buildRegex, determineTon, determineNpi, normalizeUnicodeDigits } from "@/lib/regex-utils";
import { normalizeTargetField } from "@/lib/translation-engine";

// ── Backreference conversion (\1 → $1) ──
assert.equal(convertBackrefs("\\1\\2"), "$1$2", "\\1\\2 should become $1$2");
assert.equal(convertBackrefs("Your activation key is \\1"), "Your activation key is $1");
assert.equal(convertBackrefs("\\0"), "$&", "\\0 → $& (whole match)");

// Remove space: "123 456" → "123456"
assert.equal(
  "123 456".replace(buildRegex("(\\d+)\\s(\\d+)"), convertBackrefs("\\1\\2")),
  "123456",
  "remove space via \\1\\2"
);

// Remove dash: "123-456" → "123456"
assert.equal(
  "123-456".replace(buildRegex("(.*\\d+)-(\\d+)"), convertBackrefs("\\1\\2")),
  "123456",
  "remove dash via \\1\\2"
);

// OTP forward: "Your OTP code is 252525" → "Your activation key is 252525"
assert.equal(
  "Your OTP code is 252525".replace(buildRegex("\\D*(\\d{4,})\\D*"), convertBackrefs("Your activation key is \\1")),
  "Your activation key is 252525",
  "OTP forward via \\1"
);

// Existing $1 refs untouched
assert.equal(convertBackrefs("$1$2"), "$1$2", "$1 refs are preserved");

// ── Parameter normalization ──
assert.equal(normalizeTargetField("SRC_ROUTING"), "SENDER");
assert.equal(normalizeTargetField("src number"), "SENDER");
assert.equal(normalizeTargetField("DST_ROUTING"), "DESTINATION");
assert.equal(normalizeTargetField("dst number"), "DESTINATION");
assert.equal(normalizeTargetField("SMS_BODY"), "BODY");
assert.equal(normalizeTargetField("src number ton"), "SRC_TON");
assert.equal(normalizeTargetField("DST_NUMBER_TON"), "DST_TON");
assert.equal(normalizeTargetField("src number npi"), "SRC_NPI");
assert.equal(normalizeTargetField("DST_NUMBER_NPI"), "DST_NPI");
assert.equal(normalizeTargetField("SENDER"), "SENDER", "legacy SENDER preserved");
assert.equal(normalizeTargetField("BODY"), "BODY", "legacy BODY preserved");
assert.equal(normalizeTargetField("DESTINATION"), "DESTINATION", "legacy DESTINATION preserved");

// ── Unicode digit normalization ──
assert.equal(normalizeUnicodeDigits("٠١٢٣٤٥٦٧٨٩"), "0123456789", "Arabic-Indic digits");
assert.equal(normalizeUnicodeDigits("۰۱۲۳۴۵۶۷۸۹"), "0123456789", "Persian digits");
assert.equal(normalizeUnicodeDigits("०१२३४५६७८९"), "0123456789", "Devanagari digits");
assert.equal(normalizeUnicodeDigits("０１２３４５６７８９"), "0123456789", "Fullwidth digits");
assert.equal(normalizeUnicodeDigits("+880١٦١2345678"), "+8801612345678", "mixed ASCII + Arabic-Indic");
assert.equal(normalizeUnicodeDigits("+8801612345678"), "+8801612345678", "ASCII unchanged");
assert.equal(normalizeUnicodeDigits(""), "", "empty string");

// ── TON/NPI helpers ──
assert.equal(determineTon("+8801612345678"), 1, "international → TON 1");
assert.equal(determineTon("NET2APP"), 5, "alphanumeric → TON 5");
assert.equal(determineNpi("+8801612345678"), 1, "numeric → NPI 1");
assert.equal(determineNpi("NET2APP"), 0, "alphanumeric → NPI 0");

console.log("✅ universal-translation: all assertions passed");
