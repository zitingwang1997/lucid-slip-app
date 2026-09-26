import { getAnonymousUserId } from "@/lib/anonymous-user";

const CLARITY_PROJECT_ID = "yo843bi0qn";
const CLARITY_SCRIPT_MARKER = "data-oneslip-clarity";

type ClarityArguments = unknown[];
type ClarityFunction = ((...args: ClarityArguments) => void) & {
  q?: ClarityArguments[];
};

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

declare global {
  interface Window {
    clarity?: ClarityFunction;
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  }

  interface Navigator {
    connection?: NetworkInformationLike;
  }
}

let initializationScheduled = false;
let scriptRequested = false;

function isEnabled() {
  return import.meta.env.PROD && typeof window !== "undefined";
}

function ensureClarityQueue() {
  if (!isEnabled()) return;
  if (typeof window.clarity === "function") return;

  const queue: ClarityArguments[] = [];
  const clarityQueue = ((...args: ClarityArguments) => {
    queue.push(args);
  }) as ClarityFunction;
  clarityQueue.q = queue;
  window.clarity = clarityQueue;
}

function shouldSkipForConstrainedNetwork() {
  const connection = navigator.connection;
  return Boolean(
    connection?.saveData ||
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g",
  );
}

function loadClarityScript() {
  if (!isEnabled() || scriptRequested || shouldSkipForConstrainedNetwork()) return;
  scriptRequested = true;

  try {
    if (document.querySelector(`script[${CLARITY_SCRIPT_MARKER}]`)) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
    script.setAttribute(CLARITY_SCRIPT_MARKER, "true");
    script.onerror = () => {
      // Analytics must never affect the ritual when the tracking host is slow
      // or unavailable. Do not retry during the current page lifetime.
    };
    document.head.appendChild(script);
  } catch {
    // Fail open: Clarity is optional and must not affect product behavior.
  }
}

function scheduleIdleLoad() {
  if (shouldSkipForConstrainedNetwork()) return;

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(loadClarityScript, { timeout: 4_000 });
    return;
  }

  window.setTimeout(loadClarityScript, 2_000);
}

/** Schedule Clarity only after the page has fully loaded and the browser is idle. */
export function initializeClarity() {
  if (!isEnabled() || initializationScheduled) return;
  initializationScheduled = true;
  ensureClarityQueue();

  if (document.readyState === "complete") {
    scheduleIdleLoad();
    return;
  }

  window.addEventListener("load", scheduleIdleLoad, { once: true });
}

/** Associate Clarity with the same anonymous browser ID already used by Dify. */
export function identifyClarityUser() {
  if (!isEnabled()) return;
  try {
    ensureClarityQueue();
    window.clarity?.("identify", getAnonymousUserId());
  } catch {
    // Identification is optional and must never interrupt the app.
  }
}

/** Queue a content-free behavioral event. Invalid names are ignored. */
export function trackClarityEvent(name: string) {
  if (!isEnabled() || !/^[a-z0-9_]{1,80}$/.test(name)) return;
  try {
    ensureClarityQueue();
    window.clarity?.("event", name);
  } catch {
    // Tracking is optional and must never interrupt the app.
  }
}
