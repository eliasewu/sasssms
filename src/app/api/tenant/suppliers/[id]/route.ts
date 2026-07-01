import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { softDelete, auditLog } from "@/lib/db-helpers";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const oldResult = await tenantQuery(tenant.schemaName, "SELECT * FROM suppliers WHERE id = $1", [id]);

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE suppliers SET 
      supplier_code=$1, name=$2, company_name=$3, contact_person=$4, email=$5, phone=$6,
      connection_type=$7, host=$8, port=$9, username=$10, password=$11, system_id=$12,
      system_type=$13, smpp_version=$14, bind_type=$15, address_ton=$16, address_npi=$17,
      address_range=$18, inbound_mode=$19, api_url=$20, api_key=$21,
      currency=$22, cost_per_sms=$23, initial_balance=$24, credit_limit=$25,
      force_dlr=$26, is_active=$27, config=$28, updated_at=NOW()
    WHERE id=$29 AND deleted_at IS NULL RETURNING *`,
    [
      body.supplierCode, body.name, body.companyName, body.contactPerson, body.email, body.phone,
      body.connectionType, body.host, body.port, body.username, body.password, body.systemId,
      body.systemType, body.smppVersion, body.bindType, body.addressTon, body.addressNpi,
      body.addressRange, body.inboundMode, body.apiUrl, body.apiKey,
      body.currency, body.costPerSms, body.initialBalance, body.creditLimit,
      body.forceDlr, body.isActive, body.config, id
    ]
  );

  await auditLog("suppliers", parseInt(id), "UPDATE", tenant.email, oldResult.rows[0] || {}, body, tenant.tenantId);

  return NextResponse.json({ supplier: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const deleted = await softDelete(tenant.schemaName, "suppliers", parseInt(id), tenant.email, tenant.tenantId);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true, message: "Supplier archived to CDR" });
}
