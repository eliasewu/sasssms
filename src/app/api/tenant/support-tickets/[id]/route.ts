import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { pool } from "@/db";
import { saveUploadedFiles, validateUploadLimits } from "@/lib/upload-helpers";

// GET /api/tenant/support-tickets/[id] — get ticket with all replies + attachments
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const ticket = await pool.query(
    "SELECT * FROM support_tickets WHERE id = $1 AND tenant_id = $2",
    [id, tenant.tenantId]
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

  // Attach files to each reply
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

// POST /api/tenant/support-tickets/[id] — add a reply with optional file attachments
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

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

  // Verify ticket belongs to this tenant
  const ticket = await pool.query(
    "SELECT * FROM support_tickets WHERE id = $1 AND tenant_id = $2",
    [id, tenant.tenantId]
  );
  if (ticket.rows.length === 0) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

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
       VALUES ($1, 'tenant', $2, $3, $4) RETURNING *`,
      [id, tenant.tenantId, tenant.companyName || tenant.email, message || "(file attachment)"]
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
      `UPDATE support_tickets SET replied_by = 'tenant', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");

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
