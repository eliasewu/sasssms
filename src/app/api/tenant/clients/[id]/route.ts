import { NextResponse } from "next/server";
import { getTenantFromRequest, deriveApiKey } from "@/lib/auth";
import { tenantQuery, isSmppUsernameTaken, syncSmppUsernameChange, unregisterSmppUsername } from "@/lib/tenant-schema";
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

  // ── Cross-tenant SMPP username uniqueness check ──
  const smppUsername = body.smppUsername || null;
  if (smppUsername) {
    const taken = await isSmppUsernameTaken(smppUsername, parseInt(id));
    if (taken) {
      return NextResponse.json(
        { error: `SMPP username "${smppUsername}" is already in use by another client across all tenants. Please choose a unique SMPP username.` },
        { status: 409 }
      );
    }
  }

  // Auto-derive REST API key from SMPP credentials when HTTP API is enabled
  const enableHttpApi = body.enableHttpApi || false;
  // Use local variable (not body.smppPassword) — frontend omits unchanged passwords, so body.smppPassword may be undefined
  const smppPassword = (body.smppPassword && body.smppPassword !== "••••••••") ? body.smppPassword : null;
  // Preserve existing API key unless explicitly being changed
  let httpApiKey: string | null = body.httpApiKey ?? (oldData.http_api_key as string) ?? null;
  if (enableHttpApi && smppUsername && smppPassword) {
    httpApiKey = deriveApiKey(smppUsername, smppPassword);
  }

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE clients SET 
      client_code=$1, name=$2, company_name=$3, contact_person=$4, email=$5, phone=$6,
      country=$7, address=$8, connection_type=$9, smpp_username=$10,
      smpp_allowed_ip=$12, smpp_port=$13, smpp_system_type=$14, max_tps=$15,
      smpp_password=COALESCE(NULLIF($11, '••••••••'), smpp_password),
      billing_mode=$16, currency=$17, balance=$18, credit_limit=$19,
      route_plan_id=$20, is_active=$21, enable_http_api=$22, http_api_key=$23, force_dlr=$24,
      dlr_timeout_mode=$25, dlr_timeout=$26, webhook_url=$27, updated_at=NOW()
    WHERE id=$28 AND deleted_at IS NULL RETURNING *`,
    [
      body.clientCode, body.name, body.companyName, body.contactPerson, body.email, body.phone,
      body.country, body.address, body.connectionType, body.smppUsername, smppPassword,
      body.smppAllowedIp, body.smppPort, body.smppSystemType, body.maxTps,
      body.billingMode, body.currency, body.balance, body.creditLimit,
      body.routePlanId, body.isActive, body.enableHttpApi, httpApiKey, body.forceDlr,
      body.dlrTimeoutMode, body.dlrTimeout, body.webhookUrl, id
    ]
  );

  await auditLog("clients", parseInt(id), "UPDATE", tenant.email, oldData, body, tenant.tenantId);

  // ── Sync SMPP username in global index if changed ──
  const oldUsername = (oldData.smpp_username as string) || null;
  if (oldUsername !== smppUsername) {
    await syncSmppUsernameChange(oldUsername, smppUsername, tenant.tenantId, parseInt(id), tenant.schemaName);
  }

  return NextResponse.json({ client: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // ── Fetch smpp_username BEFORE soft-deleting (for global index cleanup) ──
  const oldResult = await tenantQuery(tenant.schemaName, "SELECT smpp_username FROM clients WHERE id = $1", [id]);
  const oldSmppUsername = (oldResult.rows[0]?.smpp_username as string) || null;

  // Soft delete with CDR
  const deleted = await softDelete(tenant.schemaName, "clients", parseInt(id), tenant.email, tenant.tenantId);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Remove from global SMPP username index ──
  if (oldSmppUsername) {
    await unregisterSmppUsername(oldSmppUsername);
  }

  return NextResponse.json({ success: true, message: "Client archived to CDR" });
}
