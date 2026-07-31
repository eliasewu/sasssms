import { NextResponse } from "next/server";
import { deleteMessage, decryptCredentials } from "@/lib/webmail";

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
    const { uid, folder } = await request.json();
    if (!uid || !folder) {
      return NextResponse.json({ error: "uid and folder are required" }, { status: 400 });
    }

    const result = await deleteMessage(creds.email, creds.password, parseInt(uid), folder);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Delete failed" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Webmail delete error:", error);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}
