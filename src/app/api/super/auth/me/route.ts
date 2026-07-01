import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db } from "@/db";
import { superAdmins } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [a] = await db.select({
    id: superAdmins.id,
    name: superAdmins.name,
    email: superAdmins.email,
  }).from(superAdmins).where(eq(superAdmins.id, admin.adminId));

  return NextResponse.json({ admin: a });
}
