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
  // tls: rejectUnauthorized=false allows self-signed certs on localhost (same as email-service.ts)
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: email, pass: password },
    tls: { rejectUnauthorized: false },
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

// ═════════════════════════════════════════════════════════════
//  Folder Management — Drafts, Junk, Trash, Archive support
// ═════════════════════════════════════════════════════════════

export interface FolderInfo {
  name: string;
  displayName: string;
  total: number;
  unseen: number;
  specialUse: string;
}

const FOLDER_DISPLAY_NAMES: Record<string, string> = {
  INBOX: "Inbox",
  Drafts: "Drafts",
  Sent: "Sent",
  Junk: "Junk",
  Trash: "Trash",
  Archive: "Archive",
  "Sent Items": "Sent",
  "Sent Messages": "Sent",
  Spam: "Junk",
  "Junk Mail": "Junk",
  Deleted: "Trash",
  "Deleted Items": "Trash",
};

const FOLDER_ORDER = ["INBOX", "Drafts", "Sent", "Junk", "Trash", "Archive"];

/**
 * List all IMAP folders with message counts.
 */
export async function listFolders(
  email: string,
  password: string
): Promise<FolderInfo[]> {
  let imap: Imap | null = null;
  try {
    imap = await connectAndAuth(email, password);
    const boxes = await new Promise<Record<string, any>>((resolve, reject) => {
      imap!.getBoxes((err: Error | null, boxes?: Record<string, any>) => {
        if (err) reject(err);
        else resolve(boxes || {});
      });
    });

    const folders: FolderInfo[] = [];
    for (const name of Object.keys(boxes)) {
      try {
        const opened = await new Promise<Imap.Box>((resolve, reject) => {
          imap!.openBox(name, true, (err, box) => {
            if (err) reject(err);
            else resolve(box);
          });
        });
        const attribs: string[] = boxes[name]?.attribs || [];
        const specialUse = attribs.find((a) =>
          ["\\Inbox", "\\Drafts", "\\Sent", "\\Junk", "\\Trash", "\\Archive"].includes(a)
        ) || "";
        folders.push({
          name,
          displayName: FOLDER_DISPLAY_NAMES[name] || name,
          total: opened.messages.total,
          unseen: opened.messages.new,
          specialUse,
        });
      } catch {
        // Skip folders we can't open
      }
    }

    // Sort: standard folders first in predefined order, then others alphabetically
    folders.sort((a, b) => {
      const ai = FOLDER_ORDER.indexOf(a.name);
      const bi = FOLDER_ORDER.indexOf(b.name);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    return folders;
  } finally {
    if (imap) imap.end();
  }
}

/**
 * Fetch messages from any folder (generalized version of fetchInbox).
 */
export async function fetchFromFolder(
  email: string,
  password: string,
  folderName: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ messages: InboxMessage[]; total: number }> {
  let imap: Imap | null = null;
  try {
    imap = await connectAndAuth(email, password);
    const box = await new Promise<Imap.Box>((resolve, reject) => {
      imap!.openBox(folderName, false, (err, box) => {
        if (err) reject(err);
        else resolve(box);
      });
    });
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
      // Only request HEADER.FIELDS — the body stream for HEADER.FIELDS
      // returns only the requested headers as a clean RFC 2822 block.
      // Requesting "" (full body) as a second body would mix MIME body
      // content into the same stream, corrupting Imap.parseHeader.
      const fetch = (imap!.seq as any).fetch(`${start}:${end}`, {
        bodies: "HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID IN-REPLY-TO)",
        struct: true,
      });

      fetch.on("message", (msg: Imap.ImapMessage) => {
        let uid: number = 0;
        let flags: string[] = [];
        let size: number = 0;
        let header = "";

        msg.on("attributes", (attrs: Imap.ImapMessageAttributes) => {
          uid = attrs.uid;
          flags = attrs.flags || [];
          size = (attrs as any).size || 0;
        });

        msg.on("body", (stream: NodeJS.ReadableStream) => {
          stream.on("data", (chunk: Buffer) => {
            header += chunk.toString("utf8");
          });
        });

        msg.on("end", () => {
          if (!uid) return; // skip if no uid (shouldn't happen)
          const parsed = Imap.parseHeader(header);
          results.push({
            uid,
            from: parsed.from?.[0] || "",
            to: parsed.to?.[0] || "",
            subject: parsed.subject?.[0] || "(No subject)",
            date: parsed.date?.[0] || "",
            flags,
            size,
            hasAttachments: false,
          });
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
 * Fetch a full message from any folder by UID.
 */
export async function fetchMessageFromAnyFolder(
  email: string,
  password: string,
  uid: number,
  folderName: string
): Promise<FullMessage | null> {
  return fetchMessageFromFolder(email, password, uid, [folderName]);
}

/**
 * Move a message from one folder to another (copy + delete + expunge).
 */
export async function moveMessage(
  email: string,
  password: string,
  uid: number,
  fromFolder: string,
  toFolder: string
): Promise<{ success: boolean; error?: string }> {
  let imap: Imap | null = null;
  try {
    imap = await connectAndAuth(email, password);
    await new Promise<Imap.Box>((resolve, reject) => {
      imap!.openBox(fromFolder, false, (err, box) => {
        if (err) reject(err);
        else resolve(box);
      });
    });

    // Copy to target folder
    await new Promise<void>((resolve, reject) => {
      (imap as any).uid.copy(uid, toFolder, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Mark original as deleted
    await new Promise<void>((resolve, reject) => {
      (imap as any).uid.addFlags(uid, ["\\Deleted"], (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Expunge to permanently remove from source folder
    await new Promise<void>((resolve) => {
      imap!.expunge(() => resolve());
    });

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  } finally {
    if (imap) imap.end();
  }
}

/**
 * Delete a message — move to Trash, or permanently expunge if already in Trash.
 */
export async function deleteMessage(
  email: string,
  password: string,
  uid: number,
  folder: string
): Promise<{ success: boolean; error?: string }> {
  const isTrash = ["Trash", "Deleted", "Deleted Items"].includes(folder);

  if (isTrash) {
    // Permanent delete — add \Deleted and expunge
    let imap: Imap | null = null;
    try {
      imap = await connectAndAuth(email, password);
      await new Promise<Imap.Box>((resolve, reject) => {
        imap!.openBox(folder, false, (err, box) => {
          if (err) reject(err);
          else resolve(box);
        });
      });

      await new Promise<void>((resolve, reject) => {
        (imap as any).uid.addFlags(uid, ["\\Deleted"], (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise<void>((resolve) => {
        imap!.expunge(() => resolve());
      });

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    } finally {
      if (imap) imap.end();
    }
  } else {
    // Move to Trash
    return moveMessage(email, password, uid, folder, "Trash");
  }
}

/**
 * Save a draft to the Drafts folder via IMAP APPEND.
 */
export async function saveDraft(
  email: string,
  password: string,
  to: string,
  cc: string,
  subject: string,
  body: string,
  isHtml: boolean = false
): Promise<{ success: boolean; error?: string }> {
  let imap: Imap | null = null;
  try {
    imap = await connectAndAuth(email, password);
    const raw = buildRawMessage(email, to, cc, subject, body, isHtml);
    await new Promise<void>((resolve, reject) => {
      imap!.append(
        raw,
        { mailbox: "Drafts", flags: ["\\Draft", "\\Seen"] },
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  } finally {
    if (imap) imap.end();
  }
}

/**
 * Set or remove a flag (e.g. \Seen, \Flagged) on a message by UID.
 */
export async function setMessageFlag(
  email: string,
  password: string,
  uid: number,
  folder: string,
  flag: string,
  set: boolean
): Promise<{ success: boolean; error?: string }> {
  let imap: Imap | null = null;
  try {
    imap = await connectAndAuth(email, password);
    await new Promise<Imap.Box>((resolve, reject) => {
      imap!.openBox(folder, false, (err, box) => {
        if (err) reject(err);
        else resolve(box);
      });
    });

    await new Promise<void>((resolve, reject) => {
      const fn = set ? (imap as any).uid.addFlags : (imap as any).uid.delFlags;
      fn.call((imap as any).uid, uid, [flag], (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message };
  } finally {
    if (imap) imap.end();
  }
}
