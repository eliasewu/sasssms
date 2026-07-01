import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify profile exists
  const profile = await tenantQuery(
    tenant.schemaName,
    "SELECT id, mode FROM translation_profiles WHERE id = $1",
    [id]
  );
  if (profile.rows.length === 0) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  let entries: string[] = [];

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    const text = await file.text();
    entries = text.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
  } else {
    const body = await request.json();
    if (Array.isArray(body.entries)) {
      entries = body.entries.filter(Boolean);
    } else if (typeof body.entries === "string") {
      entries = body.entries.split(/[\r\n]+/).map((s: string) => s.trim()).filter(Boolean);
    }
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "No valid entries found" }, { status: 400 });
  }

  // Check if replacing all entries
  const replaceAll = request.headers.get("x-replace-all") === "true" ||
    new URL(request.url).searchParams.get("replaceAll") === "true";

  if (replaceAll) {
    await tenantQuery(tenant.schemaName, "DELETE FROM translation_pool_items WHERE profile_id = $1", [id]);
  }

  // Batch insert
  const inserted: { id: number; replacementValue: string }[] = [];
  for (const entry of entries) {
    const result = await tenantQuery(
      tenant.schemaName,
      "INSERT INTO translation_pool_items (profile_id, replacement_value) VALUES ($1, $2) RETURNING id, replacement_value",
      [id, entry]
    );
    inserted.push(result.rows[0]);
  }

  return NextResponse.json({
    success: true,
    count: inserted.length,
    entries: inserted,
  }, { status: 201 });
}
