import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db, pool } from "@/db";
import { voiceOtpDefaultAudio, tenants } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { convertToWav } from "@/lib/audio-convert";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "voice-defaults");
const ALLOWED_EXTENSIONS = ["mp3", "wav", "ogg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// The 11 core OTP slots every language needs: greeting + digits 0-9.
const BULK_DIGITS = ["greeting", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Map an uploaded file's name to its OTP slot (greeting / digit / letter).
 * Accepts: "greeting.wav", "0.mp3", "english_1.wav", "Greeting - 3.ogg",
 * "digit_5.mp3", "a.wav". Returns null for unrecognized names.
 */
function digitFromFileName(name: string): string | null {
  const base = name
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (base === "greeting" || base.endsWith(" greeting")) return "greeting";
  const slots = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
    ..."abcdefghijklmnopqrstuvwxyz".split("")];
  for (const d of slots) {
    if (base === d || base.endsWith(" " + d)) return d;
  }
  return null;
}

// Upsert one default-audio row for (language, digit). Returns the action and id.
async function upsertDefaultAudio(
  language: string,
  digit: string,
  fileName: string,
  fileUrl: string | null,
  audioType: string
): Promise<{ action: "updated" | "inserted"; id: number }> {
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
    return { action: "updated", id: allRows[0].id };
  }
  const [result] = await db.insert(voiceOtpDefaultAudio).values({
    language, digit, fileName, fileUrl, audioType,
  }).returning();
  return { action: "inserted", id: result.id };
}

// GET — list all default audio files
export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.select().from(voiceOtpDefaultAudio).orderBy(voiceOtpDefaultAudio.language, voiceOtpDefaultAudio.digit);
  return NextResponse.json({ audio: result });
}

// POST — upload default audio file(s). Supports:
//  1. Single file (multipart):  language + digit + file
//  2. Bulk (multipart):         language + multiple `file` parts, each file's
//     digit derived from its filename (greeting.wav, 0.wav ... 9.wav)
//  3. Legacy JSON record:       { language, digit, fileName, fileUrl, audioType }
export async function POST(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") || "";

  if (contentType.startsWith("multipart/form-data")) {
    const formData = await request.formData();
    const language = ((formData.get("language") as string) || "").trim();
    if (!language) {
      return NextResponse.json({ error: "language is required" }, { status: 400 });
    }

    const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const singleDigit = (formData.get("digit") as string | null)?.trim() || null;
    const results: { ok: boolean; digit: string; fileName?: string; fileUrl?: string; action?: string; id?: number; error?: string }[] = [];
    const seen = new Set<string>();

    for (const file of files) {
      // Legacy single upload carries the digit in the form; bulk derives it
      // from each file's name.
      const digit = files.length === 1 && singleDigit ? singleDigit : digitFromFileName(file.name);
      if (!digit || seen.has(digit)) continue;
      seen.add(digit);

      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        results.push({ ok: false, digit, error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        results.push({ ok: false, digit, error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
        continue;
      }

      // Auto-convert mp3/ogg/etc to a telephony WAV (8 kHz mono) via ffmpeg.
      const { buffer, ext: finalExt } = await convertToWav(Buffer.from(await file.arrayBuffer()), ext);
      const audioType = finalExt === "wav" ? "wav" : "mp3";
      const randSuffix = Math.random().toString(36).slice(2, 6);
      const fileName = `default_${language}_${digit}_${Date.now()}_${randSuffix}.${finalExt}`;

      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(path.join(UPLOAD_DIR, fileName), buffer);
      const fileUrl = `/uploads/voice-defaults/${fileName}`;
      const { action, id } = await upsertDefaultAudio(language, digit, fileName, fileUrl, audioType);
      results.push({ ok: true, digit, fileName, fileUrl, action, id });
    }

    // Auto-push to all active tenants once after any successful writes
    const uploaded = results.filter(r => r.ok);
    if (uploaded.length > 0) {
      const activeTenants = await db.select({ id: tenants.id, schemaName: tenants.schemaName, companyName: tenants.companyName })
        .from(tenants).where(eq(tenants.isActive, true));
      seedDefaultsToTenants(activeTenants).catch(e => console.error("Auto-seed after upload failed:", e));
    }

    // Single-file upload → keep the legacy response shape
    if (files.length === 1 && uploaded.length === 1) {
      const r = uploaded[0];
      return NextResponse.json({ success: true, action: r.action, fileUrl: r.fileUrl, fileName: r.fileName, id: r.id });
    }

    const errors = results.filter(r => !r.ok).map(r => `"${r.digit}": ${r.error}`);
    const coreUploaded = uploaded.filter(r => BULK_DIGITS.includes(r.digit)).length;
    const extra = uploaded.length - coreUploaded;
    const missing = BULK_DIGITS.filter(d => !seen.has(d));

    return NextResponse.json({
      success: true,
      action: "bulk",
      message: `Bulk upload complete: ${uploaded.length} file(s) saved for ${language}`,
      bulk: {
        total: BULK_DIGITS.length,
        uploaded: coreUploaded,
        extra,
        missing,
        errors,
      },
    });
  }

  // ── JSON body (legacy/backwards compat) ──
  const body = await request.json();
  const language = body.language;
  const digit = body.digit;
  const fileName = body.fileName || `default_${language}_${digit}.wav`;
  const fileUrl = body.fileUrl || null;
  const audioType = body.audioType || "wav";

  const { action, id } = await upsertDefaultAudio(language, digit, fileName, fileUrl, audioType);

  // Auto-push to all active tenants (fire-and-forget)
  const activeTenants = await db.select({ id: tenants.id, schemaName: tenants.schemaName, companyName: tenants.companyName })
    .from(tenants).where(eq(tenants.isActive, true));
  seedDefaultsToTenants(activeTenants).catch(e => console.error("Auto-seed after upload failed:", e));

  return NextResponse.json({ success: true, action, fileUrl, fileName, id }, { status: action === "inserted" ? 201 : 200 });
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
          // All configs where this language is PRIMARY or SECONDARY need the
          // audio — a tenant can have many country configs sharing a language
          // (e.g. UAE/Saudi/Egypt all Arabic-primary), and a call in that
          // language resolves to the country-specific config. Seeding only the
          // first match leaves dead URLs in the rest, which ALSO blocks the
          // engine's builtin-audio fallback (it only falls back when no row
          // exists). Primary-language configs are ordered first, then lowest id.
          const configResult = await client.query(
            `SELECT id FROM "${tenant.schemaName}".voice_otp_config
             WHERE primary_language = $1 OR secondary_language = $1
             ORDER BY (primary_language = $1) DESC, id ASC`,
            [def.language]
          );
          let configIds: number[];
          if (configResult.rows.length > 0) {
            configIds = configResult.rows.map((r: any) => r.id);
          } else {
            // No config at all for this language — create one.
            const newConfig = await client.query(
              `INSERT INTO "${tenant.schemaName}".voice_otp_config (country_group, prefixes, primary_language, secondary_language, bilingual)
               VALUES ($1, $2, $1, 'English', false) RETURNING id`,
              [def.language, def.language]
            );
            configIds = [newConfig.rows[0].id];
          }
          for (const configId of configIds) {
            // Atomic dedup-safe upsert using the unique index
            // voice_otp_audio_uniq(config_id, language, digit). INSERT ... ON
            // CONFLICT DO UPDATE is a single statement, so concurrent seeds
            // (e.g. the auto-seed fired after an upload racing the manual
            // "Push to Tenants") converge instead of throwing "duplicate key
            // value violates unique constraint".
            const existingAudio = await client.query(
              `SELECT file_url FROM "${tenant.schemaName}".voice_otp_audio WHERE config_id = $1 AND language = $2 AND digit = $3`,
              [configId, def.language, def.digit]
            );
            if (existingAudio.rows.length !== 1 || existingAudio.rows[0].file_url !== def.fileUrl) {
              await client.query(
                `INSERT INTO "${tenant.schemaName}".voice_otp_audio (config_id, language, digit, file_name, file_url, audio_type)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (config_id, language, digit)
                 DO UPDATE SET file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, audio_type = EXCLUDED.audio_type`,
                [configId, def.language, def.digit, def.fileName, def.fileUrl, def.audioType]
              );
              tenantGotNew = true;
            }
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

  let message: string;
  if (result.errorCount > 0) {
    message = `Pushed ${defaults.length} audio file(s) to ${result.seededCount}/${result.totalTenants} tenant(s) (${result.errorCount} errors)`;
  } else if (result.seededCount === 0) {
    message = `All ${result.totalTenants} tenant(s) already up to date (${defaults.length} audio files, no changes needed)`;
  } else {
    message = `Pushed ${defaults.length} audio file(s) to ${result.seededCount}/${result.totalTenants} tenant(s)`;
  }

  return NextResponse.json({
    success: true,
    message,
    seededCount: result.seededCount,
    errorCount: result.errorCount,
    totalTenants: result.totalTenants,
    errors: result.errors.length > 0 ? result.errors : undefined,
  });
}
