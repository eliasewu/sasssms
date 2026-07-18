import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE invoices SET status=$1 WHERE id=$2 RETURNING *`,
    [status, id]
  );

  revalidatePath('/dashboard/invoices');
  return NextResponse.json({ invoice: result.rows[0] });
}
