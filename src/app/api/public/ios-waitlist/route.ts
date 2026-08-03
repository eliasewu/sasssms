/**
 * Public iOS Waitlist Signup
 * POST /api/public/ios-waitlist
 *
 * Accepts email submissions for the iOS app waitlist.
 * Stores in a simple file-based list on each server.
 */

import { NextResponse } from "next/server";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";

const WAITLIST_DIR = "/opt/net2app/data";
const WAITLIST_FILE = "ios-waitlist.txt";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    // Ensure directory exists
    if (!existsSync(WAITLIST_DIR)) {
      mkdirSync(WAITLIST_DIR, { recursive: true });
    }

    const filePath = join(WAITLIST_DIR, WAITLIST_FILE);

    // Check for duplicates
    if (existsSync(filePath)) {
      const existing = readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
      if (existing.some(line => line.split(",")[0] === email)) {
        return NextResponse.json({ ok: true, message: "Already on the waitlist" });
      }
    }

    // Append: email,timestamp,ip
    const entry = `${email},${new Date().toISOString()}\n`;
    appendFileSync(filePath, entry);

    console.log(`[iOS Waitlist] New signup: ${email}`);

    return NextResponse.json({ ok: true, message: "Added to waitlist" });
  } catch (err) {
    console.error("[iOS Waitlist] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
