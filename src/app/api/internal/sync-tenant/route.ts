import { NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { createTenantSchema, seedMccMncRates } from "@/lib/tenant-schema";
import { eq } from "drizzle-orm";

const INTERNAL_SECRET = process.env.INTERNAL_SYNC_SECRET || "net2app-internal-sync-2024";

/**
 * POST /api/internal/sync-tenant
 * Internal endpoint for cross-server tenant replication.
 * Protected by shared INTERNAL_SYNC_SECRET.
 */
export async function POST(request: Request) {
  try {
    // Auth: shared secret in header
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "") || "";
    if (token !== INTERNAL_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { companyName, email, phone, passwordHash, schemaName, smppServerIp, serverLocation, costPerSms, smsLimit } = body;

    if (!companyName || !email || !schemaName || !passwordHash) {
      return NextResponse.json({ error: "companyName, email, schemaName, and passwordHash required" }, { status: 400 });
    }

    // Check if tenant already exists (skip if so)
    const existing = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.email, email.toLowerCase().trim()));
    if (existing.length > 0) {
      return NextResponse.json({ synced: false, reason: "already exists" });
    }

    // Insert tenant record
    const [tenant] = await db.insert(tenants).values({
      companyName,
      email: email.toLowerCase().trim(),
      phone: phone || "",
      passwordHash: passwordHash || "",
      schemaName,
      smppServerIp: smppServerIp || "0.0.0.0",
      smppServerPort: 2775,
      serverLocation: serverLocation || "global",
      costPerSms: costPerSms || "0.00010",
      smsLimit: smsLimit || 100,
      emailVerified: true,
      phoneVerified: true,
    }).returning();

    // Create isolated tenant schema
    await createTenantSchema(schemaName);

    // Seed MCC/MNC rates (fire-and-forget)
    seedMccMncRates(schemaName).catch(e =>
      console.error(`[SyncTenant] MCC/MNC seed failed for ${schemaName}:`, e)
    );

    console.log(`[SyncTenant] Replicated tenant: ${companyName} (${schemaName})`);
    return NextResponse.json({ synced: true, id: tenant.id });
  } catch (error: unknown) {
    console.error("[SyncTenant] Error:", error);
    return NextResponse.json({ error: "Sync failed", details: (error as Error).message }, { status: 500 });
  }
}
