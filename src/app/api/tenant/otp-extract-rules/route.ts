import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

// GET: list OTP extract rules with optional mcc/mnc filter
export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mcc = searchParams.get("mcc");
  const mnc = searchParams.get("mnc");

  let query = `SELECT oer.*, s.name as supplier_name 
               FROM otp_extract_rules oer 
               LEFT JOIN suppliers s ON s.id = oer.forward_supplier_id
               WHERE 1=1`;
  const params: (string | null)[] = [];
  let idx = 1;

  if (mcc) { query += ` AND (oer.mcc = $${idx} OR oer.mcc IS NULL)`; params.push(mcc); idx++; }
  if (mnc) { query += ` AND (oer.mnc = $${idx} OR oer.mnc IS NULL)`; params.push(mnc); idx++; }
  query += ` ORDER BY oer.sort_order ASC, oer.id ASC`;

  const result = await tenantQuery(tenant.schemaName, query, params.length ? params : []);
  return NextResponse.json({ rules: result.rows });
}

// POST: create new OTP extract rule
export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, mcc, mnc, regexPattern, otpGroupIndex, forwardSupplierId, forwardSender, forwardTemplate } = body;

  if (!name || !regexPattern) {
    return NextResponse.json({ error: "name and regexPattern are required" }, { status: 400 });
  }

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO otp_extract_rules (name, mcc, mnc, regex_pattern, otp_group_index, forward_supplier_id, forward_sender, forward_template)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name, mcc || null, mnc || null, regexPattern, otpGroupIndex || 1, forwardSupplierId || null, forwardSender || null, forwardTemplate || "{otp}"]
  );

  return NextResponse.json({ rule: result.rows[0] }, { status: 201 });
}

// PUT: reorder rules
export async function PUT(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { rules } = body; // array of { id, sortOrder }

  if (!Array.isArray(rules)) {
    return NextResponse.json({ error: "rules array required" }, { status: 400 });
  }

  for (const r of rules) {
    await tenantQuery(
      tenant.schemaName,
      "UPDATE otp_extract_rules SET sort_order = $1 WHERE id = $2",
      [r.sortOrder ?? 0, r.id]
    );
  }

  return NextResponse.json({ success: true });
}
