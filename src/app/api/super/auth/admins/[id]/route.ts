import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db } from "@/db";
import { superAdmins } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// DELETE /api/super/auth/admins/[id] — deactivate (soft delete) a super admin
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const adminId = parseInt(id, 10);

    if (isNaN(adminId)) {
      return NextResponse.json({ error: "Invalid admin ID" }, { status: 400 });
    }

    // Prevent deleting yourself
    if (adminId === admin.adminId) {
      return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 403 });
    }

    // Check the target admin exists
    const [target] = await db
      .select({ id: superAdmins.id, email: superAdmins.email, isActive: superAdmins.isActive })
      .from(superAdmins)
      .where(eq(superAdmins.id, adminId));

    if (!target) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    if (!target.isActive) {
      return NextResponse.json({ error: "Admin is already deactivated" }, { status: 409 });
    }

    // Prevent removing the last active admin
    const [activeCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(superAdmins)
      .where(eq(superAdmins.isActive, true));

    if (activeCount.count <= 1) {
      return NextResponse.json(
        { error: "Cannot deactivate the last active super admin" },
        { status: 403 }
      );
    }

    // Soft delete — set isActive = false
    await db
      .update(superAdmins)
      .set({ isActive: false })
      .where(eq(superAdmins.id, adminId));

    return NextResponse.json({
      success: true,
      message: `Admin "${target.email}" has been deactivated`,
    });
  } catch (error: unknown) {
    console.error("Delete super admin error:", error);
    return NextResponse.json({ error: "Failed to deactivate admin" }, { status: 500 });
  }
}
