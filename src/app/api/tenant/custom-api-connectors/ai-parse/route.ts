import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { parseApiCodeSnippet } from "@/lib/api-connector-parser";

// POST /api/tenant/custom-api-connectors/ai-parse
// Accepts raw API docs/code and returns parsed connector configuration
export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { rawCode } = body;

  if (!rawCode || !rawCode.trim()) {
    return NextResponse.json({ error: "Raw code/documentation is required" }, { status: 400 });
  }

  const result = parseApiCodeSnippet(rawCode.trim());

  return NextResponse.json({
    parsed: result,
    hasSendUrl: !!result.sendUrlTemplate,
    hasDlrUrl: !!result.dlrUrlTemplate,
    confidence: result.sendUrlTemplate ? "high" : "low",
    note: "Review the parsed configuration before saving. Adjust placeholders if needed.",
  });
}
