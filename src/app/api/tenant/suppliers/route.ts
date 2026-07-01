import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { auditLog } from "@/lib/db-helpers";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM suppliers WHERE deleted_at IS NULL ORDER BY id DESC");
  return NextResponse.json({ suppliers: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();

  try {
    const result = await tenantQuery(
      tenant.schemaName,
      `INSERT INTO suppliers (
        supplier_code, name, company_name, contact_person, email, phone,
        connection_type, host, port, username, password, system_id, system_type,
        smpp_version, bind_type, address_ton, address_npi, address_range, inbound_mode,
        api_url, api_key, currency, cost_per_sms, initial_balance, credit_limit, force_dlr,
        connection_mode, config, bind_status, connector_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30) RETURNING *`,
      [
        body.supplierCode || null, body.name, body.companyName || null, body.contactPerson || null,
        body.email || null, body.phone || null, body.connectionType,
        body.host || null, parseInt(body.port) || 2775, body.username || null, body.password || null,
        body.systemId || null, body.systemType || null, body.smppVersion || "3.4",
        body.bindType || "TRX", parseInt(body.addressTon) || 0, parseInt(body.addressNpi) || 0,
        body.addressRange || null, body.inboundMode || false,
        body.apiUrl || null, body.apiKey || null, body.currency || "USD",
        body.costPerSms || "0", body.initialBalance || "0", body.creditLimit || "0",
        body.forceDlr || false,
        body.connectionMode || "CLIENT", body.config || null, "UNBOUND",
        body.connectorId || null
      ]
    );

    await auditLog("suppliers", result.rows[0].id, "CREATE", tenant.email, undefined, { name: body.name }, tenant.tenantId);
    return NextResponse.json({ supplier: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Supplier insert error:", error);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
