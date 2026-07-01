/**
 * Webmail IMAP Utilities
 * Connects to local Dovecot IMAP server for @net2app.com email accounts.
 */
import Imap from "imap";
import { simpleParser } from "mailparser";
import crypto from "crypto";

const IMAP_HOST = process.env.WEBMAIL_IMAP_HOST || "127.0.0.1";
const IMAP_PORT = parseInt(process.env.WEBMAIL_IMAP_PORT || "143");
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
      const fetch = imap!.seqFetch(`${start}:${end}`, {
        bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID IN-REPLY-TO)", ""],
        struct: true,
      });

      fetch.on("message", (msg) => {
        let header = "";
        msg.on("body", (stream) => {
          stream.on("data", (chunk: Buffer) => {
            header += chunk.toString("utf8");
          });
        });
        msg.on("attributes", (attrs) => {
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
 * Fetch a single full message by UID.
 */
export async function fetchMessage(
  email: string,
  password: string,
  uid: number
): Promise<FullMessage | null> {
  let imap: Imap | null = null;
  try {
    imap = await connectAndAuth(email, password);
    await openInbox(imap);

    const result = await new Promise<FullMessage | null>((resolve, reject) => {
      const fetch = imap!.fetch([uid], {
        bodies: "",
      });

      let resolved = false;

      fetch.on("message", (msg) => {
        let body = "";

        msg.on("body", (stream) => {
          stream.on("data", (chunk: Buffer) => {
            body += chunk.toString("utf8");
          });
        });

        msg.once("attributes", (attrs) => {
          // Parse the full MIME message once body is complete
          msg.once("end", async () => {
            if (resolved) return;
            resolved = true;
            try {
              const parsed = await simpleParser(body);
              resolve({
                uid: attrs.uid,
                from: parsed.from?.text || "",
                to: parsed.to?.text || "",
                cc: parsed.cc?.text || "",
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
                bcc: parsed.bcc?.text || "",
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
