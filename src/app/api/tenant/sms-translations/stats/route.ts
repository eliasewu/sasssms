import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/tenant/sms-translations/stats?category=NUMBER_BLACKLIST
 *
 * Returns block counts per rule for the last 24 hours.
 * Used by the number-blacklist and content-filter dashboard pages
 * to show per-rule blocking stats.
 */
export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const category = url.searchParams.get("category") || "NUMBER_BLACKLIST";

  try {
    const result = await tenantQuery(
      tenant.schemaName,
      `SELECT rule_name, COUNT(*)::int as block_count
       FROM blocked_sms_log
       WHERE category = $1
         AND created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY rule_name
       ORDER BY block_count DESC`,
      [category]
    );

    // Also get total blocks for 24h
    const total = result.rows.reduce((sum: number, r: Record<string, unknown>) => sum + (r.block_count as number), 0);

    return NextResponse.json({
      stats: result.rows,
      total,
      period: "24h",
    });
  } catch (err) {
    console.error("Translation stats error:", err);
    return NextResponse.json({ stats: [], total: 0, period: "24h" });
  }
}
