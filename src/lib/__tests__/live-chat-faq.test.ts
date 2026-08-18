/**
 * Unit tests for the live-chat FAQ auto-reply matcher (live-chat-faq.ts).
 *
 * Run: npx tsx src/lib/__tests__/live-chat-faq.test.ts
 */
import assert from "node:assert";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findFaqAnswer } from "../live-chat-faq";

const CSV = [
  "How many free SMS credits are awarded upon signing up for a Net2APP account?,100 credits",
  "Term: Supplier,Definition: An SMS gateway provider that delivers messages for the platform.",
  "Monthly cost of the Professional plan: _____.,$150",
  "What status must a connection show on the Bind Status page to confirm it is active?,BOUND",
  "What is mandatory for using WhatsApp and Telegram OTT Connect?,A Proxy.",
  "What does the 'Capacity' setting on a Trunk configuration control?,The maximum number of concurrent SMS allowed.",
].join("\n");

function check() {
  const dir = mkdtempSync(join(tmpdir(), "faq-"));
  const file = join(dir, "flashcards.csv");
  writeFileSync(file, CSV, "utf-8");
  process.env.FAQ_CSV_PATH = file;

  // Natural phrasing → correct answer
  assert.strictEqual(
    findFaqAnswer("how many free sms credits do i get?"),
    "100 credits",
    "free credits question"
  );
  assert.strictEqual(
    findFaqAnswer("what is a supplier?"),
    "An SMS gateway provider that delivers messages for the platform.",
    "Term: Supplier"
  );
  assert.strictEqual(
    findFaqAnswer("how much is the professional plan per month?"),
    "$150",
    "fill-in-the-blank question"
  );
  assert.strictEqual(
    findFaqAnswer("what status confirms the connection is active?"),
    "BOUND",
    "BOUND question"
  );
  assert.strictEqual(
    findFaqAnswer("what do i need for whatsapp and telegram ott?"),
    "A Proxy.",
    "OTT proxy question"
  );
  assert.strictEqual(
    findFaqAnswer("what is trunk capacity?"),
    "The maximum number of concurrent SMS allowed.",
    "trunk capacity question"
  );

  // No match → null
  assert.strictEqual(findFaqAnswer("hello there"), null, "no match → null");
  assert.strictEqual(findFaqAnswer(""), null, "empty → null");

  rmSync(dir, { recursive: true, force: true });
  console.log("✅ live-chat-faq: all assertions passed");
}

try {
  check();
} catch (err) {
  console.error(err);
  process.exit(1);
}
