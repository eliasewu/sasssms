import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { softDelete, auditLog } from "@/lib/db-helpers";
import { VALID_BIND_TYPES } from "@/lib/validation";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  // Validate bind_type if provided
  if (body.bindType && !VALID_BIND_TYPES.includes(body.bindType)) {
    return NextResponse.json({ error: `Invalid bind_type: "${body.bindType}". Must be one of: ${VALID_BIND_TYPES.join(", ")}` }, { status: 400 });
  }

  const oldResult = await tenantQuery(tenant.schemaName, "SELECT * FROM suppliers WHERE id = $1", [id]);

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE suppliers SET 
      supplier_code=$1, name=$2, company_name=$3, contact_person=$4, email=$5, phone=$6,
      connection_type=$7, host=$8, port=$9, username=$10, password=COALESCE(NULLIF($11, '••••••••'), password), system_id=$12,
      system_type=$13, smpp_version=$14, bind_type=$15, address_ton=$16, address_npi=$17,
      address_range=$18, inbound_mode=$19, api_url=$20, api_key=COALESCE(NULLIF($21, '••••••••'), api_key),
      currency=$22, initial_balance=$23, credit_limit=$24,
      force_dlr=$25, is_active=$26, config=$27, updated_at=NOW()
    WHERE id=$28 AND deleted_at IS NULL RETURNING *`,
    [
      body.supplierCode ?? null, body.name ?? '', body.companyName ?? null, body.contactPerson ?? null, body.email ?? null, body.phone ?? null,
      body.connectionType ?? null, body.host ?? null, body.port ?? null, body.username ?? null, body.password ?? null, body.systemId ?? null,
      body.systemType ?? null, body.smppVersion ?? '3.4', body.bindType ?? 'TRX', body.addressTon ?? 0, body.addressNpi ?? 0,
      body.addressRange ?? null, body.inboundMode ?? false, body.apiUrl ?? null, body.apiKey ?? null,
      body.currency ?? 'USD', body.initialBalance ?? '0', body.creditLimit ?? '0',
      body.forceDlr ?? false, body.isActive ?? true, body.config ?? null, id
    ]
  );

  await auditLog("suppliers", parseInt(id), "UPDATE", tenant.email, oldResult.rows[0] || {}, body, tenant.tenantId);

  revalidatePath('/dashboard/suppliers');
  return NextResponse.json({ supplier: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const deleted = await softDelete(tenant.schemaName, "suppliers", parseInt(id), tenant.email, tenant.tenantId);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  revalidatePath('/dashboard/suppliers');
  return NextResponse.json({ success: true, message: "Supplier archived to CDR" });
}
