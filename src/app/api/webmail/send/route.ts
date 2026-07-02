import { NextResponse } from "next/server";
import { sendEmail, decryptCredentials } from "@/lib/webmail";

const MAX_ATTACH_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ATTACH_COUNT = 10;

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
    const contentType = request.headers.get("content-type") || "";

    let to: string;
    let cc: string;
    let subject: string;
    let body: string;
    let isHtml: boolean;
    let attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

    if (contentType.startsWith("multipart/form-data")) {
      const formData = await request.formData();
      to = (formData.get("to") as string) || "";
      cc = (formData.get("cc") as string) || "";
      subject = (formData.get("subject") as string) || "";
      body = (formData.get("body") as string) || "";
      isHtml = formData.get("isHtml") === "true";

      // Process attachments
      const files = formData.getAll("files") as File[];
      if (files.length > MAX_ATTACH_COUNT) {
        return NextResponse.json({ error: `Maximum ${MAX_ATTACH_COUNT} attachments allowed` }, { status: 400 });
      }
      for (const file of files) {
        if (file.size > MAX_ATTACH_SIZE) {
          return NextResponse.json({ error: `File "${file.name}" exceeds 10MB limit` }, { status: 413 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        attachments.push({
          filename: file.name,
          content: buffer,
          contentType: file.type || "application/octet-stream",
        });
      }
    } else {
      const json = await request.json();
      to = json.to || "";
      cc = json.cc || "";
      subject = json.subject || "";
      body = json.body || "";
      isHtml = json.isHtml || false;
    }

    if (!to || !subject || !body) {
      return NextResponse.json({ error: "Missing required fields: to, subject, body" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipients = to.split(",").map((e: string) => e.trim());
    for (const recipient of recipients) {
      if (!emailRegex.test(recipient)) {
        return NextResponse.json({ error: `Invalid recipient email: ${recipient}` }, { status: 400 });
      }
    }

    const result = await sendEmail(
      creds.email,
      creds.password,
      to,
      cc,
      "",
      subject,
      body,
      isHtml,
      attachments
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: "Failed to send email. Please check your connection and try again.",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Email sent to ${to}`,
    });
  } catch (error: unknown) {
    console.error("Webmail send error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
