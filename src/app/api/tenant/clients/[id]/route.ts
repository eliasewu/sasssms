import { NextResponse } from "next/server";
import { getTenantFromRequest, deriveApiKey } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { softDelete, auditLog } from "@/lib/db-helpers";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM clients WHERE id = $1 AND deleted_at IS NULL", [id]);
  if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ client: result.rows[0] });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  // Fetch old data for audit
  const oldResult = await tenantQuery(tenant.schemaName, "SELECT * FROM clients WHERE id = $1", [id]);
  const oldData = oldResult.rows[0] || {};

  // Auto-derive REST API key from SMPP credentials when HTTP API is enabled
  const enableHttpApi = body.enableHttpApi || false;
  const smppUsername = body.smppUsername || null;
  const smppPassword = body.smppPassword || null;
  let httpApiKey: string | null = body.httpApiKey || null;
  if (enableHttpApi && smppUsername && smppPassword) {
    httpApiKey = deriveApiKey(smppUsername, smppPassword);
  }

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE clients SET 
      client_code=$1, name=$2, company_name=$3, contact_person=$4, email=$5, phone=$6,
      country=$7, address=$8, connection_type=$9, smpp_username=$10, smpp_password=$11,
      smpp_allowed_ip=$12, smpp_port=$13, smpp_system_type=$14, max_tps=$15,
      billing_mode=$16, currency=$17, balance=$18, credit_limit=$19, rate_per_sms=$20,
      route_plan_id=$21, is_active=$22, enable_http_api=$23, http_api_key=$24, force_dlr=$25,
      dlr_timeout_mode=$26, dlr_timeout=$27, webhook_url=$28, updated_at=NOW()
    WHERE id=$29 AND deleted_at IS NULL RETURNING *`,
    [
      body.clientCode, body.name, body.companyName, body.contactPerson, body.email, body.phone,
      body.country, body.address, body.connectionType, body.smppUsername, body.smppPassword,
      body.smppAllowedIp, body.smppPort, body.smppSystemType, body.maxTps,
      body.billingMode, body.currency, body.balance, body.creditLimit, body.ratePerSms,
      body.routePlanId, body.isActive, body.enableHttpApi, httpApiKey, body.forceDlr,
      body.dlrTimeoutMode, body.dlrTimeout, body.webhookUrl, id
    ]
  );

  await auditLog("clients", parseInt(id), "UPDATE", tenant.email, oldData, body, tenant.tenantId);

  return NextResponse.json({ client: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Soft delete with CDR
  const deleted = await softDelete(tenant.schemaName, "clients", parseInt(id), tenant.email, tenant.tenantId);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true, message: "Client archived to CDR" });
}
