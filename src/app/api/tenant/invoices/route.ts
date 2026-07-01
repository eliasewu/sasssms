import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(
    tenant.schemaName,
    "SELECT i.*, c.name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id = c.id ORDER BY i.id DESC"
  );
  return NextResponse.json({ invoices: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { clientId, supplierId, periodStart, periodEnd, notes, taxRate } = body;

  // Determine created_for info
  const createdForType: string = (body as any).createdForType || (clientId ? "client" : supplierId ? "supplier" : "unknown");
  const createdForId = clientId || supplierId;
  
  // Get entity name
  let createdForName = "Unknown";
  if (clientId) {
    const r = await tenantQuery(tenant.schemaName, "SELECT name FROM clients WHERE id = $1", [clientId]);
    createdForName = r.rows[0]?.name || "Client #" + clientId;
  } else if (supplierId) {
    const r = await tenantQuery(tenant.schemaName, "SELECT name FROM suppliers WHERE id = $1", [supplierId]);
    createdForName = r.rows[0]?.name || "Supplier #" + supplierId;
  }

  // Calculate from messages
  let msgResult;
  if (clientId) {
    msgResult = await tenantQuery(
      tenant.schemaName,
      "SELECT COUNT(*) as msg_count, COALESCE(SUM(CAST(cost AS DECIMAL)), 0) as total_cost FROM messages WHERE client_id = $1 AND created_at >= $2 AND created_at <= $3",
      [clientId, periodStart, periodEnd]
    );
  } else {
    msgResult = await tenantQuery(
      tenant.schemaName,
      "SELECT COUNT(*) as msg_count, COALESCE(SUM(CAST(cost AS DECIMAL)), 0) as total_cost FROM messages WHERE supplier_id = $1 AND created_at >= $2 AND created_at <= $3",
      [supplierId, periodStart, periodEnd]
    );
  }

  const amount = parseFloat(msgResult.rows[0].total_cost) || 0;
  const tax = amount * ((taxRate || 0) / 100);
  const totalAmount = amount + tax;
  const invoiceNumber = "INV-" + Date.now() + "-" + (clientId || supplierId);
  const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO invoices (client_id, invoice_number, amount, tax, total_amount, status, period_start, period_end, due_date, notes, created_by, created_for_type, created_for_id, created_for_name)
     VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [clientId || null, invoiceNumber, amount, tax, totalAmount, periodStart, periodEnd, dueDate.toISOString(), notes || null,
     tenant.email, createdForType, createdForId, createdForName]
  );

  return NextResponse.json({
    invoice: result.rows[0],
    details: { messageCount: parseInt(msgResult.rows[0].msg_count), amount, tax, totalAmount, createdForName },
  }, { status: 201 });
}
