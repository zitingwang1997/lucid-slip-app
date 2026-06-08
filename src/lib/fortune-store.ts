// Lightweight local storage for the current ritual session.

export interface SelectedSlip {
  id?: number;
  number?: string;
  realm?: string;
  title?: string;
  poem?: string;
  keywords?: string;
  allusion?: string;
  image_url?: string;
  [key: string]: unknown;
}

export interface InterpretationResult {
  slip?: SelectedSlip;
  xiang_title?: string;
  xiang_content?: string;
  yi_title?: string;
  yi_content?: string;
  xing_title?: string;
  xing_content?: string;
  disclaimer?: string;
  [key: string]: unknown;
}

const Q_KEY = "oneslip.question.v2";
const SLIP_KEY = "oneslip.slip.v2";
const INTERP_KEY = "oneslip.interpretation.v2";
const CUR_HIST_KEY = "oneslip.currentHistoryId.v1";

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function setUserQuestion(q: string) {
  safeSet(Q_KEY, q);
}
export function getUserQuestion(): string {
  return safeGet<string>(Q_KEY) ?? "";
}

export function setSelectedSlip(slip: SelectedSlip) {
  safeSet(SLIP_KEY, slip);
}
export function getSelectedSlip(): SelectedSlip | null {
  return safeGet<SelectedSlip>(SLIP_KEY);
}

export function setInterpretation(result: InterpretationResult) {
  safeSet(INTERP_KEY, result);
}
export function getInterpretation(): InterpretationResult | null {
  return safeGet<InterpretationResult>(INTERP_KEY);
}

export function clearRitualSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SLIP_KEY);
  localStorage.removeItem(INTERP_KEY);
}

// ----- History (心庙) -----
export interface SavedKit {
  key: string;
  label: string;
  kit_title?: string;
  kit_subtitle?: string;
  kit_content?: string;
  kit_action?: string;
  disclaimer?: string;
  savedAt: number;
}

export interface HistoryEntry {
  id: string;
  question: string;
  /** Normalized intent summary derived from the question. */
  intent?: string;
  /** Coarse category (e.g. relationship, career, health, decision, other). */
  category?: string;
  slip: SelectedSlip;
  interpretation?: InterpretationResult;
  savedKits?: Record<string, SavedKit>;
  createdAt: number;
}

function isSameLocalDay(a: number, b: number) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function getTodayHistory(now: number = Date.now()): HistoryEntry[] {
  return loadHistory().filter((e) => isSameLocalDay(e.createdAt, now));
}

const HIST_KEY = "oneslip.history.v2";
const HIST_MIGRATION_KEY = "oneslip.history.migrated.v4";

/** One-time dev migration: clear old history entries that lack interpretation / savedKits.
 *  Runs only once per browser; future entries are preserved. */
export function runHistoryMigration() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(HIST_MIGRATION_KEY)) return;
    localStorage.removeItem(HIST_KEY);
    localStorage.setItem(HIST_MIGRATION_KEY, "true");
  } catch {}
}

export function loadHistory(): HistoryEntry[] {
  return safeGet<HistoryEntry[]>(HIST_KEY) ?? [];
}
export const getHistory = loadHistory;

export function pushHistory(entry: HistoryEntry) {
  const list = loadHistory();
  list.unshift(entry);
  safeSet(HIST_KEY, list.slice(0, 100));
}

export function getHistoryEntry(entryId: string): HistoryEntry | null {
  return loadHistory().find((e) => e.id === entryId) ?? null;
}

export function updateHistoryEntry(entryId: string, patch: Partial<HistoryEntry>) {
  const list = loadHistory();
  const idx = list.findIndex((e) => e.id === entryId);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...patch };
  safeSet(HIST_KEY, list);
}

export function saveKitToHistory(entryId: string, kitKey: string, kit: SavedKit) {
  const list = loadHistory();
  const idx = list.findIndex((e) => e.id === entryId);
  if (idx === -1) return;
  const existing = list[idx].savedKits ?? {};
  if (existing[kitKey]) return; // do not overwrite
  list[idx] = {
    ...list[idx],
    savedKits: { ...existing, [kitKey]: kit },
  };
  safeSet(HIST_KEY, list);
}

// ----- Current history id -----
export function setCurrentHistoryId(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUR_HIST_KEY, id);
  } catch {}
}
export function getCurrentHistoryId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CUR_HIST_KEY);
  } catch {
    return null;
  }
}
export function clearCurrentHistoryId() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CUR_HIST_KEY);
  } catch {}
}

export function restoreHistoryEntry(entryId: string): HistoryEntry | null {
  const entry = getHistoryEntry(entryId);
  if (!entry) return null;
  setUserQuestion(entry.question);
  setSelectedSlip(entry.slip);
  if (entry.interpretation) setInterpretation(entry.interpretation);
  setCurrentHistoryId(entry.id);
  return entry;
}
