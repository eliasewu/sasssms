import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { auditLog } from "@/lib/db-helpers";
import { VALID_BIND_TYPES } from "@/lib/validation";
import { getSelfIp } from "@/lib/server-ips";
import { getInvoiceSettings, getTenantInfo, sendSupplierWelcomeEmail } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM suppliers WHERE deleted_at IS NULL ORDER BY id DESC");

  // Never ship credentials to the browser. password / api_key /
  // gateway_api_key are replaced with has_* booleans the UI uses to render
  // masked placeholders; the gateway API key has its own on-demand view
  // endpoint (suppliers/[id]/gateway-api-key), and stored SMPP passwords are
  // only ever replaced via the edit form, never read back.
  const suppliers = result.rows.map((r) => {
    const { password, api_key, gateway_api_key, ...safe } = r as Record<string, unknown>;
    return {
      ...safe,
      has_password: Boolean(password),
      has_api_key: Boolean(api_key),
      has_gateway_api_key: Boolean(gateway_api_key),
    };
  });
  return NextResponse.json({ suppliers });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();

  // Validate bind_type if provided
  if (body.bindType && !VALID_BIND_TYPES.includes(body.bindType)) {
    return NextResponse.json({ error: `Invalid bind_type: "${body.bindType}". Must be one of: ${VALID_BIND_TYPES.join(", ")}` }, { status: 400 });
  }

  // ANDROID_SMS suppliers: the phone app has no public IP — it binds
  // inbound to OUR SMPP server. Auto-fill the SMPP host with our own
  // public IP and force SERVER (inbound) mode.
  const isAndroidSms = body.connectionType === "ANDROID_SMS";
  const host = isAndroidSms ? (body.host || (await getSelfIp())) : (body.host ?? null);
  const connectionMode = isAndroidSms ? "SERVER" : (body.connectionMode || "CLIENT");

  try {
    const result = await tenantQuery(
      tenant.schemaName,
      `INSERT INTO suppliers (
        supplier_code, name, company_name, contact_person, email, phone,
        connection_type, host, port, username, password, system_id, system_type,
        smpp_version, bind_type, address_ton, address_npi, address_range, inbound_mode,
        api_url, api_key, currency, force_dlr,
        charging_mode, dlr_timeout,
        connection_mode, config, bind_status, connector_id, billing_email
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30) RETURNING *`,
      [
        body.supplierCode || null, body.name, body.companyName || null, body.contactPerson || null,
        body.email || null, body.phone || null, body.connectionType ?? null,
        host, parseInt(body.port ?? '0') || 2775, body.username ?? null, body.password ?? null,
        body.systemId || null, body.systemType || null, body.smppVersion || "3.4",
        body.bindType || "TRX", parseInt(body.addressTon) || 0, parseInt(body.addressNpi) || 0,
        body.addressRange || null, body.inboundMode || false,
        body.apiUrl || null, body.apiKey || null, body.currency || "USD",
        body.forceDlr || false,
        body.chargingMode || "on_submit", body.dlrTimeout || null,
        connectionMode, body.config || null, "UNBOUND",
        body.connectorId || null, body.billingEmail || null
      ]
    );

    await auditLog("suppliers", result.rows[0].id, "CREATE", tenant.email, undefined, { name: body.name }, tenant.tenantId);

    // ── Auto-send welcome email (per tenant settings) ──
    const supplierEmail = body.billingEmail || body.email;
    if (body.sendWelcomeEmail !== false && supplierEmail) {
      const settings = await getInvoiceSettings(tenant.schemaName);
      if (settings.welcomeEmailAuto) {
        const info = await getTenantInfo(tenant.tenantId);
        if (info) {
          const ok = await sendSupplierWelcomeEmail(info, result.rows[0]);
          if (ok) {
            await tenantQuery(tenant.schemaName, "UPDATE suppliers SET welcome_email_sent = true WHERE id = $1", [result.rows[0].id]);
          }
        }
      }
    }

    revalidatePath('/dashboard/suppliers');
    return NextResponse.json({ supplier: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Supplier insert error:", error);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
