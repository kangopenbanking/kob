// Persistent anonymous guest identity & preferences for Live Support.
// The guest_id is treated as an opaque session secret stored in localStorage.
const KEY = 'kob_support_guest_id';
const DEPT_KEY = 'kob_support_last_department';

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

/** Persist the last selected department so guests don't need to reselect on every visit. */
export interface PersistedDepartment {
  id: string;
  name: string;
  icon?: string;
  description?: string;
}

export function getPersistedDepartment(): PersistedDepartment | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(DEPT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') return parsed;
  } catch { /* ignore */ }
  return undefined;
}

export function setPersistedDepartment(dept: PersistedDepartment | undefined) {
  if (typeof window === 'undefined') return;
  try {
    if (!dept) localStorage.removeItem(DEPT_KEY);
    else localStorage.setItem(DEPT_KEY, JSON.stringify({
      id: dept.id, name: dept.name, icon: dept.icon, description: dept.description,
    }));
  } catch { /* ignore */ }
}

