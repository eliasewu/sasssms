import { NextResponse } from "next/server";
import { getSuperAdminFromRequest, verifyPassword, hashPassword } from "@/lib/auth";
import { db } from "@/db";
import { superAdmins } from "@/db/schema";
import { eq } from "drizzle-orm";

// POST /api/super/auth/change-password — change own password
export async function POST(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }

    // Fetch current hash
    const [row] = await db
      .select({ passwordHash: superAdmins.passwordHash })
      .from(superAdmins)
      .where(eq(superAdmins.id, admin.adminId));

    if (!row) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    // Verify current password
    const valid = await verifyPassword(currentPassword, row.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    // Update to new password
    const newHash = await hashPassword(newPassword);
    await db
      .update(superAdmins)
      .set({ passwordHash: newHash })
      .where(eq(superAdmins.id, admin.adminId));

    return NextResponse.json({ success: true, message: "Password changed successfully" });
  } catch (error: unknown) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
