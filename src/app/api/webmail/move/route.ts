import { NextResponse } from "next/server";
import { moveMessage, decryptCredentials } from "@/lib/webmail";

function getCredentials(request: Request): { email: string; password: string } | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const m = cookie.match(/webmail_token=([^;]+)/);
  if (!m) return null;
  return decryptCredentials(m[1]);
}

export async function POST(request: Request) {
  const creds = getCredentials(request);
  if (!creds) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { uid, fromFolder, toFolder } = await request.json();
    if (!uid || !fromFolder || !toFolder) {
      return NextResponse.json({ error: "uid, fromFolder, and toFolder are required" }, { status: 400 });
    }

    const result = await moveMessage(creds.email, creds.password, parseInt(uid), fromFolder, toFolder);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Move failed" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Webmail move error:", error);
    return NextResponse.json({ error: "Failed to move message" }, { status: 500 });
  }
}
