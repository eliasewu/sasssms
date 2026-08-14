/**
 * Super Admin — Server Manager API
 * 
 * GET    /api/super/servers            — List all server locations with live health status
 * GET    /api/super/servers?check=ID   — Health check a specific server
 * POST   /api/super/servers            — Add server location + trigger deployment
 * DELETE /api/super/servers?id=ID      — Remove a server location
 */

import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { pool } from "@/db";
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { mkdir, writeFile, unlink } from "fs/promises";
import { join } from "path";

interface ServerLocation {
  id: string;
  country: string;
  city: string;
  countryCodes: string;
  ipAddress: string;
  port: number;
  isActive: boolean;
  sshUser?: string;
  package?: "development" | "starter" | "professional" | "enterprise";
  lastDeployed?: string;
  healthStatus?: "online" | "offline" | "unknown" | "deploying";
}

async function getServerLocations(): Promise<ServerLocation[]> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT value FROM platform_settings WHERE key = 'server_locations'"
    );
    if (rows.length === 0) return [];
    return JSON.parse(rows[0].value || "[]");
  } finally {
    client.release();
  }
}

async function saveServerLocations(locations: ServerLocation[]) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO platform_settings (key, value) VALUES ('server_locations', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [JSON.stringify(locations)]
    );
  } finally {
    client.release();
  }
}

/**
 * Shared SSH helper — runs a command on a remote server.
 * Uses environment variables to pass the password, eliminating shell injection risk.
 */
function sshExec(
  ip: string,
  user: string,
  password: string,
  command: string,
  options?: { timeout?: number; encoding?: BufferEncoding }
): string {
  const timeout = options?.timeout ?? 15000;
  const encoding = (options?.encoding as BufferEncoding) ?? "utf-8";
  
  return execSync(
    `sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=8 ${user}@${ip} '${command}'`,
    {
      timeout,
      encoding,
      env: { ...process.env, SSHPASS: password },
    }
  );
}

/**
 * Non-throwing version — catches errors and returns output + error info.
 */
function sshExecSafe(
  ip: string,
  user: string,
  password: string,
  command: string,
  timeoutMs = 15000
): { output: string; error: string | null } {
  try {
    const output = sshExec(ip, user, password, command, { timeout: timeoutMs });
    return { output, error: null };
  } catch (err: any) {
    return {
      output: err?.stdout?.toString() || "",
      error: err?.stderr?.toString() || err?.message || String(err),
    };
  }
}

export interface ServerResources {
  cpuPercent: number | null;
  ramUsedGb: number | null;
  ramTotalGb: number | null;
  ramPercent: number | null;
  diskUsed: string | null;
  diskTotal: string | null;
  diskPercent: number | null;
  load1: number | null;
}

/**
 * Parse the labeled resource block echoed by the SSH health command.
 * Every line is `KEY:<value>` so parsing is robust and quote-safe.
 * Exported for unit testing.
 */
export function parseResources(output: string): ServerResources | null {
  const cpuLine = output.match(/CPU:([^\n]*)/)?.[1]?.trim() || "";
  const memLine = output.match(/MEM:([^\n]*)/)?.[1]?.trim() || "";
  const diskLine = output.match(/DISK:([^\n]*)/)?.[1]?.trim() || "";
  const loadLine = output.match(/LOAD:([^\n]*)/)?.[1]?.trim() || "";

  if (!cpuLine && !memLine && !diskLine && !loadLine) return null;

  // CPU: "%Cpu(s): 12.3 us, ... 84.9 id, ..." → used = 100 - idle
  let cpuPercent: number | null = null;
  const idleMatch = cpuLine.match(/([\d.]+)\s*id,/);
  if (idleMatch) {
    const idle = parseFloat(idleMatch[1]);
    if (!Number.isNaN(idle)) cpuPercent = Math.round((100 - idle) * 10) / 10;
  }

  // MEM: free -m → "Mem: total used free shared buff/cache available"
  let ramUsedGb: number | null = null;
  let ramTotalGb: number | null = null;
  let ramPercent: number | null = null;
  const memParts = memLine.split(/\s+/);
  if (memParts.length >= 3 && memParts[0] === "Mem:") {
    const total = parseInt(memParts[1], 10);
    const used = parseInt(memParts[2], 10);
    if (!Number.isNaN(total) && !Number.isNaN(used) && total > 0) {
      ramTotalGb = Math.round((total / 1024) * 10) / 10;
      ramUsedGb = Math.round((used / 1024) * 10) / 10;
      ramPercent = Math.round((used / total) * 1000) / 10;
    }
  }

  // DISK: df -h / → "Filesystem Size Used Avail Use% Mounted on"
  let diskUsed: string | null = null;
  let diskTotal: string | null = null;
  let diskPercent: number | null = null;
  const diskParts = diskLine.split(/\s+/);
  if (diskParts.length >= 5 && diskParts[0] !== "Filesystem") {
    diskTotal = diskParts[1];
    diskUsed = diskParts[2];
    const pct = parseInt(diskParts[4], 10);
    if (!Number.isNaN(pct)) diskPercent = pct;
  }

  // LOAD: /proc/loadavg → "0.50 0.42 0.35 ..." (1-min average)
  let load1: number | null = null;
  const loadPart = loadLine.split(/\s+/)[0];
  if (loadPart) {
    const l = parseFloat(loadPart);
    if (!Number.isNaN(l)) load1 = l;
  }

  return { cpuPercent, ramUsedGb, ramTotalGb, ramPercent, diskUsed, diskTotal, diskPercent, load1 };
}

/**
 * Check if a server is healthy by SSH-ing in and verifying PM2 + ports,
 * and collect live CPU / RAM / storage usage for the per-server usage view.
 */
async function healthCheckServer(loc: ServerLocation): Promise<{
  healthStatus: ServerLocation["healthStatus"];
  details: string;
  uptime?: string;
  pm2Status?: string;
  ports?: string;
  resources?: ServerResources;
}> {
  if (!loc.ipAddress || !loc.sshUser) {
    return { healthStatus: "unknown", details: "No IP or SSH user configured" };
  }

  // Read stored credentials
  const credsFile = join(process.cwd(), ".server-creds", `${loc.id}.json`);
  let sshPass = "";
  if (existsSync(credsFile)) {
    try {
      const creds = JSON.parse(readFileSync(credsFile, "utf-8"));
      sshPass = creds.sshPass || "";
    } catch {}
  }

  if (!sshPass) {
    return { healthStatus: "unknown", details: "No SSH credentials stored" };
  }

  const healthCmd = [
    'echo "UPTIME:$(uptime -p)"',
    'echo "CPU:$(top -bn1 | grep %Cpu | sed -n 1p)"',
    'echo "MEM:$(free -m | sed -n 2p)"',
    'echo "DISK:$(df -h / | sed -n 2p)"',
    'echo "LOAD:$(cat /proc/loadavg | sed -n 1p)"',
    'PM2_HOME=/root/.pm2 pm2 list --no-color 2>&1 | grep -E "online|errored|stopped" | head -5',
    'echo "PORTS:"',
    'ss -tlnp 2>/dev/null | grep -E "5556|2775|80|443" | awk \'{print $4}\'',
  ].join(" && ");

  const { output, error } = sshExecSafe(loc.ipAddress, loc.sshUser, sshPass, healthCmd);

  if (error) {
    if (error.includes("Connection refused") || error.includes("Connection timed out")) {
      return { healthStatus: "offline", details: "Server unreachable" };
    }
    if (error.includes("Permission denied")) {
      return { healthStatus: "offline", details: "SSH auth failed — check credentials" };
    }
    return { healthStatus: "unknown", details: `SSH error: ${error.substring(0, 120)}` };
  }

  const resources = parseResources(output);

  if (output.includes("online")) {
    const uptime = output.match(/UPTIME:(.+)/)?.[1]?.trim() || "";
    const ports = output.match(/PORTS:([\s\S]*)/)?.[1]?.trim() || "";

    return {
      healthStatus: "online",
      details: "All services running",
      uptime,
      pm2Status: "online",
      ports: ports || "ports detected",
      resources: resources ?? undefined,
    };
  }

  return {
    healthStatus: "offline",
    details: "PM2 not running or ports not listening",
    uptime: output.match(/UPTIME:(.+)/)?.[1]?.trim(),
    resources: resources ?? undefined,
  };
}

// ── GET: List all servers with health status ──
export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const checkId = url.searchParams.get("check");

  const locations = await getServerLocations();

  // Health check a single server
  if (checkId) {
    const loc = locations.find((l) => l.id === checkId);
    if (!loc) return NextResponse.json({ error: "Location not found" }, { status: 404 });
    const health = await healthCheckServer(loc);
    return NextResponse.json({ location: loc, health });
  }

  // Return all with basic info (no SSH creds exposed)
  const servers = locations.map((loc) => ({
    id: loc.id,
    country: loc.country,
    city: loc.city,
    countryCodes: loc.countryCodes,
    ipAddress: loc.ipAddress,
    port: loc.port,
    isActive: loc.isActive,
    sshUser: loc.sshUser || null,
    package: loc.package || "starter",
    lastDeployed: loc.lastDeployed || null,
    healthStatus: loc.healthStatus || "unknown",
  }));

  return NextResponse.json({ servers });
}

// ── POST: Add server location + trigger deployment ──
export async function POST(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    locationId,
    ipAddress,
    sshUser,
    sshPass,
    suPass,
    port = 2775,
    deploy = false,
    pkg = "starter",
  } = body;

  const VALID_PACKAGES = ["development", "starter", "professional", "enterprise"];
  if (!VALID_PACKAGES.includes(pkg)) {
    return NextResponse.json({
      error: `Invalid package "${pkg}". Must be one of: ${VALID_PACKAGES.join(", ")}`,
    }, { status: 400 });
  }

  if (!locationId || !ipAddress || !sshUser || !sshPass) {
    return NextResponse.json({
      error: "locationId, ipAddress, sshUser, and sshPass are required",
    }, { status: 400 });
  }

  // Validate IP format
  if (!/^[a-zA-Z0-9.:-]+$/.test(ipAddress) || ipAddress.length > 45) {
    return NextResponse.json({
      error: "Invalid IP address format",
    }, { status: 400 });
  }

  // Validate SSH username
  if (!/^[a-zA-Z0-9_-]+$/.test(sshUser) || sshUser.length > 32) {
    return NextResponse.json({
      error: "Invalid SSH username format",
    }, { status: 400 });
  }

  // Validate location exists in server_locations
  const locations = await getServerLocations();
  const locIndex = locations.findIndex((l) => l.id === locationId);
  if (locIndex === -1) {
    return NextResponse.json({
      error: `Location "${locationId}" not found. Available: ${locations.map(l => l.id).join(", ")}`,
    }, { status: 404 });
  }

  // ── Multiple servers per location ──
  // If the chosen location already has a different server deployed, create a
  // NEW entry with a suffixed id (e.g. sydney-2, sydney-3) instead of
  // overwriting the existing one — every location can host many servers.
  const existingIp = locations[locIndex].ipAddress;
  let targetIndex = locIndex;
  if (existingIp && existingIp !== ipAddress && deploy) {
    let suffix = 2;
    let newId = `${locationId}-${suffix}`;
    while (locations.some((l) => l.id === newId)) {
      suffix++;
      newId = `${locationId}-${suffix}`;
    }
    locations.push({
      ...locations[locIndex],
      id: newId,
      ipAddress: "",
      lastDeployed: undefined as any,
      healthStatus: undefined as any,
    });
    targetIndex = locations.length - 1;
  }

  // Update the location/server entry with server details. When a second+
  // server was added to a location, targetIndex points at the new suffixed
  // entry and the original entry is left untouched.
  locations[targetIndex] = {
    ...locations[targetIndex],
    ipAddress,
    port,
    sshUser,
    package: pkg,
    isActive: true,
  };

  // Store SSH credentials securely (mode 700 dir, 600 files). Keyed by the
  // FINAL entry id (suffixed id when a second+ server was added to a location).
  const targetId = locations[targetIndex].id;
  if (deploy || sshPass) {
    const credsDir = join(process.cwd(), ".server-creds");
    await mkdir(credsDir, { recursive: true, mode: 0o700 });
    await writeFile(
      join(credsDir, `${targetId}.json`),
      JSON.stringify({ sshUser, sshPass, suPass: suPass || sshPass }),
      { mode: 0o600 }
    );
  }

  // Trigger deployment if requested
  let deployResult: { success: boolean; message: string } | null = null;
  if (deploy) {
    locations[targetIndex].healthStatus = "deploying";
    await saveServerLocations(locations);

    try {
      const deployScript = join(process.cwd(), "scripts", "deploy-to-server.sh");
      if (!existsSync(deployScript)) {
        deployResult = { success: false, message: "Deploy script not found" };
      } else {
        console.log(`[ServerManager] Deploying to ${targetId} (${ipAddress})...`);
        const output = execSync(
          `bash ${deployScript} ${targetId} 2>&1`,
          {
            timeout: 300000,
            encoding: "utf-8",
            env: {
              ...process.env,
              DEPLOY_IP: ipAddress,
              DEPLOY_USER: sshUser,
              DEPLOY_SSH_PASS: sshPass,
              DEPLOY_SU_PASS: suPass || sshPass,
            },
          }
        );
        console.log(`[ServerManager] Deploy output for ${targetId}:\n${output.substring(0, 500)}`);
        deployResult = {
          success: output.includes("Installation Complete") || output.includes("deployed successfully"),
          message: output.substring(output.length - 300),
        };

        locations[targetIndex].lastDeployed = new Date().toISOString();
        locations[targetIndex].healthStatus = deployResult.success ? "online" : "offline";
      }
    } catch (err: any) {
      deployResult = {
        success: false,
        message: err?.stderr?.substring(0, 500) || err?.message?.substring(0, 500) || String(err).substring(0, 500),
      };
      locations[targetIndex].healthStatus = "offline";
    }
  }

  await saveServerLocations(locations);

  return NextResponse.json({
    success: true,
    location: {
      ...locations[targetIndex],
      sshPass: undefined, // Never return password
    },
    deployResult,
    message: deploy
      ? `Server ${ipAddress} deployed to ${targetId}`
      : `Server ${ipAddress} added to ${targetId}`,
  });
}

// ── DELETE: Remove server from a location (keeps the location) ──
export async function DELETE(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Location ID required" }, { status: 400 });

  const locations = await getServerLocations();
  const locIndex = locations.findIndex((l) => l.id === id);
  if (locIndex === -1) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  // Clear the server IP and credentials (but keep the location)
  locations[locIndex] = {
    ...locations[locIndex],
    ipAddress: "",
    sshUser: undefined as any,
    lastDeployed: undefined as any,
    healthStatus: "unknown",
  };

  // Remove stored credentials
  const credsFile = join(process.cwd(), ".server-creds", `${id}.json`);
  if (existsSync(credsFile)) {
    await unlink(credsFile).catch(() => {});
  }

  await saveServerLocations(locations);

  return NextResponse.json({
    success: true,
    message: `Server removed from ${id}. Location preserved.`,
  });
}
