import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { auditLog } from "@/lib/db-helpers";

/**
 * Toggle a client's is_active flag without clobbering other fields.
 * Mirrors the supplier toggle-active endpoint — the main clients PUT route
 * rewrites every column with a default fallback, which would wipe name/email
 * on a bare `{ isActive }` body.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const isActive = body.isActive !== undefined ? !!body.isActive : null;

  const oldResult = await tenantQuery(tenant.schemaName, "SELECT * FROM clients WHERE id = $1", [id]);
  const old = oldResult.rows[0];
  if (!old) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE clients SET is_active = COALESCE($1, is_active), updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
    [isActive, id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  await auditLog(
    "clients",
    parseInt(id),
    "TOGGLE_ACTIVE",
    tenant.email,
    { is_active: old.is_active },
    { is_active: result.rows[0].is_active },
    tenant.tenantId
  );

  revalidatePath("/dashboard/clients");
  return NextResponse.json({ client: result.rows[0] });
}
