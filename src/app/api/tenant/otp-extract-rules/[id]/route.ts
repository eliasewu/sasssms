import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

// GET single rule
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await tenantQuery(
    tenant.schemaName,
    `SELECT oer.*, s.name as supplier_name FROM otp_extract_rules oer
     LEFT JOIN suppliers s ON s.id = oer.forward_supplier_id
     WHERE oer.id = $1`, [id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }
  return NextResponse.json({ rule: result.rows[0] });
}

// PUT update rule
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const sets: string[] = [];
  const vals: (string | number | boolean | null)[] = [];
  let idx = 1;

  const fields = ["name","mcc","mnc","regex_pattern","otp_group_index","forward_supplier_id","forward_sender","forward_template","is_active","sort_order"];
  const bodyMap: Record<string, string> = {
    name: "name", mcc: "mcc", mnc: "mnc", regexPattern: "regex_pattern",
    otpGroupIndex: "otp_group_index", forwardSupplierId: "forward_supplier_id",
    forwardSender: "forward_sender", forwardTemplate: "forward_template",
    isActive: "is_active", sortOrder: "sort_order",
  };

  for (const [bodyKey, col] of Object.entries(bodyMap)) {
    if (body[bodyKey] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      vals.push(body[bodyKey]);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  sets.push("updated_at = NOW()");
  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE otp_extract_rules SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    [...vals, id]
  );

  return NextResponse.json({ rule: result.rows[0] });
}

// DELETE rule
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await tenantQuery(tenant.schemaName, "DELETE FROM otp_extract_rules WHERE id = $1", [id]);
  return NextResponse.json({ success: true });
}
