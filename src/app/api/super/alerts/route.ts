import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { getAlerts, markAlertRead, runHealthCheck, getLastStatuses, markAllAlertsRead } from "@/lib/service-monitor";

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  // Trigger a fresh health check (runs async, returns immediately)
  if (action === "health-check") {
    // Fire-and-forget the health check
    runHealthCheck().catch(err => console.error("Health check error:", err));
    return NextResponse.json({ started: true, message: "Health check started. Poll GET /api/super/alerts for results." });
  }

  // Regular list (includes cached statuses from last health check)
  const alerts = await getAlerts(100);
  const unreadCount = alerts.filter(a => !a.isRead).length;
  const { statuses, lastCheckTime } = getLastStatuses();
  return NextResponse.json({ alerts, unreadCount, statuses, lastCheckTime: lastCheckTime?.toISOString() || null });
}

export async function PUT(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Mark as read
  if (body.alertId) {
    await markAlertRead(body.alertId);
    return NextResponse.json({ success: true });
  }

  // Mark all as read (bulk query)
  if (body.markAllRead) {
    await markAllAlertsRead();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "No action specified" }, { status: 400 });
}
