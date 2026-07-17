import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { filterRoutesByTrunkMcc } from "@/lib/smpp-client";
import type { RouteInfo } from "@/lib/smpp-client";
import { getOnlineOttDevices, sendOttMessage } from "@/lib/ott-pairing-engine";
import type { OttDeviceType } from "@/lib/ott-pairing-engine";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [tenantData] = await db
    .select({
      smsCounter: tenants.smsCounter,
      smsLimit: tenants.smsLimit,
      packageType: tenants.packageType,
    })
    .from(tenants)
    .where(eq(tenants.id, tenant.tenantId));

  const freeCredits = Math.max(0, (tenantData?.smsLimit || 0) - (tenantData?.smsCounter || 0));
  return NextResponse.json({
    freeCredits,
    totalCredits: tenantData?.smsLimit || 0,
    usedCredits: tenantData?.smsCounter || 0,
    packageType: tenantData?.packageType || "starter",
  });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [tenantData] = await db
    .select({
      smsCounter: tenants.smsCounter,
      smsLimit: tenants.smsLimit,
      packageType: tenants.packageType,
      maxTps: tenants.maxTps,
    })
    .from(tenants)
    .where(eq(tenants.id, tenant.tenantId));

  // Check remaining free test credits
  const freeCredits = Math.max(
    0,
    (tenantData?.smsLimit || 0) - (tenantData?.smsCounter || 0)
  );

  if (freeCredits <= 0) {
    return NextResponse.json({
      error: "No free test SMS credits remaining. Please top up your account.",
      freeCredits: 0,
      totalCredits: tenantData?.smsLimit || 0,
      usedCredits: tenantData?.smsCounter || 0,
    }, { status: 402 });
  }

  const body = await request.json();
  const { clientId, sender, destination, content, testRouteId } = body;

  if (!clientId || !sender || !destination || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Get client (must be active)
  const clientResult = await tenantQuery(
    tenant.schemaName,
    "SELECT * FROM clients WHERE id = $1 AND is_active = true",
    [clientId]
  );
  if (clientResult.rows.length === 0) {
    return NextResponse.json({ error: "Client not found or inactive" }, { status: 404 });
  }

  const client = clientResult.rows[0];
  let routePlanId = client.route_plan_id;
  let selectedRoute: Record<string, unknown> = {};

  // Route selection
  if (testRouteId) {
    const routeResult = await tenantQuery(
      tenant.schemaName,
      `SELECT r.*, t.name as trunk_name, t.supplier_id,
              t.mcc_allow_list, t.mcc_deny_list,
              s.name as supplier_name, s.connection_type
       FROM routes r
       LEFT JOIN trunks t ON r.trunk_id = t.id AND t.is_active = true
       LEFT JOIN suppliers s ON t.supplier_id = s.id AND s.is_active = true
       WHERE r.id = $1 AND r.is_active = true`,
      [testRouteId]
    );
    if (routeResult.rows.length === 0) {
      return NextResponse.json({ error: "Route not found or inactive" }, { status: 404 });
    }
    selectedRoute = routeResult.rows[0];
  } else if (routePlanId) {
    const routeResult = await tenantQuery(
      tenant.schemaName,
      `SELECT rpr.route_id, rpr.priority, r.name as route_name, r.trunk_id,
              t.name as trunk_name, t.supplier_id,
              t.mcc_allow_list, t.mcc_deny_list,
              s.name as supplier_name, s.connection_type
       FROM route_plan_routes rpr
       JOIN routes r ON rpr.route_id = r.id AND r.is_active = true
       JOIN trunks t ON r.trunk_id = t.id AND t.is_active = true
       JOIN suppliers s ON t.supplier_id = s.id AND s.is_active = true
       WHERE rpr.route_plan_id = $1 ORDER BY rpr.priority ASC`,
      [routePlanId]
    );
    if (routeResult.rows.length === 0) {
      return NextResponse.json({ error: "No active routes in plan. Add routes via Dashboard → Routes, and link them to the plan via Dashboard → Route Plans.", hint: "route_plan_id=" + routePlanId }, { status: 400 });
    }
    selectedRoute = routeResult.rows[0];
  } else {
    return NextResponse.json({ error: "No route plan or route specified" }, { status: 400 });
  }

  // ── Trunk-level MCC/MNC filtering ──
  const allRoutes: RouteInfo[] = [{
    routeId: (selectedRoute.route_id || selectedRoute.id) as number,
    routeName: (selectedRoute.route_name || selectedRoute.name) as string,
    trunkId: (selectedRoute.trunk_id) as number,
    trunkName: (selectedRoute.trunk_name) as string,
    trunkMccAllowList: (selectedRoute.mcc_allow_list as string) || null,
    trunkMccDenyList: (selectedRoute.mcc_deny_list as string) || null,
    supplierId: (selectedRoute.supplier_id) as number,
    supplierName: (selectedRoute.supplier_name) as string,
    connectionType: (selectedRoute.connection_type) as string,
    priority: 1,
  }];
  const filteredRoutes = filterRoutesByTrunkMcc(allRoutes, destination);
  if (filteredRoutes.length === 0) {
    return NextResponse.json({ error: "No routes available for this destination (MCC filtering)" }, { status: 400 });
  }

  // Simulate delivery for non-OTT routes; OTT routes get real delivery via pairing engine
  const messageId = "TEST_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const isOttRoute = selectedRoute.connection_type === "WhatsApp OTT" || selectedRoute.connection_type === "Telegram OTT";
  let ottDeviceId: number | null = null;
  let success: boolean;
  let msgStatus: string;
  let dlrStatus: string;

  if (isOttRoute) {
    const ottDeviceType: OttDeviceType = selectedRoute.connection_type === "WhatsApp OTT" ? "whatsapp" : "telegram";
    const onlineDevices = await getOnlineOttDevices(tenant.schemaName, ottDeviceType);

    if (onlineDevices.length === 0) {
      success = false;
      msgStatus = "FAILED";
      dlrStatus = "FAILED";
    } else {
      ottDeviceId = onlineDevices[0].id;
      const ottResult = await sendOttMessage(
        tenant.schemaName,
        ottDeviceId,
        destination,
        content,
        messageId,
        clientId,
        routePlanId || null,
        (selectedRoute.route_id || selectedRoute.id) as number,
        (selectedRoute.trunk_id) as number || null,
        (selectedRoute.supplier_id) as number || null,
        0 // cost is 0 for free tests
      );
      success = ottResult.success;
      msgStatus = success ? "SENT" : "FAILED";
      dlrStatus = success ? "PENDING" : "FAILED";
    }
  } else {
    success = Math.random() > 0.1;
    msgStatus = success ? "DELIVERED" : "FAILED";
    dlrStatus = success ? "DELIVERED" : "FAILED";
  }

  // Insert test message record (cost = 0 for free tests)
  const dlrCallbackUrl = (client.dlr_callback_url || client.webhook_url || null) as string | null;
  const msgResult = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO messages (client_id, sender, destination, content, status,
      route_plan_id, route_id, trunk_id, supplier_id, connection_type,
      cost, dlr_status, dlr_timestamp, message_id, log_type, dlr_callback_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12,$13,'test',$14) RETURNING *`,
    [
      clientId,
      sender,
      destination,
      content,
      msgStatus,
      routePlanId || null,
      selectedRoute.route_id || selectedRoute.id,
      selectedRoute.trunk_id || null,
      selectedRoute.supplier_id || null,
      selectedRoute.connection_type || "SMPP",
      dlrStatus,
      dlrStatus === "DELIVERED" ? new Date() : null,
      messageId,
      dlrCallbackUrl,
    ]
  );

  // Increment tenant SMS counter (track free usage)
  await db
    .update(tenants)
    .set({ smsCounter: (tenantData?.smsCounter || 0) + 1 })
    .where(eq(tenants.id, tenant.tenantId));

  const remainingCredits = Math.max(0, freeCredits - 1);

  return NextResponse.json({
    success: true,
    message: msgResult.rows[0],
    messageId,
    routing: {
      routePlan: routePlanId,
      route: selectedRoute.route_name || selectedRoute.name,
      trunk: selectedRoute.trunk_name,
      supplier: selectedRoute.supplier_name,
      connectionType: selectedRoute.connection_type,
    },
    cost: 0,
    dlr: { status: dlrStatus, pushed_to: dlrCallbackUrl },
    ott: ottDeviceId ? {
      deviceId: ottDeviceId,
      deviceType: selectedRoute.connection_type,
      status: msgStatus,
    } : null,
    freeCredits: {
      before: freeCredits,
      after: remainingCredits,
      used: 1,
      total: tenantData?.smsLimit || 0,
      usedTotal: (tenantData?.smsCounter || 0) + 1,
    },
  });
}
