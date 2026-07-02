#!/usr/bin/env node
/**
 * Test script: Originate a Voice OTP call via tenant's Asterisk AMI
 * 
 * Tenant SIP server: 198.27.80.229:5038
 * Destination: +8801615069178 (Bangladesh)
 * 
 * Usage: npx ts-node --esm test-ami-originate.ts
 */

import net from "net";

const AMI_HOST = process.argv[2] || "198.27.80.229";
const AMI_PORT = parseInt(process.argv[3] || "5038");
const AMI_USER = process.argv[4] || "admin";
const AMI_SECRET = process.argv[5] || "Telco1988";
const DESTINATION = process.argv[6] || "8801615069178";
const CALLER_ID = process.argv[7] || "Net2APP";

console.log(`Connecting to AMI at ${AMI_HOST}:${AMI_PORT} as ${AMI_USER}...`);

const socket = net.createConnection({ host: AMI_HOST, port: AMI_PORT });
let buffer = "";
let actionId = `test_${Date.now()}`;
let loggedIn = false;
let settleResolve: ((result: any) => void) | null = null;
let startTime = Date.now();
let settled = false;

const settle = (result: any) => {
  if (settled) return;
  settled = true;
  console.log("\n=== RESULT ===", JSON.stringify(result, null, 2));
  socket.write("Action: Logoff\r\n\r\n");
  setTimeout(() => { socket.destroy(); process.exit(result.success ? 0 : 1); }, 1000);
};

socket.on("connect", () => {
  console.log("Connected to AMI, logging in...");
  socket.write(`Action: Login\r\nUsername: ${AMI_USER}\r\nSecret: ${AMI_SECRET}\r\nActionID: ${actionId}\r\n\r\n`);
});

socket.on("data", (data: Buffer) => {
  buffer += data.toString();

  while (buffer.includes("\r\n\r\n")) {
    const idx = buffer.indexOf("\r\n\r\n");
    const raw = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 4);

    const msg: Record<string, string> = {};
    const lines = raw.split("\r\n");
    let key = "";
    for (const line of lines) {
      if (line.includes(": ")) {
        const ci = line.indexOf(": ");
        key = line.slice(0, ci);
        msg[key] = line.slice(ci + 2).replace(/\s+$/, "");
      } else if (key && line.startsWith(" ")) {
        msg[key] += "\n" + line.trim();
      }
    }

    // Login response
    if (msg.Response === "Success" && msg.ActionID === actionId) {
      loggedIn = true;
      console.log(`Logged in! Originating call to ${DESTINATION} via ${AMI_HOST}...`);

      // Send Originate
      const origId = `orig_${Date.now()}`;
      const channel = `Local/${DESTINATION}@default`;
      console.log(`Channel: ${channel}`);
      socket.write(
        `Action: Originate\r\n` +
        `Channel: ${channel}\r\n` +
        `CallerID: ${CALLER_ID}\r\n` +
        `Timeout: 30000\r\n` +
        `Application: Wait\r\n` +
        `Data: 1\r\n` +
        `Async: true\r\n` +
        `ActionID: ${origId}\r\n\r\n`
      );
    }

    // Login failure
    if (msg.Response === "Error" && !loggedIn) {
      console.error("AMI login failed:", msg.Message);
      settle({ success: false, status: "FAILED", error: msg.Message });
    }

    // Originate response
    if (msg.Event === "OriginateResponse") {
      console.log("OriginateResponse:", msg.Response, msg.Reason || "", msg.Uniqueid || "");
      if (msg.Response === "Failure") {
        settle({ success: false, status: "FAILED", error: msg.Reason, channel: msg.Channel });
      }
    }

    // Dial events
    if (msg.Event === "DialBegin") {
      console.log("DialBegin — ringing...", msg.Dialstring || msg.Channel || "");
    }

    if (msg.Event === "DialEnd") {
      console.log("DialEnd — status:", msg.DialStatus);
      if (msg.DialStatus === "ANSWER") {
        console.log("CALL ANSWERED!");
      } else {
        settle({ success: false, status: msg.DialStatus, error: `Dial ended: ${msg.DialStatus}` });
      }
    }

    if (msg.Event === "Hangup") {
      const duration = parseInt(msg["BilableSeconds"] || "0");
      console.log("Hangup — duration:", duration, "s");
      settle({
        success: true,
        status: "ANSWERED",
        duration,
        uniqueId: msg.Uniqueid,
        channel: msg.Channel,
      });
    }
  }
});

socket.on("error", (err: Error) => {
  console.error("Socket error:", err.message);
  if (!settled) settle({ success: false, status: "FAILED", error: err.message });
});

socket.on("close", () => {
  if (!settled) {
    console.log("Connection closed by server");
    settle({ success: false, status: "FAILED", error: "Connection closed" });
  }
});

// Timeout after 45 seconds
setTimeout(() => {
  if (!settled) {
    settle({ success: false, status: "NO_ANSWER", error: "Timeout — no answer after 45s" });
  }
}, 45000);
