// Webhook replay protection
// Dedupes incoming events by (source, event_id) using webhook_inbox with a TTL.
// First insert wins; later inserts return { duplicate: true } so the caller
// can return HTTP 200 idempotently without reprocessing the event.
//
// Usage:
//   const seen = await checkAndRegisterWebhook(supabase, {
//     source: "stripe",
//     event_id: req.headers.get("X-Webhook-ID") ?? body.id,
//     payload: body,
//     signature: req.headers.get("X-Webhook-Signature") ?? "",
//     ttl_seconds: 60 * 60 * 24, // 24h replay window
//   });
//   if (seen.duplicate) return new Response(JSON.stringify({ status: "duplicate" }), { status: 200 });

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface ReplayCheckArgs {
  source: string;
  event_id: string | null | undefined;
  payload: unknown;
  signature?: string;
  ttl_seconds?: number; // default 24h
}

export interface ReplayCheckResult {
  duplicate: boolean;
  inbox_id?: string;
  reason?: "missing_event_id" | "duplicate_within_ttl" | "ok";
}

const DEFAULT_TTL = 60 * 60 * 24; // 24h

export async function checkAndRegisterWebhook(
  supabase: SupabaseClient,
  args: ReplayCheckArgs,
): Promise<ReplayCheckResult> {
  const { source, event_id, payload, signature, ttl_seconds = DEFAULT_TTL } = args;
  if (!event_id) return { duplicate: false, reason: "missing_event_id" };

  // Look up an existing inbox row for this (source,event_id) within TTL window.
  const cutoff = new Date(Date.now() - ttl_seconds * 1000).toISOString();
  const { data: existing } = await supabase
    .from("webhook_inbox")
    .select("id, created_at, is_processed")
    .eq("source", source)
    .eq("event_id", event_id)
    .gte("created_at", cutoff)
    .maybeSingle();

  if (existing) {
    return { duplicate: true, inbox_id: existing.id, reason: "duplicate_within_ttl" };
  }

  // First time we see it — register. UNIQUE(source,event_id) protects against
  // races: if two concurrent writers race, the loser will hit the constraint
  // and we treat that as a duplicate as well.
  const { data: inserted, error } = await supabase
    .from("webhook_inbox")
    .insert({
      source,
      event_id,
      payload: payload as Record<string, unknown>,
      signature: signature ?? null,
      is_processed: false,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation → another worker won the race.
    if ((error as { code?: string }).code === "23505") {
      return { duplicate: true, reason: "duplicate_within_ttl" };
    }
    throw error;
  }

  return { duplicate: false, inbox_id: inserted!.id, reason: "ok" };
}

export async function markWebhookProcessed(
  supabase: SupabaseClient,
  inbox_id: string,
  error_message?: string,
): Promise<void> {
  await supabase
    .from("webhook_inbox")
    .update({
      is_processed: !error_message,
      processed_at: new Date().toISOString(),
      processing_error: error_message ?? null,
    })
    .eq("id", inbox_id);
}
