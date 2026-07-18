import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await tenantQuery(
    tenant.schemaName,
    `SELECT t.*, s.name as supplier_name, s.connection_type 
     FROM trunks t LEFT JOIN suppliers s ON t.supplier_id = s.id ORDER BY t.id DESC`
  );
  return NextResponse.json({ trunks: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, supplierId, capacity, mccAllowList, mccDenyList } = body;

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO trunks (name, supplier_id, capacity, mcc_allow_list, mcc_deny_list) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, supplierId, capacity || 100, mccAllowList || null, mccDenyList || null]
  );

  revalidatePath('/dashboard/trunks');
  return NextResponse.json({ trunk: result.rows[0] }, { status: 201 });
}
