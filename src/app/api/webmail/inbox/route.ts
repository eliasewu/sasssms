import { NextResponse } from "next/server";
import { fetchInbox, decryptCredentials } from "@/lib/webmail";

function getCredentials(request: Request): { email: string; password: string } | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const m = cookie.match(/webmail_token=([^;]+)/);
  if (!m) return null;
  return decryptCredentials(m[1]);
}

export async function GET(request: Request) {
  const creds = getCredentials(request);
  if (!creds) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const result = await fetchInbox(creds.email, creds.password, limit, offset);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Webmail inbox error:", error);
    return NextResponse.json({ error: "Failed to fetch inbox" }, { status: 500 });
  }
}
