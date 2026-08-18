/**
 * Net2APP Kafka SMS/DLR/ack bus.
 *
 * Kafka is the platform's message bus for the SMS flow, DLR flow and ACK flow
 * (see k8s/kafka-statefulset.yaml + NET2APP_KUBERNETES_MIGRATION.md):
 *
 *   sms.mt    — outbound submit (submit_sm) + submit_sm_resp ACK events.
 *               Producer: smpp-server / HTTP send API. Consumer: delivery
 *               workers (and the audit/retry worker today).
 *   sms.dlr   — delivery receipts (DELIVERED / FAILED / UNDELIV ...).
 *               Producer: delivery path (SMPP client + server deliver_sm).
 *               Consumer: DLR processor → messages table + webhooks.
 *   sms.retry — failed / timed-out sends for the retry worker.
 *
 * IMPORTANT — this bus is OPT-IN and never blocks the live SMS path:
 *   - It is disabled unless `KAFKA_BROKERS` (comma-separated) is set.
 *   - Every publish is fire-and-forget; a Kafka outage is logged once and the
 *     SMS/DLR/ack processing continues synchronously exactly as before. Kafka
 *     is an additional buffering/observability layer, not a hard dependency,
 *     until the platform flips to `SMS_FLOW_MODE=kafka` on the cutover.
 */
import { Kafka, Producer, Consumer, logLevel as KafkaLogLevel, CompressionTypes } from "kafkajs";

export const KAFKA_TOPICS = {
  MT: "sms.mt",
  DLR: "sms.dlr",
  RETRY: "sms.retry",
} as const;

export type KAFKA_TOPIC = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

/** Outbound submit_sm + submit_sm_resp ACK. One record per submit, one per ACK. */
export interface MtEvent {
  type: "submit" | "ack";
  ts: string;
  tenantId: number;
  schemaName: string;
  clientId?: number;
  messageId: string;
  supplierMessageId?: string;
  supplierId?: number;
  routeId?: number;
  trunkId?: number;
  source: string;
  destination: string;
  connectionType?: string;
  status: "SENT" | "FAILED" | "REJECTED" | "QUEUED";
  /** ack events only: SMPP command_status sent back to the ESME (0 = OK). */
  commandStatus?: number;
  errorMessage?: string;
}

/** Delivery receipt from a supplier/gateway. */
export interface DlrEvent {
  ts: string;
  tenantId: number;
  schemaName: string;
  clientId?: number;
  supplierId?: number;
  messageId: string;          // our internal message_id
  supplierMessageId: string;  // modem/supplier-assigned message_id
  status: string;             // raw stat: DELIVRD / UNDELIV / EXPIRED ...
  dlrStatus: string;          // normalized: DELIVERED / FAILED / ...
  destination: string;
  source: string;
}

/** Failed / timed-out send queued for the retry worker. */
export interface RetryEvent {
  ts: string;
  tenantId: number;
  schemaName: string;
  clientId?: number;
  messageId: string;
  supplierId?: number;
  routeId?: number;
  source: string;
  destination: string;
  content: string;
  attempts: number;
  reason: string;
}

// ── Lazy, opt-in connection state ──────────────────────────────────────────
const BROKERS = (process.env.KAFKA_BROKERS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_STARTUP_FAILURES = 5;

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let producerPromise: Promise<Producer | null> | null = null;
let disabled = BROKERS.length === 0;
let startupFailures = 0;
let warned = false;

const warnOnce = (msg: string) => {
  if (!warned) {
    warned = true;
    console.warn(msg);
  }
};

/** Whether Kafka is configured and not yet disabled by repeated failures. */
export function kafkaConfigured(): boolean {
  return !disabled && BROKERS.length > 0;
}

export function kafkaBrokers(): string[] {
  return BROKERS;
}

function getKafka(): Kafka {
  if (!kafka) {
    kafka = new Kafka({
      clientId: `net2app-${process.env.HOSTNAME || "node"}`,
      brokers: BROKERS,
      logLevel: KafkaLogLevel.WARN,
      retry: { initialRetryTime: 200, retries: 3 },
      connectionTimeout: 3000,
    });
  }
  return kafka;
}

async function getProducer(): Promise<Producer | null> {
  if (disabled || BROKERS.length === 0) return null;
  if (producer) return producer;
  if (!producerPromise) {
    producerPromise = (async () => {
      const p = getKafka().producer({
        allowAutoTopicCreation: true,
        idempotent: false, // fire-and-forget event bus — idempotence would add latency
      });
      await p.connect();
      return p;
    })().catch((err) => {
      startupFailures++;
      console.error(`[KAFKA] Producer connect failed (${startupFailures}/${MAX_STARTUP_FAILURES}):`, (err as Error).message);
      if (startupFailures >= MAX_STARTUP_FAILURES) {
        disabled = true;
        console.error("[KAFKA] Disabling Kafka bus after repeated connection failures — SMS flow continues synchronously.");
      }
      producerPromise = null;
      return null;
    });
  }
  return producerPromise;
}

/**
 * Fire-and-forget publish. Never throws and never blocks the caller; a failure
 * is logged (rate-limited) and the event is dropped for this publish attempt.
 */
async function publish(topic: KAFKA_TOPIC, key: string, value: unknown): Promise<void> {
  if (!kafkaConfigured()) return;
  try {
    const p = await getProducer();
    if (!p) return;
    await p.send({
      topic,
      compression: CompressionTypes.GZIP,
      messages: [{ key, value: JSON.stringify(value) }],
    });
    // Reset the one-shot warning on a successful send.
    warned = false;
  } catch (err) {
    warnOnce(`[KAFKA] Publish to ${topic} failed (SMS flow continues synchronously): ${(err as Error).message}`);
  }
}

export function publishMt(event: MtEvent): void {
  void publish(KAFKA_TOPICS.MT, event.messageId, event);
}

export function publishDlr(event: DlrEvent): void {
  void publish(KAFKA_TOPICS.DLR, event.messageId, event);
}

export function publishRetry(event: RetryEvent): void {
  void publish(KAFKA_TOPICS.RETRY, event.messageId, event);
}

/** Shortcut: submit + its ACK in one call (two records on sms.mt). */
export function publishMtSubmitAndAck(
  submit: MtEvent,
  commandStatus: number
): void {
  publishMt(submit);
  publishMt({ ...submit, type: "ack", commandStatus, ts: new Date().toISOString() });
}

/** Connect/ensure topics + start a consumer group (used by the worker). */
export async function ensureTopics(topics: string[] = Object.values(KAFKA_TOPICS)): Promise<void> {
  if (!kafkaConfigured()) return;
  const admin = getKafka().admin();
  try {
    await admin.connect();
    const existing = await admin.listTopics();
    const missing = topics.filter((t) => !existing.includes(t));
    if (missing.length > 0) {
      await admin.createTopics({
        topics: missing.map((t) => ({
          topic: t,
          numPartitions: 6,
          replicationFactor: 3,
        })),
      });
      console.log(`[KAFKA] Created topics: ${missing.join(", ")}`);
    }
  } finally {
    await admin.disconnect().catch(() => {});
  }
}

export interface ConsumerHandler {
  (topic: KAFKA_TOPIC, key: string | null, value: unknown): Promise<void>;
}

/**
 * Run a consumer group over the SMS/DLR/retry topics. Intended for the
 * standalone `src/workers/kafka-sms-worker.ts` process.
 */
export async function runSmsConsumer(groupId: string, handler: ConsumerHandler): Promise<void> {
  if (!kafkaConfigured()) {
    console.warn("[KAFKA] KAFKA_BROKERS not set — consumer not started.");
    return;
  }
  await ensureTopics();
  const consumer: Consumer = getKafka().consumer({ groupId });
  const topics = Object.values(KAFKA_TOPICS) as string[];

  await consumer.connect();
  await Promise.all(topics.map((t) => consumer.subscribe({ topic: t, fromBeginning: false })));
  console.log(`[KAFKA] Consumer group ${groupId} subscribed to ${topics.join(", ")}`);

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      let value: unknown = null;
      try {
        value = JSON.parse(message.value?.toString() || "null");
      } catch {
        value = message.value?.toString() || null;
      }
      await handler(topic as KAFKA_TOPIC, message.key?.toString() || null, value);
    },
  });
}

/** Graceful shutdown for producer + consumer (worker process exit). */
export async function disconnectKafka(): Promise<void> {
  try {
    if (producer) await producer.disconnect();
  } catch {}
  producer = null;
  producerPromise = null;
}
