import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { pool } from "@/db";

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Fetch all active tenants
    const { rows: allTenants } = await pool.query(
      `SELECT id, company_name, email, schema_name, sms_limit, sms_counter,
              is_active, status, package_type, created_at
       FROM tenants
       ORDER BY id`
    );

    const results: Array<{
      id: number;
      companyName: string;
      email: string;
      schemaName: string;
      smsLimit: number;
      smsCounter: number;
      actualCount: number;
      diff: number;
      status: "SYNC" | "MISMATCH" | "ERROR";
      lastMessageAt: string | null;
    }> = [];

    for (const t of allTenants) {
      try {
        const { rows: countRows } = await pool.query(
          `SELECT COUNT(*)::int AS cnt,
                  MAX(created_at)::text AS latest
           FROM "${t.schema_name}".messages`
        );
        const actualCount = parseInt(countRows[0]?.cnt ?? "0", 10);
        const lastMessageAt = countRows[0]?.latest || null;
        const diff = (t.sms_counter ?? 0) - actualCount;

        results.push({
          id: t.id,
          companyName: t.company_name || "Unnamed",
          email: t.email || "",
          schemaName: t.schema_name,
          smsLimit: t.sms_limit ?? 0,
          smsCounter: t.sms_counter ?? 0,
          actualCount,
          diff,
          status: diff === 0 ? "SYNC" : "MISMATCH",
          lastMessageAt,
        });
      } catch {
        // Schema might not exist or have no messages table
        results.push({
          id: t.id,
          companyName: t.company_name || "Unnamed",
          email: t.email || "",
          schemaName: t.schema_name,
          smsLimit: t.sms_limit ?? 0,
          smsCounter: t.sms_counter ?? 0,
          actualCount: -1,
          diff: 0,
          status: "ERROR",
          lastMessageAt: null,
        });
      }
    }

    // Compute aggregates
    const synced = results.filter((r) => r.status === "SYNC").length;
    const mismatched = results.filter((r) => r.status === "MISMATCH").length;
    const errorCount = results.filter((r) => r.status === "ERROR").length;
    const totalMismatch = results.reduce(
      (sum, r) => (r.status === "MISMATCH" ? sum + Math.abs(r.diff) : sum),
      0
    );

    return NextResponse.json({
      tenants: results,
      summary: {
        total: results.length,
        synced,
        mismatched,
        errorCount,
        totalMismatch,
        refreshedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[SMS-Counter-Audit] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
