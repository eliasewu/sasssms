import { NextResponse } from "next/server";
import { saveDraft, decryptCredentials } from "@/lib/webmail";

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
    const { to, cc, subject, body, isHtml } = await request.json();
    if (!subject && !body && !to) {
      return NextResponse.json({ error: "At least one field is required to save a draft" }, { status: 400 });
    }

    const result = await saveDraft(
      creds.email,
      creds.password,
      to || "",
      cc || "",
      subject || "(No subject)",
      body || "",
      isHtml || false
    );
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to save draft" }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: "Draft saved" });
  } catch (error: unknown) {
    console.error("Webmail draft save error:", error);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }
}
