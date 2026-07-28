import { NextResponse } from "next/server";

// Build the Google OAuth consent URL
function getGoogleAuthUrl(mode: "login" | "register"): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "https://net2app.com"}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: mode === "register" ? "select_account" : "select_account",
    state: mode, // "login" or "register" — passed through to callback
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const mode = (url.searchParams.get("mode") || "login") as "login" | "register";
    const authUrl = getGoogleAuthUrl(mode);
    return NextResponse.redirect(authUrl);
  } catch (error: unknown) {
    console.error("Google OAuth init error:", error);
    return NextResponse.json(
      { error: "Google authentication is not configured. Please contact support." },
      { status: 500 }
    );
  }
}
