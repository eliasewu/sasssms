import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { deliverSmsWithFallback, registerDlrCallback, filterRoutesByTrunkMcc } from "@/lib/smpp-client";
import type { RouteInfo, DlrPayload } from "@/lib/smpp-client";
import { getOnlineOttDevices, sendOttMessage } from "@/lib/ott-pairing-engine";
import type { OttDeviceType } from "@/lib/ott-pairing-engine";
import { lookupClientRate } from "@/lib/rates";

function generateMessageId(): string {
  return "CAMP_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  
  // Get campaign details
  const cResult = await tenantQuery(tenant.schemaName, "SELECT * FROM campaigns WHERE id = $1", [id]);
  if (cResult.rows.length === 0) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const campaign = cResult.rows[0];
  if (campaign.status !== "DRAFT") {
    return NextResponse.json({ error: "Campaign already running or completed" }, { status: 400 });
  }

  // Update campaign to RUNNING
  await tenantQuery(tenant.schemaName, 
    "UPDATE campaigns SET status = 'RUNNING', started_at = NOW() WHERE id = $1", [id]);

  // Get client info for routing
  const clientResult = await tenantQuery(tenant.schemaName,
    "SELECT * FROM clients WHERE id = $1 AND is_active = true", [campaign.client_id]);
  const client = clientResult.rows[0];
  if (!client) {
    await tenantQuery(tenant.schemaName,
      "UPDATE campaigns SET status = 'FAILED', completed_at = NOW() WHERE id = $1", [id]);
    return NextResponse.json({ error: "Client not found or inactive" }, { status: 404 });
  }

  const recipients: string[] = JSON.parse(campaign.recipients || "[]");

  // Cached for both SMS DLR registration and INSERT (OTT Worker reads from message record)
  const dlrCallbackUrl: string | null = client.dlr_callback_url || client.webhook_url || null;

  // Get route plan for the client — resolve ALL routes for fallback
  let routePlanId = client.route_plan_id;
  let allRoutes: RouteInfo[] = [];

  if (routePlanId) {
    const routeResult = await tenantQuery(tenant.schemaName,
      `SELECT rpr.route_id, rpr.priority, r.name as route_name, r.trunk_id,
              t.name as trunk_name, t.supplier_id,
              t.mcc_allow_list, t.mcc_deny_list,
              s.name as supplier_name, s.connection_type
       FROM route_plan_routes rpr
       JOIN routes r ON rpr.route_id = r.id AND r.is_active = true
       JOIN trunks t ON r.trunk_id = t.id AND t.is_active = true
       JOIN suppliers s ON t.supplier_id = s.id AND s.is_active = true
       WHERE rpr.route_plan_id = $1 ORDER BY rpr.priority ASC`,
      [routePlanId]);
    
    allRoutes = routeResult.rows.map((r: Record<string,unknown>) => ({
      routeId: r.route_id as number,
      routeName: r.route_name as string,
      trunkId: r.trunk_id as number,
      trunkName: r.trunk_name as string,
      trunkMccAllowList: (r.mcc_allow_list as string) || null,
      trunkMccDenyList: (r.mcc_deny_list as string) || null,
      supplierId: r.supplier_id as number,
      supplierName: r.supplier_name as string,
      connectionType: r.connection_type as string,
      priority: r.priority as number,
    }));
  }

  let sent = 0, delivered = 0, failed = 0;
  const messageRecords: Array<Record<string, unknown>> = [];

  // Process recipients in batches of 50 to avoid overwhelming connections
  const BATCH_SIZE = 50;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (dest) => {
      const messageId = generateMessageId();

      // ── Detect OTT routes ──
      const filteredRoutes = allRoutes.length > 0 ? filterRoutesByTrunkMcc(allRoutes, dest) : [];
      const firstRoute = filteredRoutes[0];
      const isOtt = firstRoute?.connectionType === "WhatsApp OTT" || firstRoute?.connectionType === "Telegram OTT";

      // Look up the rate for this specific destination
      const ratePerSms = await lookupClientRate(dest, campaign.client_id, tenant.schemaName);

      let isSuccess: boolean;
      let msgStatus: string;
      let dlrStat: string;
      let deliveryResult: { success: boolean; routeUsed?: RouteInfo; fallbackUsed: boolean; failedRoutes: number } | null = null;

      if (isOtt) {
        // ── OTT delivery ──
        const ottDeviceType: OttDeviceType = firstRoute.connectionType === "WhatsApp OTT" ? "whatsapp" : "telegram";
        const onlineDevices = await getOnlineOttDevices(tenant.schemaName, ottDeviceType);

        if (onlineDevices.length === 0) {
          isSuccess = false;
          msgStatus = "FAILED";
          dlrStat = "FAILED";
        } else {
          const ottResult = await sendOttMessage(
            tenant.schemaName,
            onlineDevices[0].id,
            dest,
            campaign.content,
            messageId,
            campaign.client_id,
            routePlanId,
            firstRoute.routeId,
            firstRoute.trunkId,
            firstRoute.supplierId,
            ratePerSms
          );
          isSuccess = ottResult.success;
          msgStatus = isSuccess ? "SENT" : "FAILED";
          dlrStat = isSuccess ? "PENDING" : "FAILED";
        }
      } else if (filteredRoutes.length > 0) {
        // ── SMS delivery ──
        deliveryResult = await deliverSmsWithFallback(
          tenant.tenantId,
          tenant.schemaName,
          campaign.client_id,
          campaign.sender,
          dest,
          campaign.content,
          messageId,
          filteredRoutes,
          dlrCallbackUrl || undefined
        );
        isSuccess = deliveryResult?.success ?? false;
        msgStatus = isSuccess ? "SENT" : "FAILED";
        dlrStat = isSuccess ? "PENDING" : "FAILED";
      } else {
        // No routes — simulate for backward compat
        deliveryResult = { success: Math.random() > 0.15, fallbackUsed: false, failedRoutes: 0 };
        isSuccess = deliveryResult?.success ?? false;
        msgStatus = isSuccess ? "SENT" : "FAILED";
        dlrStat = isSuccess ? "PENDING" : "FAILED";
      }

      const msgResult = await tenantQuery(
        tenant.schemaName,
        `INSERT INTO messages (client_id, sender, destination, content, status,
          route_plan_id, route_id, trunk_id, supplier_id, connection_type,
          cost, dlr_status, message_id, campaign_id, log_type, dlr_callback_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [
          campaign.client_id,
          campaign.sender,
          dest,
          campaign.content,
          msgStatus,
          routePlanId || null,
          deliveryResult?.routeUsed?.routeId || firstRoute?.routeId || null,
          deliveryResult?.routeUsed?.trunkId || firstRoute?.trunkId || null,
          deliveryResult?.routeUsed?.supplierId || firstRoute?.supplierId || null,
          deliveryResult?.routeUsed?.connectionType || firstRoute?.connectionType || "SMPP",
          ratePerSms,
          dlrStat,
          messageId,
          id,
          "campaign",
          dlrCallbackUrl,
        ]
      );

      // Deduct balance for successful sends
      if (isSuccess) {
        await tenantQuery(
          tenant.schemaName,
          "UPDATE clients SET balance = balance - $1, updated_at = NOW() WHERE id = $2",
          [ratePerSms, campaign.client_id]
        );
      }

      // Register DLR callback for SMS routes (OTT DLR is handled by the OTT Worker)
      if (isSuccess && dlrCallbackUrl && !isOtt) {
        registerDlrCallback(messageId, (dlr: DlrPayload) => {
          fetch(dlrCallbackUrl!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message_id: dlr.messageId,
              destination: dlr.dest,
              source: dlr.src,
              status: dlr.status,
              dlr_status: dlr.status,
              cost: ratePerSms,
              timestamp: new Date().toISOString(),
              campaign_id: parseInt(id),
            }),
          }).catch(() => {});
        });
      }

      return { isSuccess, msgResult, messageId };
    });

    const batchResults = await Promise.all(batchPromises);
    for (const { isSuccess, msgResult, messageId } of batchResults) {
      sent++;
      if (isSuccess) {
        delivered++;
      } else {
        failed++;
      }
      messageRecords.push(msgResult.rows[0]);
    }
  }

  // Update campaign with final counts
  await tenantQuery(tenant.schemaName,
    `UPDATE campaigns SET status = 'COMPLETED', sent_count = $1, delivered_count = $2,
     failed_count = $3, completed_at = NOW() WHERE id = $4`,
    [sent, delivered, failed, id]);

  return NextResponse.json({
    success: true,
    campaignId: parseInt(id),
    sent,
    delivered,
    failed,
    totalRecipients: recipients.length,
    status: "COMPLETED",
  });
}
