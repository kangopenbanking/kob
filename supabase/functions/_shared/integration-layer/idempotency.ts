// KOB Integration Layer — Idempotency
// Stores response per (merchant_id, idempotency_key). Replays cached response
// when client retries with the same key + same request hash.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface IdempotencyHit {
  status: number;
  body: unknown;
}

export async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function lookupIdempotency(
  key: string, merchantId: string | null, requestHash: string,
): Promise<IdempotencyHit | { conflict: true } | null> {
  if (!key) return null;
  const sb = admin();
  const { data, error } = await sb
    .from("integration_idempotency_keys")
    .select("request_hash, response_status, response_body, expires_at")
    .eq("idempotency_key", key)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  if (data.request_hash !== requestHash) return { conflict: true };
  if (data.response_status == null) return null;
  return { status: data.response_status, body: data.response_body };
}

export async function storeIdempotency(args: {
  key: string;
  merchantId: string | null;
  resource: string;
  requestHash: string;
  status: number;
  body: unknown;
}): Promise<void> {
  if (!args.key) return;
  const sb = admin();
  await sb.from("integration_idempotency_keys").upsert({
    idempotency_key: args.key,
    merchant_id: args.merchantId,
    resource: args.resource,
    request_hash: args.requestHash,
    response_status: args.status,
    response_body: args.body as Record<string, unknown>,
  }, { onConflict: "merchant_id,idempotency_key" });
}
