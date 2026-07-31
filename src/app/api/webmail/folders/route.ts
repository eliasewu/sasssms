import { NextResponse } from "next/server";
import { listFolders, decryptCredentials } from "@/lib/webmail";

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
    const folders = await listFolders(creds.email, creds.password);
    return NextResponse.json({ folders });
  } catch (error: unknown) {
    console.error("Webmail folders error:", error);
    return NextResponse.json({ error: "Failed to list folders" }, { status: 500 });
  }
}
