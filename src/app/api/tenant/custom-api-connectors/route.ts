import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

// GET /api/tenant/custom-api-connectors — list all custom connectors
export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  let query = "SELECT * FROM custom_api_connectors";
  const params: string[] = [];
  if (type) {
    query += " WHERE type = $1";
    params.push(type);
  }
  query += " ORDER BY id DESC";

  const result = await tenantQuery(tenant.schemaName, query, params);
  return NextResponse.json({ connectors: result.rows });
}

// POST /api/tenant/custom-api-connectors — create a custom connector
export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    name, type = "HTTP_API",
    sendUrlTemplate, sendMethod = "GET", sendHeaders, sendBodyTemplate,
    sendSuccessCondition, sendMessageIdPath,
    dlrUrlTemplate, dlrMethod = "GET",
    dlrSuccessCondition, dlrStatusPath, dlrDeliveredValue,
  } = body;

  if (!name || !sendUrlTemplate) {
    return NextResponse.json({ error: "Name and send URL template are required" }, { status: 400 });
  }

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO custom_api_connectors (
      name, type, send_url_template, send_method, send_headers, send_body_template,
      send_success_condition, send_message_id_path,
      dlr_url_template, dlr_method,
      dlr_success_condition, dlr_status_path, dlr_delivered_value
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      name, type, sendUrlTemplate, sendMethod, sendHeaders || null, sendBodyTemplate || null,
      sendSuccessCondition || null, sendMessageIdPath || null,
      dlrUrlTemplate || null, dlrMethod || "GET",
      dlrSuccessCondition || null, dlrStatusPath || null, dlrDeliveredValue || "Delivered",
    ]
  );

  revalidatePath('/dashboard/custom-api');
  return NextResponse.json({ connector: result.rows[0] }, { status: 201 });
}
