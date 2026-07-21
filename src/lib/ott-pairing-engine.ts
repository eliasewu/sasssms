/**
 * OTT Device Pairing Engine
 *
 * Manages the full lifecycle of OTT device QR code pairing for
 * WhatsApp, Telegram, and Signal gateways through residential proxies.
 *
 * Lifecycle: OFFLINE → AWAITING_SCAN → PAIRING → ONLINE → OFFLINE
 * Expired QRs: AWAITING_SCAN → EXPIRED → (re-initiate) → AWAITING_SCAN
 *
 * Integration: Works with an OTT Worker daemon (separate process) that
 * maintains persistent WebSocket connections to WhatsApp (baileys) and
 * Telegram (GramJS) via SOCKS5 proxies. This engine handles the DB
 * orchestration and API coordination.
 */

import { pool } from "@/db";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { SocksProxyAgent } from "socks-proxy-agent";
import qrcode from "qrcode";

// Telegram imports are dynamic (optional dependency — not always installed)
// Use require-style paths to prevent Turbopack static analysis from failing
let TelegramClient: any;
let StringSession: any;
async function loadTelegram() {
  if (!TelegramClient) {
    const pkg1 = "telegram";
    const pkg2 = "telegram/sessions";
    const mod = await (Function(`return import("${pkg1}")`)() as Promise<any>);
    TelegramClient = mod.TelegramClient;
    StringSession = (await (Function(`return import("${pkg2}")`)() as Promise<any>)).StringSession;
  }
}

// ── Types ──

export type OttDeviceType = "whatsapp" | "telegram" | "signal";

export type OttDeviceStatus =
  | "OFFLINE"
  | "PENDING_QR"
  | "AWAITING_SCAN"
  | "PAIRING"
  | "ONLINE"
  | "EXPIRED"
  | "FAILED";

export interface OttDevice {
  id: number;
  name: string;
  device_type: OttDeviceType;
  phone_number: string | null;
  api_config: string | null;
  proxy_id: number | null;
  qr_code: string | null;
  qr_session: string | null;
  qr_expires_at: string | null;
  status: OttDeviceStatus;
  last_seen: string | null;
  is_active: boolean;
}

export interface ProxyConfig {
  id: number;
  name: string;
  proxy_type: string;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  protocol: string;
  is_active: boolean;
}

export interface PairingResult {
  session: string;
  qrCode: string;
  expiresAt: string;
  deviceType: OttDeviceType;
  pairingUrl: string;
}

export interface PairingStatus {
  status: OttDeviceStatus;
  qrCode: string | null;
  qrSession: string | null;
  qrExpiresAt: string | null;
  deviceType: OttDeviceType;
  lastSeen: string | null;
  message: string;
}

export interface OttSendResult {
  success: boolean;
  messageId: string;
  deviceId: number;
  error?: string;
}

// ── Constants ──

/** QR session timeout in ms (2 minutes) */
const QR_SESSION_TIMEOUT = 120_000;

/** Polling interval for expired QR cleanup (60 seconds) */
const EXPIRY_CHECK_INTERVAL = 60_000;

const AUTH_DIR = join(tmpdir(), "ott-pairing-auth");

// Platform-level fallback Telegram credentials (per-tenant values stored in api_config take precedence)
const PLATFORM_TELEGRAM_API_ID = parseInt(process.env.TELEGRAM_API_ID || "0", 10);
const PLATFORM_TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || "";

// ── Module-level pairing connection store ──
// Connections started by the pairing API persist here so they survive
// beyond the API response and handle the scan→ONLINE lifecycle.

interface PairingConnection {
  schemaName: string;
  deviceId: number;
  deviceType: OttDeviceType;
  client: WASocket | TelegramClient;
}

const pairingConnections = new Map<string, PairingConnection>();

export function getPairingConnection(schemaName: string, deviceId: number): PairingConnection | undefined {
  return pairingConnections.get(`${schemaName}:${deviceId}`);
}

function setPairingConnection(key: string, conn: PairingConnection) {
  pairingConnections.set(key, conn);
}

function deletePairingConnection(key: string) {
  pairingConnections.delete(key);
}

export function isDevicePairing(schemaName: string, deviceId: number): boolean {
  return pairingConnections.has(`${schemaName}:${deviceId}`);
}

// ── Helpers ──

function generateSessionToken(): string {
  return crypto.randomUUID();
}

function sanitizeSchemaName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getDeviceAuthDir(schemaName: string, deviceId: number): string {
  const dir = join(AUTH_DIR, sanitizeSchemaName(schemaName), `device-${deviceId}`);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function buildSocksProxyUrl(
  host: string | null,
  port: number | null,
  protocol: string | null,
  username: string | null,
  password: string | null
): string | null {
  if (!host || !port) return null;
  const proto = protocol || "socks5";
  const auth =
    username && password
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      : username
        ? `${encodeURIComponent(username)}@`
        : "";
  return `${proto}://${auth}${host}:${port}`;
}

// ── Core Functions ──

/**
 * Initiate pairing for an OTT device.
 *
 * 1. Validates device exists, is active, and has a proxy assigned
 * 2. Sets device status to PENDING_QR so the Worker/pairing engine picks it up
 * 3. Returns session info — the real QR will be generated asynchronously
 *    by startRealPairing() which starts the actual baileys/GramJS client.
 *
 * The caller (pair API route) should call startRealPairing() as a background
 * task immediately after this function returns.
 */
export async function initiatePairing(
  schemaName: string,
  deviceId: number
): Promise<PairingResult | { error: string; status: number }> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);

    // Get device with proxy info
    const { rows: devices } = await client.query(
      `SELECT d.*, p.host as proxy_host, p.port as proxy_port,
              p.protocol as proxy_protocol, p.username as proxy_user, p.password as proxy_pass
       FROM ott_devices d
       LEFT JOIN proxy_config p ON d.proxy_id = p.id AND p.is_active = true
       WHERE d.id = $1`,
      [deviceId]
    );

    if (devices.length === 0) {
      return { error: "Device not found", status: 404 };
    }

    const device = devices[0];

    if (!device.is_active) {
      return { error: "Device is inactive", status: 400 };
    }

    if (!device.proxy_id || !device.proxy_host) {
      return { error: "Residential proxy is required for OTT pairing", status: 400 };
    }

    // Prevent duplicate pairing — a real pairing connection already exists
    if (isDevicePairing(schemaName, deviceId)) {
      return { error: "Device is already pairing — please wait for the QR code", status: 409 };
    }

    // Clear any previous QR data and set status to PENDING_QR
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + QR_SESSION_TIMEOUT).toISOString();

    await client.query(
      `UPDATE ott_devices
       SET qr_code = NULL, qr_session = $1, qr_expires_at = $2,
           status = 'PENDING_QR'
       WHERE id = $3`,
      [sessionToken, expiresAt, deviceId]
    );

    // Log pairing initiation
    await client.query(`SET search_path TO public`);
    await client.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, changed_by, new_data)
       VALUES ('ott_device', $1, 'PAIR_INITIATE', 'system', $2)`,
      [deviceId, JSON.stringify({ sessionToken, deviceType: device.device_type })]
    );

    return {
      session: sessionToken,
      qrCode: "", // Will be populated asynchronously by startRealPairing()
      expiresAt,
      deviceType: device.device_type,
      pairingUrl: "",
    };
  } catch (err) {
    console.error("[OTT-ENGINE] initiatePairing error:", err);
    return { error: "Pairing initiation failed", status: 500 };
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Start real QR pairing by connecting to WhatsApp (baileys) or Telegram (GramJS).
 *
 * This is called as a background (fire-and-forget) task from the pair API route.
 * It spawns the actual client, captures the QR event, writes the REAL QR data
 * (as a data URI) to the DB, and handles the full connection lifecycle:
 *   PENDING_QR → (real QR written) → AWAITING_SCAN → (user scans) → PAIRING → ONLINE
 *
 * On success, the connection stays alive in the module-level pairingConnections map
 * so messages can be sent even without the OTT Worker running.
 */
export async function startRealPairing(
  schemaName: string,
  deviceId: number
): Promise<void> {
  const poolKey = `${schemaName}:${deviceId}`;

  // Don't start if already pairing on this device
  if (pairingConnections.has(poolKey)) {
    console.log(`[OTT-ENGINE] Device ${deviceId} already pairing, skipping`);
    return;
  }

  const pg = pool; // use the shared pool
  let device: Record<string, unknown> | null = null;

  // ── Fetch device with proxy info ──
  try {
    await pg.query(`SET search_path TO "${schemaName}"`);
    const { rows } = await pg.query(
      `SELECT d.*, p.host as proxy_host, p.port as proxy_port,
              p.protocol as proxy_protocol, p.username as proxy_username,
              p.password as proxy_password
       FROM ott_devices d
       LEFT JOIN proxy_config p ON d.proxy_id = p.id AND p.is_active = true
       WHERE d.id = $1 AND d.is_active = true`,
      [deviceId]
    );
    await pg.query(`SET search_path TO public`);

    if (rows.length === 0) {
      console.error(`[OTT-ENGINE] Device ${deviceId} not found for pairing`);
      await markPairingFailed(schemaName, deviceId, "Device not found");
      return;
    }
    device = rows[0];
  } catch (err) {
    console.error(`[OTT-ENGINE] Device fetch failed: ${err}`);
    await markPairingFailed(schemaName, deviceId, String(err));
    return;
  }

  const deviceType = (device!.device_type as OttDeviceType) || "whatsapp";

  console.log(`[OTT-ENGINE] Starting real ${deviceType} pairing for device #${deviceId}`);

  try {
    if (deviceType === "whatsapp") {
      await startRealWhatsAppPairing(schemaName, deviceId, device!, poolKey);
    } else if (deviceType === "telegram") {
      await startRealTelegramPairing(schemaName, deviceId, device!, poolKey);
    }
  } catch (err) {
    console.error(`[OTT-ENGINE] Real pairing failed: ${err}`);
    await markPairingFailed(schemaName, deviceId, String(err));
  }
}

// ── WhatsApp Real Pairing ──

async function startRealWhatsAppPairing(
  schemaName: string,
  deviceId: number,
  device: Record<string, unknown>,
  poolKey: string
): Promise<void> {
  const proxyUrl = buildSocksProxyUrl(
    device.proxy_host as string | null,
    device.proxy_port as number | null,
    device.proxy_protocol as string | null,
    device.proxy_username as string | null,
    device.proxy_password as string | null
  );

  const authDir = getDeviceAuthDir(schemaName, deviceId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const agent = proxyUrl ? new SocksProxyAgent(proxyUrl) : undefined;
  const { version } = await fetchLatestBaileysVersion();

  console.log(`[OTT-ENGINE] WhatsApp: connecting via ${proxyUrl || "direct"} (baileys v${version.join(".")})`);

  const sock = makeWASocket({
    version,
    auth: state,
    agent: agent as any,
    printQRInTerminal: false,
    browser: ["Net2APP SMS Platform", "Chrome", "10.0.0"],
  });

  // Track this connection
  const conn: PairingConnection = { schemaName, deviceId, deviceType: "whatsapp", client: sock };
  setPairingConnection(poolKey, conn);

  let qrGenerated = false;

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect } = update;

    // ── QR received from WhatsApp ──
    if (qr && !qrGenerated) {
      qrGenerated = true;
      console.log(`[OTT-ENGINE] WhatsApp QR received for device #${deviceId}`);
      try {
        // Convert baileys QR string to a data URI for direct <img> display
        const qrDataUrl = await qrcode.toDataURL(qr, { width: 300, margin: 2 });
        const pg = pool;
        await pg.query(`SET search_path TO "${schemaName}"`);
        await pg.query(
          `UPDATE ott_devices
           SET qr_code = $1, status = 'AWAITING_SCAN',
               qr_expires_at = NOW() + INTERVAL '2 minutes'
           WHERE id = $2`,
          [qrDataUrl, deviceId]
        );
        await pg.query(`SET search_path TO public`);
        console.log(`[OTT-ENGINE] WhatsApp QR saved to DB for device #${deviceId}`);
      } catch (err) {
        console.error(`[OTT-ENGINE] WhatsApp QR save failed: ${err}`);
      }
    }

    // ── Connected / logged in ──
    if (connection === "open") {
      console.log(`[OTT-ENGINE] WhatsApp OPEN — device #${deviceId} is ONLINE`);
      try {
        // Save auth credentials to DB
        const credsPath = join(authDir, "creds.json");
        const keys: Record<string, unknown> = {};
        const keyFiles = ["app-state-sync-key.json", "app-state-sync-version.json", "pre-key-1.json", "sender-key.json"];
        for (const f of keyFiles) {
          const fp = join(authDir, f);
          if (existsSync(fp)) {
            try { keys[f.replace(".json", "")] = JSON.parse(readFileSync(fp, "utf-8")); } catch {}
          }
        }
        const apiConfig = JSON.stringify({
          creds: existsSync(credsPath) ? JSON.parse(readFileSync(credsPath, "utf-8")) : {},
          keys,
        });

        const pg = pool;
        await pg.query(`SET search_path TO "${schemaName}"`);
        await pg.query(
          `UPDATE ott_devices
           SET status = 'ONLINE', api_config = $1, last_seen = NOW(),
               qr_code = NULL, qr_session = NULL, qr_expires_at = NULL
           WHERE id = $2`,
          [apiConfig, deviceId]
        );
        await pg.query(`SET search_path TO public`);

        // Log pairing completion
        await pg.query(
          `INSERT INTO audit_log (entity_type, entity_id, action, changed_by)
           VALUES ('ott_device', $1, 'PAIR_COMPLETE', 'pairing-engine')`,
          [deviceId]
        );

        console.log(`[OTT-ENGINE] Device #${deviceId} paired and ONLINE`);
      } catch (err) {
        console.error(`[OTT-ENGINE] ONLINE save failed: ${err}`);
      }
    }

    // ── Disconnected ──
    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
      console.log(`[OTT-ENGINE] WhatsApp CLOSED (code: ${statusCode}, loggedOut: ${isLoggedOut})`);

      deletePairingConnection(poolKey);

      if (isLoggedOut) {
        try {
          const pg = pool;
          await pg.query(`SET search_path TO "${schemaName}"`);
          await pg.query(
            `UPDATE ott_devices SET status = 'OFFLINE', api_config = NULL WHERE id = $1`,
            [deviceId]
          );
          await pg.query(`SET search_path TO public`);
        } catch {}
      }
    }
  });

  // Auto-save credentials when they change
  sock.ev.on("creds.update", async () => {
    await saveCreds();
  });
}

// ── Telegram Real Pairing ──

async function startRealTelegramPairing(
  schemaName: string,
  deviceId: number,
  device: Record<string, unknown>,
  poolKey: string
): Promise<void> {
  // Read per-tenant Telegram credentials from api_config, fall back to platform env vars
  let telegramApiId = PLATFORM_TELEGRAM_API_ID;
  let telegramApiHash = PLATFORM_TELEGRAM_API_HASH;
  if (device.api_config) {
    try {
      const config = JSON.parse(device.api_config as string);
      if (config.api_id) telegramApiId = parseInt(String(config.api_id), 10);
      if (config.api_hash) telegramApiHash = config.api_hash;
    } catch {}
  }

  if (!telegramApiId || !telegramApiHash) {
    console.error(`[OTT-ENGINE] Telegram API credentials missing for device #${deviceId}`);
    await markPairingFailed(schemaName, deviceId, "Telegram API ID/Hash not configured — add them in device settings");
    return;
  }

  // Load Telegram package dynamically (optional dependency)
  try {
    await loadTelegram();
  } catch {
    console.error(`[OTT-ENGINE] Telegram package not installed — run: npm install telegram`);
    await markPairingFailed(schemaName, deviceId, "Telegram package not installed");
    return;
  }

  // Build proxy config for GramJS
  let proxyConfig: any = undefined;
  if (device.proxy_host && device.proxy_port) {
    proxyConfig = {
      ip: device.proxy_host as string,
      port: device.proxy_port as number,
      socksType: 5,
      username: (device.proxy_username as string) || undefined,
      password: (device.proxy_password as string) || undefined,
    };
  }

  console.log(`[OTT-ENGINE] Telegram: connecting via ${proxyConfig ? `${proxyConfig.ip}:${proxyConfig.port}` : "direct"}`);

  const stringSession = new StringSession("");
  const client = new TelegramClient(stringSession, telegramApiId, telegramApiHash, {
    connectionRetries: 3,
    useWSS: false,
    proxy: proxyConfig,
    deviceModel: "Net2APP SMS Platform",
    systemVersion: "1.0.0",
    appVersion: "1.0.0",
  });

  // Track this connection
  const conn: PairingConnection = { schemaName, deviceId, deviceType: "telegram", client };
  setPairingConnection(poolKey, conn);

  const existingConfig: Record<string, unknown> = device.api_config
    ? (() => { try { return JSON.parse(device.api_config as string); } catch { return {}; } })()
    : {};

  try {
    await client.connect();

    // Register disconnect detection BEFORE starting QR login
    client.addEventHandler(async (update: any) => {
      if (update.className === "UpdateConnectionState" || update._ === "updateConnectionState") {
        const state = update.state;
        if (state === 0 || state === "disconnected" || state === "broken") {
          const conn = pairingConnections.get(poolKey);
          if (!conn) return;
          console.log(`[OTT-ENGINE] Telegram disconnected for device #${deviceId}`);
          deletePairingConnection(poolKey);
          try {
            // Only mark OFFLINE if the device was already ONLINE
            const pg = pool;
            await pg.query(`SET search_path TO "${schemaName}"`);
            await pg.query(
              `UPDATE ott_devices SET status = 'OFFLINE', api_config = NULL WHERE id = $1 AND status = 'ONLINE'`,
              [deviceId]
            );
            await pg.query(`SET search_path TO public`);
          } catch {}
        }
      }
    });

    await client.signInUserWithQrCode(
      { apiId: telegramApiId, apiHash: telegramApiHash },
      {
        onError: async (err: Error) => {
          console.error(`[OTT-ENGINE] Telegram QR error: ${err.message}`);
          await markPairingFailed(schemaName, deviceId, `Telegram: ${err.message}`);
          deletePairingConnection(poolKey);
        },
        qrCode: async (code: { token: Buffer }) => {
          console.log(`[OTT-ENGINE] Telegram QR token received for device #${deviceId}`);
          const tokenB64 = code.token.toString("base64");
          const loginUrl = `tg://login?token=${tokenB64}`;
          const qrDataUrl = await qrcode.toDataURL(loginUrl, { width: 300, margin: 2 });

          try {
            const pg = pool;
            await pg.query(`SET search_path TO "${schemaName}"`);
            await pg.query(
              `UPDATE ott_devices
               SET qr_code = $1, qr_session = $2, status = 'AWAITING_SCAN',
                   qr_expires_at = NOW() + INTERVAL '2 minutes'
               WHERE id = $3`,
              [qrDataUrl, tokenB64, deviceId]
            );
            await pg.query(`SET search_path TO public`);
          } catch (err) {
            // GramJS may silently swallow callback errors — handle DB failure explicitly
            console.error(`[OTT-ENGINE] Telegram QR DB save failed: ${err}`);
            await markPairingFailed(schemaName, deviceId, `QR save: ${err}`);
            deletePairingConnection(poolKey);
            throw err;
          }
        },
        password: async (hint: string) => {
          console.log(`[OTT-ENGINE] Telegram 2FA required (hint: ${hint}) for device #${deviceId}`);
        },
      }
    );

    // ── Login successful ──
    console.log(`[OTT-ENGINE] Telegram login success — device #${deviceId} is ONLINE`);
    const savedSession = client.session.save() as unknown as string;

    // Preserve api_id/api_hash alongside the session so reconnects work
    const apiConfig = JSON.stringify({
      api_id: existingConfig.api_id || telegramApiId,
      api_hash: existingConfig.api_hash || telegramApiHash,
      session: savedSession,
    });

    const pg = pool;
    await pg.query(`SET search_path TO "${schemaName}"`);
    await pg.query(
      `UPDATE ott_devices
       SET status = 'ONLINE', api_config = $1, last_seen = NOW(),
           qr_code = NULL, qr_session = NULL, qr_expires_at = NULL
       WHERE id = $2`,
      [apiConfig, deviceId]
    );
    await pg.query(`SET search_path TO public`);

    await pg.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, changed_by)
       VALUES ('ott_device', $1, 'PAIR_COMPLETE', 'pairing-engine')`,
      [deviceId]
    );
    console.log(`[OTT-ENGINE] Device #${deviceId} paired and ONLINE`);
  } catch (err) {
    console.error(`[OTT-ENGINE] Telegram pairing failed: ${err}`);
    await markPairingFailed(schemaName, deviceId, `Telegram: ${err}`);
    deletePairingConnection(poolKey);
  }
}

// ── Helper: mark pairing as failed ──

async function markPairingFailed(schemaName: string, deviceId: number, reason: string): Promise<void> {
  try {
    const pg = pool;
    await pg.query(`SET search_path TO "${schemaName}"`);
    await pg.query(`UPDATE ott_devices SET status = 'FAILED' WHERE id = $1`, [deviceId]);
    await pg.query(`SET search_path TO public`);
    console.error(`[OTT-ENGINE] Device #${deviceId} pairing FAILED: ${reason}`);
  } catch (err) {
    console.error(`[OTT-ENGINE] markPairingFailed error: ${err}`);
  }
}

/**
 * Check the current pairing status of an OTT device.
 *
 * Also handles auto-expiry: if the QR has expired and the device
 * is still AWAITING_SCAN, transitions to EXPIRED.
 */
export async function checkPairingStatus(
  schemaName: string,
  deviceId: number
): Promise<PairingStatus | { error: string; status: number }> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);

    const { rows } = await client.query(
      `SELECT id, name, device_type, phone_number, status, qr_code, qr_session,
              qr_expires_at, last_seen
       FROM ott_devices WHERE id = $1`,
      [deviceId]
    );

    if (rows.length === 0) {
      return { error: "Device not found", status: 404 };
    }

    const device = rows[0];

    // Check if QR has expired (read-only — no DB mutation in GET)
    const isExpired = device.status === "AWAITING_SCAN"
      && device.qr_expires_at
      && new Date(device.qr_expires_at).getTime() < Date.now();

    const messages: Record<OttDeviceStatus, string> = {
      OFFLINE: "Device is offline. Initiate pairing to connect.",
      PENDING_QR: "Connecting to messaging service. QR code will appear shortly...",
      AWAITING_SCAN: "QR code ready. Scan with your device.",
      PAIRING: "Device connected. Finalizing pairing...",
      ONLINE: "Device is online and ready to send messages.",
      EXPIRED: "QR code expired. Generate a new one to retry.",
      FAILED: "Pairing failed. Check proxy configuration and try again.",
    };

    return {
      status: (isExpired ? "EXPIRED" : device.status) as OttDeviceStatus,
      qrCode: isExpired ? null : device.qr_code,
      qrSession: isExpired ? null : device.qr_session,
      qrExpiresAt: device.qr_expires_at,
      deviceType: device.device_type,
      lastSeen: device.last_seen,
      message: messages[device.status as OttDeviceStatus] || "Unknown status",
    };
  } catch (err) {
    console.error("[OTT-ENGINE] checkPairingStatus error:", err);
    return { error: "Status check failed", status: 500 };
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Mark a device as ONLINE (called by OTT Worker when pairing succeeds).
 */
export async function completePairing(
  schemaName: string,
  deviceId: number,
  apiConfig: Record<string, unknown>
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);

    await client.query(
      `UPDATE ott_devices
       SET status = 'ONLINE', last_seen = NOW(), api_config = $1,
           qr_code = NULL, qr_session = NULL, qr_expires_at = NULL
       WHERE id = $2`,
      [JSON.stringify(apiConfig), deviceId]
    );

    await client.query(`SET search_path TO public`);
    await client.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, changed_by)
       VALUES ('ott_device', $1, 'PAIR_COMPLETE', 'ott-worker')`,
      [deviceId]
    );

    return true;
  } catch (err) {
    console.error("[OTT-ENGINE] completePairing error:", err);
    return false;
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Unpair / disconnect an OTT device.
 *
 * Clears session data, sets status to OFFLINE.
 * Signals the OTT Worker to terminate the connection.
 */
export async function unpairDevice(
  schemaName: string,
  deviceId: number
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);

    await client.query(
      `UPDATE ott_devices
       SET status = 'OFFLINE', qr_code = NULL, qr_session = NULL,
           qr_expires_at = NULL, api_config = NULL
       WHERE id = $1`,
      [deviceId]
    );

    await client.query(`SET search_path TO public`);
    await client.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, changed_by)
       VALUES ('ott_device', $1, 'UNPAIR', 'system')`,
      [deviceId]
    );

    // Disconnect any active pairing connection
    const poolKey = `${schemaName}:${deviceId}`;
    const pairingConn = pairingConnections.get(poolKey);
    if (pairingConn) {
      await disconnectPairingClient(pairingConn);
      deletePairingConnection(poolKey);
    }

    return true;
  } catch (err) {
    console.error("[OTT-ENGINE] unpairDevice error:", err);
    return false;
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Find available ONLINE OTT devices for a given type within a tenant.
 * Used by the routing engine when delivering messages via OTT routes.
 *
 * Returns devices sorted by last_seen (prefer least-recently-used for load balancing).
 */
export async function getOnlineOttDevices(
  schemaName: string,
  deviceType: OttDeviceType
): Promise<OttDevice[]> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);

    const { rows } = await client.query(
      `SELECT * FROM ott_devices
       WHERE device_type = $1 AND status = 'ONLINE' AND is_active = true
       ORDER BY last_seen ASC NULLS FIRST`,
      [deviceType]
    );

    return rows as OttDevice[];
  } catch (err) {
    console.error("[OTT-ENGINE] getOnlineOttDevices error:", err);
    return [];
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Send an SMS/message through an OTT device.
 *
 * In production, this queues the message for the OTT Worker daemon
 * which delivers it over the WhatsApp/Telegram client session via SOCKS5 proxy.
 *
 * The worker then updates the messages table with delivery status.
 * This function inserts a PENDING record and returns immediately.
 */
export async function sendOttMessage(
  schemaName: string,
  deviceId: number,
  destination: string,
  content: string,
  messageId: string,
  clientId: number,
  routePlanId: number | null,
  routeId: number | null,
  trunkId: number | null,
  supplierId: number | null,
  cost: number
): Promise<OttSendResult> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);

    // Verify device is ONLINE
    const { rows: devices } = await client.query(
      `SELECT id, device_type, proxy_id FROM ott_devices WHERE id = $1 AND status = 'ONLINE' AND is_active = true`,
      [deviceId]
    );

    if (devices.length === 0) {
      return { success: false, messageId, deviceId, error: "Device not online" };
    }

    // The main route handles the INSERT into messages in a single canonical insert.
    // This function verifies the device is available and logs the intent.
    // The OTT Worker daemon picks up PENDING messages and delivers them.

    console.log(
      `[OTT-ENGINE] Message ${messageId} queued for OTT device #${deviceId} (${devices[0].device_type}) → ${destination}`
    );

    return { success: true, messageId, deviceId };
  } catch (err) {
    console.error("[OTT-ENGINE] sendOttMessage error:", err);
    return { success: false, messageId, deviceId, error: String(err) };
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Auto-expire stale QR sessions across all tenant schemas.
 * Call periodically (e.g., every 60 seconds).
 */
export async function cleanupExpiredQrSessions(): Promise<number> {
  let cleaned = 0;
  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query(
      "SELECT schema_name FROM tenants WHERE is_active = true"
    );

    for (const t of tenants) {
      await client.query(`SET search_path TO "${t.schema_name}"`);
      const result = await client.query(
        `UPDATE ott_devices
         SET status = 'EXPIRED', qr_code = NULL, qr_session = NULL
         WHERE status = 'AWAITING_SCAN'
           AND qr_expires_at IS NOT NULL
           AND qr_expires_at < NOW()`
      );
      cleaned += result.rowCount || 0;
    }
  } catch (err) {
    console.error("[OTT-ENGINE] cleanupExpiredQrSessions error:", err);
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
  return cleaned;
}

/**
 * Cleanup abandoned pairing connections (stale > 5 min with no activity).
 * Prevents slow memory leaks from abandoned pairing sessions.
 */
async function cleanupAbandonedPairings(): Promise<number> {
  let cleaned = 0;
  const now = Date.now();
  const STALE_MS = 5 * 60 * 1000; // 5 minutes

  for (const [key, conn] of pairingConnections) {
    // Only clean up devices that are still PENDING_QR or AWAITING_SCAN
    // (i.e., user started pairing but never scanned within 5 minutes)
    try {
      const pg = pool;
      await pg.query(`SET search_path TO "${conn.schemaName}"`);
      const { rows } = await pg.query(
        `SELECT status, qr_expires_at FROM ott_devices WHERE id = $1`,
        [conn.deviceId]
      );
      await pg.query(`SET search_path TO public`);

      if (rows.length === 0) {
        // Device deleted — clean up orphaned connection
        try { await disconnectPairingClient(conn); } catch {}
        pairingConnections.delete(key);
        cleaned++;
        continue;
      }

      const status = rows[0].status;
      if (status === "PENDING_QR" || status === "AWAITING_SCAN") {
        const expiresAt = rows[0].qr_expires_at ? new Date(rows[0].qr_expires_at).getTime() : 0;
        if (now > expiresAt + STALE_MS) {
          // QR expired and no scan for 5+ minutes — clean up
          try { await disconnectPairingClient(conn); } catch {}
          pairingConnections.delete(key);
          cleaned++;
        }
      }
    } catch {
      // If we can't query DB, remove the entry to be safe
      pairingConnections.delete(key);
      cleaned++;
    }
  }
  return cleaned;
}

async function disconnectPairingClient(conn: PairingConnection): Promise<void> {
  try {
    if (conn.deviceType === "whatsapp") {
      (conn.client as WASocket).ev.removeAllListeners();
      (conn.client as WASocket).ws?.close();
    } else {
      await (conn.client as TelegramClient).disconnect();
    }
  } catch {
    // Best effort cleanup
  }
}

// Start periodic cleanup
setInterval(() => {
  cleanupExpiredQrSessions().then((count) => {
    if (count > 0) console.log(`[OTT-ENGINE] Cleaned up ${count} expired QR sessions`);
  });
  cleanupAbandonedPairings().then((count) => {
    if (count > 0) console.log(`[OTT-ENGINE] Cleaned up ${count} abandoned pairing connections`);
  });
}, EXPIRY_CHECK_INTERVAL);
