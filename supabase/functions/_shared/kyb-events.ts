// Shared helper to emit KYB lifecycle events to both the gateway webhook
// queue (per-merchant outbound webhooks) and the system event_outbox
// (internal subscribers). Failures are swallowed so they never block the
// primary KYB transaction — the cron worker will retry deliveries.

export type KybEventType =
  | 'merchant.kyb.submitted'
  | 'merchant.kyb.under_review'
  | 'merchant.kyb.approved'
  | 'merchant.kyb.rejected';

export interface KybEventInput {
  event_type: KybEventType;
  merchant_id: string;
  business_name?: string | null;
  actor_id?: string | null;
  reason?: string | null;
  extra?: Record<string, unknown>;
}

export async function emitKybEvent(supabase: any, input: KybEventInput): Promise<void> {
  const payload = {
    event_type: input.event_type,
    merchant_id: input.merchant_id,
    business_name: input.business_name ?? null,
    actor_id: input.actor_id ?? null,
    reason: input.reason ?? null,
    occurred_at: new Date().toISOString(),
    ...(input.extra || {}),
  };

  // 1. Outbound webhook events (per-merchant subscribers)
  try {
    await supabase.from('gateway_webhook_events').insert({
      merchant_id: input.merchant_id,
      event_type: input.event_type,
      payload,
      status: 'pending',
      next_retry_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[kyb-events] gateway_webhook_events insert failed', e);
  }

  // 2. Internal event_outbox (downstream system subscribers)
  try {
    await supabase.from('event_outbox').insert({
      event_type: input.event_type,
      payload,
      status: 'pending',
      correlation_id: input.merchant_id,
    });
  } catch (e) {
    console.error('[kyb-events] event_outbox insert failed', e);
  }
}

// ─── Document validation (server-side MIME + size guard) ───
export const ALLOWED_DOC_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];
export const MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_DOC_COUNT = 20;

export interface DocValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateKybDocuments(documents: unknown): DocValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(documents) || documents.length === 0) {
    return { ok: false, errors: ['documents must be a non-empty array'] };
  }
  if (documents.length > MAX_DOC_COUNT) {
    errors.push(`too many documents (max ${MAX_DOC_COUNT})`);
  }
  documents.forEach((d: any, i: number) => {
    if (!d || typeof d !== 'object') {
      errors.push(`documents[${i}]: must be an object`);
      return;
    }
    const type = d.type || d.document_type;
    const url = d.url || d.file_url;
    const mime = (d.mime_type || d.content_type || '').toString().toLowerCase();
    const size = Number(d.size_bytes ?? d.size ?? 0);
    if (!type) errors.push(`documents[${i}]: type is required`);
    if (!url || typeof url !== 'string') errors.push(`documents[${i}]: url is required`);
    if (!mime) {
      errors.push(`documents[${i}]: mime_type is required`);
    } else if (!ALLOWED_DOC_MIMES.includes(mime)) {
      errors.push(`documents[${i}]: mime_type '${mime}' not allowed (allowed: ${ALLOWED_DOC_MIMES.join(', ')})`);
    }
    if (!Number.isFinite(size) || size <= 0) {
      errors.push(`documents[${i}]: size_bytes is required and must be > 0`);
    } else if (size > MAX_DOC_SIZE_BYTES) {
      errors.push(`documents[${i}]: size ${size} exceeds max ${MAX_DOC_SIZE_BYTES} bytes (10MB)`);
    }
  });
  return { ok: errors.length === 0, errors };
}
