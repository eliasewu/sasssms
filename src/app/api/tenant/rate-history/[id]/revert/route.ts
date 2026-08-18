import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { revertRateHistory } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const result = await revertRateHistory(tenant.schemaName, parseInt(id), tenant.email);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json({ success: true, message: result.message });
}
