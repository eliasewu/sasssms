import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { loadInvoiceRenderData, buildInvoiceHtml, buildInvoicePdf, buildInvoiceXlsx } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "xlsx";

  let data;
  try {
    data = await loadInvoiceRenderData(tenant.schemaName, parseInt(id));
  } catch {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  const filename = `${data.invoiceNumber}`;

  if (format === "pdf") {
    const buf = buildInvoicePdf(data);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  }
  if (format === "html") {
    const html = buildInvoiceHtml(data);
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const buf = buildInvoiceXlsx(data);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}
