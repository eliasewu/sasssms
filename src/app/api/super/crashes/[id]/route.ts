import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { pool } from "@/db";

/**
 * Super Admin — Single Android Crash Report (full detail)
 * GET /api/super/crashes/:id
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const numId = parseInt(id, 10) || 0;

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM android_crash_reports WHERE id = $1`,
        [numId]
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ crash: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Super-Crashes] Detail error:", err);
    return NextResponse.json({ error: "Failed to load crash" }, { status: 500 });
  }
}
