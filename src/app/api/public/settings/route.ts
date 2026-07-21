import { NextResponse } from "next/server";
import { pool } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      const [settingsRes, pkgsRes] = await Promise.all([
        client.query("SELECT key, value FROM platform_settings"),
        client.query("SELECT id, name, description, price, monthly_fee, sms_credits, free_sms_per_month, features, requires_license, is_active, created_at FROM packages"),
      ]);

      const obj: Record<string, string> = {};
      settingsRes.rows.forEach((s: any) => { obj[s.key] = s.value; });

      return NextResponse.json({
        costPerSms: obj.globalCostPerSms || "0.00010",
        smppServerIp: obj.smppServerIp || "0.0.0.0",
        smppServerPort: parseInt(obj.smppServerPort || "2775"),
        promo: {
          active: obj.limited_promo_active === "true",
          title: obj.limited_promo_title || "Limited Time Offer",
          text: obj.limited_promo_text || "First Starter payment → Get bonus SMS!",
          badge: obj.limited_promo_badge || "+100,000 Bonus SMS",
          bonusSms: parseInt(obj.first_payment_bonus_sms || "100000"),
          minAmount: parseFloat(obj.first_payment_min_amount || "250000"),
          signupBonus: parseInt(obj.signup_bonus_sms || "100"),
        },
        packages: pkgsRes.rows.map((p: any) => ({
          id: p.id, name: p.name, description: p.description,
          price: p.price, monthlyFee: p.monthly_fee, smsCredits: p.sms_credits,
          freeSmsPerMonth: p.free_sms_per_month,
          features: (() => { try { return JSON.parse(p.features || "[]"); } catch { return []; } })(),
          requiresLicense: p.requires_license, isActive: p.is_active,
        })),
        serverLocations: (() => {
          try { return JSON.parse(obj.server_locations || "[]"); } catch { return []; }
        })(),
      });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("public/settings error:", e);
    return NextResponse.json({ costPerSms: "0.00010", smppServerIp: "0.0.0.0", smppServerPort: 2775, packages: [] });
  }
}
