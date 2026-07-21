import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

// PUT: reorder translation profiles
export async function PUT(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { profiles } = body; // array of { id, sortOrder }

  if (!Array.isArray(profiles)) {
    return NextResponse.json({ error: "profiles array required" }, { status: 400 });
  }

  for (const p of profiles) {
    await tenantQuery(
      tenant.schemaName,
      "UPDATE translation_profiles SET sort_order = $1 WHERE id = $2",
      [p.sortOrder, p.id]
    );
  }

  return NextResponse.json({ success: true });
}
