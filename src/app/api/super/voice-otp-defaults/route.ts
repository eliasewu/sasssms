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

    // Auto-push updated audio to all active tenants (fire-and-forget)
    const activeTenants = await db.select({ id: tenants.id, schemaName: tenants.schemaName, companyName: tenants.companyName })
      .from(tenants).where(eq(tenants.isActive, true));
    seedDefaultsToTenants(activeTenants).catch(e => console.error("Auto-seed after upload failed:", e));

    return NextResponse.json({ success: true, action: "updated", fileUrl, fileName, id: allRows[0].id });
  }

  const [result] = await db.insert(voiceOtpDefaultAudio).values({
    language, digit, fileName, fileUrl, audioType,
  }).returning();

  // Auto-push new audio to all active tenants (fire-and-forget)
  const activeTenants = await db.select({ id: tenants.id, schemaName: tenants.schemaName, companyName: tenants.companyName })
    .from(tenants).where(eq(tenants.isActive, true));
  seedDefaultsToTenants(activeTenants).catch(e => console.error("Auto-seed after upload failed:", e));

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

// ── Shared seed helper: pushes all default audio to all (or selected) tenants ──
// Returns { seededCount, errorCount, totalTenants, errors: string[] }
async function seedDefaultsToTenants(targetTenants: { id: number; schemaName: string; companyName: string }[]) {
  const defaults = await db.select().from(voiceOtpDefaultAudio);
  if (defaults.length === 0) return { seededCount: 0, errorCount: 0, totalTenants: targetTenants.length, errors: [] as string[] };

  let seededCount = 0, errorCount = 0;
  const errors: string[] = [];
  const client = await pool.connect();
  try {
    for (const tenant of targetTenants) {
      try {
        let tenantGotNew = false;
        for (const def of defaults) {
          let configResult = await client.query(
            `SELECT id FROM "${tenant.schemaName}".voice_otp_config WHERE primary_language = $1 OR secondary_language = $1 LIMIT 1`,
            [def.language]
          );
          let configId: number;
          if (configResult.rows.length > 0) {
            configId = configResult.rows[0].id;
          } else {
            const newConfig = await client.query(
              `INSERT INTO "${tenant.schemaName}".voice_otp_config (country_group, prefixes, primary_language, secondary_language, bilingual)
               VALUES ($1, $2, $1, 'English', false) RETURNING id`,
              [def.language, def.language]
            );
            configId = newConfig.rows[0].id;
          }
          const existingAudio = await client.query(
            `SELECT id, file_url FROM "${tenant.schemaName}".voice_otp_audio WHERE config_id = $1 AND language = $2 AND digit = $3`,
            [configId, def.language, def.digit]
          );
          if (existingAudio.rows.length > 0) {
            if (existingAudio.rows[0].file_url !== def.fileUrl) {
              await client.query(
                `UPDATE "${tenant.schemaName}".voice_otp_audio SET file_name = $1, file_url = $2, audio_type = $3 WHERE id = $4`,
                [def.fileName, def.fileUrl, def.audioType, existingAudio.rows[0].id]
              );
              tenantGotNew = true;
            }
          } else {
            await client.query(
              `INSERT INTO "${tenant.schemaName}".voice_otp_audio (config_id, language, digit, file_name, file_url, audio_type)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [configId, def.language, def.digit, def.fileName, def.fileUrl, def.audioType]
            );
            tenantGotNew = true;
          }
        }
        if (tenantGotNew) {
          await client.query(
            `UPDATE "${tenant.schemaName}".voice_otp_config c SET
              primary_audio_count = (SELECT COUNT(*) FROM "${tenant.schemaName}".voice_otp_audio a WHERE a.config_id = c.id AND a.language = c.primary_language),
              secondary_audio_count = (SELECT COUNT(*) FROM "${tenant.schemaName}".voice_otp_audio a WHERE a.config_id = c.id AND a.language = c.secondary_language)`
          );
          seededCount++;
        }
      } catch (tenantErr) {
        errorCount++;
        errors.push(`${tenant.companyName}: ${(tenantErr as Error).message}`);
        console.error(`Seed failed for ${tenant.schemaName}:`, tenantErr);
      }
    }
  } finally {
    client.release();
  }
  return { seededCount, errorCount, totalTenants: targetTenants.length, errors };
}

// PUT /api/super/voice-otp-defaults — seed defaults to tenants
// Supports: { action: "seed-all" } or { action: "seed-selected", tenantIds: [1,2,3] }
export async function PUT(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const action = body.action;
  const tenantIds: number[] = body.tenantIds || [];

  if (action !== "seed-all" && action !== "seed-selected") {
    return NextResponse.json({ error: "Invalid action. Use 'seed-all' or 'seed-selected'" }, { status: 400 });
  }

  if (action === "seed-selected" && tenantIds.length === 0) {
    return NextResponse.json({ error: "No tenants selected" }, { status: 400 });
  }

  // Fetch tenants (all active or selected)
  let tenantQuery = db.select({ id: tenants.id, schemaName: tenants.schemaName, companyName: tenants.companyName })
    .from(tenants)
    .where(eq(tenants.isActive, true));
  
  if (action === "seed-selected") {
    // Filter by selected IDs — drizzle doesn't support in-array easily, so fetch all then filter
  }
  
  const allTenants = await tenantQuery;
  const targetTenants = action === "seed-selected"
    ? allTenants.filter(t => tenantIds.includes(t.id))
    : allTenants;

  const result = await seedDefaultsToTenants(targetTenants);
  const defaults = await db.select().from(voiceOtpDefaultAudio);

  return NextResponse.json({
    success: true,
    message: `Pushed ${defaults.length} audio file(s) to ${result.seededCount}/${result.totalTenants} tenant(s)${result.errorCount > 0 ? ` (${result.errorCount} errors)` : ""}`,
    seededCount: result.seededCount,
    errorCount: result.errorCount,
    totalTenants: result.totalTenants,
    errors: result.errors.length > 0 ? result.errors : undefined,
  });
}
