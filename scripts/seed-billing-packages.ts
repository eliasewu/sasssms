/**
 * Seed packages and update existing tenant billing defaults.
 * Run: npx tsx scripts/seed-billing-packages.ts
 */
import { db, pool } from "@/db";
import { packages, tenants, platformSettings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  console.log("🌱 Seeding billing packages and updating tenant defaults...\n");

  // 1. Seed packages
  const existing = await db.select({ name: packages.name }).from(packages);
  const existingNames = new Set(existing.map(p => p.name));

  if (!existingNames.has("Starter")) {
    await db.insert(packages).values({
      name: "Starter",
      description: "Pay-as-you-go SMS platform",
      price: "0",
      monthlyFee: "0",
      smsCredits: 0,
      freeSmsPerMonth: false,
      requiresLicense: false,
      isActive: true,
      features: '["Isolated database","50 TPS","HTTP API","Basic routing","5 sub-clients","Email support"]',
    });
    console.log("  ✅ Seeded: Starter package");
  } else {
    console.log("  ⏭️  Skipped: Starter (already exists)");
  }

  if (!existingNames.has("Professional")) {
    await db.insert(packages).values({
      name: "Professional",
      description: "Dedicated server • 200 TPS • 10M SMS/month • No per-SMS charge",
      price: "0",
      monthlyFee: "150",
      smsCredits: 10_000_000,
      freeSmsPerMonth: true,
      requiresLicense: true,
      isActive: true,
      features: '["Everything in Starter","200 TPS","10M monthly SMS included","NO per-SMS charge","SMPP support","Voice OTP","Unlimited clients","Priority support","Campaigns"]',
    });
    console.log("  ✅ Seeded: Professional package");
  } else {
    console.log("  ⏭️  Skipped: Professional (already exists)");
  }

  if (!existingNames.has("Enterprise")) {
    await db.insert(packages).values({
      name: "Enterprise",
      description: "Unlimited volume • All services included",
      price: "0",
      monthlyFee: "399",
      smsCredits: 0,
      freeSmsPerMonth: true,
      requiresLicense: true,
      isActive: true,
      features: '["Everything in Pro","Unlimited TPS","Unlimited volume","All connection types","RCS & OTT","WhatsApp","White-label","24/7 support","SLA guarantee"]',
    });
    console.log("  ✅ Seeded: Enterprise package");
  } else {
    console.log("  ⏭️  Skipped: Enterprise (already exists)");
  }

  // 2. Get platform rate for fallback
  let platformRate = "0.00025";
  try {
    const [setting] = await db.select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, "globalCostPerSms"));
    if (setting) platformRate = setting.value;
  } catch { /* use fallback */ }

  // 3. Update existing tenants with proper billing defaults
  const client = await pool.connect();
  try {
    const result = await client.query(`
      UPDATE tenants
      SET
        package_type = COALESCE(package_type, 'starter'),
        sms_valid_until = COALESCE(sms_valid_until, NOW() + INTERVAL '6 months'),
        cost_per_sms = CASE WHEN cost_per_sms IS NULL OR cost_per_sms::numeric = 0
          THEN $1::numeric
          ELSE cost_per_sms END,
        updated_at = NOW()
      WHERE is_active = true
      RETURNING id, company_name, package_type
    `, [platformRate]);

    console.log(`\n  ✅ Updated ${result.rows.length} active tenants with billing defaults`);
    for (const row of result.rows) {
      console.log(`     • ${row.company_name} → package: ${row.package_type}`);
    }
  } finally {
    client.release();
  }

  console.log("\n🎉 Done! All tenants now have billing packages available.\n");
  process.exit(0);
}

main().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
