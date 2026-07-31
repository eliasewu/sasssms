import { NextResponse } from "next/server";
import { fetchMessageFromAnyFolder, decryptCredentials } from "@/lib/webmail";

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
  const uid = parseInt(url.searchParams.get("uid") || "0");

  if (!uid) {
    return NextResponse.json({ error: "Message UID required" }, { status: 400 });
  }

  try {
    const msg = await fetchMessageFromAnyFolder(creds.email, creds.password, uid, "Sent");
    if (!msg) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    return NextResponse.json({ message: msg });
  } catch (error: unknown) {
    console.error("Webmail sent-message error:", error);
    return NextResponse.json({ error: "Failed to fetch message" }, { status: 500 });
  }
}
