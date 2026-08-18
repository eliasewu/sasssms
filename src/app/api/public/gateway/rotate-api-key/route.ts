import { NextResponse } from "next/server";
import {
  authenticateGateway,
  authenticateGatewayByApiKey,
  rotateGatewayApiKey,
} from "@/lib/gateway-rest-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/public/gateway/rotate-api-key
 *
 * Lets a gateway device rotate its long-lived API key in-app, then store the
 * fresh key (so the supplier password is only used as a fallback when the
 * stored key has already been rejected).
 *
 * Auth: accepts the CURRENT apiKey, or the supplier username+password (so a
 * device can always recover even after a server-side rotation invalidated its
 * stored key). On success the old key stops working immediately and the new
 * key is returned.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    // Prefer the current device key; fall back to supplier credentials so a
    // device can always rotate even after a server-side key change.
    let auth = apiKey ? await authenticateGatewayByApiKey(apiKey) : null;
    if (!auth && username && password) {
      auth = await authenticateGateway(username, password);
    }
    if (!auth) {
      return NextResponse.json(
        { error: "Invalid gateway API key or credentials" },
        { status: 401 }
      );
    }

    const newKey = await rotateGatewayApiKey(auth.schemaName, auth.supplierId);
    if (!newKey) {
      return NextResponse.json({ error: "Failed to rotate API key" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      apiKey: newKey,
      supplierId: auth.supplierId,
    });
  } catch (e) {
    console.error("[gateway] rotate-api-key error:", (e as Error).message);
    return NextResponse.json({ error: "Rotation failed" }, { status: 500 });
  }
}