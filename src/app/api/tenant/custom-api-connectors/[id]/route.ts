import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { buildUrl, evaluateCondition, extractFromResponse, parseHeaders } from "@/lib/api-connector-parser";

// GET /api/tenant/custom-api-connectors/[id] — get single connector
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM custom_api_connectors WHERE id = $1", [id]);
  if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ connector: result.rows[0] });
}

// PUT /api/tenant/custom-api-connectors/[id] — update connector
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json();
  const {
    name, type, sendUrlTemplate, sendMethod, sendHeaders, sendBodyTemplate,
    sendSuccessCondition, sendMessageIdPath,
    dlrUrlTemplate, dlrMethod,
    dlrSuccessCondition, dlrStatusPath, dlrDeliveredValue, isActive,
  } = body;

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE custom_api_connectors SET
      name=COALESCE($1,name), type=COALESCE($2,type),
      send_url_template=COALESCE($3,send_url_template), send_method=COALESCE($4,send_method),
      send_headers=$5, send_body_template=$6,
      send_success_condition=$7, send_message_id_path=$8,
      dlr_url_template=$9, dlr_method=COALESCE($10,dlr_method),
      dlr_success_condition=$11, dlr_status_path=$12, dlr_delivered_value=COALESCE($13,dlr_delivered_value),
      is_active=COALESCE($14,is_active)
    WHERE id=$15 RETURNING *`,
    [name || null, type || null, sendUrlTemplate || null, sendMethod || null,
     sendHeaders !== undefined ? sendHeaders : undefined, sendBodyTemplate !== undefined ? sendBodyTemplate : undefined,
     sendSuccessCondition !== undefined ? sendSuccessCondition : undefined, sendMessageIdPath !== undefined ? sendMessageIdPath : undefined,
     dlrUrlTemplate !== undefined ? dlrUrlTemplate : undefined, dlrMethod || null,
     dlrSuccessCondition !== undefined ? dlrSuccessCondition : undefined, dlrStatusPath !== undefined ? dlrStatusPath : undefined,
     dlrDeliveredValue || null, isActive !== undefined ? isActive : undefined,
     id]
  );

  if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ connector: result.rows[0] });
}

// DELETE /api/tenant/custom-api-connectors/[id] — delete connector
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await tenantQuery(tenant.schemaName, "DELETE FROM custom_api_connectors WHERE id = $1", [id]);
  return NextResponse.json({ success: true });
}

// POST /api/tenant/custom-api-connectors/[id]/test — test a connector (send a test message)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json();
  const { testDestination = "+8801700000000", testMessage = "Test message from Net2APP" } = body;

  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM custom_api_connectors WHERE id = $1", [id]);
  if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const connector = result.rows[0];
  const vars = { dst: testDestination, message: testMessage, sender: "Net2APP", apiKey: "" };

  try {
    const url = buildUrl(connector.send_url_template, vars);
    const fetchOptions: RequestInit = {
      method: connector.send_method || "GET",
      headers: parseHeaders(connector.send_headers || ""),
    };
    
    if (connector.send_body_template && connector.send_method === "POST") {
      fetchOptions.body = connector.send_body_template
        .replace("{{dst}}", testDestination)
        .replace("{{message}}", testMessage);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
    clearTimeout(timeout);

    const responseBody = await res.text();
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(responseBody); } catch { parsed = { raw: responseBody }; }

    const success = connector.send_success_condition
      ? evaluateCondition(connector.send_success_condition, parsed)
      : res.status === 200;

    const messageId = connector.send_message_id_path
      ? String(extractFromResponse(parsed, connector.send_message_id_path) || "")
      : "";

    return NextResponse.json({
      success,
      statusCode: res.status,
      responseBody,
      parsed,
      extractedMessageId: messageId || null,
      conditionResult: success,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
