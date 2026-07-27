/**
 * SMS Translation Engine
 * Applies SID (sender), BODY (content), and DESTINATION (number) translations
 * in FIXED or RANDOM mode at client-level and supplier-level.
 */
import { tenantQuery } from "@/lib/tenant-schema";
import { batchEnrichMccMnc } from "@/lib/rates";

interface TranslationProfile {
  id: number;
  name: string;
  targetField: "SENDER" | "BODY" | "DESTINATION";
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
  appliedProfiles: string[];
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
  // When includeGlobal=true: load entity-specific + global (NULL/NULL) profiles.
  // When includeGlobal=false: load ONLY entity-specific profiles.
  // This prevents global profiles from being applied TWICE (once at client level
  // and once at supplier level), which would duplicate transformations.
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

  // Map snake_case DB columns to camelCase interface
  const profiles: TranslationProfile[] = result.rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    name: r.name as string,
    targetField: (r.target_field || r.targetField || "SENDER") as "SENDER" | "BODY" | "DESTINATION",
    mode: (r.mode || "FIXED") as "FIXED" | "RANDOM",
    matchPattern: (r.match_pattern || r.matchPattern || ".*") as string,
    replacementFixed: (r.replacement_fixed ?? r.replacementFixed ?? null) as string | null,
    mcc: (r.mcc || null) as string | null,
    mnc: (r.mnc || null) as string | null,
    category: (r.category || null) as string | null,
  }));

  // Exclude blacklist/filter categories — these are not transformations,
  // they are enforced separately as blocking rules.
  const transformationProfiles = profiles.filter(
    p => p.category !== "NUMBER_BLACKLIST" && p.category !== "CONTENT_FILTER"
  );

  // If no profiles remain after filtering, return empty
  if (transformationProfiles.length === 0) return [];

  // If no profiles have MCC/MNC set, return all (global rules only)
  const hasMccMncProfiles = transformationProfiles.some(p => p.mcc || p.mnc);
  if (!hasMccMncProfiles) return transformationProfiles;

  // Resolve destination's MCC/MNC
  let destMcc: string | null = null;
  let destMnc: string | null = null;
  try {
    const enriched = await batchEnrichMccMnc([destination]);
    const entry = enriched.get(destination);
    if (entry) {
      destMcc = entry.mcc;
      destMnc = entry.mnc || null;
    }
  } catch (err) {
    console.error("[Translation] MCC/MNC lookup failed, applying global rules only:", err);
  }

  // Normalize MNC to 3 digits for comparison (profiles may have 2-digit MNC,
  // while batchEnrichMccMnc returns 3-digit from mcc_mnc_database).
  // Wildcard "*" means "any MNC for this MCC".
  const norm = (mnc: string | null): string | null => {
    if (!mnc) return mnc;
    if (mnc === "*") return null; // wildcard → treated as "match all" below
    return mnc.padStart(3, "0");
  };

  const normalizedDestMnc = norm(destMnc);

  // Filter: keep profiles that match the destination's MCC/MNC, OR are global
  return transformationProfiles.filter(p => {
    // Global profile — applies to all destinations
    if (!p.mcc && !p.mnc) return true;
    // MCC must match (or be null = match all MCCs)
    const mccMatch = !p.mcc || p.mcc === destMcc;
    // MNC must match after normalizing both sides to 3 digits
    const profileMnc = norm(p.mnc);
    const mncMatch = !profileMnc || profileMnc === normalizedDestMnc;
    return mccMatch && mncMatch;
  });
}

/**
 * Load random pool items for a profile, optionally filtered by MCC/MNC.
 * If mccmncFilter is provided, only items with a matching mccmnc tag
 * or items with NULL mccmnc (global SIDs) are returned.
 */
async function loadPoolItems(
  schemaName: string,
  profileId: number,
  mccmncFilter?: string | null
): Promise<PoolItem[]> {
  let query: string;
  let params: unknown[];
  
  if (mccmncFilter) {
    // Return items tagged with this specific MCC/MNC OR global items (null mccmnc)
    query = `SELECT * FROM translation_pool_items 
             WHERE profile_id = $1 AND (mccmnc = $2 OR mccmnc IS NULL)`;
    params = [profileId, mccmncFilter];
  } else {
    query = `SELECT * FROM translation_pool_items WHERE profile_id = $1`;
    params = [profileId];
  }
  
  const result = await tenantQuery(schemaName, query, params);
  // Map snake_case DB columns to camelCase interface
  return result.rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    profileId: r.profile_id as number,
    replacementValue: r.replacement_value as string,
    mccmnc: (r.mccmnc || null) as string | null,
  }));
}

/**
 * Apply a single translation profile to the message fields.
 * Returns the (possibly) modified sender, destination, content.
 */

/**
 * Check if a regex pattern is safe (no exponential backtracking risk).
 * Rejects patterns with nested quantifiers like (a+)+b
 */
function isSafeRegex(pattern: string): boolean {
  if (!pattern || pattern.trim() === "") return false;
  const nestedQuantifier = /\([^)]*[+*{][^)]*\)[+*{]/;
  if (nestedQuantifier.test(pattern)) return false;
  return true;
}

async function applyProfile(
  schemaName: string,
  profile: TranslationProfile,
  sender: string,
  destination: string,
  content: string
): Promise<{ sender: string; destination: string; content: string; applied: boolean }> {
  const target = profile.targetField;
  const input = target === "SENDER" ? sender : target === "DESTINATION" ? destination : content;

  let regex: RegExp;
  try {
    // Safety check before creating regex
    if (!isSafeRegex(profile.matchPattern || ".*")) {
      console.warn(`Unsafe regex pattern rejected for profile ${profile.name}: ${profile.matchPattern}`);
      return { sender, destination, content, applied: false };
    }
    regex = new RegExp(profile.matchPattern || ".*", "m");
  } catch {
    // Invalid regex, skip this profile
    return { sender, destination, content, applied: false };
  }

  if (!regex.test(input)) {
    return { sender, destination, content, applied: false };
  }

  let replacement: string;

  if (profile.mode === "RANDOM") {
    // Derive mccmnc filter from destination for per-MCC/MNC pool item selection
    let mccmncFilter: string | null | undefined = undefined;
    try {
      const enriched = await batchEnrichMccMnc([destination]);
      const entry = enriched.get(destination);
      if (entry) {
        mccmncFilter = entry.mcc + (entry.mnc || "").padStart(3, "0");
      }
    } catch { /* skip — use all pool items */ }
    const pool = await loadPoolItems(schemaName, profile.id, mccmncFilter);
    if (pool.length === 0) {
      return { sender, destination, content, applied: false };
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    replacement = pick.replacementValue;
  } else {
    // Use ?? instead of || — empty string "" is a valid replacement (e.g., strip prefix)
    replacement = profile.replacementFixed ?? input;
  }

  // ── Number Pipeline: check if replacement_fixed is a JSON step definition ──
  if (target === "DESTINATION") {
    let pipelineResult = input;
    let pipelineApplied = false;
    try {
      const parsed = JSON.parse(replacement);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.steps)) {
        // Apply the 3-step pipeline in order: stripDigits → removePrefix → addPrefix
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
          return { sender, destination: pipelineResult, content, applied: true };
        }
      }
    } catch {
      // Not JSON — fall through to normal regex replacement
    }
  }

  // Normal replacement (supports $1, $2 capture groups)
  let newValue = input.replace(regex, replacement);

  // ── {{OTP}} / {code} placeholder replacement ──
  // If the template/replacement contains {{OTP}} or {code},
  // extract OTP digits from the original content and substitute
  // them into the result so the final message has the real OTP.
  if (newValue.includes("{{OTP}}") || newValue.includes("{code}")) {
    const otpMatch = content.match(/\b(\d{4,8})\b/);
    if (otpMatch && otpMatch[1]) {
      newValue = newValue.replace(/\{\{OTP\}\}/g, otpMatch[1]);
      newValue = newValue.replace(/\{code\}/g, otpMatch[1]);
    }
  }

  switch (target) {
    case "SENDER":
      return { sender: newValue, destination, content, applied: true };
    case "DESTINATION":
      return { sender, destination: newValue, content, applied: true };
    case "BODY":
      return { sender, destination, content: newValue, applied: true };
    default:
      return { sender, destination, content, applied: false };
  }
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
): Promise<{ sender: string; destination: string; content: string; appliedNames: string[] }> {
  const profiles = await loadProfiles(schemaName, entityType, entityId, destination, includeGlobal);
  let currentSender = sender;
  let currentDest = destination;
  let currentContent = content;
  const appliedNames: string[] = [];

  for (const profile of profiles) {
    const result = await applyProfile(
      schemaName,
      profile,
      currentSender,
      currentDest,
      currentContent
    );
    if (result.applied) {
      currentSender = result.sender;
      currentDest = result.destination;
      currentContent = result.content;
      appliedNames.push(profile.name);
      console.log(`[Translation] ${entityType} #${entityId}: "${profile.name}" | field=${profile.targetField} | pattern=${profile.matchPattern} | dest: ${currentDest} → ${result.destination}`);
    }
  }

  return { sender: currentSender, destination: currentDest, content: currentContent, appliedNames };
}

/**
 * Full translation pipeline: client-level first, then supplier-level.
 * Stores original values in the result for logging.
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

  // Step 1: Client-level translations
  const clientResult = await applyEntityTranslations(
    schemaName, "client", clientId,
    originalSender, originalDestination, originalContent
  );
  allApplied.push(...clientResult.appliedNames.map(n => `[Client] ${n}`));

  // Step 2: Supplier-level translations (if supplier assigned).
  // Pass includeGlobal=false so global profiles don't run again (they already
  // ran at client-level above).
  let finalSender = clientResult.sender;
  let finalDest = clientResult.destination;
  let finalContent = clientResult.content;

  if (supplierId) {
    const supplierResult = await applyEntityTranslations(
      schemaName, "supplier", supplierId,
      finalSender, finalDest, finalContent,
      false // includeGlobal = false — already applied at client level
    );
    finalSender = supplierResult.sender;
    finalDest = supplierResult.destination;
    finalContent = supplierResult.content;
    allApplied.push(...supplierResult.appliedNames.map(n => `[Supplier] ${n}`));
  }

  return {
    sender: finalSender,
    destination: finalDest,
    content: finalContent,
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
  const result = await applyProfile(
    schemaName, profile,
    sampleSender, sampleDestination, sampleContent
  );
  return {
    original: { sender: sampleSender, destination: sampleDestination, content: sampleContent },
    translated: { sender: result.sender, destination: result.destination, content: result.content },
    applied: result.applied,
  };
}
