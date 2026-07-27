import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { liveChatRooms, liveChatMessages, liveChatNotes, superAdmins } from "@/db/schema";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { eq, asc, desc } from "drizzle-orm";

// GET /api/super/live-chat — get rooms, messages, notes, or admins list
export async function GET(request: NextRequest) {
  try {
    const admin = getSuperAdminFromRequest(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const list = searchParams.get("list");

    // Return list of active super admins for the transfer dropdown
    if (list === "admins") {
      const admins = await db
        .select({ id: superAdmins.id, name: superAdmins.name, email: superAdmins.email })
        .from(superAdmins)
        .where(eq(superAdmins.isActive, true))
        .orderBy(asc(superAdmins.name));
      return NextResponse.json({ admins });
    }

    if (roomId) {
      const rid = parseInt(roomId);

      // Get messages for a specific room
      const messages = await db
        .select()
        .from(liveChatMessages)
        .where(eq(liveChatMessages.roomId, rid))
        .orderBy(asc(liveChatMessages.createdAt));

      // Get internal notes for this room
      const notes = await db
        .select()
        .from(liveChatNotes)
        .where(eq(liveChatNotes.roomId, rid))
        .orderBy(asc(liveChatNotes.createdAt));

      // Mark tenant messages as read
      await db
        .update(liveChatRooms)
        .set({ unreadSuper: 0 })
        .where(eq(liveChatRooms.id, rid));

      return NextResponse.json({ messages, notes });
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

// POST /api/super/live-chat — send reply OR add internal note
export async function POST(request: NextRequest) {
  try {
    const admin = getSuperAdminFromRequest(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const { roomId, message, action, note } = body;

    // Add internal note
    if (action === "add_note" && roomId && note) {
      const safeNote = String(note).slice(0, 5000);
      const [entry] = await db
        .insert(liveChatNotes)
        .values({
          roomId,
          adminId: admin.id,
          adminName: admin.name || admin.email,
          note: safeNote,
        })
        .returning();
      return NextResponse.json({ note: entry });
    }

    // Send chat message
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
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// PATCH /api/super/live-chat — close room or transfer to another admin
export async function PATCH(request: NextRequest) {
  try {
    const admin = getSuperAdminFromRequest(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const { roomId, action, assignedTo } = body;

    if (action === "close" && roomId) {
      await db
        .update(liveChatRooms)
        .set({ status: "CLOSED" })
        .where(eq(liveChatRooms.id, roomId));
      return NextResponse.json({ success: true });
    }

    if (action === "transfer" && roomId && assignedTo !== undefined) {
      // Fetch the target admin's name for the system message
      const targetId = assignedTo != null ? parseInt(String(assignedTo)) : null;
      let targetName = "Unassigned";
      if (targetId) {
        const [targetAdmin] = await db
          .select({ name: superAdmins.name })
          .from(superAdmins)
          .where(eq(superAdmins.id, targetId))
          .limit(1);
        if (targetAdmin) targetName = targetAdmin.name;
      }

      await db
        .update(liveChatRooms)
        .set({ assignedTo: targetId })
        .where(eq(liveChatRooms.id, roomId));

      // Post a system note about the transfer
      await db.insert(liveChatNotes).values({
        roomId,
        adminId: admin.id,
        adminName: admin.name || admin.email,
        note: `🔄 Transferred chat to ${targetName}`,
      });

      return NextResponse.json({ success: true, assignedTo: targetId });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[super-live-chat] PATCH error:", err.message);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
