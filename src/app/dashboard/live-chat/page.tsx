"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ChatRoom {
  id: number;
  subject: string;
  status: string;
  lastMessageAt: string;
  unreadTenant: number;
  unreadSuper: number;
}

interface ChatMessage {
  id: number;
  roomId: number;
  senderType: "tenant" | "super";
  senderName: string;
  message: string;
  createdAt: string;
}

const POLL_INTERVAL = 2000; // 2 seconds

export default function TenantLiveChatPage() {
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMsgIdRef = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch chat state
  const fetchChat = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/live-chat");
      if (!res.ok) return;
      const data = await res.json();
      setRoom(data.activeRoom);
      if (data.messages?.length) {
        setMessages(data.messages);
        lastMsgIdRef.current = data.messages[data.messages.length - 1]?.id || 0;
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchChat();
  }, [fetchChat]);

  // Poll for new messages
  useEffect(() => {
    if (!room) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/tenant/live-chat");
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages?.length) {
          const last = data.messages[data.messages.length - 1];
          if (last.id > lastMsgIdRef.current) {
            setMessages(data.messages);
            lastMsgIdRef.current = last.id;
          }
        }
        if (data.activeRoom) setRoom(data.activeRoom);
      } catch {}
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [room]);

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const createChat = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/tenant/live-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", subject: "Support Chat" }),
      });
      const data = await res.json();
      if (data.room) {
        setRoom(data.room);
        fetchChat();
      }
    } catch {} finally {
      setCreating(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !room || sending) return;
    setSending(true);
    const msg = input.trim();
    setInput("");
    try {
      await fetch("/api/tenant/live-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", roomId: room.id, message: msg }),
      });
    } catch {} finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Live Chat</h1>
        <p className="text-sm text-gray-500">Chat with our support team in real-time</p>
      </div>

      {!room ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a Conversation</h3>
            <p className="text-gray-500 mb-6">Need help? Start a live chat and our support team will respond as soon as possible.</p>
            <button
              onClick={createChat}
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50 transition shadow-md"
            >
              {creating ? "Starting..." : "Start Live Chat"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">
                Send a message to start the conversation
              </p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderType === "tenant" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.senderType === "tenant"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-white border border-gray-200 text-gray-900 rounded-bl-md shadow-sm"
                  }`}
                >
                  {msg.senderType === "super" && (
                    <p className="text-xs font-medium text-blue-600 mb-0.5">{msg.senderName}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  <p className={`text-[10px] mt-1 ${msg.senderType === "tenant" ? "text-blue-200" : "text-gray-400"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat status */}
          {room.status === "CLOSED" ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <p className="text-yellow-800 text-sm font-medium">This chat has been closed.</p>
              <button onClick={() => { setRoom(null); setMessages([]); }} className="text-blue-600 text-sm mt-1 hover:underline">
                Start a new chat
              </button>
            </div>
          ) : (
            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={room.status === "CLOSED"}
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
          )}
        </>
      )}
    </div>
  );
}
