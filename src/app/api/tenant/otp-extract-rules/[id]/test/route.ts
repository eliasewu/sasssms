import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { autoDetectOtp } from "@/lib/otp-detect";

// POST: test an OTP extract pattern against sample content
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { sampleContent } = body;

  if (!sampleContent) {
    return NextResponse.json({ error: "sampleContent is required" }, { status: 400 });
  }

  // Load the rule
  const ruleResult = await tenantQuery(
    tenant.schemaName,
    "SELECT * FROM otp_extract_rules WHERE id = $1", [id]
  );

  if (ruleResult.rows.length === 0) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const rule = ruleResult.rows[0];

  try {
    let extractedOtp: string | null = null;

    if (rule.auto_detect) {
      extractedOtp = autoDetectOtp(sampleContent);
    } else {
      const regex = new RegExp(rule.regex_pattern, "gm");
      const match = regex.exec(sampleContent);
      if (match && match[rule.otp_group_index]) {
        extractedOtp = match[rule.otp_group_index];
      }
      // Fall back to smart auto-detection when the custom pattern didn't match,
      // so OTP is extracted from any content (e.g. "Your code is (\d+)" vs
      // "Your OTP code is 252525").
      if (!extractedOtp) extractedOtp = autoDetectOtp(sampleContent);
    }

    if (extractedOtp) {
      return NextResponse.json({
        matched: true,
        extractedOtp,
        forwardedContent: (rule.forward_template || "{otp}")
          .replace(/\{otp\}/g, extractedOtp)
          .replace(/\{\{OTP\}\}/g, extractedOtp),
        ruleName: rule.name,
      });
    }

    return NextResponse.json({
      matched: false,
      message: "No OTP found in the sample content",
      pattern: rule.regex_pattern,
    });
  } catch (err) {
    return NextResponse.json({
      error: "Invalid regex pattern",
      details: (err as Error).message,
    }, { status: 400 });
  }
}
