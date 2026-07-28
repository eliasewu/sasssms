import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, passwordResetTokens } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { forgotLimiter, getClientIp } from "@/lib/rate-limit";

// POST /api/auth/reset-password
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 attempts per IP per minute (defense-in-depth)
    const ip = getClientIp(request);
    if (forgotLimiter.check(ip)) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const body = await request.json();
    const { token, email, newPassword } = body;

    if (!token || !email || !newPassword) {
      return NextResponse.json({ error: "Token, email, and new password are required." }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find a valid, unused, non-expired token
    const [resetEntry] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.email, normalizedEmail),
          eq(passwordResetTokens.used, false)
        )
      )
      .limit(1);

    if (!resetEntry) {
      return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
    }

    if (new Date(resetEntry.expiresAt) < new Date()) {
      // Mark expired token as used
      await db
        .update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetEntry.id));
      return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 });
    }

    // Hash new password and update tenant
    const passwordHash = await hashPassword(newPassword);

    await db
      .update(tenants)
      .set({ passwordHash })
      .where(eq(tenants.email, normalizedEmail));

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, resetEntry.id));

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully. You can now sign in.",
    });
  } catch (err: any) {
    console.error("[reset-password] Error:", err.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
