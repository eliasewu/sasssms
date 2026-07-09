import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { checkPairingStatus } from "@/lib/ott-pairing-engine";

/** GET — poll current pairing status of an OTT device */
export async function GET(
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

  const result = await checkPairingStatus(tenant.schemaName, deviceId);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    status: result,
  });
}
