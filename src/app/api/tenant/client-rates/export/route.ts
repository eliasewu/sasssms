import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { loadRateGroups, buildRatesXlsx, buildRatesPdf, forwardRatesEmail } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "xlsx";
  const clientId = url.searchParams.get("clientId") ? parseInt(url.searchParams.get("clientId")!) : undefined;

  const groups = await loadRateGroups(tenant.schemaName, "client", clientId);

  if (format === "pdf") {
    const buf = buildRatesPdf(groups, "Client Rates");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="client-rates${clientId ? "-" + clientId : ""}.pdf"`,
      },
    });
  }

  const buf = buildRatesXlsx(groups, "Client Rates");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="client-rates${clientId ? "-" + clientId : ""}.xlsx"`,
    },
  });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const clientId = parseInt(body.clientId);
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const result = await forwardRatesEmail(tenant.schemaName, "client", clientId, "Your Rates");
  if (!result.ok) {
    const error =
      result.reason === "no_rates"
        ? "This client has no rates."
        : result.reason === "no_email"
        ? "This client has no email address."
        : "Failed to send email. Check SMTP settings.";
    return NextResponse.json({ error }, { status: result.reason === "send_failed" ? 500 : 400 });
  }
  return NextResponse.json({ success: true, to: result.to });
}
