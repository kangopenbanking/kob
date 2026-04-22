// Ad-hoc client-side rate limiting for Live Support.
// The backend has no general rate-limit primitives yet (see project policy),
// so we lean on a SECURITY DEFINER function `support_check_rate_limit` that
// returns { allowed, remaining, retry_after_seconds }.
import { supabase } from '@/integrations/supabase/client';

export type SupportAction = 'create_conversation' | 'send_message';

const DEFAULTS: Record<SupportAction, { perMinute: number; perHour: number }> = {
  create_conversation: { perMinute: 2, perHour: 10 },
  send_message: { perMinute: 20, perHour: 200 },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  reason?: string;
}

export async function checkSupportRateLimit(
  identity: string | undefined,
  action: SupportAction,
): Promise<RateLimitResult> {
  if (!identity) return { allowed: true, remaining: 999, retryAfterSeconds: 0 };
  const limits = DEFAULTS[action];
  try {
    const { data, error } = await supabase.rpc('support_check_rate_limit' as any, {
      p_identity: identity,
      p_action: action,
      p_max_per_minute: limits.perMinute,
      p_max_per_hour: limits.perHour,
    });
    if (error) {
      console.warn('[support.rateLimit] RPC error, failing open:', error);
      return { allowed: true, remaining: limits.perMinute, retryAfterSeconds: 0 };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      allowed: !!row?.allowed,
      remaining: Number(row?.remaining ?? 0),
      retryAfterSeconds: Number(row?.retry_after_seconds ?? 0),
      reason: row?.allowed ? undefined : `Too many ${action.replace('_', ' ')} attempts.`,
    };
  } catch (e) {
    console.warn('[support.rateLimit] failing open:', e);
    return { allowed: true, remaining: limits.perMinute, retryAfterSeconds: 0 };
  }
}
