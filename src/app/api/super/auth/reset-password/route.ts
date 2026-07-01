import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db } from "@/db";
import { superAdmins, tenants } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";

// Super admin resets ANY tenant's password
export async function POST(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { email, newPassword, type } = body; // type: "tenant" or "super_admin"

    if (!email || !newPassword) {
      return NextResponse.json({ error: "Email and new password required" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = await hashPassword(newPassword);

    if (type === "super_admin") {
      const result = await db.update(superAdmins)
        .set({ passwordHash })
        .where(eq(superAdmins.email, normalizedEmail));
      
      return NextResponse.json({ 
        success: true, 
        message: `Super admin password reset for ${normalizedEmail}`,
      });
    }

    // Reset tenant password
    const result = await db.update(tenants)
      .set({ passwordHash })
      .where(eq(tenants.email, normalizedEmail));

    return NextResponse.json({ 
      success: true, 
      message: `Tenant password reset for ${normalizedEmail}. They can now login.`,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
