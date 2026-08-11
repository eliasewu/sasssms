/**
 * Canonical Tenant Guide FAQ — single source of truth for the Net2APP
 * tenant-guide questions shown on the landing page, pricing page and all
 * feature pages. Answers are sourced from the Tenant User Guide (Guide.docx)
 * and the platform flashcard set (flashcards.csv).
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const TENANT_FAQS: FaqItem[] = [
  {
    q: "What is Net2APP and how does it work?",
    a: "Net2APP is a multi-tenant CPaaS (Communications Platform as a Service) that lets you deploy your own SMS gateway in under 60 seconds. It includes SMPP v3.4, HTTP SMS API, Voice OTP, RCS, WhatsApp, and Telegram — all with zero setup fees and pay-as-you-go pricing. Each tenant gets an isolated PostgreSQL schema for complete data privacy.",
  },
  {
    q: "Is a credit card required to start the Net2APP free trial?",
    a: "No. All plans include a free trial period and no credit card is required. Sign up, get your account created instantly on the free Starter plan, and receive 100 free SMS credits to test the platform.",
  },
  {
    q: "How do I top up my balance and which payment methods are accepted?",
    a: "Billing is primarily handled through cryptocurrency — including USDT, BTC, and BNB. Go to the Billing page, enter the amount, and upload a screenshot or payment slip of the transaction. A super admin then reviews and approves the payment to update the balance. The minimum top-up on the Starter plan is $25.",
  },
  {
    q: "How do I connect SMS suppliers to Net2APP?",
    a: "Go to Suppliers → All Suppliers and click '+ Add Supplier'. For SMPP suppliers, enter the name, host, port, username, and password, then configure the bind type (Transceiver, Transmitter, Receiver, or TX+RX). SMPP v3.4 is recommended as the default. For HTTP API suppliers, enter the API URL and API key instead of host/port credentials. After adding, check the Bind Status page to confirm the connection shows as BOUND.",
  },
  {
    q: "What does the Bind Status page monitor?",
    a: "Bind Status monitors the connection state between the platform and the supplier gateway. A functional SMPP connection displays as 'BOUND' — typically with a Transceiver status. For Ejoin/Sk gateways, save and reboot after setting the SMPP credentials to finalize the connection.",
  },
  {
    q: "How does SMS routing work — Trunks, Routes, and Route Plans?",
    a: "Net2APP uses a 4-layer routing hierarchy: Suppliers are linked to Trunks (which set capacity limits — the maximum concurrent SMS — and MCC allow/deny lists for geographic filtering). Trunks are assigned to Routes, which define country codes, prefixes, and priority (lower numbers = higher priority). Routes are grouped into Route Plans (Default Plan, SIM OTP, SIM Marketing) for load balancing and automatic failover, and each plan is assigned to a client under Clients → Edit Client → Route Plan.",
  },
  {
    q: "What happens if the Priority 1 route fails?",
    a: "The system automatically attempts delivery via the next highest-priority fallback route. Because Route Plans group multiple routes — potentially from different trunks and suppliers — delivery automatically fails over to the next available path, ensuring high reliability.",
  },
  {
    q: "How is profit calculated within the Net2APP platform?",
    a: "Profit is the difference between the rate charged to the client (Client Rates) and the cost paid to the supplier (Supplier Rates) for each destination. Rates are set per operator using MCC/MNC (Mobile Country Code / Mobile Network Code), and only one rate can be active per destination — adding a new rate automatically deactivates the old one.",
  },
  {
    q: "What does the Force DLR option do for clients?",
    a: "When Force DLR is enabled for a client, the system marks messages as delivered immediately without waiting for supplier delivery receipts. For real delivery verification, check the SMS Logs on the Messages page.",
  },
  {
    q: "What is required for WhatsApp and Telegram OTT Connect?",
    a: "A proxy is mandatory for WhatsApp and Telegram OTT connections to function. Once the API and credential information is updated, the connector works automatically as part of the Advanced Connectors suite.",
  },
  {
    q: "Can I translate sender IDs, numbers, and message content?",
    a: "Yes. SID Translation uses regex patterns to match and replace incoming sender IDs (with a Quick Test box to preview transformations). Number Translation strips leading digits and adds prefixes — for example, stripping 2 digits from '00880' and adding prefix '77' produces '77880'. Content Translation extracts OTP codes (default 4–8 digits, or a custom regex) and fills them into templates using the {{OTP}} placeholder. Rules are assigned by dragging clients/suppliers into a rule's scope, and lower priority numbers run first.",
  },
  {
    q: "How do I set rates for all operators in a country at once?",
    a: "Use Bulk Rate Management (or Bulk Import) under Rates. Instead of entering rates operator-by-operator, Bulk Import adds all operators for an entire country at once — significantly reducing setup time for large-scale operations.",
  },
  {
    q: "Where can I find help and support?",
    a: "The Knowledge Base for common Net2APP questions is located at net2app.com/resources. For direct assistance, create a support ticket via Settings → Support Tickets — tickets are private, and including your tenant name and relevant message IDs speeds up resolution.",
  },
];

/** Pick tenant-guide FAQs by index (1-based for readability). */
export function pickFaqs(...indexes: number[]): FaqItem[] {
  return indexes.map((i) => TENANT_FAQS[i - 1]).filter(Boolean);
}

/** Convert FAQ items to schema.org FAQPage mainEntity entries. */
export function faqSchema(faqs: FaqItem[]): Array<{
  "@type": "Question";
  name: string;
  acceptedAnswer: { "@type": "Answer"; text: string };
}> {
  return faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  }));
}
