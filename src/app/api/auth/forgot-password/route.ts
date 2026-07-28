import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, passwordResetTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { forgotLimiter, getClientIp } from "@/lib/rate-limit";

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// POST /api/auth/forgot-password
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 attempts per IP per 15 min
    const ip = getClientIp(request);
    if (forgotLimiter.check(ip)) {
      // Always return success to avoid email enumeration
      return NextResponse.json({ success: true, message: "If that email exists, a reset link has been sent." });
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ success: true, message: "If that email exists, a reset link has been sent." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Look up tenant
    const [tenant] = await db
      .select({ id: tenants.id, companyName: tenants.companyName, email: tenants.email })
      .from(tenants)
      .where(eq(tenants.email, normalizedEmail))
      .limit(1);

    // Always return the same message — prevent email enumeration
    if (!tenant) {
      return NextResponse.json({ success: true, message: "If that email exists, a reset link has been sent." });
    }

    // Generate token, expires in 1 hour
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Invalidate any previous unused tokens for this email
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(and(eq(passwordResetTokens.email, normalizedEmail), eq(passwordResetTokens.used, false)));

    await db.insert(passwordResetTokens).values({
      email: normalizedEmail,
      token,
      expiresAt,
    });

    // Build reset URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://net2app.com";
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    // Send email
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "mail.net2app.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: parseInt(process.env.SMTP_PORT || "587") === 465,
        auth: {
          user: process.env.SMTP_USER || "noreply@net2app.com",
          pass: process.env.SMTP_PASS || "",
        },
      });

      await transporter.sendMail({
        from: `"Net2APP" <${process.env.SMTP_USER || "noreply@net2app.com"}>`,
        to: normalizedEmail,
        subject: "Reset your Net2APP password",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#2563eb;">Reset Your Password</h2>
          <p>Hi ${tenant.companyName},</p>
          <p>You requested a password reset. Click the button below to create a new password. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Reset Password</a>
          <p style="color:#94a3b8;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
          <hr style="margin:20px 0;border:0;border-top:1px solid #e2e8f0;" />
          <p style="color:#94a3b8;font-size:11px;">Net2APP — SMS Gateway Platform</p>
        </div>`,
      });
    } catch (emailErr) {
      console.error("[forgot-password] Email send failed:", emailErr);
      // Still return success — don't leak whether email sending worked
    }

    return NextResponse.json({ success: true, message: "If that email exists, a reset link has been sent." });
  } catch (err: any) {
    console.error("[forgot-password] Error:", err.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
