import { NextResponse } from "next/server";
import { verifyCredentials, encryptCredentials } from "@/lib/webmail";

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60000; // 1 minute lockout after 5 failures

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Only allow @net2app.com accounts
    if (!email.toLowerCase().endsWith("@net2app.com")) {
      return NextResponse.json({ error: "Only @net2app.com email accounts are supported" }, { status: 403 });
    }

    // Rate limiting
    const key = email.toLowerCase();
    const now = Date.now();
    const attempt = loginAttempts.get(key);
    if (attempt && attempt.count >= MAX_ATTEMPTS && now - attempt.lastAttempt < LOCKOUT_MS) {
      return NextResponse.json({ error: "Too many login attempts. Try again in 1 minute." }, { status: 429 });
    }

    const valid = await verifyCredentials(email, password);
    if (!valid) {
      // Track failed attempt
      if (!attempt || now - attempt.lastAttempt > LOCKOUT_MS) {
        loginAttempts.set(key, { count: 1, lastAttempt: now });
      } else {
        attempt.count++;
        attempt.lastAttempt = now;
      }
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Clear failed attempts on success
    loginAttempts.delete(key);

    // Encrypt credentials for the session token (AES-256-GCM)
    const token = encryptCredentials(email, password);

    const response = NextResponse.json({
      success: true,
      email,
      token,
    });

    response.cookies.set("webmail_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 2, // 2 hours
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    console.error("Webmail login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
