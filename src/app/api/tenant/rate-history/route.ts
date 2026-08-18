import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { getRateHistory } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") as "client" | "supplier" | null;
  const entityId = url.searchParams.get("entityId") ? parseInt(url.searchParams.get("entityId")!) : undefined;

  const history = await getRateHistory(
    tenant.schemaName,
    type === "client" || type === "supplier" ? type : undefined,
    entityId
  );
  return NextResponse.json({ history });
}
