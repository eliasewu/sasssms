import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { pool } from "@/db";
import * as XLSX from "xlsx";

interface ParsedEntry {
  mcc: string;
  mnc: string | null;
  countryCode: string;
  countryName: string;
  networkName: string | null;
  language: string;
}

/** Parse CSV text into entries */
function parseCsv(content: string): ParsedEntry[] {
  const lines = content.split("\n").filter(Boolean);
  const entries: ParsedEntry[] = [];

  // Detect header row and skip it
  const firstLine = lines[0]?.toLowerCase() || "";
  const hasHeader = firstLine.includes("mcc") || firstLine.includes("country_code");
  const startIndex = hasHeader ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted CSV fields properly
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        parts.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    parts.push(current.trim());

    const mcc = parts[0];
    const mnc = parts[1] || "";
    const countryCode = parts[2] || "";
    const countryName = parts[3] || "";
    const networkName = parts[4] || "";
    const language = parts[5] || "English";

    if (mcc && countryName) {
      entries.push({
        mcc,
        mnc: mnc || null,
        countryCode,
        countryName,
        networkName: networkName || null,
        language,
      });
    }
  }

  return entries;
}

/** Parse Excel (.xlsx) buffer into entries */
function parseExcel(buffer: Buffer): ParsedEntry[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

  const entries: ParsedEntry[] = [];

  for (const row of jsonData) {
    const mcc = String(row.mcc || row.MCC || "").trim();
    const countryName = String(row.country_name || row.countryName || row.Country || row.COUNTRY || "").trim();
    const mnc = String(row.mnc || row.MNC || "").trim();
    const countryCode = String(row.country_code || row.countryCode || row["Country Code"] || row["country code"] || "").trim();
    const networkName = String(row.network_name || row.networkName || row.Network || row.NETWORK || "").trim();
    const language = String(row.language || row.Language || "").trim() || "English";

    if (mcc && countryName) {
      entries.push({
        mcc,
        mnc: mnc || null,
        countryCode,
        countryName,
        networkName: networkName || null,
        language,
      });
    }
  }

  return entries;
}

/** POST — upload CSV/Excel file and bulk insert into global MCC/MNC database */
export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  let entries: ParsedEntry[];

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    entries = parseExcel(buffer);
  } else if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
    const content = buffer.toString("utf-8");
    entries = parseCsv(content);
  } else {
    return NextResponse.json({ error: "Unsupported file format. Use .csv, .xlsx, or .xls" }, { status: 400 });
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "No valid entries found in file" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    let inserted = 0;
    let skipped = 0;

    const batchSize = 50;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      for (const entry of batch) {
        // Check duplicate
        const { rows: existing } = await client.query(
          "SELECT id FROM mcc_mnc_database WHERE mcc = $1 AND COALESCE(mnc,'') = $2 AND country_code = $3",
          [entry.mcc, entry.mnc || "", entry.countryCode]
        );

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        await client.query(
          `INSERT INTO mcc_mnc_database (mcc, mnc, country_code, country_name, network_name, language)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [entry.mcc, entry.mnc, entry.countryCode, entry.countryName, entry.networkName, entry.language]
        );
        inserted++;
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      totalEntries: entries.length,
      message: `Uploaded ${inserted} entries (${skipped} skipped) from ${file.name}`,
    });
  } catch (error) {
    console.error("MCC upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
