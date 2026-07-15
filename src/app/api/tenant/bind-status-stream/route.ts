import { bindEventBus } from "@/lib/bind-event-bus";
import { getTenantFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ tenantId: tenant.tenantId, schemaName: tenant.schemaName })}\n\n`)
      );

      // Subscribe to bind events for this tenant only
      const unsubscribe = bindEventBus.onBindEvent((event) => {
        if (event.tenantId !== tenant.tenantId) return;

        const data = JSON.stringify({
          type: event.type,
          entityId: event.entityId,
          status: event.status,
          systemId: event.systemId,
          timestamp: event.timestamp,
        });

        controller.enqueue(
          encoder.encode(`event: status-change\ndata: ${data}\n\n`)
        );
      });

      // Keep-alive ping every 30 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepAlive);
          unsubscribe();
        }
      }, 30000);

      // Cleanup on disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        unsubscribe();
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
