import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import Imap from "imap";
import { simpleParser } from "mailparser";

const EMAIL = process.env.SMTP_USER || "welcome@net2app.com";
const PASSWORD = process.env.SMTP_PASS || "";
const AUTO_REPLY_SUBJECT = "Re: {{SUBJECT}}";
const AUTO_REPLY_BODY =
  "Thank you for your email.\n\n" +
  "We have received your message and will get back to you as soon as possible. " +
  "For urgent inquiries, please contact our support team through the dashboard.\n\n" +
  "Best regards,\nNet2APP Support Team\nwelcome@net2app.com";

/**
 * Connect to local Dovecot IMAP and authenticate as welcome@net2app.com.
 */
function connectImap(): Promise<Imap> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: EMAIL,
      password: PASSWORD,
      host: "127.0.0.1",
      port: 143,
      tls: false,
      authTimeout: 10000,
    });
    imap.once("ready", () => resolve(imap));
    imap.once("error", (err: Error) => reject(err));
    imap.connect();
  });
}

/**
 * Search for unseen messages in the INBOX.
 */
function searchUnseen(imap: Imap): Promise<number[]> {
  return new Promise((resolve, reject) => {
    imap.openBox("INBOX", false, (err, box) => {
      if (err) return reject(err);
      imap.search(["UNSEEN"], (searchErr, results) => {
        if (searchErr) return reject(searchErr);
        resolve(results || []);
      });
    });
  });
}

/**
 * Fetch a message by sequence number.
 */
function fetchMessage(imap: Imap, seq: number): Promise<{ from: string; subject: string; messageId: string; inReplyTo: string; text: string } | null> {
  return new Promise((resolve, reject) => {
    const f = imap.fetch(`${seq}`, { bodies: "" });
    let resolved = false;

    f.on("message", (msg) => {
      let body = "";
      msg.on("body", (stream) => {
        stream.on("data", (chunk: Buffer) => { body += chunk.toString("utf8"); });
      });
      msg.once("end", async () => {
        if (resolved) return;
        resolved = true;
        try {
          const parsed = await simpleParser(body);
          const addrText = (a: any): string =>
            !a ? "" : (Array.isArray(a) ? a[0]?.text : a?.text) || "";
          resolve({
            from: addrText(parsed.from),
            subject: parsed.subject || "(No subject)",
            messageId: parsed.messageId || "",
            inReplyTo: parsed.inReplyTo || "",
            text: parsed.text || "",
          });
        } catch {
          resolve(null);
        }
      });
    });

    f.once("error", (err) => { if (!resolved) { resolved = true; reject(err); } });
    f.once("end", () => { if (!resolved) { resolved = true; resolve(null); } });
  });
}

/**
 * Add the \\Seen flag to a message by sequence number.
 */
function markSeen(imap: Imap, seq: number): Promise<void> {
  return new Promise((resolve, reject) => {
    imap.addFlags(seq, ["\\Seen"], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Send auto-reply via local SMTP.
 */
async function sendAutoReply(from: string, subject: string): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: "127.0.0.1",
      port: 587,
      secure: false,
      auth: { user: EMAIL, pass: PASSWORD },
      tls: { rejectUnauthorized: false },
    });

    await transporter.sendMail({
      from: `"Net2APP" <${EMAIL}>`,
      to: from,
      subject: AUTO_REPLY_SUBJECT.replace("{{SUBJECT}}", subject.startsWith("Re:") ? subject : `Re: ${subject}`),
      text: AUTO_REPLY_BODY,
    });

    return true;
  } catch (err) {
    console.error("[check-emails] Failed to send auto-reply:", err);
    return false;
  }
}

/**
 * GET /api/internal/n8n/check-emails
 *
 * Internal endpoint polled by n8n every 3 minutes.
 * Checks the welcome@net2app.com INBOX for new unseen messages
 * and sends an auto-reply to each one.
 *
 * Auth: localhost-only or shared secret (same as check-activity).
 */
export async function GET(request: Request) {
  try {
    // ── Auth ──
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") || "";
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const host = request.headers.get("host") || "";
    const isLocalhost = !ip || ip === "127.0.0.1" || ip === "::1" || ip === "localhost" ||
      host.startsWith("localhost") || host.startsWith("127.0.0.1");
    if (!isLocalhost && token !== (process.env.INTERNAL_SYNC_SECRET || "net2app-internal-sync-2024")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!PASSWORD) {
      return NextResponse.json({ error: "SMTP_PASS not configured" }, { status: 500 });
    }

    // ── Connect to IMAP ──
    const imap = await connectImap();
    let autoReplied = 0;
    let errors: string[] = [];
    let unseen: number[] = [];

    try {
      // ── Search for unseen messages ──
      unseen = await searchUnseen(imap);
      console.log(`[check-emails] Found ${unseen.length} unseen message(s)`);

      // ── Process each unseen message ──
      for (const seq of unseen) {
        try {
          const msg = await fetchMessage(imap, seq);
          if (!msg || !msg.from) {
            // Mark as seen anyway to avoid re-processing
            await markSeen(imap, seq).catch(() => {});
            continue;
          }

          // Send auto-reply
          const sent = await sendAutoReply(msg.from, msg.subject);
          if (sent) {
            autoReplied++;
            console.log(`[check-emails] Auto-replied to: ${msg.from} — "${msg.subject}"`);
            // Mark as seen only after successful reply to allow retry on failure
            await markSeen(imap, seq).catch(() => {});
          } else {
            errors.push(`Failed to send reply to ${msg.from} — will retry next poll`);
          }
        } catch (itemErr) {
          errors.push(`Error processing seq ${seq}: ${(itemErr as Error).message}`);
        }
      }
    } finally {
      imap.end();
    }

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      email: EMAIL,
      results: {
        totalUnseen: unseen.length,
        autoReplied,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error: unknown) {
    console.error("[check-emails] Error:", error);
    return NextResponse.json(
      { error: "Internal error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
