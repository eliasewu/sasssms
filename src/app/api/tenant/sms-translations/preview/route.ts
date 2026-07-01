import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { generateSample } from "@/lib/translation-engine";

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { profileId, sampleSender, sampleDestination, sampleContent } = body;

  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  // Load profile
  const profileResult = await tenantQuery(
    tenant.schemaName,
    "SELECT * FROM translation_profiles WHERE id = $1",
    [profileId]
  );
  if (profileResult.rows.length === 0) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const profile = profileResult.rows[0];

  // For random mode, also return the available pool items
  let poolItems: { id: number; replacementValue: string }[] = [];
  if (profile.mode === "RANDOM") {
    const poolResult = await tenantQuery(
      tenant.schemaName,
      "SELECT id, replacement_value FROM translation_pool_items WHERE profile_id = $1 LIMIT 20",
      [profileId]
    );
    poolItems = poolResult.rows.map(r => ({ id: r.id, replacementValue: r.replacement_value }));
  }

  const sample = await generateSample(
    tenant.schemaName,
    {
      id: profile.id,
      name: profile.name,
      targetField: profile.target_field,
      mode: profile.mode,
      matchPattern: profile.match_pattern || ".*",
      replacementFixed: profile.replacement_fixed,
    },
    sampleSender || "TEST",
    sampleDestination || "+1234567890",
    sampleContent || "Your code is 123456"
  );

  // Generate multiple random samples for random mode
  const randomSamples: string[] = [];
  if (profile.mode === "RANDOM" && poolItems.length > 0) {
    const input = profile.target_field === "SENDER" ? (sampleSender || "TEST") :
                   profile.target_field === "DESTINATION" ? (sampleDestination || "+1234567890") :
                   (sampleContent || "Your code is 123456");
    for (let i = 0; i < Math.min(5, poolItems.length); i++) {
      const pick = poolItems[Math.floor(Math.random() * poolItems.length)];
      try {
        const regex = new RegExp(profile.match_pattern || ".*", "gm");
        randomSamples.push(input.replace(regex, pick.replacementValue));
      } catch {
        randomSamples.push(pick.replacementValue);
      }
    }
  }

  return NextResponse.json({
    sample,
    profile: {
      id: profile.id,
      name: profile.name,
      targetField: profile.target_field,
      mode: profile.mode,
      matchPattern: profile.match_pattern,
      replacementFixed: profile.replacement_fixed,
    },
    poolItems,
    randomSamples,
  });
}
