import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db, pool } from "@/db";
import { voiceOtpDefaultAudio, tenants } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "voice-defaults");
const ALLOWED_EXTENSIONS = ["mp3", "wav", "ogg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// GET — list all default audio files
export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.select().from(voiceOtpDefaultAudio).orderBy(voiceOtpDefaultAudio.language, voiceOtpDefaultAudio.digit);
  return NextResponse.json({ audio: result });
}

// POST — upload a default audio file (multipart) or create a record (JSON)
export async function POST(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") || "";

  let language: string;
  let digit: string;
  let fileName: string;
  let fileUrl: string | null = null;
  let audioType = "wav";

  if (contentType.startsWith("multipart/form-data")) {
    const formData = await request.formData();
    language = formData.get("language") as string;
    digit = formData.get("digit") as string;
    const file = formData.get("file") as File | null;

    if (!language || !digit) {
      return NextResponse.json({ error: "language and digit are required" }, { status: 400 });
    }
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB.` }, { status: 413 });
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` }, { status: 400 });
    }

    audioType = ext === "mp3" ? "mp3" : "wav";
    const randSuffix = Math.random().toString(36).slice(2, 6);
    fileName = `default_${language}_${digit}_${Date.now()}_${randSuffix}.${ext}`;

    await mkdir(UPLOAD_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, fileName), buffer);
    fileUrl = `/uploads/voice-defaults/${fileName}`;
  } else {
    const body = await request.json();
    language = body.language;
    digit = body.digit;
    fileName = body.fileName || `default_${language}_${digit}.wav`;
    fileUrl = body.fileUrl || null;
    audioType = body.audioType || "wav";
  }

  // Upsert: check if record for language+digit already exists
  const allRows = await db.select()
    .from(voiceOtpDefaultAudio)
    .where(
      and(
        eq(voiceOtpDefaultAudio.language, language),
        eq(voiceOtpDefaultAudio.digit, digit)
      )
    );

  if (allRows.length > 0) {
    await db.update(voiceOtpDefaultAudio)
      .set({ fileName, fileUrl, audioType })
      .where(eq(voiceOtpDefaultAudio.id, allRows[0].id));
    return NextResponse.json({ success: true, action: "updated", fileUrl, fileName, id: allRows[0].id });
  }

  const [result] = await db.insert(voiceOtpDefaultAudio).values({
    language, digit, fileName, fileUrl, audioType,
  }).returning();

  return NextResponse.json({ success: true, action: "inserted", fileUrl, fileName, id: result.id }, { status: 201 });
}

// DELETE — delete a default audio file
export async function DELETE(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await db.select().from(voiceOtpDefaultAudio).where(eq(voiceOtpDefaultAudio.id, parseInt(id)));
  if (existing.length === 0) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }

  await db.delete(voiceOtpDefaultAudio).where(eq(voiceOtpDefaultAudio.id, parseInt(id)));
  return NextResponse.json({ success: true });
}

// POST /api/super/voice-otp-defaults/seed — seed defaults to all existing tenants
export async function PUT(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (body.action !== "seed-all") {
    return NextResponse.json({ error: "Invalid action. Use 'seed-all'" }, { status: 400 });
  }

  // Fetch all active tenants
  const allTenants = await db.select({ id: tenants.id, schemaName: tenants.schemaName })
    .from(tenants)
    .where(eq(tenants.isActive, true));

  // Get all default audio
  const defaults = await db.select().from(voiceOtpDefaultAudio);

  let seededCount = 0;
  const client = await pool.connect();
  try {
    for (const tenant of allTenants) {
      // Upsert default audio into tenant schema
      for (const def of defaults) {
        // Get the config_id for this language in the tenant schema
        const configResult = await client.query(
          `SELECT id FROM "${tenant.schemaName}".voice_otp_config WHERE primary_language = $1 OR secondary_language = $1 LIMIT 1`,
          [def.language]
        );

        if (configResult.rows.length > 0) {
          const configId = configResult.rows[0].id;
          // Upsert audio file
          await client.query(
            `INSERT INTO "${tenant.schemaName}".voice_otp_audio (config_id, language, digit, file_name, file_url, audio_type)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [configId, def.language, def.digit, def.fileName, def.fileUrl, def.audioType]
          );
        }
      }
      seededCount++;
    }
  } finally {
    client.release();
  }

  return NextResponse.json({
    success: true,
    message: `Seeded defaults into ${seededCount}/${allTenants.length} tenants`,
    seededCount,
    totalTenants: allTenants.length,
  });
}
