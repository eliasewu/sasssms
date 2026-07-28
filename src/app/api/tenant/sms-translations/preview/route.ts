import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { generateSample } from "@/lib/translation-engine";

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    // Saved profile mode
    profileId,
    // Inline rule params (for testing BEFORE saving)
    targetField,
    mode,
    matchPattern,
    replacementFixed,
    mcc,
    mnc,
    // Sample values
    sampleSender,
    sampleDestination,
    sampleContent,
    // Number pipeline steps (alternative to replacementFixed for NUMBER type)
    steps,
  } = body;

  // ── Resolve the profile — either from DB or from inline params ──
  let profile: {
    id: number;
    name: string;
    targetField: string;
    mode: string;
    matchPattern: string;
    replacementFixed: string | null;
    mcc: string | null;
    mnc: string | null;
  };

  if (profileId) {
    // Load saved profile from DB
    const profileResult = await tenantQuery(
      tenant.schemaName,
      "SELECT * FROM translation_profiles WHERE id = $1",
      [profileId]
    );
    if (profileResult.rows.length === 0) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    const p = profileResult.rows[0];
    profile = {
      id: p.id,
      name: p.name,
      targetField: p.target_field,
      mode: p.mode,
      matchPattern: p.match_pattern || ".*",
      replacementFixed: p.replacement_fixed,
      mcc: p.mcc || null,
      mnc: p.mnc || null,
    };
  } else if (targetField) {
    // Inline rule params — build a virtual profile for preview without saving
    // Support number pipeline steps (convert to JSON if provided)
    let effectiveReplacement = replacementFixed;
    if (targetField === "DESTINATION" && steps && Array.isArray(steps)) {
      const nonEmpty = steps.filter((s: any) => s.value?.trim());
      effectiveReplacement = JSON.stringify({ steps: nonEmpty });
    }
    profile = {
      id: 0,
      name: body.name || "Preview",
      targetField,
      mode: mode || "FIXED",
      matchPattern: matchPattern || ".*",
      replacementFixed: effectiveReplacement || null,
      mcc: mcc || null,
      mnc: mnc || null,
    };
  } else {
    return NextResponse.json({
      error: "Provide either profileId (saved profile) or targetField (inline preview)"
    }, { status: 400 });
  }

  // ── Run preview ──
  const sender = sampleSender || "TEST";
  const destination = sampleDestination || "+1234567890";
  const content = sampleContent || "Your code is 123456";

  const sample = await generateSample(
    tenant.schemaName,
    {
      id: profile.id,
      name: profile.name,
      targetField: profile.targetField as "SENDER" | "BODY" | "DESTINATION",
      mode: profile.mode as "FIXED" | "RANDOM",
      matchPattern: profile.matchPattern || ".*",
      replacementFixed: profile.replacementFixed,
      mcc: profile.mcc,
      mnc: profile.mnc,
    },
    sender,
    destination,
    content
  );

  // ── For RANDOM mode, also return pool items from DB (only if saved) ──
  let poolItems: { id: number; replacementValue: string }[] = [];
  if (profile.mode === "RANDOM" && profile.id > 0) {
    const poolResult = await tenantQuery(
      tenant.schemaName,
      "SELECT id, replacement_value FROM translation_pool_items WHERE profile_id = $1 LIMIT 20",
      [profileId]
    );
    poolItems = poolResult.rows.map(r => ({ id: r.id, replacementValue: r.replacement_value }));
  }

  // ── Generate multiple random samples for RANDOM mode ──
  const randomSamples: string[] = [];
  if (profile.mode === "RANDOM" && poolItems.length > 0) {
    const input = profile.targetField === "SENDER" ? sender :
                   profile.targetField === "DESTINATION" ? destination :
                   content;
    for (let i = 0; i < Math.min(5, poolItems.length); i++) {
      const pick = poolItems[Math.floor(Math.random() * poolItems.length)];
      try {
        const regex = new RegExp(profile.matchPattern || ".*", "gm");
        randomSamples.push(input.replace(regex, pick.replacementValue));
      } catch {
        randomSamples.push(pick.replacementValue);
      }
    }
  }

  // ── For NUMBER pipeline, also show step-by-step breakdown ──
  let pipelineBreakdown: { step: string; value: string; intermediate: string }[] | null = null;
  if (profile.targetField === "DESTINATION" && steps && Array.isArray(steps) && steps.some((s: any) => s.value?.trim())) {
    pipelineBreakdown = [];
    let current = destination;
    for (const step of steps) {
      if (!step.value?.trim()) continue;
      let before = current;
      if (step.type === "stripDigits") {
        const n = parseInt(step.value, 10);
        if (!isNaN(n) && n > 0 && n < current.length) current = current.slice(n);
      } else if (step.type === "removePrefix") {
        if (current.startsWith(step.value)) current = current.slice(step.value.length);
      } else if (step.type === "addPrefix") {
        current = step.value + current;
      }
      pipelineBreakdown.push({ step: step.type, value: step.value, intermediate: current });
    }
  }

  return NextResponse.json({
    sample,
    profile: {
      id: profile.id,
      name: profile.name,
      targetField: profile.targetField,
      mode: profile.mode,
      matchPattern: profile.matchPattern,
      replacementFixed: profile.replacementFixed,
      mcc: profile.mcc,
      mnc: profile.mnc,
    },
    poolItems,
    randomSamples,
    pipelineBreakdown,
  });
}
