import { NextResponse } from "next/server";
import { ALL_SERVER_IPS, KNOWN_LABELS } from "@/lib/server-ips";

/**
 * GET /api/public/server-list
 *
 * Lightweight server discovery endpoint for the Android SMS Gateway app.
 * Returns server IPs with SMPP ports so the app knows where to connect.
 * Unlike /api/public/server-status, this INCLUDES IPs (needed by the app).
 *
 * No auth required — the app authenticates via SMPP bind credentials.
 */
export async function GET() {
  const servers = ALL_SERVER_IPS.map((ip) => ({
    ip,
    label: KNOWN_LABELS[ip] || ip,
    smppPort: 2775,
  }));

  return NextResponse.json(
    { servers, total: servers.length },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
