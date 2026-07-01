import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.select().from(tenants).orderBy(desc(tenants.id));
  return NextResponse.json({ tenants: result });
}
