import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tawkChatMessages } from "@/db/schema";
import { tawkLimiter, getClientIp } from "@/lib/rate-limit";

const MAX_MESSAGE_LENGTH = 10000;

// POST /api/public/tawk-chat — receives chat messages from Tawk_API callbacks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      propertyId,
      chatId,
      senderType,
      senderName,
      message,
      messageTimestamp,
      visitorName,
      visitorEmail,
    } = body;

    if (!propertyId || !senderType || !message) {
      return NextResponse.json(
        { error: "propertyId, senderType, and message are required" },
        { status: 400 }
      );
    }

    if (!["visitor", "agent"].includes(senderType)) {
      return NextResponse.json(
        { error: "senderType must be 'visitor' or 'agent'" },
        { status: 400 }
      );
    }

    // Rate limit: 30 messages per minute per IP
    const ip = getClientIp(request);
    if (tawkLimiter.check(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const safeMessage = String(message).slice(0, MAX_MESSAGE_LENGTH);

    const [saved] = await db
      .insert(tawkChatMessages)
      .values({
        propertyId: String(propertyId),
        chatId: chatId ? String(chatId).slice(0, 100) : null,
        senderType,
        senderName: senderName ? String(senderName).slice(0, 255) : null,
        message: safeMessage,
        messageTimestamp: messageTimestamp ? new Date(messageTimestamp) : null,
        visitorName: visitorName ? String(visitorName).slice(0, 255) : null,
        visitorEmail: visitorEmail ? String(visitorEmail).slice(0, 255) : null,
      })
      .returning();

    return NextResponse.json({ success: true, id: saved.id });
  } catch (err: any) {
    console.error("[tawk-chat] Failed to save chat message:", err.message);
    return NextResponse.json(
      { error: "Failed to save message" },
      { status: 500 }
    );
  }
}
