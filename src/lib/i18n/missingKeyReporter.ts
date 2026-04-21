import { supabase } from '@/integrations/supabase/client';

/**
 * Runtime missing-key telemetry.
 * - Buffers reports client-side (de-duped per session)
 * - Flushes via RPC every 5s in batches
 * - Silently degrades if RPC unavailable
 */

const seenThisSession = new Set<string>();
let queue: { key: string; language: string; route: string; component?: string }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function reportMissingKey(
  key: string,
  language: string,
  component?: string,
): void {
  const route = typeof window !== 'undefined' ? window.location.pathname : '';
  const dedup = `${key}|${language}|${route}`;
  if (seenThisSession.has(dedup)) return;
  seenThisSession.add(dedup);

  queue.push({ key, language, route, component });
  if (timer) return;
  timer = setTimeout(flush, 5000);
}

async function flush() {
  timer = null;
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    await Promise.all(
      batch.map((b) =>
        supabase.rpc('report_missing_i18n_key', {
          p_key: b.key,
          p_language: b.language,
          p_route: b.route,
          p_component: b.component ?? null,
        }),
      ),
    );
  } catch {
    /* swallow — telemetry must never break the app */
  }
}
