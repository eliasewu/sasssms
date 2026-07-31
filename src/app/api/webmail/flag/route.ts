import { NextResponse } from "next/server";
import { setMessageFlag, decryptCredentials } from "@/lib/webmail";

function getCredentials(request: Request): { email: string; password: string } | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const m = cookie.match(/webmail_token=([^;]+)/);
  if (!m) return null;
  return decryptCredentials(m[1]);
}

// Only allow standard IMAP system flags — prevents arbitrary flag injection
const ALLOWED_FLAGS = new Set(["\\Seen", "\\Flagged", "\\Answered"]);

export async function POST(request: Request) {
  const creds = getCredentials(request);
  if (!creds) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { uid, folder, flag, set } = await request.json();
    if (!uid || !folder || !flag) {
      return NextResponse.json({ error: "uid, folder, and flag are required" }, { status: 400 });
    }

    if (!ALLOWED_FLAGS.has(flag)) {
      return NextResponse.json({ error: `Flag "${flag}" is not permitted. Allowed: \Seen, \Flagged, \Answered` }, { status: 403 });
    }

    const result = await setMessageFlag(
      creds.email,
      creds.password,
      parseInt(uid),
      folder,
      flag,
      set !== false
    );
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to set flag" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Webmail flag error:", error);
    return NextResponse.json({ error: "Failed to update flag" }, { status: 500 });
  }
}
