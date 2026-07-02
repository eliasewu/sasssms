/**
 * Webmail IMAP + SMTP Utilities
 * Connects to local Dovecot IMAP and Postfix SMTP for @net2app.com email accounts.
 */
import Imap from "imap";
import { simpleParser, type AddressObject } from "mailparser";
import nodemailer from "nodemailer";
import crypto from "crypto";

const IMAP_HOST = process.env.WEBMAIL_IMAP_HOST || "127.0.0.1";
const IMAP_PORT = parseInt(process.env.WEBMAIL_IMAP_PORT || "143");
const SMTP_HOST = process.env.WEBMAIL_SMTP_HOST || process.env.SMTP_HOST || "127.0.0.1";
const SMTP_PORT = parseInt(process.env.WEBMAIL_SMTP_PORT || process.env.SMTP_PORT || "587");
const ENCRYPTION_KEY = process.env.WEBMAIL_ENCRYPTION_KEY
  ? Buffer.from(process.env.WEBMAIL_ENCRYPTION_KEY, "hex")
  : (() => { console.warn("[webmail] Using fallback encryption key — set WEBMAIL_ENCRYPTION_KEY env var for production"); return crypto.createHash("sha256").update("net2app-webmail-secret-key").digest(); })();
const IV_LENGTH = 12;

/**
 * Encrypt webmail session credentials using AES-256-GCM.
 */
export function encryptCredentials(email: string, password: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const payload = JSON.stringify({ email, password });
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

/**
 * Decrypt webmail session credentials.
 */
export function decryptCredentials(token: string): { email: string; password: string } | null {
  try {
    const buf = Buffer.from(token, "base64url");
    const iv = buf.subarray(0, IV_LENGTH);
    const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = buf.subarray(IV_LENGTH + 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return null;
  }
}

export interface InboxMessage {
  uid: number;
  from: string;
  to: string;
  subject: string;
  date: string;
  flags: string[];
  size: number;
  preview?: string;
  hasAttachments: boolean;
}

export interface FullMessage extends InboxMessage {
  textBody: string;
  htmlBody: string;
  attachments: Array<{ filename: string; contentType: string; size: number }>;
  cc: string;
  bcc: string;
  inReplyTo: string;
  messageId: string;
}

/**
 * Open an IMAP connection and authenticate.
 */
function connectAndAuth(email: string, password: string): Promise<Imap> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: email,
      password,
      host: IMAP_HOST,
      port: IMAP_PORT,
      tls: false,
      authTimeout: 10000,
    });

    imap.once("ready", () => resolve(imap));
    imap.once("error", (err: Error) => reject(err));
    imap.connect();
  });
}

/**
 * Open inbox on an authenticated IMAP connection.
 */
function openInbox(imap: Imap): Promise<Imap.Box> {
  return new Promise((resolve, reject) => {
    imap.openBox("INBOX", false, (err, box) => {
      if (err) return reject(err);
      resolve(box);
    });
  });
}

/**
 * Send an email via SMTP using the user's credentials.
 * The email is saved to the "Sent" folder via IMAP after sending.
 */
export async function sendEmail(
  email: string,
  password: string,
  to: string,
  cc: string,
  bcc: string,
  subject: string,
  body: string,
  isHtml: boolean = false,
  attachments: Array<{ filename: string; content: Buffer; contentType: string }> = []
): Promise<{ success: boolean; error?: string }> {
  // Create a fresh transporter with the user's credentials
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: email, pass: password },
  });

  try {
    await transporter.sendMail({
      from: email,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      [isHtml ? "html" : "text"]: body,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    // Save to Sent folder via IMAP
    try {
      const imap = await connectAndAuth(email, password);
      await new Promise<void>((resolve, reject) => {
        imap.append(
          buildRawMessage(email, to, cc, subject, body, isHtml),
          { mailbox: "Sent", flags: ["\\Seen"] },
          (err) => {
            imap.end();
            if (err) return reject(err);
            resolve();
          }
        );
      });
    } catch (imapErr) {
      // Non-fatal: email was sent, just couldn't save to Sent
      console.error("[webmail] Failed to save sent message:", imapErr);
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = (err as Error).message || "Send failed";
    console.error("[webmail] Send error:", msg);
    return { success: false, error: msg };
  }
}

/**
 * Build a raw RFC 2822 message for IMAP APPEND to Sent folder.
 */
function buildRawMessage(
  from: string,
  to: string,
  cc: string,
  subject: string,
  body: string,
  isHtml: boolean
): string {
  const date = new Date().toUTCString();
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2, 10)}@net2app.com>`;
  const contentType = isHtml ? 'text/html; charset="UTF-8"' : 'text/plain; charset="UTF-8"';

  let raw = `Date: ${date}\r\n`;
  raw += `From: ${from}\r\n`;
  raw += `To: ${to}\r\n`;
  if (cc) raw += `Cc: ${cc}\r\n`;
  raw += `Subject: ${subject}\r\n`;
  raw += `Message-ID: ${messageId}\r\n`;
  raw += `MIME-Version: 1.0\r\n`;
  raw += `Content-Type: ${contentType}\r\n`;
  raw += `Content-Transfer-Encoding: 7bit\r\n`;
  raw += `\r\n`;
  // Normalize body line endings to CRLF for RFC 2822 compliance
  raw += body.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
  raw += `\r\n`;

  return raw;
}

/**
 * Fetch messages from the Sent folder.
 */
export async function fetchSentFolder(
  email: string,
  password: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ messages: InboxMessage[]; total: number }> {
  let imap: Imap | null = null;
  try {
    imap = await connectAndAuth(email, password);
    // Open Sent folder (try common names)
    const box = await openMailbox(imap, ["Sent", "Sent Items", "Sent Messages"]);
    const total = box.messages.total;

    if (total === 0) {
      return { messages: [], total: 0 };
    }

    const start = Math.max(1, total - offset - limit + 1);
    const end = total - offset;

    if (start > end) {
      return { messages: [], total };
    }

    const messages = await new Promise<InboxMessage[]>((resolve, reject) => {
      const results: InboxMessage[] = [];
      const fetch = (imap!.seq as any).fetch(`${start}:${end}`, {
        bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)", ""],
        struct: true,
      });

      fetch.on("message", (msg: Imap.ImapMessage) => {
        let header = "";
        msg.on("body", (stream: NodeJS.ReadableStream) => {
          stream.on("data", (chunk: Buffer) => {
            header += chunk.toString("utf8");
          });
        });
        msg.on("attributes", (attrs: Imap.ImapMessageAttributes) => {
          results.push({
            uid: attrs.uid,
            from: "", to: "", subject: "", date: "",
            flags: attrs.flags || [],
            size: (attrs as any).size || 0,
            hasAttachments: false,
          });
        });
        msg.on("end", () => {
          const parsed = Imap.parseHeader(header);
          const idx = results.findIndex((r) => r.uid === (msg as any).attributes?.uid);
          if (idx !== -1) {
            results[idx].from = parsed.from?.[0] || "";
            results[idx].to = parsed.to?.[0] || "";
            results[idx].subject = parsed.subject?.[0] || "(No subject)";
            results[idx].date = parsed.date?.[0] || "";
          }
        });
      });

      fetch.once("error", reject);
      fetch.once("end", () => resolve(results.reverse()));
    });

    return { messages, total };
  } finally {
    if (imap) imap.end();
  }
}

/**
 * Open a mailbox by trying multiple folder names sequentially.
 */
async function openMailbox(imap: Imap, folderNames: string[]): Promise<Imap.Box> {
  for (const name of folderNames) {
    try {
      return await new Promise<Imap.Box>((resolve, reject) => {
        imap.openBox(name, false, (err, box) => {
          if (err) reject(err); else resolve(box);
        });
      });
    } catch {
      // Try next folder name
    }
  }
  throw new Error(`Could not open any of: ${folderNames.join(", ")}`);
}

/**
 * Verify email credentials by connecting to IMAP.
 */
export async function verifyCredentials(email: string, password: string): Promise<boolean> {
  let imap: Imap | null = null;
  try {
    imap = await connectAndAuth(email, password);
    return true;
  } catch {
    return false;
  } finally {
    if (imap) imap.end();
  }
}

/**
 * Fetch inbox message summaries (last N messages).
 */
export async function fetchInbox(
  email: string,
  password: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ messages: InboxMessage[]; total: number }> {
  let imap: Imap | null = null;
  try {
    imap = await connectAndAuth(email, password);
    const box = await openInbox(imap);
    const total = box.messages.total;

    if (total === 0) {
      return { messages: [], total: 0 };
    }

    const start = Math.max(1, total - offset - limit + 1);
    const end = total - offset;

    if (start > end) {
      return { messages: [], total };
    }

    const messages = await new Promise<InboxMessage[]>((resolve, reject) => {
      const results: InboxMessage[] = [];
      const fetch = (imap!.seq as any).fetch(`${start}:${end}`, {
        bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID IN-REPLY-TO)", ""],
        struct: true,
      });

      fetch.on("message", (msg: Imap.ImapMessage) => {
        let header = "";
        msg.on("body", (stream: NodeJS.ReadableStream) => {
          stream.on("data", (chunk: Buffer) => {
            header += chunk.toString("utf8");
          });
        });
        msg.on("attributes", (attrs: Imap.ImapMessageAttributes) => {
          results.push({
            uid: attrs.uid,
            from: "",
            to: "",
            subject: "",
            date: "",
            flags: attrs.flags || [],
            size: (attrs as any).size || 0,
            hasAttachments: false,
          });
        });
        msg.on("end", () => {
          // Parse headers
          const parsed = Imap.parseHeader(header);
          const idx = results.findIndex((r) => r.uid === (msg as any).attributes?.uid);
          if (idx !== -1) {
          results[idx].from = parsed.from?.[0] || "";
          results[idx].to = parsed.to?.[0] || "";
          results[idx].subject = parsed.subject?.[0] || "(No subject)";
          results[idx].date = parsed.date?.[0] || "";
          }
        });
      });

      fetch.once("error", reject);
      fetch.once("end", () => resolve(results.reverse()));
    });

    return { messages, total };
  } finally {
    if (imap) imap.end();
  }
}

/**
 * Fetch a single full message by UID (INBOX).
 */
export async function fetchMessage(
  email: string,
  password: string,
  uid: number
): Promise<FullMessage | null> {
  return fetchMessageFromFolder(email, password, uid, ["INBOX"]);
}

/**
 * Fetch a single full message from the Sent folder by UID.
 */
export async function fetchSentMessage(
  email: string,
  password: string,
  uid: number
): Promise<FullMessage | null> {
  return fetchMessageFromFolder(email, password, uid, ["Sent", "Sent Items", "Sent Messages"]);
}

/**
 * Fetch a single full message by UID from a specific folder.
 */
async function fetchMessageFromFolder(
  email: string,
  password: string,
  uid: number,
  folderNames: string[]
): Promise<FullMessage | null> {
  let imap: Imap | null = null;
  try {
    imap = await connectAndAuth(email, password);
    await openMailbox(imap, folderNames);

    const result = await new Promise<FullMessage | null>((resolve, reject) => {
      const fetch = imap!.fetch([uid], {
        bodies: "",
      });

      let resolved = false;

      fetch.on("message", (msg: Imap.ImapMessage) => {
        let body = "";

        msg.on("body", (stream: NodeJS.ReadableStream) => {
          stream.on("data", (chunk: Buffer) => {
            body += chunk.toString("utf8");
          });
        });

        msg.once("attributes", (attrs: Imap.ImapMessageAttributes) => {
          // Parse the full MIME message once body is complete
          msg.once("end", async () => {
            if (resolved) return;
            resolved = true;
            try {
              // Helper to safely extract address text from AddressObject | AddressObject[]
            const addrText = (a: AddressObject | AddressObject[] | undefined): string =>
              !a ? "" : (Array.isArray(a) ? a[0]?.text : a?.text) || "";
            const parsed = await simpleParser(body);
              resolve({
                uid: attrs.uid,
                from: addrText(parsed.from),
                to: addrText(parsed.to),
                cc: addrText(parsed.cc),
                subject: parsed.subject || "(No subject)",
                date: parsed.date?.toISOString() || "",
                flags: attrs.flags || [],
                size: (attrs as any).size || 0,
                textBody: parsed.text || "",
                htmlBody: parsed.html || "",
                hasAttachments: (parsed.attachments || []).length > 0,
                attachments: (parsed.attachments || []).map((a) => ({
                  filename: a.filename || "attachment",
                  contentType: a.contentType,
                  size: a.size,
                })),
                preview: (parsed.text || "").substring(0, 150),
                bcc: addrText(parsed.bcc),
                inReplyTo: parsed.inReplyTo || "",
                messageId: parsed.messageId || "",
              });
            } catch {
              resolve(null);
            }
          });
        });
      });

      fetch.once("error", (err) => { if (!resolved) { resolved = true; reject(err); } });
      fetch.once("end", () => { if (!resolved) { resolved = true; resolve(null); } });
    });

    return result;
  } finally {
    if (imap) imap.end();
  }
}
