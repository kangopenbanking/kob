// Lightweight backend health probe used before opening a support conversation.
// Fast (~1.5s timeout) and side-effect free: a HEAD-like read on a public table.
import { supabase } from '@/integrations/supabase/client';

export type HealthState = 'unknown' | 'checking' | 'healthy' | 'degraded' | 'offline';

export async function checkSupportBackendHealth(timeoutMs = 1500): Promise<{
  state: HealthState;
  latencyMs: number;
  error?: string;
}> {
  const started = performance.now();
  try {
    const probe = supabase
      .from('support_departments')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    const result = await Promise.race([
      probe,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Health probe timed out')), timeoutMs)),
    ]) as any;

    const latencyMs = Math.round(performance.now() - started);
    if (result?.error) {
      return { state: 'degraded', latencyMs, error: result.error.message };
    }
    return { state: latencyMs > 1200 ? 'degraded' : 'healthy', latencyMs };
  } catch (e: any) {
    return {
      state: 'offline',
      latencyMs: Math.round(performance.now() - started),
      error: e?.message || 'Network unavailable',
    };
  }
}
