import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { initiatePairing, startRealPairing } from "@/lib/ott-pairing-engine";

/** POST — initiate QR code pairing for an OTT device */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deviceId = parseInt(id);

  if (isNaN(deviceId)) {
    return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
  }

  const result = await initiatePairing(tenant.schemaName, deviceId);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Fire-and-forget: start the real baileys/GramJS client to generate a valid QR.
  // The client runs in the background and writes the QR to the DB.
  // The frontend polls pair-status to see the QR when it's ready.
  startRealPairing(tenant.schemaName, deviceId).catch((err) => {
    console.error(`[OTT-API] Background pairing failed for device #${deviceId}:`, err);
  });

  return NextResponse.json({
    success: true,
    pairing: result,
  });
}
