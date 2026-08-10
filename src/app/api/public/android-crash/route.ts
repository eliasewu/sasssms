import { NextResponse } from "next/server";
import { pool } from "@/db";

/**
 * Public Android Crash Report Ingestion
 * POST /api/public/android-crash
 *
 * The Net2APP SMS Gateway Android app uploads JS exceptions, native
 * crashes, and logcat tails here so crashes can be diagnosed remotely
 * without adb access. No auth required — the phone identifies itself
 * with its device id + optional SMPP supplier username.
 *
 * Body (all optional except a message of some kind):
 *   deviceId, username, deviceModel, androidVersion, appVersion,
 *   process ("ui" | "headless"), crashType ("js" | "native" | "boundary" | ...),
 *   message, stackTrace, logcat, jsLog, appState
 */
export const dynamic = "force-dynamic";

const MAX_LOG = 100_000; // logcat tail cap
const MAX_JS_LOG = 60_000;
const MAX_STACK = 25_000;
const MAX_MESSAGE = 5_000;

// ── Abuse protection (endpoint is public by design) ──
// In-memory sliding-window rate limit per IP: 30 reports/minute. Real phones
// send a handful per crash burst; this blocks scripted flooding of the table.
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  // Bound memory: drop idle entries periodically
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

function cap(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v);
  if (!s.trim()) return null;
  return s.length > max ? s.slice(0, max) : s;
}

export async function POST(request: Request) {
  try {
    // Per-IP rate limit before parsing the body
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (rateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many crash reports — slow down" },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const message = cap((body as Record<string, unknown>).message, MAX_MESSAGE)
      || cap((body as Record<string, unknown>).crashType, 50)
      || "unknown crash";

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO android_crash_reports
         (device_id, username, device_model, android_version, app_version,
          process, crash_type, message, stack_trace, logcat, js_log, app_state)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          cap((body as Record<string, unknown>).deviceId, 100),
          cap((body as Record<string, unknown>).username, 255),
          cap((body as Record<string, unknown>).deviceModel, 255),
          cap((body as Record<string, unknown>).androidVersion, 50),
          cap((body as Record<string, unknown>).appVersion, 50),
          cap((body as Record<string, unknown>).process, 50),
          cap((body as Record<string, unknown>).crashType, 50),
          message,
          cap((body as Record<string, unknown>).stackTrace, MAX_STACK),
          cap((body as Record<string, unknown>).logcat, MAX_LOG),
          cap((body as Record<string, unknown>).jsLog, MAX_JS_LOG),
          cap((body as Record<string, unknown>).appState, 10_000),
        ]
      );
    } finally {
      client.release();
    }

    // Keep at most 500 crash reports per device — drop the oldest
    const deviceId = cap((body as Record<string, unknown>).deviceId, 100);
    if (deviceId) {
      pool.query(
        `DELETE FROM android_crash_reports
         WHERE device_id = $1 AND id NOT IN (
           SELECT id FROM android_crash_reports
           WHERE device_id = $1 ORDER BY id DESC LIMIT 500
         )`,
        [deviceId]
      ).catch(() => {});
    }

    // Global retention: ~2% of requests sweep reports older than 60 days so
    // the table stays bounded even if attackers invent device ids.
    if (Math.random() < 0.02) {
      pool.query(
        `DELETE FROM android_crash_reports WHERE created_at < NOW() - INTERVAL '60 days'`
      ).catch(() => {});
    }

    console.log(`[AndroidCrash] ${message} — ${(body as Record<string, unknown>).deviceModel || "?"} / ${(body as Record<string, unknown>).androidVersion || "?"} (${(body as Record<string, unknown>).username || "no-supplier"})`);

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (err) {
    console.error("[AndroidCrash] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}
