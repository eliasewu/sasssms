import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

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

  const ratePerSms = parseFloat(client.rate_per_sms || "0.00030");
  const recipients: string[] = JSON.parse(campaign.recipients || "[]");

  // Get route plan for the client
  let routePlanId = client.route_plan_id;
  let routeInfo: Record<string, unknown> = {};

  if (routePlanId) {
    const routeResult = await tenantQuery(tenant.schemaName,
      `SELECT rpr.route_id, rpr.priority, r.name as route_name, r.trunk_id,
              t.name as trunk_name, t.supplier_id,
              s.name as supplier_name, s.connection_type
       FROM route_plan_routes rpr
       JOIN routes r ON rpr.route_id = r.id AND r.is_active = true
       JOIN trunks t ON r.trunk_id = t.id AND t.is_active = true
       JOIN suppliers s ON t.supplier_id = s.id AND s.is_active = true
       WHERE rpr.route_plan_id = $1 ORDER BY rpr.priority ASC LIMIT 1`,
      [routePlanId]);
    if (routeResult.rows.length > 0) routeInfo = routeResult.rows[0];
  }

  let sent = 0, delivered = 0, failed = 0;
  const messageRecords: Array<Record<string, unknown>> = [];

  // Create individual message records for each recipient
  for (const dest of recipients) {
    sent++;
    const messageId = generateMessageId();
    const isSuccess = Math.random() > 0.15; // 85% delivery rate
    
    // Phase 1: Message SENT to supplier
    const msgStatus = isSuccess ? "SENT" : "FAILED";
    const dlrStatus = isSuccess ? "SENT" : "FAILED";
    
    const msgResult = await tenantQuery(
      tenant.schemaName,
      `INSERT INTO messages (client_id, sender, destination, content, status,
        route_plan_id, route_id, trunk_id, supplier_id, connection_type,
        cost, dlr_status, dlr_timestamp, message_id, campaign_id, log_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        campaign.client_id,
        campaign.sender,
        dest,
        campaign.content,
        msgStatus,
        routePlanId || null,
        routeInfo.route_id || null,
        routeInfo.trunk_id || null,
        routeInfo.supplier_id || null,
        routeInfo.connection_type || "SMPP",
        ratePerSms,
        dlrStatus,
        isSuccess ? new Date() : null,
        messageId,
        id,
        "campaign",
      ]
    );

    // Phase 2: Simulate DLR callback (after brief delay, some become FAILED)
    if (isSuccess) {
      const finalDlr = Math.random() > 0.1 ? "DELIVERED" : "FAILED";
      const finalStatus = finalDlr === "DELIVERED" ? "DELIVERED" : "FAILED";
      
      await tenantQuery(
        tenant.schemaName,
        "UPDATE messages SET dlr_status = $1, status = $2, dlr_timestamp = NOW() WHERE id = $3",
        [finalDlr, finalStatus, msgResult.rows[0].id]
      );

      if (finalDlr === "DELIVERED") {
        delivered++;
      } else {
        failed++;
      }
    } else {
      failed++;
    }

    messageRecords.push(msgResult.rows[0]);

    // Deduct client balance per message
    await tenantQuery(
      tenant.schemaName,
      "UPDATE clients SET balance = balance - $1, updated_at = NOW() WHERE id = $2",
      [ratePerSms, campaign.client_id]
    );
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
