const ANONYMOUS_USER_KEY = "oneslip.anonymousUserId.v1";

let memoryFallback: string | null = null;

function createAnonymousUserId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `os_${crypto.randomUUID()}`;
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return `os_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }

  return `os_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * Returns a random browser-scoped identifier. It contains no account or
 * device information and stays stable until the visitor clears site data.
 */
export function getAnonymousUserId() {
  if (typeof window === "undefined") return "oneslip-anonymous";

  try {
    const existing = localStorage.getItem(ANONYMOUS_USER_KEY);
    if (existing) return existing;

    const created = createAnonymousUserId();
    localStorage.setItem(ANONYMOUS_USER_KEY, created);
    return created;
  } catch {
    memoryFallback ??= createAnonymousUserId();
    return memoryFallback;
  }
}
