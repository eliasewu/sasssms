import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { liveChatRooms, liveChatMessages } from "@/db/schema";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { eq, asc, desc } from "drizzle-orm";

// GET /api/super/live-chat — get all rooms or messages for a specific room
export async function GET(request: NextRequest) {
  try {
    const admin = getSuperAdminFromRequest(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    if (roomId) {
      // Get messages for a specific room
      const messages = await db
        .select()
        .from(liveChatMessages)
        .where(eq(liveChatMessages.roomId, parseInt(roomId)))
        .orderBy(asc(liveChatMessages.createdAt));

      // Mark tenant messages as read
      await db
        .update(liveChatRooms)
        .set({ unreadSuper: 0 })
        .where(eq(liveChatRooms.id, parseInt(roomId)));

      return NextResponse.json({ messages });
    }

    // List all rooms, active first
    const rooms = await db
      .select()
      .from(liveChatRooms)
      .orderBy(desc(liveChatRooms.lastMessageAt))
      .limit(50);

    return NextResponse.json({ rooms });
  } catch (err: any) {
    console.error("[super-live-chat] GET error:", err.message);
    return NextResponse.json({ error: "Failed to load chats" }, { status: 500 });
  }
}

// POST /api/super/live-chat — send a reply
export async function POST(request: NextRequest) {
  try {
    const admin = getSuperAdminFromRequest(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const { roomId, message } = body;

    if (!roomId || !message) {
      return NextResponse.json({ error: "roomId and message required" }, { status: 400 });
    }

    const safeMsg = String(message).slice(0, 5000);

    const [msg] = await db
      .insert(liveChatMessages)
      .values({
        roomId,
        senderType: "super",
        senderId: admin.id,
        senderName: admin.name || admin.email,
        message: safeMsg,
      })
      .returning();

    // Increment unread_tenant and update last_message_at
    await db.execute(
      `UPDATE live_chat_rooms SET unread_tenant = unread_tenant + 1, last_message_at = NOW() WHERE id = $1`,
      [roomId]
    );

    return NextResponse.json({ message: msg });
  } catch (err: any) {
    console.error("[super-live-chat] POST error:", err.message);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

// PATCH /api/super/live-chat — close a room
export async function PATCH(request: NextRequest) {
  try {
    const admin = getSuperAdminFromRequest(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const { roomId, action } = body;

    if (action === "close" && roomId) {
      await db
        .update(liveChatRooms)
        .set({ status: "CLOSED" })
        .where(eq(liveChatRooms.id, roomId));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[super-live-chat] PATCH error:", err.message);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
