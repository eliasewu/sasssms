import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { pool } from "@/db";

/**
 * Super Admin — Android Crash Reports
 *
 * GET  /api/super/crashes?limit=50&deviceId=xxx — List crash reports (newest first)
 * DELETE /api/super/crashes?id=123              — Delete a specific report
 * DELETE /api/super/crashes?clear=1             — Clear all reports
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
  const deviceId = url.searchParams.get("deviceId")?.trim() || null;

  try {
    const client = await pool.connect();
    try {
      const result = deviceId
        ? await client.query(
            `SELECT id, device_id, username, device_model, android_version, app_version,
                    process, crash_type, message, created_at
             FROM android_crash_reports WHERE device_id = $1
             ORDER BY id DESC LIMIT $2`,
            [deviceId, limit]
          )
        : await client.query(
            `SELECT id, device_id, username, device_model, android_version, app_version,
                    process, crash_type, message, created_at
             FROM android_crash_reports
             ORDER BY id DESC LIMIT $1`,
            [limit]
          );
      return NextResponse.json({ crashes: result.rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Super-Crashes] Error:", err);
    return NextResponse.json({ error: "Failed to load crashes" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const clearAll = url.searchParams.get("clear") === "1";

  try {
    const client = await pool.connect();
    try {
      if (clearAll) {
        await client.query(`DELETE FROM android_crash_reports`);
        return NextResponse.json({ ok: true, cleared: "all" });
      }
      if (id) {
        await client.query(`DELETE FROM android_crash_reports WHERE id = $1`, [parseInt(id, 10) || 0]);
        return NextResponse.json({ ok: true, deleted: parseInt(id, 10) || 0 });
      }
      return NextResponse.json({ error: "id or clear=1 required" }, { status: 400 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Super-Crashes] Delete error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
