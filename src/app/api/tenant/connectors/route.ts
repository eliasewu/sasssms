import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { pool } from "@/db";

/**
 * GET /api/tenant/connectors
 *
 * Returns merged connector list:
 *   1. Public connectors (153+ pre-loaded APIs: HTTP, RCS, Flash SMS, WhatsApp, Telegram, etc.)
 *   2. Tenant's own custom_api_connectors (filtered to only types that match the public table)
 *
 * The public connectors have: id, name, type, provider, region, api_url, auth_method
 * Custom connectors have: id (negated to avoid collisions), name, type, send_url_template, ...
 */
export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  try {
    // 1. Fetch public connectors (read directly from public schema)
    let publicQuery = "SELECT id, name, type, provider, region, api_url, auth_method, is_active FROM public.connectors WHERE is_active = true";
    const publicParams: string[] = [];
    if (type) {
      // Match both the exact type and aliases (Flash SMS → FLASH_SMS, HTTP API → HTTP_API)
      const mappedType = type === "Flash SMS" ? "FLASH_SMS" : type === "HTTP API" ? "HTTP_API" : type;
      publicQuery += " AND type = $1";
      publicParams.push(mappedType);
    }
    publicQuery += " ORDER BY name";

    const client = await pool.connect();
    const publicResult = await client.query(publicQuery, publicParams);
    client.release();

    // 2. Fetch tenant-specific custom connectors
    let customQuery = "SELECT id, name, type, send_url_template as api_url, is_active FROM custom_api_connectors";
    const customParams: string[] = [];
    if (type) {
      customQuery += " WHERE type = $1";
      customParams.push(type);
    }
    customQuery += " ORDER BY id DESC";

    const customResult = await tenantQuery(tenant.schemaName, customQuery, customParams);

    // 3. Merge: public connectors first, then tenant custom ones
    // IMPORTANT: custom connectors keep their real IDs — the supplier form sends
    // connectorId directly to the API which looks up custom_api_connectors by id.
    const mergedConnectors = [
      ...publicResult.rows.map((c: Record<string, unknown>) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        provider: c.provider || null,
        region: c.region || "global",
        api_url: c.api_url || null,
        auth_method: c.auth_method || "API_KEY",
        is_active: c.is_active,
        source: "global",
      })),
      ...customResult.rows.map((c: Record<string, unknown>) => ({
        id: c.id as number,
        name: c.name,
        type: c.type,
        provider: null,
        region: "custom",
        api_url: c.api_url || null,
        auth_method: "CUSTOM",
        is_active: c.is_active,
        source: "custom",
      })),
    ];

    return NextResponse.json({ connectors: mergedConnectors });
  } catch (err) {
    console.error("Failed to fetch connectors:", err);
    return NextResponse.json({ connectors: [] });
  }
}
