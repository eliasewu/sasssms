/**
 * Safe response parser for custom API connectors.
 * Handles path extraction (like lodash.get) and simple condition evaluation
 * WITHOUT using eval() or new Function().
 */

/** Safely get a nested value from a JSON object using a dot/bracket path */
function safeGet(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.replace(/\[(\d+|['"][^'"]+['"])\]/g, ".$1").replace(/^\./, "").split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part.replace(/^['"]|['"]$/g, "")];
  }
  return current;
}

export interface ConnectorConfig {
  sendUrlTemplate: string;
  sendMethod: string;
  sendHeaders: string;
  sendBodyTemplate: string;
  sendSuccessCondition: string;
  sendMessageIdPath: string;
  dlrUrlTemplate: string;
  dlrMethod: string;
  dlrSuccessCondition: string;
  dlrStatusPath: string;
  dlrDeliveredValue: string;
}

export interface ParseResult {
  sendUrlTemplate: string;
  sendMethod: string;
  sendHeaders: string;
  sendBodyTemplate: string;
  sendSuccessCondition: string;
  sendMessageIdPath: string;
  dlrUrlTemplate: string;
  dlrMethod: string;
  dlrSuccessCondition: string;
  dlrStatusPath: string;
  dlrDeliveredValue: string;
}

/**
 * Build a URL by replacing {{placeholders}} with values.
 * Supports: {{dst}}, {{message}}, {{sender}}, {{message_id}}, {{apiKey}}
 */
export function buildUrl(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");
}

/**
 * Build a body string by replacing {{placeholders}}.
 */
export function buildBody(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");
}

/**
 * Parse raw header string (e.g. "Content-Type: application/json\nAuthorization: Bearer xxx")
 * into a Record<string, string>.
 */
export function parseHeaders(raw: string): Record<string, string> {
  if (!raw) return {};
  const entries: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      entries[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
    }
  }
  return entries;
}

/**
 * Safely evaluate a success condition like "response.http_code == 200" or "response.info.status == \"Delivered\""
 * against a JSON response object. Supports ==, != operators.
 */
export function evaluateCondition(condition: string, response: Record<string, unknown>): boolean {
  if (!condition || !condition.trim()) return true;

  // Match: response.path.to.field == value  OR  response.path.to.field != value
  const match = condition.match(/^response\.([\w.\[\]'\"]+)\s*(==|!=)\s*(.+)$/);
  if (!match) return false;

  const [, path, operator, rawValue] = match;
  const actual = safeGet(response, path);
  const expected = parseExpectedValue(rawValue.trim());

  if (operator === "==") return actual === expected;
  if (operator === "!=") return actual !== expected;
  return false;
}

function parseExpectedValue(raw: string): unknown {
  // String literals
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  // Numbers
  if (/^-?\d+(\.\d+)?$/.test(raw)) return parseFloat(raw);
  // Booleans
  if (raw === "true") return true;
  if (raw === "false") return false;
  // Null
  if (raw === "null") return null;
  // Default: string
  return raw;
}

/**
 * Extract a value from a JSON response using a path like "info.trans_id" or "response.info.trans_id".
 * Handles "response." prefix gracefully.
 */
export function extractFromResponse(response: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const cleanPath = path.replace(/^response\./, "");
  return safeGet(response, cleanPath);
}

/**
 * AI Auto-Config Parser — extracts connector configuration from raw API docs/code snippets.
 * Handles Python, cURL, and plain URL patterns.
 */
export function parseApiCodeSnippet(rawCode: string): ParseResult {
  const result: ParseResult = {
    sendUrlTemplate: "",
    sendMethod: "GET",
    sendHeaders: "",
    sendBodyTemplate: "",
    sendSuccessCondition: "",
    sendMessageIdPath: "",
    dlrUrlTemplate: "",
    dlrMethod: "GET",
    dlrSuccessCondition: "",
    dlrStatusPath: "",
    dlrDeliveredValue: "Delivered",
  };

  const content = rawCode.trim();

  // ── Extract Send URL ──
  // Pattern: https://... with query params containing {{dst}}, {{message}}, msisdn, code, etc.
  const sendUrlMatch = content.match(/(https?:\/\/[^\s'"]+(?:msisdn|dst|to|destination|phone|number|code|message|text|msg|sender)[^\s'"]*)/i);
  if (sendUrlMatch) {
    let url = sendUrlMatch[1].replace(/\?.*$/, match => match.replace(/(['"])\s*\+\s*(\1)/g, ""));
    // Replace actual parameter values with placeholders
    url = url
      .replace(/([?&]msisdn=)[^&\s'"]+/i, "$1{{dst}}")
      .replace(/([?&]dst=)[^&\s'"]+/i, "$1{{dst}}")
      .replace(/([?&]to=)[^&\s'"]+/i, "$1{{dst}}")
      .replace(/([?&]destination=)[^&\s'"]+/i, "$1{{dst}}")
      .replace(/([?&]phone=)[^&\s'"]+/i, "$1{{dst}}")
      .replace(/([?&]number=)[^&\s'"]+/i, "$1{{dst}}")
      .replace(/([?&]code=)[^&\s'"]+/i, "$1{{message}}")
      .replace(/([?&]message=)[^&\s'"]+/i, "$1{{message}}")
      .replace(/([?&]text=)[^&\s'"]+/i, "$1{{message}}")
      .replace(/([?&]msg=)[^&\s'"]+/i, "$1{{message}}")
      .replace(/([?&]sender=)[^&\s'"]+/i, "$1{{sender}}")
      .replace(/([?&]from=)[^&\s'"]+/i, "$1{{sender}}")
      .replace(/([?&]apiKey=)[^&\s'"]+/i, "$1{{apiKey}}");
    result.sendUrlTemplate = url;
    result.sendMethod = url.includes("{{dst}}") && !content.includes("POST") && !content.includes("body") ? "GET" : "POST";
  }

  // ── Extract DLR URL ──
  // Pattern: URLs with trans_id, message_id, dlr, delivery, check, status
  const dlrUrlMatch = content.match(/(https?:\/\/[^\s'"]+(?:trans_id|message_id|dlr|delivery|check|status|query)[^\s'"]*)/i);
  if (dlrUrlMatch) {
    let url = dlrUrlMatch[1];
    url = url
      .replace(/([?&]trans_id=)[^&\s'"]+/i, "$1{{message_id}}")
      .replace(/([?&]message_id=)[^&\s'"]+/i, "$1{{message_id}}")
      .replace(/([?&]msg_id=)[^&\s'"]+/i, "$1{{message_id}}")
      .replace(/([?&]apiKey=)[^&\s'"]+/i, "$1{{apiKey}}");
    result.dlrUrlTemplate = url;
    result.dlrMethod = "GET";
  }

  // ── Extract response success conditions ──
  const http200Match = content.match(/\b(http_code|status_code|status)\s*==\s*200\b/);
  if (http200Match) result.sendSuccessCondition = `response.${http200Match[1]} == 200`;

  const codeMatch = content.match(/\bcode\s*==\s*200\b/);
  if (codeMatch && !result.sendSuccessCondition) result.sendSuccessCondition = "response.code == 200";

  // ── Extract message_id field ──
  const transIdMatch = content.match(/trans_id|message_id|messageId/i);
  if (transIdMatch) {
    const pathMatch = content.match(/info\s*\[\s*["'](trans_id|message_id)["']\s*\]/);
    if (pathMatch) {
      result.sendMessageIdPath = `info.${pathMatch[1]}`;
    } else if (content.includes("info.trans_id")) {
      result.sendMessageIdPath = "info.trans_id";
    } else if (content.includes("info.message_id")) {
      result.sendMessageIdPath = "info.message_id";
    }
  }

  // ── Extract DLR success condition ──
  if (codeMatch) result.dlrSuccessCondition = "response.code == 200";
  
  const deliveredMatch = content.match(/status.*==\s*["'](\w+)["']/);
  if (deliveredMatch) {
    result.dlrStatusPath = "info.status";
    result.dlrDeliveredValue = deliveredMatch[1];
  } else if (content.includes("Delivered")) {
    result.dlrStatusPath = "info.status";
    result.dlrDeliveredValue = "Delivered";
  }

  // ── Extract headers ──
  const contentTypeMatch = content.match(/Content-Type:\s*(\S+)/i);
  if (contentTypeMatch) {
    result.sendHeaders = `Content-Type: ${contentTypeMatch[1]}`;
  }

  // If method detection found POST indicators, adjust
  if (content.match(/\bPOST\b.*\bjson\b/i) || content.match(/\bPOST\b.*\bdata\b/i)) {
    result.sendMethod = "POST";
    if (!result.sendHeaders) result.sendHeaders = "Content-Type: application/json";
  }

  return result;
}
