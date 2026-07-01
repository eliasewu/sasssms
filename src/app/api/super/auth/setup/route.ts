import { NextResponse } from "next/server";
import { db } from "@/db";
import { superAdmins, packages, mccMncDatabase, platformSettings } from "@/db/schema";
import { hashPassword, createToken } from "@/lib/auth";

const ALL_REGIONS = [
  "global", "americas", "middle_east", "africa",
  "oceania", "bangladesh", "india_pakistan", "europe", "russia", "china"
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, setupKey } = body;

    if (setupKey !== "SETUP_SMS_PLATFORM_2024") {
      return NextResponse.json({ error: "Invalid setup key" }, { status: 403 });
    }

    const existing = await db.select().from(superAdmins);
    if (existing.length > 0) {
      return NextResponse.json({ error: "Super admin already exists. Please login." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const [admin] = await db.insert(superAdmins).values({
      email: email.toLowerCase().trim(), passwordHash, name,
    }).returning();

    // Packages: Starter=Free, Professional=$150/month no SMS charge, Enterprise=$400
    await db.insert(packages).values([
      {
        name: "Starter", description: "Pay-as-you-go SMS platform",
        price: "0", monthlyFee: "0", smsCredits: 0, freeSmsPerMonth: false,
        requiresLicense: false,
        features: '["Isolated database","50 TPS","HTTP API","Basic routing","5 sub-clients","Email support"]',
      },
      {
        name: "Professional", description: "Dedicated server • 200 TPS • 10M SMS/month • No per-SMS charge",
        price: "0", monthlyFee: "150", smsCredits: 10000000, freeSmsPerMonth: true,
        requiresLicense: true,
        features: '["Everything in Starter","200 TPS","10M monthly SMS included","NO per-SMS charge","SMPP support","Voice OTP","Unlimited clients","Priority support","Campaigns"]',
      },
      {
        name: "Enterprise", description: "Unlimited volume • All services included",
        price: "0", monthlyFee: "400", smsCredits: 0, freeSmsPerMonth: true,
        requiresLicense: true,
        features: '["Everything in Pro","Unlimited TPS","Unlimited volume","All connection types","RCS & OTT","WhatsApp","White-label","24/7 support","SLA guarantee"]',
      },
    ]);

    // Platform settings
    await db.insert(platformSettings).values([
      { key: "globalCostPerSms", value: "0.00025" },
      { key: "ott_proxy_required", value: "true" },
    ]);

    // Store region list
    await db.insert(platformSettings).values({
      key: "connector_regions",
      value: JSON.stringify(ALL_REGIONS),
    });

    // MCC/MNC data
    const mccData = [
      { mcc: "404", countryCode: "+91", countryName: "India", networkName: "BSNL", language: "Hindi" },
      { mcc: "405", countryCode: "+91", countryName: "India", networkName: "Airtel", language: "Hindi" },
      { mcc: "310", countryCode: "+1", countryName: "United States", networkName: "AT&T", language: "English" },
      { mcc: "311", countryCode: "+1", countryName: "United States", networkName: "Verizon", language: "English" },
      { mcc: "234", countryCode: "+44", countryName: "United Kingdom", networkName: "Vodafone", language: "English" },
      { mcc: "262", countryCode: "+49", countryName: "Germany", networkName: "T-Mobile", language: "German" },
      { mcc: "208", countryCode: "+33", countryName: "France", networkName: "Orange", language: "French" },
      { mcc: "222", countryCode: "+39", countryName: "Italy", networkName: "TIM", language: "Italian" },
      { mcc: "214", countryCode: "+34", countryName: "Spain", networkName: "Movistar", language: "Spanish" },
      { mcc: "420", countryCode: "+966", countryName: "Saudi Arabia", networkName: "STC", language: "Arabic" },
      { mcc: "424", countryCode: "+971", countryName: "UAE", networkName: "Etisalat", language: "Arabic" },
      { mcc: "460", countryCode: "+86", countryName: "China", networkName: "China Mobile", language: "Mandarin" },
      { mcc: "440", countryCode: "+81", countryName: "Japan", networkName: "NTT Docomo", language: "Japanese" },
      { mcc: "450", countryCode: "+82", countryName: "South Korea", networkName: "SKT", language: "Korean" },
      { mcc: "505", countryCode: "+61", countryName: "Australia", networkName: "Telstra", language: "English" },
      { mcc: "724", countryCode: "+55", countryName: "Brazil", networkName: "Vivo", language: "Portuguese" },
      { mcc: "334", countryCode: "+52", countryName: "Mexico", networkName: "Telcel", language: "Spanish" },
      { mcc: "621", countryCode: "+234", countryName: "Nigeria", networkName: "MTN", language: "English" },
      { mcc: "655", countryCode: "+27", countryName: "South Africa", networkName: "Vodacom", language: "Zulu" },
      { mcc: "602", countryCode: "+20", countryName: "Egypt", networkName: "Vodafone", language: "Arabic" },
    ];
    for (const m of mccData) { await db.insert(mccMncDatabase).values(m); }

    const token = createToken({ adminId: admin.id, email: admin.email, isSuper: true });
    const response = NextResponse.json({
      success: true,
      admin: { id: admin.id, email: admin.email, name: admin.name },
      message: "Super admin created. 10 regions ready for API connectors.",
    });
    response.cookies.set("super_admin_token", token, {
      httpOnly: true, secure: false, sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, path: "/",
    });
    return response;
  } catch (error: unknown) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}
