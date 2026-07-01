import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db } from "@/db";
import { packages } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { safeInt, safeDecimal, safeText } from "@/lib/validation";

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.select().from(packages).orderBy(desc(packages.id));
  return NextResponse.json({ packages: result });
}

export async function POST(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const [result] = await db.insert(packages).values({
    name: safeText(body.name, 255),
    description: safeText(body.description, 1000, ""),
    price: safeDecimal(body.price, "0"),
    smsCredits: safeInt(body.smsCredits, 0),
    features: safeText(body.features, 5000, "[]"),
  }).returning();

  return NextResponse.json({ package: result }, { status: 201 });
}
