/**
 * Shared audit trail helper.
 *
 * Writes an `audit_logs` row using the service-role client so RLS doesn't
 * block legitimate system events. Always non-fatal — never throws, never
 * blocks the financial path that called it.
 *
 * Standing Order 4 (Surgeon Rule): additive only — does not modify any
 * existing audit_logs writers.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export type AuditEvent = {
  action_type: string;
  entity_type: string;
  entity_id: string;
  performed_by?: string | null;
  details?: Record<string, unknown>;
};

let serviceClient: ReturnType<typeof createClient> | null = null;
function getServiceClient() {
  if (serviceClient) return serviceClient;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  serviceClient = createClient(url, key, { auth: { persistSession: false } });
  return serviceClient;
}

export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const supabase = getServiceClient();
    if (!supabase) {
      console.warn('[audit-trail] service client unavailable; skipping');
      return;
    }
    const { error } = await supabase.from('audit_logs').insert({
      action_type: event.action_type,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      performed_by: event.performed_by ?? null,
      details: event.details ?? {},
    });
    if (error) console.warn('[audit-trail] insert failed:', error.message);
  } catch (err) {
    console.warn('[audit-trail] unexpected error:', err);
  }
}
