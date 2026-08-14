/**
 * Unit tests for the LoginGuard brute-force lockout helper (rate-limit.ts).
 *
 * Run: npx tsx src/lib/__tests__/login-guard.test.ts
 */
import assert from "node:assert";
import { LoginGuard } from "../rate-limit";

function check() {
  // ── Fresh guard: attempts allowed until threshold ──
  const guard = new LoginGuard(5, 60_000);

  // 1. First four failures are allowed, remaining decrements
  let r = guard.registerFailure("alice@example.com");
  assert.strictEqual(r.remaining, 4, "after 1 fail → 4 remaining");
  assert.strictEqual(r.lockedMs, 0, "not locked yet");

  r = guard.registerFailure("alice@example.com");
  assert.strictEqual(r.remaining, 3, "after 2 fails → 3 remaining");

  r = guard.registerFailure("alice@example.com");
  r = guard.registerFailure("alice@example.com");
  assert.strictEqual(r.remaining, 1, "after 4 fails → 1 remaining");
  assert.strictEqual(guard.lockedMs("alice@example.com"), 0, "still not locked");

  // 2. Fifth failure locks the account for the window
  r = guard.registerFailure("alice@example.com");
  assert.strictEqual(r.remaining, 0, "5th fail → locked");
  assert.ok(r.lockedMs > 0 && r.lockedMs <= 60_000, `lockout ~60s, got ${r.lockedMs}ms`);
  const lockedRead = guard.lockedMs("alice@example.com");
  assert.ok(lockedRead > 0 && lockedRead <= r.lockedMs, `lockedMs reflects the lockout (got ${lockedRead}ms)`);

  // 3. Attempts during lockout stay locked and do NOT extend the window
  const lockedAt = guard.lockedMs("alice@example.com");
  r = guard.registerFailure("alice@example.com");
  assert.strictEqual(r.remaining, 0, "still locked");
  assert.ok(guard.lockedMs("alice@example.com") <= lockedAt, "lockout not extended by extra attempts");

  // 4. Accounts are independent — bob is untouched
  assert.strictEqual(guard.lockedMs("bob@example.com"), 0, "other account unaffected");
  r = guard.registerFailure("bob@example.com");
  assert.strictEqual(r.remaining, 4, "bob starts fresh");

  // 5. Successful login resets the streak — alice unlocked immediately
  guard.reset("alice@example.com");
  assert.strictEqual(guard.lockedMs("alice@example.com"), 0, "reset clears lockout");
  r = guard.registerFailure("alice@example.com");
  assert.strictEqual(r.remaining, 4, "streak restarts after reset");

  // 6. Lockout expiry (simulated with a tiny window) frees the account
  const fast = new LoginGuard(2, 20); // 2 fails → 20ms lockout
  fast.registerFailure("carol@example.com");
  r = fast.registerFailure("carol@example.com");
  assert.strictEqual(r.remaining, 0, "fast guard: 2 fails locks");
  assert.strictEqual(fast.lockedMs("carol@example.com") > 0, true, "locked after 2 fails");

  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.strictEqual(fast.lockedMs("carol@example.com"), 0, "expired lockout releases the account");
      // After expiry the counter restarts from zero
      r = fast.registerFailure("carol@example.com");
      assert.strictEqual(r.remaining, 1, "post-expiry first fail → 1 remaining");
      resolve();
    }, 50);
  });
}

check()
  .then(() => console.log("✅ login-guard: all assertions passed"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
