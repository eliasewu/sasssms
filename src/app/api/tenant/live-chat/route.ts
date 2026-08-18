import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { liveChatRooms, liveChatMessages } from "@/db/schema";
import { getTenantFromRequest } from "@/lib/auth";
import { findFaqAnswer } from "@/lib/live-chat-faq";
import { eq, asc, desc, and, sql } from "drizzle-orm";

// GET /api/tenant/live-chat — get the tenant's chat room and messages
export async function GET(request: NextRequest) {
  try {
    const tenant = getTenantFromRequest(request);
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = tenant.tenantId;

    // Find existing open room or return null
    const rooms = await db
      .select()
      .from(liveChatRooms)
      .where(eq(liveChatRooms.tenantId, tenantId))
      .orderBy(desc(liveChatRooms.createdAt))
      .limit(10);

    // Get messages for the first open room
    const openRoom = rooms.find(r => r.status === "OPEN");
    let messages: any[] = [];
    if (openRoom) {
      messages = await db
        .select()
        .from(liveChatMessages)
        .where(eq(liveChatMessages.roomId, openRoom.id))
        .orderBy(asc(liveChatMessages.createdAt));

      // Mark super messages as read by tenant
      await db
        .update(liveChatRooms)
        .set({ unreadTenant: 0 })
        .where(eq(liveChatRooms.id, openRoom.id));
    }

    return NextResponse.json({
      rooms,
      activeRoom: openRoom || null,
      messages,
    });
  } catch (err: any) {
    console.error("[live-chat] GET error:", err.message);
    return NextResponse.json({ error: "Failed to load chat" }, { status: 500 });
  }
}

// POST /api/tenant/live-chat — create a chat room or send a message
export async function POST(request: NextRequest) {
  try {
    const tenant = getTenantFromRequest(request);
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = tenant.tenantId;
    const body = await request.json();
    const { action, message, subject } = body;

    if (action === "create") {
      // Check if tenant already has an open room
      const existing = await db
        .select()
        .from(liveChatRooms)
        .where(and(eq(liveChatRooms.tenantId, tenantId), eq(liveChatRooms.status, "OPEN")))
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json({ room: existing[0] });
      }

      const [room] = await db
        .insert(liveChatRooms)
        .values({
          tenantId,
          tenantName: (tenant as any).companyName || tenant.email,
          tenantEmail: tenant.email,
          subject: subject || "Support Chat",
        })
        .returning();

      return NextResponse.json({ room });
    }

    if (action === "send") {
      const { roomId } = body;
      if (!roomId || !message) {
        return NextResponse.json({ error: "roomId and message required" }, { status: 400 });
      }

      const safeMsg = String(message).slice(0, 5000);

      const [msg] = await db
        .insert(liveChatMessages)
        .values({
          roomId,
          senderType: "tenant",
          senderId: tenantId,
          senderName: (tenant as any).companyName || tenant.email,
          message: safeMsg,
        })
        .returning();

      // Update last message time + increment unread for super
      await db.execute(sql`UPDATE live_chat_rooms SET unread_super = unread_super + 1, last_message_at = NOW() WHERE id = ${roomId}`);

      // ── FAQ auto-reply: answer known questions directly from the CSV ──
      let autoReply: { senderName: string; message: string } | null = null;
      const faqAnswer = findFaqAnswer(safeMsg);
      if (faqAnswer) {
        autoReply = { senderName: "Net2APP Assistant", message: faqAnswer };
        await db.insert(liveChatMessages).values({
          roomId,
          senderType: "super",
          senderName: autoReply.senderName,
          message: autoReply.message,
        });
        // Mark the auto-reply as unread for the tenant (it appears as an agent reply)
        await db.execute(sql`UPDATE live_chat_rooms SET unread_tenant = unread_tenant + 1, last_message_at = NOW() WHERE id = ${roomId}`);
      }

      return NextResponse.json({ message: msg, autoReply });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("[live-chat] POST error:", err.message);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
