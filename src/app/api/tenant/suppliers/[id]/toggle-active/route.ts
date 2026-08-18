import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { auditLog } from "@/lib/db-helpers";

/**
 * Toggle a supplier's is_active flag without clobbering other fields.
 *
 * The main PUT route rewrites every column with a default fallback, so a bare
 * `{ isActive }` body would wipe name/etc. This endpoint updates ONLY the
 * active flag, which is what the Active/Inactive button in the suppliers table
 * needs.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const isActive = body.isActive !== undefined ? !!body.isActive : null;

  const oldResult = await tenantQuery(tenant.schemaName, "SELECT * FROM suppliers WHERE id = $1", [id]);
  const old = oldResult.rows[0];
  if (!old) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE suppliers SET is_active = COALESCE($1, is_active), updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
    [isActive, id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  await auditLog(
    "suppliers",
    parseInt(id),
    "TOGGLE_ACTIVE",
    tenant.email,
    { is_active: old.is_active },
    { is_active: result.rows[0].is_active },
    tenant.tenantId
  );

  revalidatePath("/dashboard/suppliers");
  return NextResponse.json({ supplier: result.rows[0] });
}
