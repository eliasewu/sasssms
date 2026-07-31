import { NextResponse } from "next/server";
import { fetchFromFolder, fetchMessageFromAnyFolder, decryptCredentials } from "@/lib/webmail";

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

  const url = new URL(request.url);
  const folder = url.searchParams.get("folder") || "INBOX";
  const uid = url.searchParams.get("uid");

  try {
    // If uid is provided, fetch a single full message from that folder
    if (uid) {
      const msg = await fetchMessageFromAnyFolder(creds.email, creds.password, parseInt(uid), folder);
      if (!msg) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }
      return NextResponse.json({ message: msg });
    }

    // Otherwise fetch the folder listing
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const result = await fetchFromFolder(creds.email, creds.password, folder, limit, offset);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Webmail folder error:", error);
    return NextResponse.json({ error: "Failed to fetch folder" }, { status: 500 });
  }
}
