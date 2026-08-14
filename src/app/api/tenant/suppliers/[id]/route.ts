import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { softDelete, auditLog } from "@/lib/db-helpers";
import { VALID_BIND_TYPES } from "@/lib/validation";
import { getSelfIp } from "@/lib/server-ips";

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

  // ANDROID_SMS suppliers bind inbound to our server (no public IP on the phone).
  // Auto-fill the SMPP host with our own public IP and force SERVER (inbound)
  // mode + inbound_mode, exactly like the POST route does on create.
  const effectiveConnType = body.connectionType ?? oldResult.rows[0]?.connection_type ?? null;
  const isAndroidSms = effectiveConnType === "ANDROID_SMS";
  const host = isAndroidSms ? (body.host || (await getSelfIp())) : (body.host ?? null);
  const connectionMode = isAndroidSms
    ? "SERVER"
    : (body.connectionMode ?? oldResult.rows[0]?.connection_mode ?? "CLIENT");
  const inboundMode = isAndroidSms ? true : (body.inboundMode ?? false);

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE suppliers SET 
      supplier_code=$1, name=$2, company_name=$3, contact_person=$4, email=$5, phone=$6,
      connection_type=$7, host=$8, port=$9, username=COALESCE(NULLIF($10, ''), username), password=COALESCE(NULLIF($11, '••••••••'), password), system_id=$12,
      system_type=$13, smpp_version=$14, bind_type=$15, address_ton=$16, address_npi=$17,
      address_range=$18, inbound_mode=$19, api_url=$20, api_key=COALESCE(NULLIF($21, '••••••••'), api_key),
      currency=$22, force_dlr=$23, charging_mode=$24, dlr_timeout=$25, is_active=$26,
      connection_mode=$27, config=$28, updated_at=NOW()
    WHERE id=$29 AND deleted_at IS NULL RETURNING *`,
    [
      body.supplierCode ?? null, body.name ?? '', body.companyName ?? null, body.contactPerson ?? null, body.email ?? null, body.phone ?? null,
      effectiveConnType, host, body.port ?? null, body.username ?? null, body.password ?? null, body.systemId ?? null,
      body.systemType ?? null, body.smppVersion ?? '3.4', body.bindType ?? 'TRX', body.addressTon ?? 0, body.addressNpi ?? 0,
      body.addressRange ?? null, inboundMode, body.apiUrl ?? null, body.apiKey ?? null,
      body.currency ?? 'USD',
      body.forceDlr ?? false, body.chargingMode ?? 'on_submit', body.dlrTimeout ?? null, body.isActive ?? true,
      connectionMode, body.config ?? null, id
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
