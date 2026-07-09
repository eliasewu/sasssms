import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { unpairDevice } from "@/lib/ott-pairing-engine";

/** POST — unpair/disconnect an OTT device */
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

  const success = await unpairDevice(tenant.schemaName, deviceId);

  if (!success) {
    return NextResponse.json({ error: "Unpair failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
