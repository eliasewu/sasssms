"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ChatRoom {
  id: number;
  tenantId: number;
  tenantName: string;
  tenantEmail: string;
  subject: string;
  status: string;
  lastMessageAt: string;
  unreadTenant: number;
  unreadSuper: number;
  createdAt: string;
}

interface ChatMessage {
  id: number;
  roomId: number;
  senderType: "tenant" | "super";
  senderName: string;
  message: string;
  createdAt: string;
}

const POLL_INTERVAL = 2000;

export default function SuperLiveChatPage() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMsgIdRef = useRef(Infinity); // Infinity = no messages seen yet; prevents false sound on first load
  const audioCtxRef = useRef<AudioContext | null>(null);
  const notifiedMsgIds = useRef<Set<number>>(new Set()); // Track which messages already triggered a notification

  // Clean up on unmount
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Fire a desktop notification for tenant messages
  const notifyTenantMessage = useCallback((room: ChatRoom, msg: ChatMessage) => {
    try {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      // Don't notify if the tab is already focused — admin is watching
      if (document.visibilityState === "visible") return;
      // Don't notify the same message twice
      if (notifiedMsgIds.current.has(msg.id)) return;
      notifiedMsgIds.current.add(msg.id);

      const n = new Notification(`💬 ${room.tenantName}`, {
        body: msg.message.slice(0, 160),
        icon: "/favicon.ico",
        tag: `live-chat-${room.id}`,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // Notifications not supported — silently ignore
    }
  }, []);

  // Play a short notification ping via Web Audio API (no external files needed)
  const playPing = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      // Browsers suspend AudioContext until user interaction — resume if needed
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;

      // Two-tone "ding-ding" chime
      [880, 1100].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.15);
        gain.gain.setValueAtTime(0, now + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.25);
      });
    } catch {
      // Audio not supported — silently ignore
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch rooms
  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/super/live-chat");
      if (!res.ok) return;
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch {}
  }, []);

  // Initial load
  useEffect(() => {
    fetchRooms().then(() => setLoading(false));
  }, [fetchRooms]);

  // Poll rooms every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  // Load messages when selecting a room
  const selectRoom = async (room: ChatRoom) => {
    setActiveRoom(room);
    notifiedMsgIds.current.clear(); // Reset notification tracking for new room
    try {
      const res = await fetch(`/api/super/live-chat?roomId=${room.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
      if (data.messages?.length) {
        lastMsgIdRef.current = data.messages[data.messages.length - 1]?.id || 0;
      }
    } catch {}
  };

  // Poll active room for new messages
  useEffect(() => {
    if (!activeRoom) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/super/live-chat?roomId=${activeRoom.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages?.length) {
          const last = data.messages[data.messages.length - 1];
          if (last.id > lastMsgIdRef.current) {
            // Check for new tenant messages — play sound + desktop notification
            const newTenantMsgs = data.messages.filter(
              (m: ChatMessage) => m.id > lastMsgIdRef.current && m.senderType === "tenant"
            );
            if (newTenantMsgs.length > 0) {
              playPing();
              // Fire desktop notification for the latest tenant message
              notifyTenantMessage(activeRoom, newTenantMsgs[newTenantMsgs.length - 1]);
            }
            setMessages(data.messages);
            lastMsgIdRef.current = last.id;
          }
        }
      } catch {}
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [activeRoom, playPing]);

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeRoom || sending) return;
    setSending(true);
    const msg = input.trim();
    setInput("");
    try {
      await fetch("/api/super/live-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: activeRoom.id, message: msg }),
      });
    } catch {} finally {
      setSending(false);
    }
  };

  const closeRoom = async () => {
    if (!activeRoom) return;
    await fetch("/api/super/live-chat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: activeRoom.id, action: "close" }),
    });
    setActiveRoom((prev) => prev ? { ...prev, status: "CLOSED" } : null);
    fetchRooms();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const openRooms = rooms.filter((r) => r.status === "OPEN");
  const totalUnread = rooms.reduce((sum, r) => sum + r.unreadSuper, 0);

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Room list sidebar */}
      <div className="w-80 shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">Live Chat</h1>
          <p className="text-xs text-gray-500">
            {openRooms.length} active · {totalUnread} unread
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {rooms.length === 0 ? (
            <p className="text-center text-gray-400 text-sm p-6">No chat rooms yet</p>
          ) : (
            rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => selectRoom(room)}
                className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition ${
                  activeRoom?.id === room.id ? "bg-blue-50 border-l-4 border-l-blue-600" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-gray-900 truncate">{room.tenantName}</span>
                  {room.unreadSuper > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-medium">
                      {room.unreadSuper}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{room.tenantEmail}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    room.status === "OPEN" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {room.status}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(room.lastMessageAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200">
        {!activeRoom ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
              <p className="text-sm">Select a chat from the left</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">{activeRoom.tenantName}</h2>
                <p className="text-xs text-gray-500">{activeRoom.tenantEmail}</p>
              </div>
              {activeRoom.status === "OPEN" && (
                <button
                  onClick={closeRoom}
                  className="text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition"
                >
                  Close Chat
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">No messages yet</p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === "super" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.senderType === "super"
                        ? "bg-blue-600 text-white rounded-br-md"
                        : "bg-white border border-gray-200 text-gray-900 rounded-bl-md shadow-sm"
                    }`}
                  >
                    {msg.senderType === "tenant" && (
                      <p className="text-xs font-medium text-blue-600 mb-0.5">{msg.senderName}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    <p className={`text-[10px] mt-1 ${msg.senderType === "super" ? "text-blue-200" : "text-gray-400"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {activeRoom.status === "OPEN" ? (
              <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-medium disabled:opacity-50 transition"
                >
                  {sending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              </form>
            ) : (
              <div className="p-4 border-t border-gray-200 bg-yellow-50 text-center">
                <p className="text-sm text-yellow-800 font-medium">This chat has been closed</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
