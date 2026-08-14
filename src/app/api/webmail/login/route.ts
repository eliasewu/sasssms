import { NextResponse } from "next/server";
import { verifyCredentials, encryptCredentials } from "@/lib/webmail";
import { webmailLoginGuard } from "@/lib/rate-limit";

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

    // Brute-force lockout: 5 consecutive failures → 1 minute block (per account)
    const key = email.toLowerCase();
    const lockedMs = webmailLoginGuard.lockedMs(key);
    if (lockedMs > 0) {
      return NextResponse.json({ error: "Too many login attempts. Try again in 1 minute." }, { status: 429 });
    }

    const valid = await verifyCredentials(email, password);
    if (!valid) {
      webmailLoginGuard.registerFailure(key);
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Clear failed attempts on success
    webmailLoginGuard.reset(key);

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
