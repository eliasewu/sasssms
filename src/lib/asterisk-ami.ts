/**
 * Asterisk AMI (Asterisk Manager Interface) Executor
 * 
 * Real call origination via Asterisk Manager Interface.
 * Connects to localhost:5038, authenticates, issues Originate actions,
 * and listens for call events (ANSWER, HANGUP, etc.).
 * 
 * Protocol: https://docs.asterisk.org/Configuration/AMI/
 */

import net from "net";
import type { AudioPlaylistItem } from "./voice-otp-engine";

// ── Types ──

export interface AmiConfig {
  host: string;
  port: number;
  username: string;
  secret: string;
}

export interface OriginateResult {
  success: boolean;
  callSid: string;
  duration: number;
  status: "ANSWERED" | "NO_ANSWER" | "BUSY" | "FAILED";
  errorMessage?: string;
  uniqueId?: string;
  channel?: string;
}

type AmiResponseHandler = (response: AmiMessage) => void;
type AmiEventHandler = (event: AmiMessage) => void;

interface AmiMessage {
  [key: string]: string;
}

// ── AMI Client ──

export class AsteriskAmiClient {
  private host: string;
  private port: number;
  private username: string;
  private secret: string;
  private socket: net.Socket | null = null;
  private buffer = "";
  private responseHandlers: Map<string, AmiResponseHandler> = new Map();
  private eventHandlers: Map<string, AmiEventHandler[]> = new Map();
  private loggedIn = false;
  private reconnectDelay = 2000;
  private destroyed = false;

  constructor(config: AmiConfig) {
    this.host = config.host;
    this.port = config.port;
    this.username = config.username;
    this.secret = config.secret;
  }

  /**
   * Connect to AMI and login.
   */
  async connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed && this.loggedIn) {
      return; // Already connected
    }

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({ host: this.host, port: this.port }, () => {
        // AMI sends a banner on connect — wait for it then login
      });

      this.socket.on("data", (data: Buffer) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.socket.on("error", (err: Error) => {
        if (!this.loggedIn) {
          reject(err);
        }
      });

      this.socket.on("close", () => {
        this.loggedIn = false;
        if (!this.destroyed) {
          // Auto-reconnect
          setTimeout(() => this.connect().catch(() => {}), this.reconnectDelay);
        }
      });

      // After initial connect, send login
      this.login()
        .then(() => resolve())
        .catch(reject);
    });
  }

  /**
   * Login to AMI.
   */
  private async login(): Promise<void> {
    const actionId = `login_${Date.now()}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responseHandlers.delete(actionId);
        reject(new Error("AMI login timeout"));
      }, 10000);

      this.responseHandlers.set(actionId, (msg: AmiMessage) => {
        clearTimeout(timeout);
        if (msg.Response === "Success") {
          this.loggedIn = true;
          resolve();
        } else {
          reject(new Error(`AMI login failed: ${msg.Message || "Unknown"}`));
        }
      });

      this.sendRaw(
        `Action: Login\r\nUsername: ${this.username}\r\nSecret: ${this.secret}\r\nActionID: ${actionId}\r\n\r\n`
      );
    });
  }

  /**
   * Process the incoming data buffer, extracting complete AMI messages.
   */
  private processBuffer(): void {
    while (this.buffer.includes("\r\n\r\n")) {
      const idx = this.buffer.indexOf("\r\n\r\n");
      const raw = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 4);

      const message = parseAmiMessage(raw);

      // Route to response handler
      if (message.Response) {
        const actionId = message.ActionID || "";
        const handler = this.responseHandlers.get(actionId);
        if (handler) {
          handler(message);
          return;
        }
        // If it's a follow-up Response like "Goodbye", ignore
        if (message.Response === "Goodbye") return;
      }

      // Route to event handlers
      if (message.Event) {
        const handlers = this.eventHandlers.get(message.Event) || [];
        for (const h of handlers) {
          h(message);
        }
      }
    }
  }

  /**
   * Register a one-time handler for an event.
   */
  once(eventName: string, handler: AmiEventHandler): void {
    const wrapped: AmiEventHandler = (msg) => {
      // Remove self after firing
      const handlers = this.eventHandlers.get(eventName) || [];
      const idx = handlers.indexOf(wrapped);
      if (idx >= 0) handlers.splice(idx, 1);
      handler(msg);
    };
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName)!.push(wrapped);
  }

  /**
   * Send an AMI action and wait for the response.
   */
  private async sendAction(
    action: string,
    params: Record<string, string>,
    timeoutMs = 15000
  ): Promise<AmiMessage> {
    const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responseHandlers.delete(actionId);
        reject(new Error(`AMI action '${action}' timed out`));
      }, timeoutMs);

      this.responseHandlers.set(actionId, (msg: AmiMessage) => {
        clearTimeout(timeout);
        resolve(msg);
      });

      let raw = `Action: ${action}\r\nActionID: ${actionId}\r\n`;
      for (const [key, value] of Object.entries(params)) {
        raw += `${key}: ${value}\r\n`;
      }
      raw += "\r\n";
      this.sendRaw(raw);
    });
  }

  /**
   * Originate a call via AMI.
   * Sends an Originate action and waits for events to determine call result.
   */
  async originate(params: {
    channel: string;
    callerId: string;
    timeout: number;
    application?: string;
    data?: string;
    variable?: Record<string, string>;
  }): Promise<OriginateResult> {
    if (!this.loggedIn) {
      return {
        success: false,
        callSid: "N/A",
        duration: 0,
        status: "FAILED",
        errorMessage: "AMI not connected",
      };
    }

    const startTime = Date.now();
    const origParams: Record<string, string> = {
      Channel: params.channel,
      CallerID: params.callerId,
      Timeout: String(params.timeout * 1000), // milliseconds
      Application: params.application || "Wait",
      Data: params.data || "1",
      Async: "true",
    };

    // Set custom variables
    if (params.variable) {
      const vars = Object.entries(params.variable)
        .map(([k, v]) => `${k}=${v}`)
        .join(",");
      origParams.Variable = vars;
    }

    // Set up event listeners before sending Originate
    let callResult: OriginateResult = {
      success: false,
      callSid: "N/A",
      duration: 0,
      status: "FAILED",
      errorMessage: "No response",
    };

    let settled = false;
    let settleResolve: ((result: OriginateResult) => void) | null = null;
    const resolveOnce = (result: OriginateResult) => {
      if (settled) return;
      settled = true;
      if (settleResolve) settleResolve(result);
    };

    const settle = new Promise<OriginateResult>((resolve) => {
      settleResolve = resolve;
      // Listen for OriginateResponse event
      this.once("OriginateResponse", (event: AmiMessage) => {
        callResult.callSid = event.Uniqueid || "N/A";
        callResult.channel = event.Channel;

        if (event.Response === "Failure") {
          callResult.success = false;
          callResult.status = "FAILED";
          callResult.errorMessage = event.Reason || "Originate failed";
          resolveOnce(callResult);
        }
      });

      // Listen for DialBegin (call is ringing)
      const dialEndTimeout = setTimeout(() => {
        callResult.success = false;
        callResult.status = "NO_ANSWER";
        callResult.errorMessage = "Call timeout — no answer";
        callResult.duration = Math.floor((Date.now() - startTime) / 1000);
        resolveOnce(callResult);
      }, params.timeout * 1000 + 5000);

      // Fallback for Hangup: if Hangup doesn't arrive in 60s, resolve anyway
      let hangupFallbackTimeout: NodeJS.Timeout | null = null;

      // Listen for DialEnd to capture answer status
      this.once("DialEnd", (event: AmiMessage) => {
        clearTimeout(dialEndTimeout);
        const dialStatus = event.DialStatus || "";

        if (dialStatus === "ANSWER") {
          // Wait for Hangup to get duration
          this.once("Hangup", (hangupEvent: AmiMessage) => {
            clearTimeout(hangupFallbackTimeout!);
            callResult.success = true;
            callResult.status = "ANSWERED";
            callResult.duration = Math.floor((Date.now() - startTime) / 1000);
            const billsec = parseInt(hangupEvent["BilableSeconds"] || hangupEvent["BillableSeconds"] || "0");
            if (billsec > 0) callResult.duration = billsec;
            resolveOnce(callResult);
          });

          // Fallback: if Hangup doesn't arrive in 60s, resolve anyway
          hangupFallbackTimeout = setTimeout(() => {
            resolveOnce({
              success: true,
              callSid: callResult.callSid || "N/A",
              duration: Math.floor((Date.now() - startTime) / 1000),
              status: "ANSWERED",
            });
          }, 60000);
        } else if (dialStatus === "BUSY") {
          resolveOnce({ success: false, callSid: callResult.callSid || "N/A", duration: 0, status: "BUSY", errorMessage: "Line busy" });
        } else if (dialStatus === "CHANUNAVAIL") {
          resolveOnce({ success: false, callSid: callResult.callSid || "N/A", duration: 0, status: "FAILED", errorMessage: "Channel unavailable" });
        } else if (dialStatus === "CONGESTION") {
          resolveOnce({ success: false, callSid: callResult.callSid || "N/A", duration: 0, status: "FAILED", errorMessage: "Congestion" });
        } else {
          resolveOnce({ success: false, callSid: callResult.callSid || "N/A", duration: 0, status: "FAILED", errorMessage: `Dial failed: ${dialStatus}` });
        }
      });
    });

    // Send the Originate action
    const origResponse = await this.sendAction("Originate", origParams, params.timeout * 1000 + 10000);

    if (origResponse.Response === "Error") {
      return {
        success: false,
        callSid: "N/A",
        duration: 0,
        status: "FAILED",
        errorMessage: origResponse.Message || "Originate error",
      };
    }

    // If OriginateResponse event already settled, return immediately
    if (callResult.status !== "FAILED" || callResult.errorMessage !== "No response") {
      return callResult;
    }

    return settle;
  }

  /**
   * Send raw data over the AMI socket.
   */
  private sendRaw(data: string): void {
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(data);
    }
  }

  /**
   * Close the AMI connection.
   */
  async disconnect(): Promise<void> {
    this.destroyed = true;
    return new Promise((resolve) => {
      if (this.socket && !this.socket.destroyed) {
        this.sendRaw("Action: Logoff\r\n\r\n");
        this.socket.once("close", () => resolve());
        setTimeout(() => {
          if (this.socket && !this.socket.destroyed) {
            this.socket.destroy();
          }
          resolve();
        }, 2000);
      } else {
        resolve();
      }
    });
  }
}

// ── AMI Message Parser ──

function parseAmiMessage(raw: string): AmiMessage {
  const msg: AmiMessage = {};
  const lines = raw.split("\r\n");
  let key = "";
  for (const line of lines) {
    if (line.includes(": ")) {
      const colonIdx = line.indexOf(": ");
      key = line.slice(0, colonIdx);
      let value = line.slice(colonIdx + 2);
      // Trim trailing spaces
      value = value.replace(/\s+$/, "");
      msg[key] = value;
    } else if (key && line.startsWith(" ")) {
      // Multi-line value continuation
      msg[key] += "\n" + line.trim();
    }
  }
  return msg;
}

// ── Asterisk AMI Executor (implements SipCallExecutor) ──

import type { SipCallExecutor } from "./voice-otp-engine";

export class AsteriskAmiExecutor implements SipCallExecutor {
  private defaultAmiConfig: AmiConfig;
  private localClient: AsteriskAmiClient | null = null;
  private localConnectionPromise: Promise<void> | null = null;

  constructor(defaultAmiConfig?: Partial<AmiConfig>) {
    this.defaultAmiConfig = {
      host: defaultAmiConfig?.host || process.env.ASTERISK_AMI_HOST || "127.0.0.1",
      port: defaultAmiConfig?.port || parseInt(process.env.ASTERISK_AMI_PORT || "5038"),
      username: defaultAmiConfig?.username || process.env.ASTERISK_AMI_USER || "net2app",
      secret: defaultAmiConfig?.secret || process.env.ASTERISK_AMI_SECRET || "Telco1988",
    };
  }

  /**
   * Get or create the local AMI client (fallback when no tenant SIP config).
   */
  private async getLocalClient(): Promise<AsteriskAmiClient> {
    if (this.localClient && this.localConnectionPromise) {
      await this.localConnectionPromise;
      return this.localClient;
    }
    this.localClient = new AsteriskAmiClient(this.defaultAmiConfig);
    this.localConnectionPromise = this.localClient.connect();
    await this.localConnectionPromise;
    return this.localClient;
  }

  /**
   * Originate a voice OTP call via Asterisk AMI.
   * If tenant has their own SIP server configured, connects to that server's AMI.
   * Otherwise falls back to the local Asterisk AMI.
   */
  async originateCall(params: {
    destination: string;
    callerId: string;
    sipHost: string;
    sipPort: number;
    sipUsername: string;
    sipPassword: string;
    timeout: number;
    audioPlaylist: AudioPlaylistItem[];
  }): Promise<{
    success: boolean;
    callSid: string;
    duration: number;
    status: "ANSWERED" | "NO_ANSWER" | "BUSY" | "FAILED";
    errorMessage?: string;
  }> {
    let ami: AsteriskAmiClient | null = null;

    try {
      // If tenant has their own SIP server, connect to their AMI
      if (params.sipHost && params.sipHost !== "127.0.0.1" && params.sipHost !== "localhost") {
        const tenantAmiConfig: AmiConfig = {
          host: params.sipHost,
          port: params.sipPort || 5038,
          username: params.sipUsername || "admin",
          secret: params.sipPassword || "",
        };
        ami = new AsteriskAmiClient(tenantAmiConfig);
        await ami.connect();
      } else {
        // Fall back to local Asterisk AMI
        ami = await this.getLocalClient();
      }

      const channel = buildChannel(params);

      const result = await ami.originate({
        channel,
        callerId: params.callerId,
        timeout: params.timeout,
        application: "Wait",
        data: "1",
        variable: {
          VOTP_DEST: params.destination,
          VOTP_LANG: "en",
        },
      });

      return {
        success: result.success,
        callSid: result.callSid || result.uniqueId || "N/A",
        duration: result.duration,
        status: result.status,
        errorMessage: result.errorMessage,
      };
    } catch (err: unknown) {
      return {
        success: false,
        callSid: "N/A",
        duration: 0,
        status: "FAILED",
        errorMessage: (err as Error).message || "AMI connection failed",
      };
    } finally {
      // Disconnect tenant AMI connections (but keep local one alive)
      if (ami && params.sipHost && params.sipHost !== "127.0.0.1" && params.sipHost !== "localhost") {
        await ami.disconnect().catch(() => {});
      }
    }
  }
}

/**
 * Build the Asterisk channel string for call origination.
 * Uses Local/<number>@default — tenant must have an outbound route
 * in their Asterisk's [default] extensions.conf context.
 */
function buildChannel(params: { destination: string }): string {
  const number = params.destination.replace(/[^0-9+]/g, "");
  return `Local/${number}@default`;
}
