// Wave 5C — Helper to enqueue failed bank operations into the retry queue.
// Used by bank-data-poller and bank-data-router on transient failures.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export interface EnqueueRetryOptions {
  bank_id: string;
  config_id?: string | null;
  operation: string;
  payload: Record<string, unknown>;
  error_message: string;
  max_attempts?: number;
  correlation_id?: string;
}

const BASE_BACKOFF_SECONDS = 60;
const MAX_BACKOFF_SECONDS = 3600;

export function computeBackoff(attempt: number): number {
  return Math.min(BASE_BACKOFF_SECONDS * Math.pow(2, attempt), MAX_BACKOFF_SECONDS);
}

/**
 * Enqueue a failed operation for later replay. Idempotent on (bank_id, operation, correlation_id).
 */
export async function enqueueRetry(
  admin: SupabaseClient,
  opts: EnqueueRetryOptions,
): Promise<{ id: string | null; error?: string }> {
  const { data, error } = await admin
    .from('bank_retry_queue')
    .insert({
      bank_id: opts.bank_id,
      config_id: opts.config_id ?? null,
      operation: opts.operation,
      payload: opts.payload,
      status: 'pending',
      attempt_count: 0,
      max_attempts: opts.max_attempts ?? 5,
      next_attempt_at: new Date(Date.now() + BASE_BACKOFF_SECONDS * 1000).toISOString(),
      last_error: opts.error_message.slice(0, 500),
      correlation_id: opts.correlation_id ?? null,
    })
    .select('id')
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data?.id ?? null };
}
