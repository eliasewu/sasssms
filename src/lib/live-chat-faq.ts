/**
 * Live-chat FAQ auto-reply.
 *
 * Reads a small Q&A CSV (question,answer — plus flashcard-style rows like
 * "Term: X,Definition: Y", "Concept: X,Definition: Y", "Process: X,Step: Y")
 * and answers tenant live-chat messages whose significant words overlap a
 * question. Pure string matching — no external deps, no network.
 *
 * CSV path is configurable via FAQ_CSV_PATH (default /home/ubuntu/flashcards.csv).
 */
import { readFileSync, statSync, existsSync } from "fs";

export interface FaqEntry {
  question: string;
  answer: string;
}

const DEFAULT_PATH = "/home/ubuntu/flashcards.csv";

// ── Minimal CSV line parser (handles quoted fields + escaped quotes) ──
function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cols.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  cols.push(cur);
  return cols.map((c) => c.trim());
}

// Flashcard-style rows carry a label prefix on both columns.
function normalizeQuestion(raw: string): string {
  let q = raw.trim();
  for (const prefix of ["Term:", "Concept:", "Process:"]) {
    if (q.toLowerCase().startsWith(prefix.toLowerCase())) {
      q = q.slice(prefix.length).trim();
      break;
    }
  }
  // Trailing fill-in-the-blank marker e.g. "Monthly cost of the Professional plan: _____."
  q = q.replace(/:?\s*_{3,}\.?$/i, "").replace(/\s*\.$/, "").trim();
  return q;
}

function normalizeAnswer(raw: string): string {
  let a = raw.trim();
  for (const prefix of ["Definition:", "Step:"]) {
    if (a.toLowerCase().startsWith(prefix.toLowerCase())) {
      a = a.slice(prefix.length).trim();
      break;
    }
  }
  return a.trim();
}

// ── Caching (reload only when the file changes) ──
let cache: { mtimeMs: number; entries: FaqEntry[] } | null = null;

export function loadFaqEntries(): FaqEntry[] {
  const path = process.env.FAQ_CSV_PATH || DEFAULT_PATH;
  if (!existsSync(path)) return [];
  const mtimeMs = statSync(path).mtimeMs;
  if (cache && cache.mtimeMs === mtimeMs) return cache.entries;

  const raw = readFileSync(path, "utf-8");
  const entries: FaqEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (cols.length < 2) continue;
    const question = normalizeQuestion(cols[0]);
    const answer = normalizeAnswer(cols.slice(1).join(","));
    if (!question || !answer) continue;
    entries.push({ question, answer });
  }
  cache = { mtimeMs, entries };
  return entries;
}

// ── Matching ──
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "am",
  "to", "of", "in", "on", "at", "for", "with", "and", "or", "but", "if", "then",
  "so", "as", "it", "its", "this", "that", "these", "those", "you", "your",
  "yours", "i", "me", "my", "mine", "we", "our", "ours", "us", "he", "she",
  "they", "them", "his", "her", "their", "do", "does", "did", "doing", "have",
  "has", "had", "having", "will", "would", "can", "could", "should", "shall",
  "may", "might", "must", "what", "which", "who", "whom", "whose", "when",
  "where", "why", "how", "not", "no", "nor", "there", "here", "all", "any",
  "some", "each", "every", "other", "another", "more", "most", "such", "only",
  "own", "same", "too", "very", "just", "also", "into", "upon", "within",
  "without", "about", "between", "through", "during", "before", "after",
  "above", "below", "from", "under", "over", "off", "again", "than", "then",
]);

/** Very light stemming so "monthly"↔"month", "credits"↔"credit" etc. match. */
function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("ing")) return w.slice(0, -3);
  if (w.endsWith("ed")) return w.slice(0, -2);
  if (w.endsWith("ly")) return w.slice(0, -2);
  if (w.endsWith("es")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function significantStems(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
}

/**
 * Return the best-matching FAQ answer for a chat message, or null when no
 * entry matches confidently (≥2 shared significant stems, or a fully-covered
 * short term/definition).
 */
export function findFaqAnswer(message: string): string | null {
  if (!message) return null;
  const entries = loadFaqEntries();
  if (entries.length === 0) return null;

  const msgStems = new Set(significantStems(message));
  if (msgStems.size === 0) return null;

  let best: { entry: FaqEntry; hits: number; coverage: number } | null = null;
  for (const entry of entries) {
    const qStems = significantStems(entry.question);
    if (qStems.length === 0) continue;
    let hits = 0;
    for (const q of qStems) if (msgStems.has(q)) hits++;
    if (hits === 0) continue;
    const coverage = hits / qStems.length;
    if (!best || hits > best.hits || (hits === best.hits && coverage > best.coverage)) {
      best = { entry, hits, coverage };
    }
  }

  if (!best) return null;
  if (best.hits >= 2) return best.entry.answer;
  if (best.hits >= 1 && best.coverage >= 0.5) return best.entry.answer;
  return null;
}
