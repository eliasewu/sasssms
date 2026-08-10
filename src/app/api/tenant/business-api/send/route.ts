import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendBusinessApiMessage } from "@/lib/business-api-send";

export const dynamic = "force-dynamic";

/**
 * POST /api/tenant/business-api/send
 *
 * Sends a message through a configured Business API connection
 * (business_api_connect — Telegram Bot API / WhatsApp Business API).
 *
 * Body: {
 *   clientId: number,        // platform sub-client
 *   connectionId: number,    // business_api_connect.id
 *   destination: string,     // E.164 recipient — validated before sending
 *   message: string,
 *   sender?: string          // optional (WhatsApp sender id / Telegram unused)
 * }
 *
 * Number-validity gate: invalid destinations are REJECTED, never sent and
 * never charged (billing matrix rule 5) — the response carries
 * `rejected: true` and the message row shows FAIL/undelivered DLR.
 */
export async function POST(request: Request) {
  // Cookie-based dashboard session OR HTTP API key (x-api-key / Bearer)
  let tenant = getTenantFromRequest(request);
  let apiClientId: number | null = null;

  if (!tenant) {
    const apiKey =
      request.headers.get("x-api-key") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (apiKey) {
      const allTenants = await db
        .select({ id: tenants.id, schemaName: tenants.schemaName })
        .from(tenants)
        .where(eq(tenants.isActive, true));
      for (const t of allTenants) {
        const clientResult = await tenantQuery(
          t.schemaName,
          "SELECT id FROM clients WHERE (http_api_key = $1 OR smpp_username = $1) AND is_active = true AND enable_http_api = true",
          [apiKey]
        );
        if (clientResult.rows.length > 0) {
          tenant = { tenantId: t.id, email: "api@client", schemaName: t.schemaName, companyName: "" };
          apiClientId = clientResult.rows[0].id;
          break;
        }
      }
      if (!tenant) {
        return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
      }
    }
  }

  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const clientId = apiClientId || body.clientId;
  const { connectionId, destination, message, sender } = body;

  if (!clientId || !connectionId || !destination || !message) {
    return NextResponse.json(
      { error: "Missing required fields: clientId, connectionId, destination, message" },
      { status: 400 }
    );
  }

  // ── SMS credit check (same guard as /api/tenant/send-sms) ──
  const [tenantData] = await db
    .select({ smsCounter: tenants.smsCounter, smsLimit: tenants.smsLimit })
    .from(tenants)
    .where(eq(tenants.id, tenant.tenantId));
  const smsRemaining = (tenantData?.smsLimit || 0) - (tenantData?.smsCounter || 0);
  if (tenantData?.smsLimit && tenantData.smsLimit > 0 && smsRemaining <= 0) {
    return NextResponse.json({
      error: "SMS credit exhausted. Please top-up to continue sending.",
      smsBalance: 0,
      smsTotal: tenantData.smsLimit,
      smsSent: tenantData.smsCounter,
    }, { status: 402 });
  }

  const result = await sendBusinessApiMessage({
    schemaName: tenant.schemaName,
    tenantId: tenant.tenantId,
    clientId,
    connectionId,
    destination,
    message,
    sender: sender || null,
  });

  // Rejected invalid numbers are a client-side validation failure, not a server error
  if (result.rejected) {
    return NextResponse.json({
      success: false,
      rejected: true,
      messageId: result.messageId,
      status: "REJECTED",
      dlr: { status: "FAILED", reason: "Invalid destination number" },
      cost: 0,
      provider: result.provider,
      error: result.error,
    }, { status: 422 });
  }

  if (!result.success) {
    return NextResponse.json({
      success: false,
      messageId: result.messageId,
      status: result.status,
      dlr: { status: result.dlrStatus },
      cost: result.cost,
      provider: result.provider,
      apiName: result.apiName,
      httpStatus: result.httpStatus,
      response: result.responseText ? String(result.responseText).slice(0, 200) : undefined,
      error: result.error || "Provider rejected the message",
    }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    messageId: result.messageId,
    status: result.status,
    dlr: { status: result.dlrStatus },
    cost: result.cost,
    provider: result.provider,
    apiName: result.apiName,
  });
}
