// Lightweight local storage for the current ritual session.
// Only stores the user's question, the selected slip from Workflow A,
// and the interpretation from Workflow B.

export interface SelectedSlip {
  image_url?: string;
  // Pass-through; Dify workflow B receives this as qian_data
  [key: string]: unknown;
}

export interface ReadingSection {
  content?: string;
  [key: string]: unknown;
}

export interface InterpretationResult {
  reading?: {
    xiang?: ReadingSection;
    yi?: ReadingSection;
    xing?: ReadingSection;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

const Q_KEY = "oneslip.question.v2";
const SLIP_KEY = "oneslip.slip.v2";
const INTERP_KEY = "oneslip.interpretation.v2";

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
export interface HistoryEntry {
  id: string;
  question: string;
  slip: SelectedSlip;
  createdAt: number;
}
const HIST_KEY = "oneslip.history.v2";

export function loadHistory(): HistoryEntry[] {
  return safeGet<HistoryEntry[]>(HIST_KEY) ?? [];
}
export function pushHistory(entry: HistoryEntry) {
  const list = loadHistory();
  list.unshift(entry);
  safeSet(HIST_KEY, list.slice(0, 100));
}
