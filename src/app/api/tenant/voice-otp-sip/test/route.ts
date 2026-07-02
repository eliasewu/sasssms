import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import net from "net";

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { host, port } = body;

  if (!host) {
    return NextResponse.json({ error: "Host is required" }, { status: 400 });
  }

  const sipPort = parseInt(port) || 5060;

  try {
    // 1. TCP connectivity test
    const tcpResult = await new Promise<{ reachable: boolean; latency: number }>((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();
      socket.setTimeout(5000);

      socket.on("connect", () => {
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ reachable: true, latency });
      });

      socket.on("error", () => {
        socket.destroy();
        resolve({ reachable: false, latency: Date.now() - start });
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve({ reachable: false, latency: Date.now() - start });
      });

      socket.connect(sipPort, host);
    });

    if (!tcpResult.reachable) {
      return NextResponse.json({
        success: false,
        host,
        port: sipPort,
        error: `Cannot connect to ${host}:${sipPort}. Check that the host is reachable and the port is open.`,
        details: tcpResult,
      });
    }

    // 2. Attempt a lightweight SIP OPTIONS exchange
    let sipResponse: string | null = null;
    let sipSuccess = false;
    try {
      sipResponse = await new Promise<string>((resolve, reject) => {
        const socket = new net.Socket();
        const timeout = setTimeout(() => {
          socket.destroy();
          reject(new Error("SIP OPTIONS timeout"));
        }, 3000);

        const callId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const optionsRequest = [
          `OPTIONS sip:${host}:${sipPort} SIP/2.0`,
          "Via: SIP/2.0/UDP 127.0.0.1:5060;branch=z9hG4bK-test",
          `Call-ID: ${callId}`,
          "From: <sip:test@127.0.0.1>;tag=test",
          "To: <sip:test@127.0.0.1>",
          "CSeq: 1 OPTIONS",
          "Contact: <sip:test@127.0.0.1>",
          "Max-Forwards: 70",
          "Content-Length: 0",
          "",
          "",
        ].join("\r\n");

        let data = "";
        socket.connect(sipPort, host, () => {
          socket.write(optionsRequest);
        });

        socket.on("data", (chunk: Buffer) => {
          data += chunk.toString();
          if (data.includes("\r\n\r\n")) {
            clearTimeout(timeout);
            socket.destroy();
            resolve(data);
          }
        });

        socket.on("error", (err: Error) => {
          clearTimeout(timeout);
          socket.destroy();
          reject(err);
        });

        socket.on("timeout", () => {
          clearTimeout(timeout);
          socket.destroy();
          reject(new Error("SIP OPTIONS timeout"));
        });
      });

      sipSuccess = sipResponse.includes("SIP/2.0 200") || sipResponse.includes("SIP/2.0 100");
    } catch {
      // SIP OPTIONS exchange failed — host is still TCP-reachable
      sipSuccess = false;
    }

    return NextResponse.json({
      success: true,
      host,
      port: sipPort,
      reachable: true,
      latency: tcpResult.latency,
      sipResponse: sipSuccess ? "SIP OPTIONS accepted" : "TCP reachable, SIP handshake not confirmed",
      sipSuccess,
      details: {
        tcpLatency: `${tcpResult.latency}ms`,
        sipResponded: sipSuccess,
      },
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      host,
      port: sipPort,
      error: (err as Error).message || "Connection test failed",
    });
  }
}
