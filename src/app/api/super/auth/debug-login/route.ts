import { NextResponse } from "next/server";
import { db } from "@/db";
import { superAdmins } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email || "").toLowerCase().trim();
    
    // Check DB
    const [admin] = await db.select().from(superAdmins).where(eq(superAdmins.email, email));
    
    return NextResponse.json({
      received: { email, passwordLen: (body.password || "").length },
      dbFound: !!admin,
      dbEmail: admin?.email || null,
      hashLen: admin?.passwordHash?.length || 0,
      hashPrefix: admin?.passwordHash?.substring(0, 10) || null,
      hostname: require("os").hostname(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
