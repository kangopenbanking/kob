/**
 * QR telemetry — fire-and-forget logger for scan/parse/payment events.
 * Writes to public.qr_telemetry_events. Never throws to caller.
 *
 * Standard error codes (keep in sync with docs/portal/qr-payload-formats.md):
 *   QR_PARSE_INVALID_JSON     — raw value was not JSON and not a bare account
 *   QR_PARSE_UNKNOWN_TYPE     — JSON parsed but `type` not recognized
 *   QR_PARSE_MISSING_FIELDS   — known type but required fields absent
 *   QR_SCAN_CAMERA_DENIED     — getUserMedia rejected
 *   QR_SCAN_NO_CAMERA         — no camera device
 *   QR_PAY_INVALID_AMOUNT     — user-entered amount is <= 0 or NaN
 *   QR_PAY_EDGE_ERROR         — pos-qr-payment returned an error
 *   QR_PAY_RETRY              — user retried after a failure
 *   QR_PAY_SUCCESS            — payment OK (status=success)
 *   QR_SCAN_SUCCESS           — scan parsed OK (status=success)
 */
import { supabase } from '@/integrations/supabase/client';

export type QrEventType = 'scan' | 'payment' | 'parse';
export type QrEventStatus = 'success' | 'error' | 'retry';

export interface QrTelemetryInput {
  event_type: QrEventType;
  status: QrEventStatus;
  error_code?: string;
  error_message?: string;
  surface?: string;            // e.g. 'CustomerScan', 'CustomerRequest'
  qr_type?: string;            // kob_pay | kob_pos_pay | kob_store
  merchant_id?: string;
  amount?: number;
  currency?: string;
  latency_ms?: number;
  attempt?: number;
  client_meta?: Record<string, unknown>;
}

const RECENT: { ts: number; code?: string }[] = [];
const SPIKE_WINDOW_MS = 60_000;
const SPIKE_THRESHOLD = 5;

export async function logQrEvent(input: QrTelemetryInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('qr_telemetry_events').insert({
      user_id: user?.id ?? null,
      event_type: input.event_type,
      status: input.status,
      error_code: input.error_code ?? null,
      error_message: input.error_message ?? null,
      surface: input.surface ?? null,
      qr_type: input.qr_type ?? null,
      merchant_id: input.merchant_id ?? null,
      amount: input.amount ?? null,
      currency: input.currency ?? null,
      latency_ms: input.latency_ms ?? null,
      attempt: input.attempt ?? 1,
      client_meta: {
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        ...input.client_meta,
      },
    });

    // Client-side spike detection — triggers server alert eval.
    if (input.status === 'error' || input.status === 'retry') {
      const now = Date.now();
      RECENT.push({ ts: now, code: input.error_code });
      while (RECENT.length && now - RECENT[0].ts > SPIKE_WINDOW_MS) RECENT.shift();
      if (RECENT.length >= SPIKE_THRESHOLD) {
        // Best-effort — ignore failures.
        supabase.functions.invoke('qr-telemetry-alert', {
          body: { window_minutes: 1, threshold: SPIKE_THRESHOLD },
        }).catch(() => {});
        RECENT.length = 0;
      }
    }
  } catch {
    /* swallow — telemetry must never break UX */
  }
}

/** Classify a parser failure into a stable error code. */
export function classifyParseError(parsed: any): { code: string; suggestion: string } {
  if (parsed == null || typeof parsed !== 'object') {
    return { code: 'QR_PARSE_INVALID_JSON', suggestion: 'This QR code is not a Kang payment code.' };
  }
  const t = parsed.type;
  if (t === 'kob_pay' && !parsed.account && !parsed.kang_id) {
    return { code: 'QR_PARSE_MISSING_FIELDS', suggestion: 'This Request Money QR is missing an account — ask the sender to regenerate it.' };
  }
  if (t === 'kob_pos_pay' && !parsed.merchant_id) {
    return { code: 'QR_PARSE_MISSING_FIELDS', suggestion: 'This merchant QR is missing a merchant ID. Ask the cashier to refresh it.' };
  }
  if (t === 'kob_store' && !parsed.merchant_id) {
    return { code: 'QR_PARSE_MISSING_FIELDS', suggestion: 'This store QR is missing a store ID.' };
  }
  if (!t) {
    return { code: 'QR_PARSE_UNKNOWN_TYPE', suggestion: 'Unrecognized QR — try the merchant\'s payment QR, or enter the code manually.' };
  }
  return { code: 'QR_PARSE_UNKNOWN_TYPE', suggestion: `QR type "${t}" is not supported. Tap Rescan to try again.` };
}
