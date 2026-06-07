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
