/**
 * SMS Translation Engine
 * Applies regex match → replace rules across the full SMPP parameter set:
 *   SENDER (source_addr) / DESTINATION (destination_addr) / BODY (short_message)
 *   plus SRC_TON, DST_TON, SRC_NPI, DST_NPI (numeric SMPP fields).
 *
 * Replacement strings support PCRE-style backreferences (\1, \2, …) which are
 * converted to JS `$1, $2, …` before `String.replace` runs, so rules like:
 *   match `(\d+)\s(\d+)` → replace `\1\2`  ("123 456" → "123456")
 * work as expected.
 */
import { tenantQuery } from "@/lib/tenant-schema";
import { lookupMccMnc } from "@/lib/mcc-lookup";
import { buildRegex, isSafeRegex, convertBackrefs, determineTon, determineNpi, normalizeUnicodeDigits } from "@/lib/regex-utils";

type TargetField = "SENDER" | "DESTINATION" | "BODY" | "SRC_TON" | "DST_TON" | "SRC_NPI" | "DST_NPI";

/** SMPP TON/NPI values carried alongside the three string fields. */
export interface TonNpi {
  srcTon: number;
  srcNpi: number;
  dstTon: number;
  dstNpi: number;
}

interface TranslationProfile {
  id: number;
  name: string;
  targetField: TargetField;
  mode: "FIXED" | "RANDOM";
  matchPattern: string;
  replacementFixed: string | null;
  mcc: string | null;
  mnc: string | null;
  category: string | null;
}

interface PoolItem {
  id: number;
  profileId: number;
  replacementValue: string;
  mccmnc: string | null;
}

interface TranslationResult {
  sender: string;
  destination: string;
  content: string;
  srcTon: number;
  srcNpi: number;
  dstTon: number;
  dstNpi: number;
  appliedProfiles: string[];
}

/**
 * Normalize a user-supplied "parameter" name to a canonical target field.
 * Accepts the SMPP parameter names (src/dst routing, src/dst number,
 * src/dst number ton/npi, sms body) as well as the legacy SENDER/BODY/
 * DESTINATION values already stored in the DB.
 */
export function normalizeTargetField(raw: string): TargetField {
  const f = (raw || "SENDER").toUpperCase().replace(/[\s_\-/]+/g, "");
  switch (f) {
    case "SRCROUTING": case "SRCNUMBER": case "SOURCEADDR": case "SENDER": case "SID": case "FROM":
      return "SENDER";
    case "DSTROUTING": case "DSTNUMBER": case "DESTADDR": case "DESTINATION": case "DESTINATIONADDR": case "TO":
      return "DESTINATION";
    case "SMSBODY": case "BODY": case "SHORTMESSAGE": case "CONTENT": case "MESSAGE":
      return "BODY";
    case "SRCNUMBERTON": case "SRCTON": case "SOURCEADDRTON":
      return "SRC_TON";
    case "DSTNUMBERTON": case "DSTTON": case "DESTADDRTON":
      return "DST_TON";
    case "SRCNUMBERNPI": case "SRCNPI": case "SOURCEADDRNPI":
      return "SRC_NPI";
    case "DSTNUMBERNPI": case "DSTNPI": case "DESTADDRNPI":
      return "DST_NPI";
    default:
      return "SENDER";
  }
}

/**
 * Load active translation profiles assigned to a client or supplier.
 * Filters by MCC/MNC based on the destination number — profiles with
 * mcc/mnc set will only apply to destinations matching that MCC/MNC.
 * Profiles with NULL mcc AND NULL mnc are global (apply to all destinations).
 */
async function loadProfiles(
  schemaName: string,
  entityType: "client" | "supplier",
  entityId: number,
  destination: string,
  includeGlobal: boolean = true
): Promise<TranslationProfile[]> {
  const col = entityType === "client" ? "client_id" : "supplier_id";
  const result = await tenantQuery(
    schemaName,
    includeGlobal
      ? `SELECT tp.* FROM translation_profiles tp
         JOIN translation_assignments ta ON ta.profile_id = tp.id
         WHERE (ta.${col} = $1 OR (ta.client_id IS NULL AND ta.supplier_id IS NULL))
           AND ta.is_active = true AND tp.is_active = true
         ORDER BY ta.priority ASC`
      : `SELECT tp.* FROM translation_profiles tp
         JOIN translation_assignments ta ON ta.profile_id = tp.id
         WHERE ta.${col} = $1
           AND ta.is_active = true AND tp.is_active = true
         ORDER BY ta.priority ASC`,
    [entityId]
  );

  const profiles: TranslationProfile[] = result.rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    name: r.name as string,
    targetField: normalizeTargetField(String(r.target_field || r.targetField || "SENDER")),
    mode: (r.mode || "FIXED") as "FIXED" | "RANDOM",
    matchPattern: (r.match_pattern || r.matchPattern || ".*") as string,
    replacementFixed: (r.replacement_fixed ?? r.replacementFixed ?? null) as string | null,
    mcc: (r.mcc || null) as string | null,
    mnc: (r.mnc || null) as string | null,
    category: (r.category || null) as string | null,
  }));

  const transformationProfiles = profiles.filter(
    p => p.category !== "NUMBER_BLACKLIST" && p.category !== "CONTENT_FILTER"
  );

  if (transformationProfiles.length === 0) return [];

  const hasMccMncProfiles = transformationProfiles.some(p => p.mcc || p.mnc);
  if (!hasMccMncProfiles) return transformationProfiles;

  let destMcc: string | null = null;
  let destMnc: string | null = null;
  try {
    const entry = await lookupMccMnc(destination);
    if (entry && entry.mcc) {
      destMcc = entry.mcc;
      destMnc = entry.mnc || null;
    }
  } catch (err) {
    console.error("[Translation] MCC/MNC lookup failed, applying global rules only:", err);
  }

  const norm = (mnc: string | null): string | null => {
    if (!mnc) return mnc;
    if (mnc === "*") return null;
    return mnc.padStart(3, "0");
  };

  const normalizedDestMnc = norm(destMnc);

  return transformationProfiles.filter(p => {
    if (!p.mcc && !p.mnc) return true;
    const mccMatch = !p.mcc || p.mcc === destMcc;
    const profileMnc = norm(p.mnc);
    const mncMatch = !profileMnc || profileMnc === normalizedDestMnc;
    return mccMatch && mncMatch;
  });
}

async function loadPoolItems(
  schemaName: string,
  profileId: number,
  mccmncFilter?: string | null
): Promise<PoolItem[]> {
  let query: string;
  let params: unknown[];

  if (mccmncFilter) {
    query = `SELECT * FROM translation_pool_items
             WHERE profile_id = $1 AND (mccmnc = $2 OR mccmnc IS NULL)`;
    params = [profileId, mccmncFilter];
  } else {
    query = `SELECT * FROM translation_pool_items WHERE profile_id = $1`;
    params = [profileId];
  }

  const result = await tenantQuery(schemaName, query, params);
  return result.rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    profileId: r.profile_id as number,
    replacementValue: r.replacement_value as string,
    mccmnc: (r.mccmnc || null) as string | null,
  }));
}

interface MessageState {
  sender: string;
  destination: string;
  content: string;
  srcTon: number;
  srcNpi: number;
  dstTon: number;
  dstNpi: number;
}

/**
 * Apply a single translation profile to the message fields.
 */
async function applyProfile(
  schemaName: string,
  profile: TranslationProfile,
  state: MessageState
): Promise<MessageState & { applied: boolean }> {
  const { sender, destination, content, srcTon, srcNpi, dstTon, dstNpi } = state;
  const target = profile.targetField;

  // The input to match is the string form of the selected SMPP field.
  let input: string;
  switch (target) {
    case "SENDER": input = sender; break;
    case "DESTINATION": input = destination; break;
    case "SRC_TON": input = String(srcTon); break;
    case "SRC_NPI": input = String(srcNpi); break;
    case "DST_TON": input = String(dstTon); break;
    case "DST_NPI": input = String(dstNpi); break;
    case "BODY":
    default: input = content; break;
  }

  let regex: RegExp;
  try {
    if (!isSafeRegex(profile.matchPattern || ".*")) {
      console.warn(`Unsafe regex pattern rejected for profile ${profile.name}: ${profile.matchPattern}`);
      return { ...state, applied: false };
    }
    regex = buildRegex(profile.matchPattern || ".*", "m");
  } catch {
    return { ...state, applied: false };
  }

  if (!regex.test(input)) {
    return { ...state, applied: false };
  }

  let replacement: string;

  if (profile.mode === "RANDOM") {
    let mccmncFilter: string | null | undefined = undefined;
    try {
      const entry = await lookupMccMnc(destination);
      if (entry && entry.mcc) {
        mccmncFilter = entry.mcc + (entry.mnc || "").padStart(3, "0");
      }
    } catch { /* skip */ }
    const pool = await loadPoolItems(schemaName, profile.id, mccmncFilter);
    if (pool.length === 0) {
      return { ...state, applied: false };
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    replacement = pick.replacementValue;
  } else {
    replacement = profile.replacementFixed ?? input;
  }

  // ── Number pipeline: replacement_fixed may be a JSON step definition ──
  if (target === "DESTINATION") {
    let pipelineResult = input.replace(/^\+/, "00");
    let pipelineApplied = false;
    try {
      const parsed = JSON.parse(replacement);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.steps)) {
        for (const step of parsed.steps) {
          if (step.type === "stripDigits") {
            const n = parseInt(step.value, 10);
            if (!isNaN(n) && n > 0 && n < pipelineResult.length) {
              pipelineResult = pipelineResult.slice(n);
              pipelineApplied = true;
            }
          } else if (step.type === "removePrefix") {
            const prefix = String(step.value || "");
            if (prefix && pipelineResult.startsWith(prefix)) {
              pipelineResult = pipelineResult.slice(prefix.length);
              pipelineApplied = true;
            }
          } else if (step.type === "addPrefix") {
            const prefix = String(step.value || "");
            if (prefix) {
              pipelineResult = prefix + pipelineResult;
              pipelineApplied = true;
            }
          }
        }
        if (pipelineApplied) {
          return { ...state, destination: pipelineResult, applied: true };
        }
      }
    } catch {
      // Not JSON — fall through to normal regex replacement
    }
  }

  // ── Content (BODY) JSON config: {replacement, otpMinLength, otpMaxLength, customRegex} ──
  let otpMinLength = 4;
  let otpMaxLength = 8;
  let otpCustomRegex = "";
  if (target === "BODY") {
    try {
      const parsed = JSON.parse(replacement);
      if (parsed && typeof parsed === "object" && typeof parsed.replacement === "string") {
        replacement = parsed.replacement;
        if (typeof parsed.otpMinLength === "number") otpMinLength = parsed.otpMinLength;
        if (typeof parsed.otpMaxLength === "number") otpMaxLength = parsed.otpMaxLength;
        if (typeof parsed.customRegex === "string" && parsed.customRegex) otpCustomRegex = parsed.customRegex;
      }
    } catch {
      // Not JSON — treat replacement as a plain template string
    }
  }

  // ── {{OTP}} / {code} rewrite templates ──
  const isRewriteTemplate = replacement.includes("{{OTP}}") || replacement.includes("{code}");

  // Normal replacement — converts \1..\9 → $1..$9 so capture groups are filled.
  let newValue = isRewriteTemplate ? replacement : input.replace(regex, convertBackrefs(replacement));

  if (isRewriteTemplate) {
    let otp: string | null = null;
    if (otpCustomRegex) {
      try {
        const m = content.match(buildRegex(otpCustomRegex));
        if (m) otp = m[1] || m[0];
      } catch { /* invalid custom regex */ }
    }
    if (!otp) {
      const m = content.match(buildRegex("\\b(\\d{" + otpMinLength + "," + otpMaxLength + "})\\b"));
      if (m) otp = m[1] || null;
    }
    if (otp) {
      newValue = newValue.replace(/\{\{OTP\}\}/g, otp);
      newValue = newValue.replace(/\{code\}/g, otp);
    }
  }

  // Write the new value back to the target field.
  switch (target) {
    case "SENDER": return { ...state, sender: newValue, applied: true };
    case "DESTINATION": return { ...state, destination: newValue, applied: true };
    case "SRC_TON": return { ...state, srcTon: parseInt(newValue, 10) || 0, applied: true };
    case "SRC_NPI": return { ...state, srcNpi: parseInt(newValue, 10) || 0, applied: true };
    case "DST_TON": return { ...state, dstTon: parseInt(newValue, 10) || 0, applied: true };
    case "DST_NPI": return { ...state, dstNpi: parseInt(newValue, 10) || 0, applied: true };
    case "BODY":
    default: return { ...state, content: newValue, applied: true };
  }
}

function initialTonNpi(sender: string, destination: string): TonNpi {
  return {
    srcTon: determineTon(sender),
    srcNpi: determineNpi(sender),
    dstTon: determineTon(destination),
    dstNpi: determineNpi(destination),
  };
}

/**
 * Apply all assigned translations for a given entity (client or supplier).
 */
export async function applyEntityTranslations(
  schemaName: string,
  entityType: "client" | "supplier",
  entityId: number,
  sender: string,
  destination: string,
  content: string,
  includeGlobal: boolean = true
): Promise<{
  sender: string;
  destination: string;
  content: string;
  srcTon: number;
  srcNpi: number;
  dstTon: number;
  dstNpi: number;
  appliedNames: string[];
}> {
  // Normalize Unicode digits in the number fields to ASCII (e.g. "٠١٢٣" → "0123")
  // before any matching — SMPP routing and TON/NPI derivation expect ASCII digits.
  const normSender = normalizeUnicodeDigits(sender);
  const normDest = normalizeUnicodeDigits(destination);

  const profiles = await loadProfiles(schemaName, entityType, entityId, normDest, includeGlobal);
  let state: MessageState = {
    sender: normSender,
    destination: normDest,
    content,
    ...initialTonNpi(normSender, normDest),
  };
  const appliedNames: string[] = [];

  for (const profile of profiles) {
    const result = await applyProfile(schemaName, profile, state);
    if (result.applied) {
      state = result;
      appliedNames.push(profile.name);
      console.log(`[Translation] ${entityType} #${entityId}: "${profile.name}" | field=${profile.targetField} | pattern=${profile.matchPattern}`);
    }
  }

  return {
    sender: state.sender,
    destination: state.destination,
    content: state.content,
    srcTon: state.srcTon,
    srcNpi: state.srcNpi,
    dstTon: state.dstTon,
    dstNpi: state.dstNpi,
    appliedNames,
  };
}

/**
 * Full translation pipeline: client-level first, then supplier-level.
 */
export async function applyTranslations(
  schemaName: string,
  clientId: number,
  supplierId: number | null,
  originalSender: string,
  originalDestination: string,
  originalContent: string
): Promise<TranslationResult> {
  const allApplied: string[] = [];

  const clientResult = await applyEntityTranslations(
    schemaName, "client", clientId,
    originalSender, originalDestination, originalContent
  );
  allApplied.push(...clientResult.appliedNames.map(n => `[Client] ${n}`));

  let finalSender = clientResult.sender;
  let finalDest = clientResult.destination;
  let finalContent = clientResult.content;
  let finalSrcTon = clientResult.srcTon;
  let finalSrcNpi = clientResult.srcNpi;
  let finalDstTon = clientResult.dstTon;
  let finalDstNpi = clientResult.dstNpi;

  if (supplierId) {
    const supplierResult = await applyEntityTranslations(
      schemaName, "supplier", supplierId,
      finalSender, finalDest, finalContent,
      false
    );
    finalSender = supplierResult.sender;
    finalDest = supplierResult.destination;
    finalContent = supplierResult.content;
    finalSrcTon = supplierResult.srcTon;
    finalSrcNpi = supplierResult.srcNpi;
    finalDstTon = supplierResult.dstTon;
    finalDstNpi = supplierResult.dstNpi;
    allApplied.push(...supplierResult.appliedNames.map(n => `[Supplier] ${n}`));
  }

  return {
    sender: finalSender,
    destination: finalDest,
    content: finalContent,
    srcTon: finalSrcTon,
    srcNpi: finalSrcNpi,
    dstTon: finalDstTon,
    dstNpi: finalDstNpi,
    appliedProfiles: allApplied,
  };
}

/**
 * Generate a sample preview — non-persisted, for the UI preview endpoint.
 */
export async function generateSample(
  schemaName: string,
  profile: TranslationProfile,
  sampleSender: string,
  sampleDestination: string,
  sampleContent: string
): Promise<{
  original: { sender: string; destination: string; content: string };
  translated: { sender: string; destination: string; content: string };
  applied: boolean;
}> {
  const state: MessageState = {
    sender: sampleSender,
    destination: sampleDestination,
    content: sampleContent,
    ...initialTonNpi(sampleSender, sampleDestination),
  };
  const result = await applyProfile(schemaName, profile, state);
  return {
    original: { sender: sampleSender, destination: sampleDestination, content: sampleContent },
    translated: { sender: result.sender, destination: result.destination, content: result.content },
    applied: result.applied,
  };
}
