import { NextResponse } from "next/server";
import { db } from "@/db";
import { superAdmins } from "@/db/schema";
import { verifyPassword, createToken } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const [admin] = await db.select().from(superAdmins).where(eq(superAdmins.email, email.toLowerCase().trim()));
    if (!admin) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!admin.isActive) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }

    const token = createToken({
      adminId: admin.id,
      email: admin.email,
      isSuper: true,
    });

    const response = NextResponse.json({
      success: true,
      admin: { id: admin.id, name: admin.name, email: admin.email },
      token,
    });

    response.cookies.set("super_admin_token", token, {
      httpOnly: true,
      secure: true, // HTTPS is now enabled via SSL
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days (matches JWT expiry)
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    console.error("Super admin login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
