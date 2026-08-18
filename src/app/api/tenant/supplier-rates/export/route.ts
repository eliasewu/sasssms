import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { loadRateGroups, buildRatesXlsx, buildRatesPdf, forwardRatesEmail } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "xlsx";
  const supplierId = url.searchParams.get("supplierId") ? parseInt(url.searchParams.get("supplierId")!) : undefined;

  const groups = await loadRateGroups(tenant.schemaName, "supplier", supplierId);

  if (format === "pdf") {
    const buf = buildRatesPdf(groups, "Supplier Rates");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="supplier-rates${supplierId ? "-" + supplierId : ""}.pdf"`,
      },
    });
  }

  const buf = buildRatesXlsx(groups, "Supplier Rates");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="supplier-rates${supplierId ? "-" + supplierId : ""}.xlsx"`,
    },
  });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const supplierId = parseInt(body.supplierId);
  if (!supplierId) return NextResponse.json({ error: "supplierId required" }, { status: 400 });

  const result = await forwardRatesEmail(tenant.schemaName, "supplier", supplierId, "Your Supplier Rates");
  if (!result.ok) {
    const error =
      result.reason === "no_rates"
        ? "This supplier has no rates."
        : result.reason === "no_email"
        ? "This supplier has no email address."
        : "Failed to send email. Check SMTP settings.";
    return NextResponse.json({ error }, { status: result.reason === "send_failed" ? 500 : 400 });
  }
  return NextResponse.json({ success: true, to: result.to });
}
