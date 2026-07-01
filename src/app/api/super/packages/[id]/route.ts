import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db } from "@/db";
import { packages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeInt, safeDecimal, safeText, safeBool } from "@/lib/validation";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const [result] = await db.update(packages).set({
    name: safeText(body.name, 255),
    description: safeText(body.description, 1000, ""),
    price: safeDecimal(body.price, "0"),
    monthlyFee: safeDecimal(body.monthlyFee, "0"),
    smsCredits: safeInt(body.smsCredits, 0),
    freeSmsPerMonth: safeBool(body.freeSmsPerMonth, false),
    requiresLicense: safeBool(body.requiresLicense, false),
    isActive: safeBool(body.isActive, true),
    features: safeText(body.features, 5000, "[]"),
  }).where(eq(packages.id, parseInt(id))).returning();

  return NextResponse.json({ package: result });
}
