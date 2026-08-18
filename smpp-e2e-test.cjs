const smpp = require("smpp");
const HOST = process.argv[2];
const PORT = parseInt(process.argv[3]);
const USER = process.argv[4];
const PASS = process.argv[5];
const DST = process.argv[6] || "8801712345678";
const SRC = process.argv[7] || "Net2APP";

const sess = smpp.connect({ host: HOST, port: PORT, auto_enquire_link_period: 30000 });
let bound = false;
let gotAck = false;
let gotDlr = false;

const log = (...a) => console.log(new Date().toISOString(), ...a);

sess.on("connect", () => {
  log("TCP connected");
  sess.bind_transceiver({ system_id: USER, password: PASS, system_type: "ESME", interface_version: 0x34 }, (pdu) => {
    log("BIND RESP status=0x" + pdu.command_status.toString(16), "smsc_id=" + (pdu.system_id || ""));
    if (pdu.command_status !== 0) { log("BIND REJECTED"); process.exit(1); }
    bound = true;
    log("BOUND OK — sending submit_sm to", DST);
    sess.send(new smpp.PDU("submit_sm", {
      source_addr_ton: 5, source_addr_npi: 0, source_addr: SRC,
      dest_addr_ton: 1, dest_addr_npi: 1, destination_addr: DST,
      short_message: { message: "Net2APP SMPP/DLR flow test " + Date.now() },
      registered_delivery: 1, data_coding: 0,
    }), (resp) => {
      gotAck = true;
      log("SUBMIT_SM RESP status=0x" + resp.command_status.toString(16), "message_id=" + (resp.message_id || "(empty)"));
      if (resp.command_status !== 0) { log("SUBMIT REJECTED — no DLR will follow"); }
    });
  });
});

sess.on("enquire_link", (pdu) => { log("RECEIVED enquire_link, responding"); try { sess.send(pdu.response()); } catch {} });
sess.on("enquire_link_resp", () => log("enquire_link_resp (our keepalive answered)"));
sess.on("deliver_sm", (pdu) => {
  gotDlr = true;
  const text = typeof pdu.short_message === "string" ? pdu.short_message : (pdu.short_message && pdu.short_message.message) || "";
  log("DELIVER_SM (DLR):", text);
  try { sess.send(pdu.response({ message_id: "" })); } catch {}
});
sess.on("submit_sm", (pdu) => log("unexpected submit_sm received:", pdu.destination_addr));
sess.on("close", () => { log("CONNECTION CLOSED"); process.exit(0); });
sess.on("error", (e) => log("SOCKET ERROR:", e.message));

setTimeout(() => {
  log("=== SUMMARY ===", "bound:", bound, "gotAck:", gotAck, "gotDlr:", gotDlr);
  process.exit(0);
}, 45000);
