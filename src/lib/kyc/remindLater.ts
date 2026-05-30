/**
 * Lightweight client-side "remind me later" scheduler for the KYC banner.
 * Stores a snooze-until timestamp in localStorage so it survives reloads,
 * and (best-effort) fires an in-app reminder via the Notification API
 * + a window event the banner can listen to.
 */

const STORAGE_KEY = "kyc-banner-snooze-until";
const EVENT_NAME = "kyc-remind-later";

export interface SnoozeOption {
  id: string;
  label: string;
  /** Duration in milliseconds. */
  ms: number;
}

export const SNOOZE_OPTIONS: SnoozeOption[] = [
  { id: "1h", label: "In 1 hour", ms: 60 * 60 * 1000 },
  { id: "4h", label: "In 4 hours", ms: 4 * 60 * 60 * 1000 },
  { id: "tomorrow", label: "Tomorrow", ms: 24 * 60 * 60 * 1000 },
  { id: "week", label: "Next week", ms: 7 * 24 * 60 * 60 * 1000 },
];

export function getSnoozeUntil(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return null;
    return n;
  } catch {
    return null;
  }
}

export function isSnoozed(): boolean {
  const until = getSnoozeUntil();
  return !!until && until > Date.now();
}

let activeTimer: ReturnType<typeof setTimeout> | null = null;

function fireReminder() {
  try {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("Identity verification reminder", {
        body: "You asked to be reminded to verify your identity. Tap to continue.",
        icon: "/icons/icon-192.png",
        tag: "kyc-remind-later",
      });
    }
  } catch {
    /* notification API not available */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    /* no-op */
  }
}

export function scheduleSnooze(durationMs: number) {
  const until = Date.now() + durationMs;
  try {
    localStorage.setItem(STORAGE_KEY, String(until));
  } catch {
    /* storage blocked */
  }
  if (activeTimer) clearTimeout(activeTimer);
  // Best-effort foreground reminder. Cap setTimeout to ~24 days to be safe.
  const delay = Math.min(durationMs, 24 * 24 * 60 * 60 * 1000);
  activeTimer = setTimeout(fireReminder, delay);

  // Ask for Notification permission opportunistically (non-blocking).
  try {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission().catch(() => undefined);
    }
  } catch {
    /* ignore */
  }
}

export function clearSnooze() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
}

export function onRemindLaterFired(handler: () => void): () => void {
  const fn = () => handler();
  window.addEventListener(EVENT_NAME, fn);
  return () => window.removeEventListener(EVENT_NAME, fn);
}

export const KYC_REMIND_LATER_EVENT = EVENT_NAME;
