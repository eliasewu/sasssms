import { NextResponse } from "next/server";
import { trackLogout } from "@/lib/db-helpers";
import crypto from "crypto";

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie");
  let tokenHash = "";
  
  if (cookie) {
    const tokenMatch = cookie.match(/tenant_token=([^;]+)/);
    if (tokenMatch) {
      tokenHash = crypto.createHash("sha256").update(tokenMatch[1]).digest("hex");
      await trackLogout(tokenHash).catch(() => {});
    }
  }

  const response = NextResponse.json({ success: true, message: "Logged out" });
  
  // Clear tenant cookie properly
  response.cookies.set("tenant_token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
