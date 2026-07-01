import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { pool } from "@/db";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT * FROM smpp_server_config WHERE tenant_id = $1 OR tenant_id IS NULL ORDER BY id", 
      [tenant.tenantId]
    );
    return NextResponse.json({ servers: rows });
  } finally { client.release(); }
}
