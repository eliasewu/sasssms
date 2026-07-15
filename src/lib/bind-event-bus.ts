import { EventEmitter } from "events";

export interface BindEvent {
  type: "client" | "supplier";
  entityId: number;
  tenantId: number;
  schemaName: string;
  status: "BOUND" | "UNBOUND";
  systemId: string;
  timestamp: string;
}

export class BindEventBus extends EventEmitter {
  constructor() {
    super();
    // Allow unlimited listeners — each SSE client registers one
    this.setMaxListeners(0);
  }

  emitBindEvent(event: BindEvent) {
    this.emit("bind-status-change", event);
  }

  onBindEvent(listener: (event: BindEvent) => void) {
    this.on("bind-status-change", listener);
    return () => this.off("bind-status-change", listener);
  }
}

// Use globalThis to share singleton across Next.js instrumentation and API route entry points
const _global = globalThis as typeof globalThis & { __bindEventBus?: BindEventBus };

/** Singleton event bus for bind status changes across the SMPP server and SSE clients */
export const bindEventBus: BindEventBus = _global.__bindEventBus ??= new BindEventBus();
