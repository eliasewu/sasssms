/**
 * Public Server Status — SSE Stream
 * GET /api/public/server-status/stream
 *
 * Streams real-time server health updates via Server-Sent Events.
 * No auth required. IP addresses are REDACTED before streaming.
 * Uses the shared server-health module for TCP checks.
 */

import { checkAllServers, HEALTH_CHECK_INTERVAL_MS, ServerInfo } from "@/lib/server-health";

/** Strip sensitive fields (IP, port) from server objects before public exposure */
function sanitize(servers: ServerInfo[]): ServerInfo[] {
  return servers.map(s => ({ ...s, ipAddress: "", port: 0 }));
}

export async function GET(request: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      // Guard: if client already disconnected, bail immediately
      if (request.signal.aborted) {
        controller.close();
        return;
      }

      let closed = false;
      let eventId = 0;

      // Lightweight SSE emit — only sets closed on fatal/aborted errors
      // Includes id: field for proper EventSource reconnect tracking
      const emit = (event: string, data: any) => {
        if (closed) return;
        try {
          eventId++;
          const payload = JSON.stringify(data);
          controller.enqueue(new TextEncoder().encode(
            `id: ${eventId}\nevent: ${event}\ndata: ${payload}\n\n`
          ));
        } catch {
          // Stream likely closed by client — stop gracefully
          closed = true;
          try { controller.close(); } catch {}
        }
      };

      // Send initial connected event
      emit("connected", { message: "SSE stream established", timestamp: new Date().toISOString() });

      // Run health check immediately on connect
      try {
        const servers = await checkAllServers();
        emit("update", { servers: sanitize(servers), timestamp: new Date().toISOString() });
      } catch (err) {
        console.error("[SSE] Initial health check error:", err);
        emit("error", { message: "Initial health check failed" });
      }

      // Periodic health checks every 30s
      const updateInterval = setInterval(async () => {
        if (closed) return;
        try {
          const servers = await checkAllServers();
          emit("update", { servers: sanitize(servers), timestamp: new Date().toISOString() });
        } catch (err) {
          console.error("[SSE] Health check error:", err);
          emit("error", { message: "Health check failed, retrying next cycle" });
        }
      }, HEALTH_CHECK_INTERVAL_MS);

      // Independent heartbeat every 15s to keep connection alive between updates
      const heartbeatInterval = setInterval(() => {
        if (!closed) {
          // Only emit heartbeat if we sent an update recently (within 40s)
          // to avoid unnecessary chatter
          emit("heartbeat", { timestamp: new Date().toISOString() });
        }
      }, 15_000);

      // Cleanup on client disconnect
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(updateInterval);
        clearInterval(heartbeatInterval);
        try { controller.close(); } catch {}
      };

      // Use request.signal for reliable abort detection (works in Next.js App Router)
      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
