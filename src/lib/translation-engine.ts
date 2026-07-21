/**
 * SMS Translation Engine
 * Applies SID (sender), BODY (content), and DESTINATION (number) translations
 * in FIXED or RANDOM mode at client-level and supplier-level.
 */
import { tenantQuery } from "@/lib/tenant-schema";

interface TranslationProfile {
  id: number;
  name: string;
  targetField: "SENDER" | "BODY" | "DESTINATION";
  mode: "FIXED" | "RANDOM";
  matchPattern: string;
  replacementFixed: string | null;
}

interface PoolItem {
  id: number;
  profileId: number;
  replacementValue: string;
}

interface TranslationResult {
  sender: string;
  destination: string;
  content: string;
  appliedProfiles: string[];
}

/**
 * Load active translation profiles assigned to a client or supplier.
 */
async function loadProfiles(
  schemaName: string,
  entityType: "client" | "supplier",
  entityId: number
): Promise<TranslationProfile[]> {
  const col = entityType === "client" ? "client_id" : "supplier_id";
  // Also load globally-assigned profiles (those with NULL client_id AND NULL supplier_id)
  const result = await tenantQuery(
    schemaName,
    `SELECT tp.* FROM translation_profiles tp
     JOIN translation_assignments ta ON ta.profile_id = tp.id
     WHERE (ta.${col} = $1 OR (ta.client_id IS NULL AND ta.supplier_id IS NULL))
       AND ta.is_active = true AND tp.is_active = true
     ORDER BY ta.priority ASC`,
    [entityId]
  );
  return result.rows as TranslationProfile[];
}

/**
 * Load random pool items for a profile.
 */
async function loadPoolItems(
  schemaName: string,
  profileId: number
): Promise<PoolItem[]> {
  const result = await tenantQuery(
    schemaName,
    "SELECT * FROM translation_pool_items WHERE profile_id = $1",
    [profileId]
  );
  return result.rows as PoolItem[];
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
    regex = new RegExp(profile.matchPattern || ".*", "gm");
  } catch {
    // Invalid regex, skip this profile
    return { sender, destination, content, applied: false };
  }

  if (!regex.test(input)) {
    return { sender, destination, content, applied: false };
  }

  let replacement: string;

  if (profile.mode === "RANDOM") {
    const pool = await loadPoolItems(schemaName, profile.id);
    if (pool.length === 0) {
      return { sender, destination, content, applied: false };
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    replacement = pick.replacementValue;
  } else {
    // Use ?? instead of || — empty string "" is a valid replacement (e.g., strip prefix)
    replacement = profile.replacementFixed ?? input;
  }

  // Perform the replacement (supports $1, $2 capture groups)
  const newValue = input.replace(regex, replacement);

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
  content: string
): Promise<{ sender: string; destination: string; content: string; appliedNames: string[] }> {
  const profiles = await loadProfiles(schemaName, entityType, entityId);
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

  // Step 2: Supplier-level translations (if supplier assigned)
  let finalSender = clientResult.sender;
  let finalDest = clientResult.destination;
  let finalContent = clientResult.content;

  if (supplierId) {
    const supplierResult = await applyEntityTranslations(
      schemaName, "supplier", supplierId,
      finalSender, finalDest, finalContent
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
