/**
 * Kafka SMS/DLR/ack worker.
 *
 * Consumes the SMS bus topics (sms.mt / sms.dlr / sms.retry) produced by the
 * live app and emits a structured audit stream. This is the foundation the
 * async delivery/DLR processors will be built on at cutover
 * (`SMS_FLOW_MODE=kafka`) — today the live app still delivers synchronously,
 * so this worker does NOT re-deliver (that would double-send). It provides:
 *
 *   1. A single, ordered audit trail of every submit, ACK and DLR (JSONL on
 *      stdout — pipe to your log collector / metrics stack).
 *   2. Dead-letter visibility: sms.retry events are logged with their reason.
 *
 * Run (PM2 / k8s `ott-worker`-style deployment):
 *   KAFKA_BROKERS=kafka:9092 npm run kafka-worker
 *
 * It is a no-op (with a warning) unless KAFKA_BROKERS is set.
 */
import { runSmsConsumer, disconnectKafka, KAFKA_TOPIC } from "@/lib/kafka-bus";

const GROUP_ID = process.env.KAFKA_GROUP_ID || "net2app-sms-worker";

async function main(): Promise<void> {
  await runSmsConsumer(GROUP_ID, async (topic: KAFKA_TOPIC, key, value) => {
    const record = {
      worker: "kafka-sms-worker",
      ts: new Date().toISOString(),
      topic,
      key,
      value,
    };
    if (topic === "sms.mt") {
      const mt = value as { type?: string; messageId?: string; destination?: string; status?: string };
      console.log(`[KAFKA-WORKER] MT ${mt.type || "?"} ${mt.messageId || key} → ${mt.destination || "?"} (${mt.status || "?"})`);
    } else if (topic === "sms.dlr") {
      const dlr = value as { messageId?: string; status?: string; destination?: string };
      console.log(`[KAFKA-WORKER] DLR ${dlr.messageId || key} ${dlr.status || "?"} → ${dlr.destination || "?"}`);
    } else if (topic === "sms.retry") {
      const retry = value as { messageId?: string; destination?: string; reason?: string };
      console.log(`[KAFKA-WORKER] RETRY ${retry.messageId || key} → ${retry.destination || "?"} (${retry.reason || "?"})`);
    }
    // Full JSONL record for downstream systems.
    console.log(`[KAFKA-WORKER] ${JSON.stringify(record)}`);
  });
}

const shutdown = async (signal: string) => {
  console.log(`[KAFKA-WORKER] ${signal} received — disconnecting`);
  await disconnectKafka();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((err) => {
  console.error("[KAFKA-WORKER] fatal:", err);
  process.exit(1);
});
