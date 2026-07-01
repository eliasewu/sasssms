import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { pool } from "@/db";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Get invoice
  const invResult = await tenantQuery(tenant.schemaName, "SELECT * FROM invoices WHERE id = $1", [id]);
  if (invResult.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inv = invResult.rows[0];

  // Get MCC breakdown for the invoice period
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT 
        COALESCE(SUBSTRING(m.destination FROM 1 FOR 3), '??') as prefix,
        COUNT(*) as msg_count,
        SUM(CAST(m.cost AS DECIMAL)) as total_cost
       FROM "${tenant.schemaName}".messages m
       WHERE m.client_id = $1
         AND m.created_at >= $2
         AND m.created_at <= $3
       GROUP BY SUBSTRING(m.destination FROM 1 FOR 3)
       ORDER BY msg_count DESC`,
      [inv.client_id, inv.period_start, inv.period_end]
    );

    // Enrich with MCC data
    const { rows: mccs } = await client.query("SELECT mcc, country_code, country_name, network_name FROM mcc_mnc_database");

    const summary = rows.map(r => {
      const mcc = mccs.find(m => m.country_code === `+${r.prefix}` || m.mcc === r.prefix);
      return {
        mcc: r.prefix,
        country: mcc?.country_name || "Unknown",
        network: mcc?.network_name || "—",
        count: parseInt(r.msg_count),
        cost: parseFloat(r.total_cost || "0").toFixed(6),
      };
    });

    return NextResponse.json({ invoice: inv, summary });
  } finally {
    client.release();
  }
}
