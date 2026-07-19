/**
 * Supplier Connection Self-Test API
 * Runs TCP connectivity check + raw SMPP bind diagnostic against a supplier's SMSC.
 *
 * GET /api/tenant/suppliers/[id]/test-connection
 * Returns: { tcp, smpp, diagnostics }
 */
import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import * as net from "net";

// ── SMPP Bind PDU builders (same raw PDU logic as test-smpp-raw-bind.ts) ──

function smppVersionToHex(version: string): number {
  const v = version.trim();
  if (v === "3.3") return 0x33;
  if (v === "3.4") return 0x34;
  if (v === "5.0" || v === "5") return 0x50;
  return 0x34;
}

function bindTypeToCommand(type: string): number {
  switch (type) {
    case "TX": case "transmitter": return 0x00000002;
    case "RX": case "receiver":    return 0x00000001;
    default:                       return 0x00000009; // TRX / transceiver
  }
}

function buildBindPdu(
  systemId: string, password: string, systemType: string,
  interfaceVersion: number, bindTypeCmd: number, seqNum: number = 1,
): Buffer {
  const body = Buffer.concat([
    Buffer.from(systemId + "\0", "ascii"),
    Buffer.from(password + "\0", "ascii"),
    Buffer.from(systemType + "\0", "ascii"),
    Buffer.from([interfaceVersion]),
    Buffer.from([0x00]), // addr_ton
    Buffer.from([0x00]), // addr_npi
    Buffer.from([0x00]), // address_range
  ]);
  const commandLength = 16 + body.length;
  const header = Buffer.alloc(16);
  header.writeUInt32BE(commandLength, 0);
  header.writeUInt32BE(bindTypeCmd, 4);
  header.writeUInt32BE(0x00000000, 8);
  header.writeUInt32BE(seqNum, 12);
  return Buffer.concat([header, body]);
}

function parseBindResponse(buf: Buffer) {
  if (buf.length < 16) return null;
  const commandLength = buf.readUInt32BE(0);
  if (buf.length < commandLength) return null;
  const commandId = buf.readUInt32BE(4);
  const commandStatus = buf.readUInt32BE(8);
  const seqNum = buf.readUInt32BE(12);

  // Parse body: system_id (cstring) + optional TLVs
  const bodyStart = 16;
  const bodyEnd = commandLength;
  let nullIdx = buf.indexOf(0, bodyStart);
  const systemId = nullIdx >= bodyStart
    ? buf.subarray(bodyStart, nullIdx).toString("ascii")
    : buf.subarray(bodyStart, bodyEnd).toString("ascii");

  // Look for sc_interface_version TLV (0x0210) after system_id
  let smscVersionHex: string | null = null;
  if (nullIdx >= bodyStart && nullIdx + 5 < bodyEnd) {
    let offset = nullIdx + 1;
    while (offset + 4 <= bodyEnd) {
      const tlvTag = buf.readUInt16BE(offset);
      const tlvLen = buf.readUInt16BE(offset + 2);
      if (tlvTag === 0x0210 && tlvLen >= 1) {
        smscVersionHex = `0x${buf.readUInt8(offset + 4).toString(16)}`;
      }
      offset += 4 + tlvLen;
    }
  }

  const respTypeMap: Record<number, string> = {
    0x80000001: "bind_receiver_resp",
    0x80000002: "bind_transmitter_resp",
    0x80000009: "bind_transceiver_resp",
  };

  return {
    commandLength,
    commandId,
    commandStatus,
    seqNum,
    systemId,
    smscVersionHex,
    respType: respTypeMap[commandId] || `0x${commandId.toString(16)}`,
    hexDump: buf.subarray(0, commandLength).toString("hex"),
  };
}

function statusLabel(status: number): string {
  const labels: Record<number, string> = {
    0x00: "OK",
    0x08: "RSYSERR (System Error)",
    0x0A: "RINVDSTADR (Invalid Destination Address — may indicate IP filtering or address_range rejection)",
    0x0C: "RBINDFAIL (Bind Failed)",
    0x0D: "RINVPASWD (Invalid Password)",
    0x0E: "RINVSYSID (Invalid System ID)",
  };
  return labels[status] || `Unknown (0x${status.toString(16)})`;
}

function hexdump(buf: Buffer): string {
  const lines: string[] = [];
  for (let offset = 0; offset < buf.length; offset += 16) {
    const chunk = buf.subarray(offset, Math.min(offset + 16, buf.length));
    const hex = Array.from(chunk).map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const ascii = Array.from(chunk).map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${offset.toString(16).padStart(4, "0")}  ${hex.padEnd(48)}  ${ascii}`);
  }
  return lines.join("\n");
}

// ── TCP connectivity check ──
function tcpCheck(host: string, port: number, timeoutMs: number = 5000): Promise<{ success: boolean; error?: string; latencyMs?: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const sock = new net.Socket();
    sock.setTimeout(timeoutMs);
    sock.on("connect", () => {
      const latency = Date.now() - start;
      sock.destroy();
      resolve({ success: true, latencyMs: latency });
    });
    sock.on("error", (err: Error) => {
      sock.destroy();
      resolve({ success: false, error: err.message });
    });
    sock.on("timeout", () => {
      sock.destroy();
      resolve({ success: false, error: `Connection timed out after ${timeoutMs}ms` });
    });
    sock.connect(port, host);
  });
}

// ── SMPP raw bind result type ──
interface SmppCheckResult {
  success: boolean;
  commandStatus: number;
  statusLabel: string;
  systemId: string | null;
  smscVersionHex: string | null;
  error?: string;
  sentHex?: string;
  respHex?: string;
  hexDump?: string;
}

// ── SMPP raw bind diagnostic ──
function smppBindCheck(
  host: string, port: number,
  systemId: string, password: string, systemType: string,
  interfaceVersion: number, bindType: string,
  timeoutMs: number = 8000,
): Promise<SmppCheckResult> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let receivedData = Buffer.alloc(0);
    let settled = false;

    const finish = (result: SmppCheckResult) => {
      if (settled) return;
      settled = true;
      sock.destroy();
      resolve(result);
    };

    sock.setTimeout(timeoutMs);
    sock.on("error", (err: Error) => {
      finish({ success: false, commandStatus: -1, statusLabel: "TCP Error", systemId: null, smscVersionHex: null, error: `TCP error: ${err.message}` });
    });
    sock.on("timeout", () => {
      finish({ success: false, commandStatus: -1, statusLabel: "Timeout", systemId: null, smscVersionHex: null, error: `No response from SMSC within ${timeoutMs}ms` });
    });

    sock.on("data", (data: Buffer) => {
      receivedData = Buffer.concat([receivedData, data]);
      if (receivedData.length < 4) return;
      const pduLen = receivedData.readUInt32BE(0);
      if (receivedData.length < pduLen) return;

      const parsed = parseBindResponse(receivedData);
      if (!parsed) {
        finish({ success: false, commandStatus: -1, statusLabel: "Parse Error", systemId: null, smscVersionHex: null, error: "Could not parse SMSC response", respHex: receivedData.toString("hex") });
        return;
      }

      const sentHex = buildBindPdu(systemId, password, systemType, interfaceVersion, bindTypeToCommand(bindType)).toString("hex");
      finish({
        success: parsed.commandStatus === 0,
        commandStatus: parsed.commandStatus,
        statusLabel: statusLabel(parsed.commandStatus),
        systemId: parsed.systemId || null,
        smscVersionHex: parsed.smscVersionHex,
        sentHex,
        respHex: parsed.hexDump,
        hexDump: hexdump(receivedData.subarray(0, pduLen)),
      });
    });

    sock.on("close", () => {
      if (!settled) {
        finish({ success: false, commandStatus: -1, statusLabel: "Connection Closed", systemId: null, smscVersionHex: null, error: "SMSC closed connection without responding" });
      }
    });

    sock.connect(port, host, () => {
      const bindCmdId = bindTypeToCommand(bindType);
      const pdu = buildBindPdu(systemId, password, systemType, interfaceVersion, bindCmdId);
      sock.write(pdu);
    });
  });
}

// ── API Route Handler ──
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supplierId = parseInt(id);
  if (isNaN(supplierId)) return NextResponse.json({ error: "Invalid supplier ID" }, { status: 400 });

  // Fetch supplier from DB
  const result = await tenantQuery(
    tenant.schemaName,
    `SELECT id, name, host, port, username, system_id, password, bind_type, system_type, connection_mode, smpp_version, connection_type
     FROM suppliers WHERE id = $1 AND is_active = true AND deleted_at IS NULL`,
    [supplierId],
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  const s = result.rows[0] as { id: number; name: string; host: string; port: number; username: string; system_id: string; password: string; bind_type: string; system_type: string; connection_mode: string; smpp_version: string; connection_type: string };

  if (s.connection_type !== "SMPP") {
    return NextResponse.json({ error: "Self-test is only available for SMPP suppliers" }, { status: 400 });
  }

  if (s.connection_mode !== "CLIENT") {
    return NextResponse.json({
      error: "Self-test is only available for CLIENT-mode suppliers. SERVER-mode suppliers connect to us.",
      tcp: { success: false, note: "SERVER mode — supplier connects to us, not the other way around." },
    }, { status: 400 });
  }

  const host = s.host;
  const port = Number(s.port) || 2775;
  const systemId = s.username || s.system_id || "";
  const password = s.password || "";
  const systemType = s.system_type || "ESME";
  const smppVersion = s.smpp_version || "3.4";
  const bindType = s.bind_type || "TRX";

  if (!host || !systemId) {
    return NextResponse.json({
      error: "Supplier is missing host or username/system_id — cannot test.",
      tcp: { success: false, error: "Missing host or credentials" },
    }, { status: 400 });
  }

  // ── Run diagnostics in parallel ──
  const [tcpResult, smppResult] = await Promise.all([
    tcpCheck(host, port, 5000),
    smppBindCheck(
      host, port,
      systemId, password, systemType,
      smppVersionToHex(smppVersion), bindType,
      8000,
    ),
  ]);

  // ── Build diagnostics summary ──
  const diagnostics: string[] = [];

  if (tcpResult.success) {
    diagnostics.push(`✅ TCP connected to ${host}:${port} in ${tcpResult.latencyMs}ms`);
  } else {
    diagnostics.push(`❌ TCP failed: ${tcpResult.error}`);
  }

  if (smppResult.success) {
    diagnostics.push(`✅ SMPP bind SUCCESS (status 0)`);
    if (smppResult.systemId) diagnostics.push(`   SMSC system_id: "${smppResult.systemId}"`);
    if (smppResult.smscVersionHex) diagnostics.push(`   SMSC negotiated version: ${smppResult.smscVersionHex}`);
  } else if (smppResult.commandStatus > 0) {
    diagnostics.push(`❌ SMPP bind REJECTED — status ${smppResult.commandStatus}: ${smppResult.statusLabel}`);
    if (smppResult.systemId) diagnostics.push(`   SMSC system_id: "${smppResult.systemId}"`);
    if (smppResult.smscVersionHex) diagnostics.push(`   SMSC negotiated version: ${smppResult.smscVersionHex}`);
    if (smppResult.commandStatus === 0x0D) {
      diagnostics.push("   🔑 The password is incorrect for this system_id");
    } else if (smppResult.commandStatus === 0x0E) {
      diagnostics.push("   👤 The system_id is not recognized by the SMSC");
    } else if (smppResult.commandStatus === 0x0A) {
      diagnostics.push("   📍 RINVDSTADR on bind means: IP not authorized, wrong system_type, or address_range restriction");
      diagnostics.push("   → Verify this server's IP is whitelisted on the SMSC");
      diagnostics.push("   → Try changing system_type (currently \"" + systemType + "\")");
    }
  } else if (smppResult.error) {
    diagnostics.push(`❌ SMPP error: ${smppResult.error}`);
  }

  return NextResponse.json({
    supplier: { id: supplierId, name: s.name, host, port, systemId, systemType, smppVersion, bindType },
    tcp: tcpResult,
    smpp: {
      success: smppResult.success,
      commandStatus: smppResult.commandStatus,
      statusLabel: smppResult.statusLabel,
      systemId: smppResult.systemId,
      smscVersionHex: smppResult.smscVersionHex,
      error: smppResult.error,
      sentHex: smppResult.sentHex,
      respHex: smppResult.respHex,
      hexDump: smppResult.hexDump,
    },
    diagnostics,
    testedAt: new Date().toISOString(),
  });
}
