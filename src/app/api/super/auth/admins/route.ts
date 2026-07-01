import { NextResponse } from "next/server";
import { getSuperAdminFromRequest, hashPassword } from "@/lib/auth";
import { db } from "@/db";
import { superAdmins } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/super/auth/admins — list all super admins
export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await db.select({
      id: superAdmins.id,
      email: superAdmins.email,
      name: superAdmins.name,
      isActive: superAdmins.isActive,
      createdAt: superAdmins.createdAt,
    }).from(superAdmins).orderBy(desc(superAdmins.id));

    return NextResponse.json({ admins: result });
  } catch (error: unknown) {
    console.error("List super admins error:", error);
    return NextResponse.json({ error: "Failed to list admins" }, { status: 500 });
  }
}

// POST /api/super/auth/admins — create a new super admin
export async function POST(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Email, password, and name are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existing = await db.select({ id: superAdmins.id })
      .from(superAdmins)
      .where(eq(superAdmins.email, normalizedEmail));

    if (existing.length > 0) {
      return NextResponse.json({ error: "A super admin with this email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const [newAdmin] = await db.insert(superAdmins).values({
      email: normalizedEmail,
      passwordHash,
      name: name.trim(),
      isActive: true,
    }).returning();

    return NextResponse.json({
      success: true,
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        name: newAdmin.name,
        isActive: newAdmin.isActive,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create super admin error:", error);
    return NextResponse.json({ error: "Failed to create admin" }, { status: 500 });
  }
}
