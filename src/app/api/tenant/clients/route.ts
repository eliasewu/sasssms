import { NextResponse } from "next/server";
import { getTenantFromRequest, deriveApiKey } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { auditLog } from "@/lib/db-helpers";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await tenantQuery(
    tenant.schemaName,
    "SELECT * FROM clients WHERE deleted_at IS NULL ORDER BY id DESC"
  );
  return NextResponse.json({ clients: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();

  // Auto-derive REST API key from SMPP credentials when HTTP API is enabled
  const enableHttpApi = body.enableHttpApi || false;
  const smppUsername = body.smppUsername || null;
  const smppPassword = body.smppPassword || null;
  let httpApiKey: string | null = null;
  if (enableHttpApi && smppUsername && smppPassword) {
    httpApiKey = deriveApiKey(smppUsername, smppPassword);
  }

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO clients (
      client_code, name, company_name, contact_person, email, phone, country, address,
      connection_type, smpp_username, smpp_password, smpp_allowed_ip, smpp_port, smpp_system_type, max_tps,
      billing_mode, currency, balance, credit_limit, rate_per_sms,
      route_plan_id, enable_http_api, http_api_key, force_dlr, dlr_timeout_mode, dlr_timeout, webhook_url
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) RETURNING *`,
    [
      body.clientCode || null, body.name, body.companyName || null, body.contactPerson || null,
      body.email, body.phone, body.country || null, body.address || null,
      body.connectionType || null, body.smppUsername || null, body.smppPassword || null,
      body.smppAllowedIp || null, body.smppPort || 2775, body.smppSystemType || null, body.maxTps || null,
      body.billingMode || "prepaid", body.currency || "USD",
      body.balance || "0", body.creditLimit || "0", body.ratePerSms || "0.00030",
      body.routePlanId || null, body.enableHttpApi || false, httpApiKey, body.forceDlr || false,
      body.dlrTimeoutMode || null, body.dlrTimeout || null, body.webhookUrl || null
    ]
  );

  await auditLog("clients", result.rows[0].id, "CREATE", tenant.email, undefined, { name: body.name }, tenant.tenantId);

  return NextResponse.json({ client: result.rows[0] }, { status: 201 });
}
