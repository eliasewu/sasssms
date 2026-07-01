import { NextResponse } from "next/server";
import { db } from "@/db";
import { paymentConfig } from "@/db/schema";

export async function GET() {
  try {
    const result = await db.select().from(paymentConfig).limit(100);
    return NextResponse.json({ gateways: result });
  } catch {
    return NextResponse.json({ gateways: [] });
  }
}
