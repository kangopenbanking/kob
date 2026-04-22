// Persistent anonymous guest identity for Live Support.
// The guest_id is treated as an opaque session secret stored in localStorage.
const KEY = 'kob_support_guest_id';

export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() ?? `g_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `g_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}
