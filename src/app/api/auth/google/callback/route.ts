import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { pool } from "@/db";
import { createToken } from "@/lib/auth";
import crypto from "crypto";

// Build the public-facing base URL for redirects.
// Hardcoded to prevent localhost:5556 leaking when behind nginx.
const APP_BASE_URL = "https://net2app.com";

function getOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "https://net2app.com"}/api/auth/google/callback`;

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    // Google returned an error (user denied consent, etc.)
    if (error) {
      const redirectUrl = new URL("/", APP_BASE_URL);
      redirectUrl.searchParams.set("auth_error", error);
      return NextResponse.redirect(redirectUrl);
    }

    if (!code) {
      return NextResponse.redirect(new URL("/", APP_BASE_URL));
    }

    // Exchange authorization code for tokens
    const oauthClient = getOAuthClient();
    const { tokens } = await oauthClient.getToken(code);

    if (!tokens.id_token) {
      throw new Error("No ID token received from Google");
    }

    // Verify the ID token and extract user info
    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error("Invalid Google token payload");
    }

    const googleId = payload.sub; // unique Google user ID
    const email = payload.email.toLowerCase().trim();
    const name = payload.name || email.split("@")[0];

    // ── Try to find existing tenant by google_id ──
    const { rows: existingByGoogle } = await pool.query(
      "SELECT id, schema_name, company_name, email, is_active FROM tenants WHERE google_id = $1 LIMIT 1",
      [googleId]
    );

    // Google-linked account found → log them in
    if (existingByGoogle.length > 0) {
      const tenant = existingByGoogle[0];
      if (!tenant.is_active) {
        const redirectUrl = new URL("/", APP_BASE_URL);
        redirectUrl.searchParams.set("auth_error", "account_suspended");
        return NextResponse.redirect(redirectUrl);
      }

      const token = createToken({
        tenantId: tenant.id,
        email: tenant.email,
        schemaName: tenant.schema_name,
        companyName: tenant.company_name,
      });

      const response = NextResponse.redirect(new URL("/dashboard", APP_BASE_URL));
      response.cookies.set("tenant_token", token, {
        httpOnly: true, secure: true, sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, path: "/",
      });
      return response;
    }

    // Check by email (user might have registered with email/password before)
    const { rows: existingByEmail } = await pool.query(
      "SELECT id, schema_name, company_name, is_active, google_id FROM tenants WHERE email = $1 LIMIT 1",
      [email]
    );

    if (existingByEmail.length > 0) {
      const tenant = existingByEmail[0];
      if (!tenant.is_active) {
        const redirectUrl = new URL("/", APP_BASE_URL);
        redirectUrl.searchParams.set("auth_error", "account_suspended");
        return NextResponse.redirect(redirectUrl);
      }

      // Link Google ID to existing account
      if (!tenant.google_id) {
        await pool.query("UPDATE tenants SET google_id = $1 WHERE id = $2", [googleId, tenant.id]);
      }

      const token = createToken({
        tenantId: tenant.id,
        email,
        schemaName: tenant.schema_name,
        companyName: tenant.company_name,
      });

      const response = NextResponse.redirect(new URL("/dashboard", APP_BASE_URL));
      response.cookies.set("tenant_token", token, {
        httpOnly: true, secure: true, sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, path: "/",
      });
      return response;
    }

    // ── New Google user — store a session token and redirect to phone collection ──
    // Generate a random session token (64 hex chars, fits in VARCHAR(100))
    const sessionToken = crypto.randomBytes(32).toString("hex");

    // Store the session with 10-minute expiry
    await pool.query(
      `INSERT INTO password_reset_tokens (email, token, expires_at, used)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes', false)`,
      [email, sessionToken]
    );

    // Redirect to phone collection page — pass session token + profile data
    const redirectUrl = new URL("/auth/google/complete", APP_BASE_URL);
    redirectUrl.searchParams.set("state", sessionToken);
    redirectUrl.searchParams.set("email", email);
    redirectUrl.searchParams.set("name", name);
    redirectUrl.searchParams.set("googleId", googleId);
    return NextResponse.redirect(redirectUrl);

  } catch (err: unknown) {
    console.error("Google callback error:", err);
    const redirectUrl = new URL("/", APP_BASE_URL);
    redirectUrl.searchParams.set("auth_error", "google_failed");
    return NextResponse.redirect(redirectUrl);
  }
}
