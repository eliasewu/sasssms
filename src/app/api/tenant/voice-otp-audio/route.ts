import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "voice");
const ALLOWED_EXTENSIONS = ["mp3", "wav", "ogg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM voice_otp_audio ORDER BY id");
  return NextResponse.json({ audio: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") || "";
  
  let configId: number;
  let language: string;
  let digit: string;
  let fileName: string;
  let fileUrl: string | null = null;
  let audioType = "wav";

  if (contentType.startsWith("multipart/form-data")) {
    const formData = await request.formData();
    configId = parseInt(formData.get("configId") as string);
    language = formData.get("language") as string;
    digit = formData.get("digit") as string;
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Security: file size limit
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB.` }, { status: 413 });
    }

    // Security: extension whitelist
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` }, { status: 400 });
    }

    audioType = ext === "mp3" ? "mp3" : "wav";
    // Add random suffix to prevent filename collisions
    const randSuffix = Math.random().toString(36).slice(2, 6);
    fileName = `voice_${tenant.tenantId}_${configId}_${language}_${digit}_${Date.now()}_${randSuffix}.${ext}`;
    
    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });
    
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, fileName), buffer);
    fileUrl = `/uploads/voice/${fileName}`;
  } else {
    // JSON body (legacy/backwards compat)
    const body = await request.json();
    configId = body.configId;
    language = body.language;
    digit = body.digit;
    fileName = body.fileName || "upload.wav";
    fileUrl = body.fileUrl || null;
    audioType = body.audioType || "wav";
  }

  // Check if already exists
  const existing = await tenantQuery(tenant.schemaName,
    "SELECT id FROM voice_otp_audio WHERE config_id = $1 AND language = $2 AND digit = $3",
    [configId, language, digit]);
  
  if (existing.rows.length > 0) {
    await tenantQuery(tenant.schemaName,
      "UPDATE voice_otp_audio SET file_name = $1, file_url = $2, audio_type = $3 WHERE id = $4",
      [fileName, fileUrl, audioType, existing.rows[0].id]);
    
    return NextResponse.json({ success: true, action: "updated", fileUrl, fileName });
  }

  await tenantQuery(tenant.schemaName,
    "INSERT INTO voice_otp_audio (config_id, language, digit, file_name, file_url, audio_type) VALUES ($1,$2,$3,$4,$5,$6)",
    [configId, language, digit, fileName, fileUrl, audioType]);

  // Update audio count
  const countResult = await tenantQuery(tenant.schemaName,
    "SELECT COUNT(*) as c FROM voice_otp_audio WHERE config_id = $1 AND language = $2",
    [configId, language]);
  
  const configRow = await tenantQuery(tenant.schemaName,
    "SELECT primary_language FROM voice_otp_config WHERE id = $1", [configId]);
  const isPrimary = language === configRow.rows[0]?.primary_language;
  
  if (isPrimary) {
    await tenantQuery(tenant.schemaName,
      "UPDATE voice_otp_config SET primary_audio_count = $1 WHERE id = $2",
      [countResult.rows[0].c, configId]);
  } else {
    await tenantQuery(tenant.schemaName,
      "UPDATE voice_otp_config SET secondary_audio_count = $1 WHERE id = $2",
      [countResult.rows[0].c, configId]);
  }

  return NextResponse.json({ success: true, action: "inserted", fileUrl, fileName }, { status: 201 });
}

export async function DELETE(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const result = await tenantQuery(
    tenant.schemaName,
    "DELETE FROM voice_otp_audio WHERE id = $1 RETURNING config_id, language",
    [parseInt(id)]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }

  // Update audio count for the config
  const { config_id, language } = result.rows[0];
  const countResult = await tenantQuery(tenant.schemaName,
    "SELECT COUNT(*) as c FROM voice_otp_audio WHERE config_id = $1 AND language = $2",
    [config_id, language]);
  
  const configRow = await tenantQuery(tenant.schemaName,
    "SELECT primary_language FROM voice_otp_config WHERE id = $1", [config_id]);
  const isPrimary = language === configRow.rows[0]?.primary_language;
  
  if (isPrimary) {
    await tenantQuery(tenant.schemaName,
      "UPDATE voice_otp_config SET primary_audio_count = $1 WHERE id = $2",
      [countResult.rows[0].c, config_id]);
  } else {
    await tenantQuery(tenant.schemaName,
      "UPDATE voice_otp_config SET secondary_audio_count = $1 WHERE id = $2",
      [countResult.rows[0].c, config_id]);
  }

  return NextResponse.json({ success: true });
}
