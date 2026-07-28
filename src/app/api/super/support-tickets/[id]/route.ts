import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { pool } from "@/db";
import { saveUploadedFiles, validateUploadLimits } from "@/lib/upload-helpers";
import { notifyTenantTicketReply } from "@/lib/email-service";

async function getAdminName(adminId: number): Promise<string> {
  const r = await pool.query("SELECT name FROM super_admins WHERE id = $1", [adminId]);
  return r.rows[0]?.name || "Admin";
}

// Timeout promise that rejects after ms — used for real connection timeout
function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );
}

// Fetch with true connection timeout using Promise.race
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 3000): Promise<Response> {
  return Promise.race([
    fetch(url, options),
    timeoutPromise(timeoutMs),
  ]) as Promise<Response>;
}

// GET /api/super/support-tickets/[id] — get ticket with all replies + attachments
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const url = new URL(request.url);
  const serverIp = url.searchParams.get("_serverIp");

  // If this is a remote ticket request, proxy to the correct server
  if (serverIp) {
    const authHdr = request.headers.get("authorization");
    const cookie = request.headers.get("cookie") || "";
    const tokenMatch = cookie.match(/super_admin_token=([^;]+)/);
    const bearerToken = authHdr?.replace(/^Bearer\s+/i, "") || (tokenMatch ? tokenMatch[1] : "");
    try {
      const res = await fetchWithTimeout(
        `http://${serverIp}:5556/api/super/support-tickets/${id}`,
        { headers: { Authorization: `Bearer ${bearerToken}` } },
        3000
      );
      if (!res.ok) {
        return NextResponse.json({ error: `Remote server returned ${res.status}` }, { status: res.status });
      }
      const data = await res.json();
      return NextResponse.json(data);
    } catch (e: unknown) {
      return NextResponse.json({ error: `Could not reach server: ${(e as Error).message}` }, { status: 502 });
    }
  }

  const ticket = await pool.query(
    `SELECT t.*, tn.company_name as tenant_name, tn.email as tenant_email
     FROM support_tickets t
     JOIN tenants tn ON t.tenant_id = tn.id
     WHERE t.id = $1`,
    [id]
  );
  if (ticket.rows.length === 0) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const replies = await pool.query(
    "SELECT * FROM support_ticket_replies WHERE ticket_id = $1 ORDER BY created_at ASC",
    [id]
  );

  // Fetch attachments for all replies
  const replyIds = replies.rows.map((r: { id: number }) => r.id);
  let attachments: { id: number; reply_id: number; file_name: string; file_path: string; file_size: number; mime_type: string; created_at: string }[] = [];
  if (replyIds.length > 0) {
    const attResult = await pool.query(
      "SELECT * FROM support_ticket_attachments WHERE reply_id = ANY($1) ORDER BY created_at ASC",
      [replyIds]
    );
    attachments = attResult.rows;
  }

  const repliesWithAttachments = replies.rows.map((r: { id: number }) => ({
    ...r,
    attachments: attachments.filter(a => a.reply_id === r.id).map(a => ({
      id: a.id,
      fileName: a.file_name,
      filePath: a.file_path,
      fileSize: a.file_size,
      mimeType: a.mime_type,
    })),
  }));

  return NextResponse.json({ ticket: ticket.rows[0], replies: repliesWithAttachments });
}

// POST /api/super/support-tickets/[id] — add a reply with optional file attachments (supports cross-server)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const url = new URL(request.url);
  const serverIp = url.searchParams.get("_serverIp");

  // If this is for a remote server, proxy the request as-is (multipart passthrough)
  if (serverIp) {
    const authHdr = request.headers.get("authorization");
    const cookie = request.headers.get("cookie") || "";
    const tokenMatch = cookie.match(/super_admin_token=([^;]+)/);
    const bearerToken = authHdr?.replace(/^Bearer\s+/i, "") || (tokenMatch ? tokenMatch[1] : "");
    try {
      const clonedBody = request.clone();
      const res = await fetchWithTimeout(
        `http://${serverIp}:5556/api/super/support-tickets/${id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            "Content-Type": request.headers.get("content-type") || "application/json",
          },
          body: clonedBody.body,
          // @ts-expect-error duplex is needed for streaming body
          duplex: "half",
        },
        5000
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return NextResponse.json(errData, { status: res.status });
      }
      const data = await res.json();
      return NextResponse.json(data, { status: 201 });
    } catch (e: unknown) {
      return NextResponse.json({ error: `Could not reach server: ${(e as Error).message}` }, { status: 502 });
    }
  }

  let message: string;
  let files: File[] = [];

  // Accept both multipart/form-data (with files) and JSON (text-only)
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    message = (formData.get("message") as string || "").trim();
    files = formData.getAll("files") as File[];
  } else {
    const body = await request.json();
    message = (body.message || "").trim();
  }

  if (!message && files.length === 0) {
    return NextResponse.json({ error: "Message or attachment is required" }, { status: 400 });
  }

  // Verify ticket exists + fetch tenant email in one query
  const ticket = await pool.query(
    `SELECT t.*, tn.company_name as tenant_name, tn.email as tenant_email
     FROM support_tickets t
     JOIN tenants tn ON t.tenant_id = tn.id
     WHERE t.id = $1`,
    [id]
  );
  if (ticket.rows.length === 0) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const ticketRow = ticket.rows[0];
  const adminName = await getAdminName(admin.adminId);

  // Validate upload limits before saving
  const limitError = validateUploadLimits(files);
  if (limitError) {
    return NextResponse.json({ error: limitError }, { status: 413 });
  }

  // Save files to disk in parallel (non-blocking before DB transaction)
  const uploadedFiles = await saveUploadedFiles(files);

  // Wrap reply + attachments in a DB transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const reply = await client.query(
      `INSERT INTO support_ticket_replies (ticket_id, replied_by, replied_by_id, replied_by_name, message)
       VALUES ($1, 'super', $2, $3, $4) RETURNING *`,
      [id, admin.adminId, adminName, message || "(file attachment)"]
    );

    const replyId = reply.rows[0].id;
    for (const f of uploadedFiles) {
      await client.query(
        `INSERT INTO support_ticket_attachments (reply_id, file_name, file_path, file_size, mime_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [replyId, f.fileName, f.filePath, f.fileSize, f.mimeType]
      );
    }

    // Update ticket: set replied_by and bump updated_at
    await client.query(
      `UPDATE support_tickets SET 
         replied_by = 'super', 
         status = CASE WHEN status = 'OPEN' THEN 'IN_PROGRESS' ELSE status END,
         updated_at = NOW() 
       WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");

    // Fire-and-forget email notification (after COMMIT, non-blocking)
    if (ticketRow.tenant_email) {
      notifyTenantTicketReply({
        tenantEmail: ticketRow.tenant_email,
        tenantName: ticketRow.tenant_name || "Valued Customer",
        ticketId: parseInt(id),
        ticketSubject: ticketRow.subject,
        replyMessage: message || "[File attachment]",
        adminName,
      }).catch(err => console.error("Ticket reply email failed:", err));
    }

    return NextResponse.json({
      reply: {
        ...reply.rows[0],
        attachments: uploadedFiles.map(f => ({
          fileName: f.fileName, filePath: f.filePath,
          fileSize: f.fileSize, mimeType: f.mimeType,
        })),
      },
    }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Reply transaction failed:", err);
    return NextResponse.json({ error: "Failed to create reply" }, { status: 500 });
  } finally {
    client.release();
  }
}
