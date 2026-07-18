import { NextResponse } from "next/server";
import { db } from "@/db";
import { platformSettings, packages } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [settings, allPkgs] = await Promise.all([
      db.select().from(platformSettings),
      db.select().from(packages),
    ]);

    const obj: Record<string, string> = {};
    settings.forEach(s => { obj[s.key] = s.value; });

    return NextResponse.json({
      costPerSms: obj.globalCostPerSms || "0.00010",
      smppServerIp: obj.smppServerIp || "0.0.0.0",
      smppServerPort: parseInt(obj.smppServerPort || "2775"),
      promo: {
        active: obj.limited_promo_active === "true",
        title: obj.limited_promo_title || "Limited Time Offer",
        text: obj.limited_promo_text || "First Starter payment of 250,000 → Get +100,000 bonus SMS!",
        badge: obj.limited_promo_badge || "+100,000 Bonus SMS",
      },
      packages: allPkgs.map(p => ({
        id: p.id, name: p.name, description: p.description,
        price: p.price, monthlyFee: p.monthlyFee, smsCredits: p.smsCredits,
        freeSmsPerMonth: p.freeSmsPerMonth,
        features: JSON.parse(p.features || "[]"),
        requiresLicense: p.requiresLicense, isActive: p.isActive,
      })),
    });
  } catch {
    return NextResponse.json({ costPerSms: "0.00010", smppServerIp: "0.0.0.0", smppServerPort: 2775, packages: [] });
  }
}
