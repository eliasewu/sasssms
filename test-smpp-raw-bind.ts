/**
 * Raw SMPP Bind PDU Diagnostic Tool
 * Connects to an SMSC, sends a bind PDU, and captures the raw hex response.
 * Supports bind_transceiver, bind_transmitter, and bind_receiver.
 *
 * Usage: npx tsx test-smpp-raw-bind.ts
 *
 * Env vars (all required):
 *   SMSC_HOST       — SMSC hostname/IP (default: 145.239.1.103)
 *   SMSC_PORT       — SMSC port (default: 2775)
 *   SYSTEM_ID       — SMPP system_id / username
 *   PASSWORD        — SMPP password
 *   SYSTEM_TYPE     — SMPP system_type (default: SMSC)
 *   IF_VERSION      — interface_version hex: 0x33 (v3.3), 0x34 (v3.4), 0x50 (v5.0) (default: 0x34)
 *   BIND_TYPE       — "transceiver" (default), "transmitter", or "receiver"
 *
 * Quick multi-version test:
 *   for v in 0x34 0x33 0x50; do echo "=== Testing v$v ===" && IF_VERSION=$v SMSC_HOST=... SYSTEM_ID=... PASSWORD=... npx tsx test-smpp-raw-bind.ts; done
 */

import * as net from "net";

// ── Config ──
const SMSC_HOST = process.env.SMSC_HOST || "145.239.1.103";
const SMSC_PORT = parseInt(process.env.SMSC_PORT || "2775");
const SYSTEM_ID = process.env.SYSTEM_ID || "";
const PASSWORD = process.env.PASSWORD || "";
const SYSTEM_TYPE = process.env.SYSTEM_TYPE !== undefined ? process.env.SYSTEM_TYPE : "SMSC";
const INTERFACE_VERSION = parseInt(process.env.IF_VERSION || "0x34");
const BIND_TYPE = process.env.BIND_TYPE || "transceiver";
const ADDR_RANGE = process.env.ADDR_RANGE !== undefined ? process.env.ADDR_RANGE : "";

// Validate required params
if (!SYSTEM_ID || !PASSWORD) {
  console.error("❌ SYSTEM_ID and PASSWORD environment variables are required.");
  console.error("   Example: SYSTEM_ID=vltest PASSWORD=xxx npx tsx test-smpp-raw-bind.ts");
  process.exit(1);
}

function bindCommandId(type: string): { id: number; name: string; respId: number } {
  switch (type) {
    case "transmitter": return { id: 0x00000002, name: "bind_transmitter", respId: 0x80000002 };
    case "receiver":    return { id: 0x00000001, name: "bind_receiver", respId: 0x80000001 };
    default:            return { id: 0x00000009, name: "bind_transceiver", respId: 0x80000009 };
  }
}

function buildBindPdu(
  systemId: string, password: string, systemType: string,
  interfaceVersion: number, bindTypeCmd: number, addressRange: string, seqNum: number = 1
): Buffer {
  const body = Buffer.concat([
    Buffer.from(systemId + "\0", "ascii"),
    Buffer.from(password + "\0", "ascii"),
    Buffer.from(systemType + "\0", "ascii"),
    Buffer.from([interfaceVersion]),
    Buffer.from([0x00]), // addr_ton
    Buffer.from([0x00]), // addr_npi
    Buffer.from(addressRange + "\0", "ascii"), // address_range
  ]);
  const commandLength = 16 + body.length;
  const header = Buffer.alloc(16);
  header.writeUInt32BE(commandLength, 0);
  header.writeUInt32BE(bindTypeCmd, 4);
  header.writeUInt32BE(0x00000000, 8);
  header.writeUInt32BE(seqNum, 12);
  return Buffer.concat([header, body]);
}

function parsePdu(buf: Buffer) {
  const commandLength = buf.readUInt32BE(0);
  const commandId = buf.readUInt32BE(4);
  const commandStatus = buf.readUInt32BE(8);
  const seqNum = buf.readUInt32BE(12);
  const body = buf.subarray(16, commandLength);
  const bodyStrings: string[] = [];
  let i = 0;
  while (i < body.length) {
    const nullIdx = body.indexOf(0, i);
    if (nullIdx === -1) { bodyStrings.push(body.subarray(i).toString("hex")); break; }
    bodyStrings.push(body.subarray(i, nullIdx).toString("ascii"));
    i = nullIdx + 1;
  }
  return { commandLength, commandId, commandStatus, seqNum, bodyHex: body.toString("hex"), bodyStrings };
}

function commandName(id: number): string {
  const names: Record<number, string> = {
    0x00000001: "bind_receiver", 0x00000002: "bind_transmitter", 0x00000009: "bind_transceiver",
    0x80000001: "bind_receiver_resp", 0x80000002: "bind_transmitter_resp", 0x80000009: "bind_transceiver_resp",
  };
  return names[id] || `0x${id.toString(16)}`;
}

function statusDescription(status: number): string {
  const desc: Record<number, string> = {
    0x00: "OK", 0x01: "RINVMSGLEN", 0x02: "RINVCMDLEN", 0x03: "RINVCMDID",
    0x04: "RINVBNDSTS", 0x05: "RALYBND", 0x08: "RSYSERR", 0x0A: "RINVDSTADR",
    0x0B: "RINVMSGID", 0x0C: "RBINDFAIL", 0x0D: "RINVPASWD (invalid password)",
    0x0E: "RINVSYSID (invalid system_id)", 0x0F: "RCANCELFAIL", 0x14: "RMSGQFUL",
  };
  return desc[status] || `Unknown (0x${status.toString(16)})`;
}

function hexdump(buf: Buffer): string {
  const lines: string[] = [];
  for (let offset = 0; offset < buf.length; offset += 16) {
    const chunk = buf.subarray(offset, offset + 16);
    const hex = Array.from(chunk).map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const ascii = Array.from(chunk).map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${offset.toString(16).padStart(4, "0")}  ${hex.padEnd(48)}  ${ascii}`);
  }
  return lines.join("\n");
}

// ── Main ──
const bindCmd = bindCommandId(BIND_TYPE);
const verLabel = INTERFACE_VERSION === 0x33 ? "3.3" : INTERFACE_VERSION === 0x34 ? "3.4" : INTERFACE_VERSION === 0x50 ? "5.0" : `0x${INTERFACE_VERSION.toString(16)}`;

console.log("=".repeat(70));
console.log("  SMPP Raw Bind PDU Diagnostic");
console.log("=".repeat(70));
console.log(`  Target:    ${SMSC_HOST}:${SMSC_PORT}`);
console.log(`  Bind Type: ${bindCmd.name}`);
console.log(`  System ID: "${SYSTEM_ID}"`);
console.log(`  Password:  "${PASSWORD}"`);
console.log(`  Sys Type:  "${SYSTEM_TYPE}"`);
console.log(`  Version:   0x${INTERFACE_VERSION.toString(16)} (SMPP v${verLabel})`);
console.log(`  Addr Range: "${ADDR_RANGE || "(none)"}"`);
console.log(`  PDU Size:  ${16 + SYSTEM_ID.length + 1 + PASSWORD.length + 1 + SYSTEM_TYPE.length + 1 + 1 + 1 + 1 + 1} bytes`);
console.log("=".repeat(70));

const socket = new net.Socket();
let receivedData = Buffer.alloc(0);

function handleResponse() {
  if (receivedData.length >= 4) {
    const pduLen = receivedData.readUInt32BE(0);
    if (receivedData.length >= pduLen) {
      const pdu = receivedData.subarray(0, pduLen);
      console.log("\n📥  RAW RESPONSE PDU:");
      console.log(hexdump(pdu));
      const parsed = parsePdu(pdu);
      console.log(`\n📋  PARSED:`);
      console.log(`    Command:   ${commandName(parsed.commandId)}`);
      console.log(`    Status:    ${parsed.commandStatus} — ${statusDescription(parsed.commandStatus)}`);
      console.log(`    Seq:       ${parsed.seqNum}`);
      if (parsed.bodyStrings.length > 0) console.log(`    Body:      [${parsed.bodyStrings.map(s => `"${s}"`).join(", ")}]`);

      const isBindResp = parsed.commandId === bindCmd.respId;
      if (isBindResp && parsed.commandStatus === 0x00) {
        const respSystemId = parsed.bodyStrings.length >= 1 ? parsed.bodyStrings[0] : "?";
        console.log(`\n    ✅ BIND SUCCESSFUL — SMSC: "${respSystemId}", SMPP ${verLabel}`);
      } else if (isBindResp) {
        console.log(`\n    ❌ BIND REJECTED (status ${parsed.commandStatus} = ${statusDescription(parsed.commandStatus)})`);
        if (parsed.commandStatus === 0x0D) {
          console.log("    🔑 INVALID PASSWORD — the password does not match what the SMSC expects");
        } else if (parsed.commandStatus === 0x0E) {
          console.log("    👤 INVALID SYSTEM_ID — the system_id is not recognized by the SMSC");
        } else if (parsed.commandStatus === 0x0C) {
          console.log("    🚫 BIND FAILED — generic rejection (check IP whitelist, system_type, or contact SMSC admin)");
        } else if (parsed.commandStatus === 0x08) {
          console.log("    💥 SYSTEM ERROR — SMSC internal error");
        } else if (parsed.commandStatus === 0x0A) {
          console.log("    📍 RINVDSTADR — non-standard for bind. May indicate IP-based filtering or malformed PDU");
        } else {
          console.log("    ❓ Non-standard bind rejection — the SMSC is rejecting with an unusual code");
          console.log("       This often means IP-based access control. Verify your server IP is whitelisted.");
        }
      } else {
        console.log("    ⚠️  Unexpected response type (not a bind response)");
      }

      console.log("\n" + "=".repeat(70));
      socket.destroy();
      process.exit(parsed.commandStatus === 0 ? 0 : 1);
    }
  }
}

socket.on("data", (data: Buffer) => {
  receivedData = Buffer.concat([receivedData, data]);
  handleResponse();
});

socket.on("error", (err: Error) => { console.error(`\n💥 TCP ERROR: ${err.message}`); console.error("   Check: firewall, routing, DNS, or if SMSC is listening on this port"); process.exit(2); });
socket.on("close", () => { if (receivedData.length === 0) { console.error("\n💥 Connection closed with no data — SMSC may have dropped the connection before responding"); console.error("   This can mean: IP not whitelisted, wrong port/protocol, or SMSC immediately rejected the TCP connection"); process.exit(3); } });
socket.setTimeout(10000);
socket.on("timeout", () => { console.error("\n💥 TIMEOUT — No response from SMSC within 10 seconds"); console.error("   The SMSC accepted TCP but didn't respond to the bind PDU"); process.exit(4); });

console.log("\n⏳ Connecting... ");
socket.connect(SMSC_PORT, SMSC_HOST, () => {
  console.log("✅ TCP connected");
  const pdu = buildBindPdu(SYSTEM_ID, PASSWORD, SYSTEM_TYPE, INTERFACE_VERSION, bindCmd.id, ADDR_RANGE);
  console.log("\n📤  SENDING:");
  console.log(hexdump(pdu));
  console.log(`    Command: ${bindCmd.name} | Seq: 1`);
  socket.write(pdu);
  console.log("⏳ Waiting for response...");
});
