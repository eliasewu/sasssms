#!/usr/bin/env npx tsx
/**
 * OTT Worker Daemon — Multi-tenant WhatsApp/Telegram Gateway
 *
 * Standalone Node.js process that maintains persistent connections to
 * WhatsApp (via @whiskeysockets/baileys) and Telegram (via GramJS)
 * through SOCKS5 residential proxies.
 *
 * Responsibilities:
 *  - Discovery: polls public.tenants and per-tenant ott_devices every 10s
 *  - Connection: manages baileys/GramJS client lifecycle per device
 *  - QR Generation: writes real QR data from baileys/GramJS to DB
 *  - Message Delivery: polls PENDING OTT messages every 2s and sends them
 *  - DLR Updates: writes delivery status back to the messages table
 *  - Session Persistence: saves/restores auth state to ott_devices.api_config
 *
 * Usage: npm run ott-worker
 *        or: npx tsx src/workers/ott-worker.ts
 *
 * Required environment variables:
 *   DATABASE_URL     — PostgreSQL connection string (same as Next.js)
 *   TELEGRAM_API_ID   — Telegram API ID from my.telegram.org
 *   TELEGRAM_API_HASH — Telegram API hash from my.telegram.org
 */

import { Pool } from "pg";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ── OTT Client Libraries ──
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { SocksProxyAgent } from "socks-proxy-agent";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

// ── Types ──

type OttDeviceType = "whatsapp" | "telegram";

type OttDeviceStatus =
  | "OFFLINE"
  | "PENDING_QR"
  | "AWAITING_SCAN"
  | "PAIRING"
  | "ONLINE"
  | "EXPIRED"
  | "FAILED";

interface DeviceRecord {
  id: number;
  name: string;
  device_type: OttDeviceType;
  phone_number: string | null;
  api_config: string | null;
  proxy_host: string | null;
  proxy_port: number | null;
  proxy_username: string | null;
  proxy_password: string | null;
  proxy_protocol: string | null;
  status: OttDeviceStatus;
  qr_session: string | null;
  schema_name: string;
}

interface PendingMessage {
  id: number;
  message_id: string;
  destination: string;
  content: string;
  client_id: number;
  route_id: number | null;
  trunk_id: number | null;
  supplier_id: number | null;
  connection_type: string;
  dlr_callback_url: string | null;
  schema_name: string;
}

interface WorkerLogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  deviceId?: number;
  schema?: string;
  message: string;
}

// ── Globals ──

const DEV = process.env.NODE_ENV !== "production";
const LOG_LEVEL = DEV ? "DEBUG" : "INFO";

const DISCOVERY_INTERVAL_MS = 10_000;
const MESSAGE_POLL_INTERVAL_MS = 2_000;
const CLEANUP_INTERVAL_MS = 60_000;
const MAX_RECONNECT_ATTEMPTS = 5;
const AUTH_DIR = join(tmpdir(), "ott-worker-auth");

const PLATFORM_TELEGRAM_API_ID = parseInt(process.env.TELEGRAM_API_ID || "0", 10);
const PLATFORM_TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || "";

let pool: Pool;
let running = true;

const connectionPool = new Map<string, DeviceConnection>();

interface DeviceConnection {
  schemaName: string;
  deviceId: number;
  deviceType: OttDeviceType;
  client: WASocket | TelegramClient;
  reconnectAttempts: number;
  lastActive: number;
}

// ── Logging ──

function log(
  level: WorkerLogEntry["level"],
  message: string,
  deviceId?: number,
  schema?: string
) {
  const levels: Record<string, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
  if (levels[level] < levels[LOG_LEVEL]) return;

  const prefix = `[OTT-WORKER] [${new Date().toISOString()}] [${level}]`;
  const ctx = [schema, deviceId ? `#${deviceId}` : null].filter(Boolean).join(" ");
  console.log(`${prefix}${ctx ? ` [${ctx}]` : ""} ${message}`);
}

// ── Database ──

function getPool(): Pool {
  if (!pool) {
    const dbUrl = process.env.DATABASE_URL || "postgres://localhost:5432/saas_sms";
    pool = new Pool({ connectionString: dbUrl, max: 10 });
    log("INFO", "Database pool created");
  }
  return pool;
}

// ── Proxy Helper ──

function buildSocksProxyUrl(device: DeviceRecord): string | null {
  if (!device.proxy_host || !device.proxy_port) return null;
  const protocol = device.proxy_protocol || "socks5";
  const auth =
    device.proxy_username && device.proxy_password
      ? `${encodeURIComponent(device.proxy_username)}:${encodeURIComponent(device.proxy_password)}@`
      : device.proxy_username
        ? `${encodeURIComponent(device.proxy_username)}@`
        : "";
  return `${protocol}://${auth}${device.proxy_host}:${device.proxy_port}`;
}

// ── WhatsApp Client (baileys) ──

function getAuthDir(schemaName: string, deviceId: number): string {
  const dir = join(AUTH_DIR, sanitizeSchemaName(schemaName), `device-${deviceId}`);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function sanitizeSchemaName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function restoreWhatsAppSession(
  schemaName: string,
  deviceId: number,
  apiConfigStr: string | null
): Promise<boolean> {
  if (!apiConfigStr) return false;
  try {
    const config = JSON.parse(apiConfigStr);
    if (!config.creds || !config.keys) return false;

    const dir = getAuthDir(schemaName, deviceId);
    writeFileSync(join(dir, "creds.json"), JSON.stringify(config.creds, null, 2));

    const keyFileMap: Record<string, string> = {
      "app-state-sync-key": "app-state-sync-key.json",
      "app-state-sync-version": "app-state-sync-version.json",
      "pre-key-1": "pre-key-1.json",
      "sender-key": "sender-key.json",
    };
    for (const [key, filename] of Object.entries(keyFileMap)) {
      if (config.keys[key]) {
        writeFileSync(join(dir, filename), JSON.stringify(config.keys[key], null, 2));
      }
    }

    log("DEBUG", "Restored WhatsApp session from DB", deviceId, schemaName);
    return true;
  } catch {
    return false;
  }
}

async function saveWhatsAppSession(
  schemaName: string,
  deviceId: number
): Promise<void> {
  const dir = getAuthDir(schemaName, deviceId);
  const credsPath = join(dir, "creds.json");
  if (!existsSync(credsPath)) return;

  try {
    const creds = JSON.parse(readFileSync(credsPath, "utf-8"));
    const keys: Record<string, unknown> = {};
    const files = [
      "app-state-sync-key.json",
      "app-state-sync-version.json",
      "pre-key-1.json",
      "sender-key.json",
    ];
    for (const f of files) {
      const fp = join(dir, f);
      if (existsSync(fp)) {
        try { keys[f.replace(".json", "")] = JSON.parse(readFileSync(fp, "utf-8")); } catch {}
      }
    }
    const apiConfig = JSON.stringify({ creds, keys });
    const pg = getPool();
    await pg.query(`SET search_path TO "${schemaName}"`);
    await pg.query(`UPDATE ott_devices SET api_config = $1 WHERE id = $2`, [apiConfig, deviceId]);
    await pg.query(`SET search_path TO public`);
    log("DEBUG", "Saved WhatsApp session to DB", deviceId, schemaName);
  } catch (err) {
    log("ERROR", `Failed to save WhatsApp session: ${err}`, deviceId, schemaName);
  }
}

async function startWhatsAppClient(
  device: DeviceRecord
): Promise<DeviceConnection | null> {
  const { schema_name: schemaName, id: deviceId } = device;
  const poolKey = `${schemaName}:${deviceId}`;
  const proxyUrl = buildSocksProxyUrl(device);

  log("INFO", "Starting WhatsApp client", deviceId, schemaName);
  await restoreWhatsAppSession(schemaName, deviceId, device.api_config);

  const authDir = getAuthDir(schemaName, deviceId);

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const agent = proxyUrl ? new SocksProxyAgent(proxyUrl) : undefined;
    const { version, isLatest } = await fetchLatestBaileysVersion();
    log("DEBUG", `Baileys v${version.join(".")}, latest: ${isLatest}`, deviceId, schemaName);

    const sock = makeWASocket({
      version,
      auth: state,
      agent: agent as any,
      printQRInTerminal: false,
      browser: ["Net2APP SMS Platform", "Chrome", "10.0.0"],
      logger: DEV
        ? {
            info: (...a: unknown[]) => log("DEBUG", a.join(" "), deviceId, schemaName),
            warn: (...a: unknown[]) => log("WARN", a.join(" "), deviceId, schemaName),
            error: (...a: unknown[]) => log("ERROR", a.join(" "), deviceId, schemaName),
            debug: (...a: unknown[]) => log("DEBUG", a.join(" "), deviceId, schemaName),
            trace: () => {},
            child: () => ({} as any),
            level: "debug",
          }
        : undefined,
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        log("INFO", "WhatsApp QR received", deviceId, schemaName);
        try {
          const pg = getPool();
          await pg.query(`SET search_path TO "${schemaName}"`);
          await pg.query(
            `UPDATE ott_devices
             SET qr_code = $1, status = 'AWAITING_SCAN',
                 qr_expires_at = NOW() + INTERVAL '2 minutes'
             WHERE id = $2`,
            [qr, deviceId]
          );
          await pg.query(`SET search_path TO public`);
        } catch (err) {
          log("ERROR", `QR save failed: ${err}`, deviceId, schemaName);
        }
      }

      if (connection === "open") {
        log("INFO", "WhatsApp OPEN", deviceId, schemaName);
        try {
          const pg = getPool();
          await pg.query(`SET search_path TO "${schemaName}"`);
          await pg.query(
            `UPDATE ott_devices
             SET status = 'ONLINE', last_seen = NOW(),
                 qr_code = NULL, qr_session = NULL, qr_expires_at = NULL
             WHERE id = $1`,
            [deviceId]
          );
          await pg.query(`SET search_path TO public`);
        } catch (err) {
          log("ERROR", `ONLINE update failed: ${err}`, deviceId, schemaName);
        }
        await saveWhatsAppSession(schemaName, deviceId);
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const reason = (lastDisconnect?.error as any)?.output?.payload?.message || "unknown";
        log("WARN", `WhatsApp CLOSED (code: ${statusCode}, reason: ${reason})`, deviceId, schemaName);

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

        if (!shouldReconnect) {
          log("INFO", "Logged out — marking OFFLINE", deviceId, schemaName);
          try {
            const pg = getPool();
            await pg.query(`SET search_path TO "${schemaName}"`);
            await pg.query(
              `UPDATE ott_devices SET status = 'OFFLINE', api_config = NULL WHERE id = $1`,
              [deviceId]
            );
            await pg.query(`SET search_path TO public`);
          } catch {}
          connectionPool.delete(poolKey);
          return;
        }

        const conn = connectionPool.get(poolKey);
        if (conn && conn.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          conn.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, conn.reconnectAttempts - 1), 30000);
          log("INFO", `Reconnect in ${delay}ms (${conn.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, deviceId, schemaName);
          connectionPool.delete(poolKey);
          setTimeout(() => {
            if (!running) return;
            startWhatsAppClient(device).then((c) => {
              if (c && running) connectionPool.set(poolKey, c);
            });
          }, delay);
        } else {
          log("ERROR", "Max reconnects reached", deviceId, schemaName);
          connectionPool.delete(poolKey);
        }
      }
    });

    sock.ev.on("creds.update", async () => {
      await saveCreds();
      await saveWhatsAppSession(schemaName, deviceId);
    });

    sock.ev.on("messages.upsert", async (m) => {
      for (const msg of m.messages) {
        if (msg.key.fromMe) continue;
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        const sender = msg.key.remoteJid || "";
        if (!text) continue;
        log("DEBUG", `Incoming WhatsApp: ${text.slice(0, 50)}`, deviceId, schemaName);
        try {
          const pg = getPool();
          await pg.query(`SET search_path TO "${schemaName}"`);
          await pg.query(
            `INSERT INTO sms_inbox (sender, destination, content, received_at) VALUES ($1,$2,$3,NOW())`,
            [sender, device.phone_number || "unknown", text]
          );
          await pg.query(`SET search_path TO public`);
        } catch (err) {
          log("ERROR", `Inbox insert failed: ${err}`, deviceId, schemaName);
        }
      }
    });

    sock.ev.on("message-receipt.update", async (updates) => {
      for (const u of updates) {
        const remoteJid = u.key.remoteJid || "";
        try {
          const pg = getPool();
          await pg.query(`SET search_path TO "${schemaName}"`);
          const dlrResult = await pg.query(
            `UPDATE messages
             SET dlr_status = CASE WHEN $3 = true THEN 'DELIVERED' ELSE 'SENT' END,
                 dlr_timestamp = NOW()
             WHERE id = (
               SELECT id FROM messages
               WHERE destination LIKE $1 AND connection_type = 'WhatsApp OTT'
                 AND dlr_status = 'PENDING'
               ORDER BY created_at DESC LIMIT 1
             )
             RETURNING dlr_callback_url, message_id, destination`,
            [`%${remoteJid.replace(/@.*$/, "")}%`, deviceId, !!u.receipt?.messageId]
          );
          await pg.query(`SET search_path TO public`);

          // Push DLR when receipt indicates delivery
          if (dlrResult.rows.length > 0 && u.receipt?.messageId) {
            const { dlr_callback_url, message_id, destination } = dlrResult.rows[0] as Record<string, string>;
            pushOttDlr(dlr_callback_url || null, message_id, destination, "DELIVERED", "WhatsApp OTT");
          }
        } catch (err) {
          log("ERROR", `DLR update failed: ${err}`, deviceId, schemaName);
        }
      }
    });

    log("INFO", "WhatsApp client started", deviceId, schemaName);
    return { schemaName, deviceId, deviceType: "whatsapp", client: sock, reconnectAttempts: 0, lastActive: Date.now() };
  } catch (err) {
    log("ERROR", `WhatsApp start failed: ${err}`, deviceId, schemaName);
    return null;
  }
}

// ── Telegram Client (GramJS) ──

async function startTelegramClient(
  device: DeviceRecord
): Promise<DeviceConnection | null> {
  const { schema_name: schemaName, id: deviceId } = device;
  const poolKey = `${schemaName}:${deviceId}`;

  // Read per-device Telegram credentials from api_config, fall back to platform env vars
  let storedApiId: number | undefined;
  let storedApiHash: string | undefined;
  let sessionStr = "";
  let telegramApiId = PLATFORM_TELEGRAM_API_ID;
  let telegramApiHash = PLATFORM_TELEGRAM_API_HASH;

  if (device.api_config) {
    try {
      const config = JSON.parse(device.api_config);
      if (config.api_id) telegramApiId = parseInt(String(config.api_id), 10);
      if (config.api_hash) telegramApiHash = config.api_hash;
      sessionStr = config.session || "";
      storedApiId = config.api_id ? parseInt(String(config.api_id), 10) : undefined;
      storedApiHash = config.api_hash || undefined;
    } catch {}
  }

  if (!telegramApiId || !telegramApiHash) {
    log("ERROR", "TELEGRAM_API_ID/HASH required", deviceId, schemaName);
    return null;
  }

  log("INFO", "Starting Telegram client", deviceId, schemaName);
  const stringSession = new StringSession(sessionStr);

  let proxyConfig: any = undefined;
  if (device.proxy_host && device.proxy_port) {
    proxyConfig = {
      ip: device.proxy_host,
      port: device.proxy_port,
      socksType: 5,
      username: device.proxy_username || undefined,
      password: device.proxy_password || undefined,
    };
  }

  try {
    const client = new TelegramClient(stringSession, telegramApiId, telegramApiHash, {
      connectionRetries: 3,
      useWSS: false,
      proxy: proxyConfig,
      deviceModel: "Net2APP SMS Platform",
      systemVersion: "1.0.0",
      appVersion: "1.0.0",
    });

    const isAuthorized = sessionStr
      ? await client.connect().then(() => true).catch(() => false)
      : false;

    if (!isAuthorized) {
      log("INFO", "Telegram not authorized — QR login", deviceId, schemaName);
      try {
        await client.connect();
        await client.signInUserWithQrCode(
          { apiId: telegramApiId, apiHash: telegramApiHash },
          {
            onError: async (err: Error) => {
              log("ERROR", `Telegram QR error: ${err.message}`, deviceId, schemaName);
              try {
                const pg = getPool();
                await pg.query(`SET search_path TO "${schemaName}"`);
                await pg.query(`UPDATE ott_devices SET status = 'FAILED' WHERE id = $1`, [deviceId]);
                await pg.query(`SET search_path TO public`);
              } catch {}
            },
            qrCode: async (code: { token: Buffer }) => {
              const tokenB64 = code.token.toString("base64");
              const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`tg://login?token=${tokenB64}`)}&margin=10`;
              log("INFO", "Telegram QR ready", deviceId, schemaName);
              try {
                const pg = getPool();
                await pg.query(`SET search_path TO "${schemaName}"`);
                await pg.query(
                  `UPDATE ott_devices
                   SET qr_code = $1, qr_session = $2, status = 'AWAITING_SCAN',
                       qr_expires_at = NOW() + INTERVAL '2 minutes'
                   WHERE id = $3`,
                  [qrImageUrl, tokenB64, deviceId]
                );
                await pg.query(`SET search_path TO public`);
              } catch (err) {
                log("ERROR", `Telegram QR save failed: ${err}`, deviceId, schemaName);
              }
            },
            password: async (hint: string) => {
              log("WARN", `Telegram 2FA required (hint: ${hint})`, deviceId, schemaName);
            },
          }
        );
        log("INFO", "Telegram QR login success", deviceId, schemaName);
      } catch (err) {
        log("ERROR", `Telegram QR login failed: ${err}`, deviceId, schemaName);
        try {
          const pg = getPool();
          await pg.query(`SET search_path TO "${schemaName}"`);
          await pg.query(`UPDATE ott_devices SET status = 'FAILED' WHERE id = $1`, [deviceId]);
          await pg.query(`SET search_path TO public`);
        } catch {}
        return null;
      }
    }

    // Save session — preserve api_id/api_hash for future reconnects
    const savedSession = client.session.save() as unknown as string;
    try {
      const apiConfig = JSON.stringify({
        api_id: storedApiId || telegramApiId,
        api_hash: storedApiHash || telegramApiHash,
        session: savedSession,
      });
      const pg = getPool();
      await pg.query(`SET search_path TO "${schemaName}"`);
      await pg.query(
        `UPDATE ott_devices
         SET status = 'ONLINE', api_config = $1, last_seen = NOW(),
             qr_code = NULL, qr_session = NULL, qr_expires_at = NULL
         WHERE id = $2`,
        [apiConfig, deviceId]
      );
      await pg.query(`SET search_path TO public`);
    } catch (err) {
      log("ERROR", `Telegram session save failed: ${err}`, deviceId, schemaName);
    }

    // Reconnection + incoming messages handler
    let telegramReconnectTimer: NodeJS.Timeout | null = null;
    client.addEventHandler(async (update: any) => {
      if (update.className === "UpdateConnectionState" || update._ === "updateConnectionState") {
        const state = update.state;
        if (state === 0 || state === "disconnected" || state === "broken") {
          const conn = connectionPool.get(poolKey);
          if (!conn || !running) return;
          if (conn.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            log("ERROR", "Telegram max reconnects reached", deviceId, schemaName);
            connectionPool.delete(poolKey);
            try {
              const pg = getPool();
              await pg.query(`SET search_path TO "${schemaName}"`);
              await pg.query(`UPDATE ott_devices SET status = 'FAILED' WHERE id = $1`, [deviceId]);
              await pg.query(`SET search_path TO public`);
            } catch {}
            return;
          }
          conn.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, conn.reconnectAttempts - 1), 30000);
          log("INFO", `Telegram reconnect in ${delay}ms (${conn.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, deviceId, schemaName);
          connectionPool.delete(poolKey);
          if (telegramReconnectTimer) clearTimeout(telegramReconnectTimer);
          telegramReconnectTimer = setTimeout(async () => {
            if (!running) return;
            const newConn = await startTelegramClient(device);
            if (newConn && running) connectionPool.set(poolKey, newConn);
          }, delay);
        }
      }

      if (update.className === "UpdateNewMessage") {
        const message = update.message;
        if (!message || message.out) return;
        const text = message.message || "";
        const sender = message.peerId?.userId?.toString() || "";
        if (!text) return;
        log("DEBUG", `Incoming Telegram: ${text.slice(0, 50)}`, deviceId, schemaName);
        try {
          const pg = getPool();
          await pg.query(`SET search_path TO "${schemaName}"`);
          await pg.query(
            `INSERT INTO sms_inbox (sender, destination, content, received_at) VALUES ($1,$2,$3,NOW())`,
            [sender, device.phone_number || "unknown", text]
          );
          await pg.query(`SET search_path TO public`);
        } catch (err) {
          log("ERROR", `Telegram inbox failed: ${err}`, deviceId, schemaName);
        }
      }

      // Telegram delivery confirmation — push DLR when message gets permanent ID
      // Catches edge cases where deliverMessage hasn't run yet (PENDING) or only set SENT
      if (update.className === "UpdateMessageID") {
        log("DEBUG", `Telegram message ID confirmed: ${update.id}`, deviceId, schemaName);
        try {
          const pg = getPool();
          await pg.query(`SET search_path TO "${schemaName}"`);
          const dlrResult = await pg.query(
            `UPDATE messages
             SET dlr_status = 'DELIVERED', dlr_timestamp = NOW()
             WHERE connection_type = 'Telegram OTT'
               AND dlr_status IN ('PENDING', 'SENT')
               AND status = 'SENT'
             ORDER BY created_at DESC LIMIT 1
             RETURNING dlr_callback_url, message_id, destination`
          );
          await pg.query(`SET search_path TO public`);
          if (dlrResult.rows.length > 0) {
            const { dlr_callback_url, message_id, destination } = dlrResult.rows[0] as Record<string, string>;
            pushOttDlr(dlr_callback_url || null, message_id, destination, "DELIVERED", "Telegram OTT");
          }
        } catch (err) {
          log("ERROR", `Telegram DLR update failed: ${err}`, deviceId, schemaName);
        }
      }
    });

    log("INFO", "Telegram client started", deviceId, schemaName);
    return { schemaName, deviceId, deviceType: "telegram", client, reconnectAttempts: 0, lastActive: Date.now() };
  } catch (err) {
    log("ERROR", `Telegram start failed: ${err}`, deviceId, schemaName);
    return null;
  }
}

// ── Connection Pool Manager ──

async function startDeviceClient(device: DeviceRecord): Promise<void> {
  const poolKey = `${device.schema_name}:${device.id}`;
  if (connectionPool.has(poolKey)) {
    connectionPool.get(poolKey)!.lastActive = Date.now();
    return;
  }
  const conn = device.device_type === "whatsapp"
    ? await startWhatsAppClient(device)
    : await startTelegramClient(device);
  if (conn) connectionPool.set(poolKey, conn);
}

async function stopDeviceClient(schemaName: string, deviceId: number): Promise<void> {
  const poolKey = `${schemaName}:${deviceId}`;
  const conn = connectionPool.get(poolKey);
  if (!conn) return;

  log("INFO", "Stopping client", deviceId, schemaName);
  try {
    if (conn.deviceType === "whatsapp") {
      const sock = conn.client as WASocket;
      sock.ev.removeAllListeners();
      sock.ws?.close();
    } else {
      await (conn.client as TelegramClient).disconnect();
    }
  } catch (err) {
    log("ERROR", `Stop error: ${err}`, deviceId, schemaName);
  }
  connectionPool.delete(poolKey);
}

// ── Discovery Loop ──

async function discoverDevices(): Promise<void> {
  const pg = getPool();
  try {
    const { rows: tenants } = await pg.query(`SELECT id, schema_name FROM tenants WHERE is_active = true`);
    for (const tenant of tenants) {
      const schemaName = tenant.schema_name;
      try {
        const { rows: devices } = await pg.query(
          `SELECT d.*, p.host as proxy_host, p.port as proxy_port,
                  p.username as proxy_username, p.password as proxy_password,
                  p.protocol as proxy_protocol
           FROM "${schemaName}".ott_devices d
           LEFT JOIN "${schemaName}".proxy_config p ON d.proxy_id = p.id AND p.is_active = true
           WHERE d.is_active = true
             AND d.status IN ('PENDING_QR', 'AWAITING_SCAN', 'PAIRING', 'ONLINE')
           ORDER BY d.id`
        );

        for (const dev of devices) {
          const poolKey = `${schemaName}:${dev.id}`;
          if (dev.status === "OFFLINE" || dev.status === "EXPIRED" || dev.status === "FAILED") {
            if (connectionPool.has(poolKey)) await stopDeviceClient(schemaName, dev.id);
            continue;
          }
          if (connectionPool.has(poolKey)) {
            connectionPool.get(poolKey)!.lastActive = Date.now();
          } else {
            await startDeviceClient({ ...dev, schema_name: schemaName });
          }
        }

        for (const [key, conn] of connectionPool) {
          if (conn.schemaName === schemaName && !devices.some((d: any) => d.id === conn.deviceId)) {
            await stopDeviceClient(schemaName, conn.deviceId);
          }
        }
      } catch (err) {
        log("ERROR", `Discovery error ${schemaName}: ${err}`);
      }
    }
  } catch (err) {
    log("ERROR", `Discovery loop: ${err}`);
  }
}

// ── HTTP DLR Push ──

/**
 * Push DLR notification to the client's HTTP callback URL.
 * Fire-and-forget — logs errors but never throws.
 */
async function pushOttDlr(
  dlrCallbackUrl: string | null,
  messageId: string,
  destination: string,
  dlrStatus: string,
  connectionType: string
): Promise<void> {
  if (!dlrCallbackUrl) return;
  try {
    const payload = {
      message_id: messageId,
      destination,
      status: dlrStatus,
      connection_type: connectionType,
      timestamp: new Date().toISOString(),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    await fetch(dlrCallbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    log("DEBUG", `DLR pushed to ${dlrCallbackUrl} for ${messageId} → ${dlrStatus}`);
  } catch {
    // Fire-and-forget — client callback failures are non-critical
  }
}

// ── Message Poller ──

async function pollPendingMessages(): Promise<void> {
  const pg = getPool();
  try {
    const { rows: tenants } = await pg.query(`SELECT id, schema_name FROM tenants WHERE is_active = true`);
    for (const tenant of tenants) {
      const schemaName = tenant.schema_name;
      try {
        const { rows: messages } = await pg.query(
          `SELECT id, message_id, destination, content, client_id,
                  route_id, trunk_id, supplier_id, connection_type,
                  dlr_callback_url
           FROM "${schemaName}".messages
           WHERE connection_type IN ('WhatsApp OTT', 'Telegram OTT')
             AND dlr_status = 'PENDING' AND status != 'FAILED'
           ORDER BY created_at ASC LIMIT 50`
        );
        for (const msg of messages) {
          await deliverMessage({ ...msg, schema_name: schemaName });
        }
      } catch (err) {
        log("ERROR", `Poll error ${schemaName}: ${err}`);
      }
    }
  } catch (err) {
    log("ERROR", `Message poller: ${err}`);
  }
}

async function deliverMessage(msg: PendingMessage): Promise<void> {
  const { schema_name: schemaName, connection_type: connType } = msg;
  const deviceType: OttDeviceType = connType === "WhatsApp OTT" ? "whatsapp" : "telegram";

  const conn = Array.from(connectionPool.values()).find(
    (c) => c.schemaName === schemaName && c.deviceType === deviceType
  );
  if (!conn) return;

  log("DEBUG", `Delivering ${msg.message_id} via ${deviceType}#${conn.deviceId}`, conn.deviceId, schemaName);

  try {
    const pg = getPool();
    await pg.query(`SET search_path TO "${schemaName}"`);

    if (deviceType === "whatsapp") {
      const jid = `${msg.destination.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
      await (conn.client as WASocket).sendMessage(jid, { text: msg.content });
      await pg.query(`UPDATE messages SET status = 'SENT', dlr_status = 'SENT' WHERE id = $1`, [msg.id]);
    } else {
      await (conn.client as TelegramClient).sendMessage(msg.destination, { message: msg.content });
      await pg.query(
        `UPDATE messages SET status = 'SENT', dlr_status = 'DELIVERED', dlr_timestamp = NOW() WHERE id = $1`,
        [msg.id]
      );
    }

    await pg.query(`SET search_path TO public`);
    conn.lastActive = Date.now();
    log("INFO", `Message ${msg.message_id} delivered`, conn.deviceId, schemaName);

    // Push DLR to client HTTP callback
    const newDlrStatus = deviceType === "telegram" ? "DELIVERED" : "SENT";
    pushOttDlr(msg.dlr_callback_url, msg.message_id, msg.destination, newDlrStatus, msg.connection_type);
  } catch (err) {
    log("ERROR", `Delivery failed: ${err}`, conn.deviceId, schemaName);
    let becameFailed = false;
    try {
      const pg = getPool();
      await pg.query(`SET search_path TO "${schemaName}"`);
      const result = await pg.query(
        `UPDATE messages
         SET retry_count = COALESCE(retry_count, 0) + 1,
             status = CASE WHEN COALESCE(retry_count, 0) + 1 >= COALESCE(max_retries, 3) THEN 'FAILED' ELSE status END,
             dlr_status = CASE WHEN COALESCE(retry_count, 0) + 1 >= COALESCE(max_retries, 3) THEN 'FAILED' ELSE dlr_status END
         WHERE id = $1
         RETURNING status`,
        [msg.id]
      );
      await pg.query(`SET search_path TO public`);
      becameFailed = result.rows[0]?.status === "FAILED";
    } catch {}

    // Push FAILED DLR when message permanently fails
    if (becameFailed) {
      pushOttDlr(msg.dlr_callback_url, msg.message_id, msg.destination, "FAILED", msg.connection_type);
    }
  }
}

// ── Cleanup Loop ──

async function cleanupLoop(): Promise<void> {
  try {
    const pg = getPool();
    const { rows: tenants } = await pg.query(`SELECT schema_name FROM tenants WHERE is_active = true`);
    for (const t of tenants) {
      try {
        await pg.query(`SET search_path TO "${t.schema_name}"`);
        await pg.query(
          `UPDATE ott_devices
           SET status = 'EXPIRED', qr_code = NULL, qr_session = NULL
           WHERE status = 'AWAITING_SCAN' AND qr_expires_at IS NOT NULL AND qr_expires_at < NOW()`
        );
        await pg.query(`SET search_path TO public`);
      } catch {}
    }
  } catch (err) {
    log("ERROR", `Cleanup: ${err}`);
  }

  const now = Date.now();
  for (const [, conn] of connectionPool) {
    if (now - conn.lastActive > 5 * 60_000) {
      log("WARN", "Pruning idle connection", conn.deviceId, conn.schemaName);
      await stopDeviceClient(conn.schemaName, conn.deviceId);
    }
  }
}

// ── Main Loop ──

let discoveryTimer: NodeJS.Timeout;
let messagePollTimer: NodeJS.Timeout;
let cleanupTimer: NodeJS.Timeout;

async function start(): Promise<void> {
  log("INFO", "══════════════════════════════════════");
  log("INFO", "OTT Worker Daemon starting...");
  log("INFO", `DISCOVERY: ${DISCOVERY_INTERVAL_MS}ms POLL: ${MESSAGE_POLL_INTERVAL_MS}ms CLEANUP: ${CLEANUP_INTERVAL_MS}ms`);
  log("INFO", `RECONNECT_MAX: ${MAX_RECONNECT_ATTEMPTS}`);
  log("INFO", `PLATFORM_TELEGRAM_API_ID: ${PLATFORM_TELEGRAM_API_ID ? "set" : "MISSING"}`);

  if (!PLATFORM_TELEGRAM_API_ID || !PLATFORM_TELEGRAM_API_HASH) {
    log("WARN", "Telegram credentials missing — Telegram devices will fail");
  }

  if (!existsSync(AUTH_DIR)) mkdirSync(AUTH_DIR, { recursive: true });

  try { await getPool().query("SELECT 1"); log("INFO", "DB connection OK"); }
  catch (err) { log("ERROR", `DB failed: ${err}`); process.exit(1); }

  await discoverDevices();
  log("INFO", `Discovery done — ${connectionPool.size} devices`);

  discoveryTimer = setInterval(() => discoverDevices().catch(e => log("ERROR", `discovery: ${e}`)), DISCOVERY_INTERVAL_MS);
  messagePollTimer = setInterval(() => pollPendingMessages().catch(e => log("ERROR", `poll: ${e}`)), MESSAGE_POLL_INTERVAL_MS);
  cleanupTimer = setInterval(() => cleanupLoop().catch(e => log("ERROR", `cleanup: ${e}`)), CLEANUP_INTERVAL_MS);

  log("INFO", "Worker running — Ctrl+C to stop");
}

async function shutdown(signal: string): Promise<void> {
  log("INFO", `${signal} — shutting down...`);
  running = false;
  clearInterval(discoveryTimer);
  clearInterval(messagePollTimer);
  clearInterval(cleanupTimer);

  const devices = Array.from(connectionPool.values());
  log("INFO", `Disconnecting ${devices.length} devices...`);
  for (const conn of devices) {
    try { await stopDeviceClient(conn.schemaName, conn.deviceId); } catch {}
    if (conn.deviceType === "whatsapp") {
      try { await saveWhatsAppSession(conn.schemaName, conn.deviceId); } catch {}
    }
  }

  if (pool) await pool.end();
  log("INFO", "Worker stopped.");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => log("ERROR", `Uncaught: ${err.stack || err.message}`));
process.on("unhandledRejection", (reason) => log("ERROR", `Unhandled: ${reason}`));

start().catch((err) => { console.error("[OTT-WORKER] Fatal:", err); process.exit(1); });
