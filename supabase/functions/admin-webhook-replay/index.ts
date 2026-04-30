// Admin-only: replays a saved webhook_inbox event through the matching
// gateway-webhook-* receiver. Used for debugging signature verification and
// confirming idempotency. Requires the original `signature` to be stored on
// the inbox row (sandbox triggers always store it; production stores it for
// inbound events received after the signature-persistence migration).
//
// Behaviour:
//   1. Loads the inbox row (admin only).
//   2. Re-POSTs the raw payload + signature header to the internal receiver
//      URL, derived from SUPABASE_URL on the server side. The client never
//      sees this URL — only a typed { result } object is returned.
//   3. Records the outcome in webhook_replay_audit for later review.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const RECEIVERS: Record<string, { fn: string; sigHeader: string }> = {
  stripe:      { fn: "gateway-webhook-stripe",      sigHeader: "stripe-signature" },
  flutterwave: { fn: "gateway-webhook-flutterwave", sigHeader: "verif-hash" },
  paypal:      { fn: "gateway-webhook-paypal",      sigHeader: "paypal-transmission-sig" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const inboxId: string | undefined = body?.inbox_id;
    if (!inboxId || !/^[0-9a-f-]{36}$/i.test(inboxId)) {
      return json({ error: "invalid_inbox_id" }, 400);
    }

    const { data: row, error: rowErr } = await supabase
      .from("webhook_inbox")
      .select("id, source, event_id, payload, signature, is_processed, processed_at")
      .eq("id", inboxId)
      .maybeSingle();

    if (rowErr) throw rowErr;
    if (!row) return json({ error: "inbox_not_found" }, 404);

    const receiver = RECEIVERS[row.source];
    if (!receiver) {
      return json({ error: "unsupported_provider", provider: row.source }, 400);
    }

    if (!row.signature) {
      return json({
        error: "missing_signature_on_inbox",
        hint: "This event was stored before signature persistence; replay against the live receiver is not possible.",
      }, 422);
    }

    // Internal-only URL — never returned to the client.
    const internalBase = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
    const internalUrl = `${internalBase}/functions/v1/${receiver.fn}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")!}`,
      [receiver.sigHeader]: row.signature,
      "X-Replay": "1",
      "X-Replay-Inbox-Id": row.id,
    };

    const replayResp = await fetch(internalUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(row.payload),
    });

    const text = await replayResp.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* keep raw */ }

    const resultCode: string | null =
      replayResp.headers.get("X-Webhook-Error-Code") ??
      parsed?.code ??
      parsed?.error ??
      (replayResp.ok ? "ok" : null);

    const idempotentSkip =
      parsed?.status === "already_processed" || parsed?.code === "duplicate_event";

    const signatureValid = !(
      resultCode === "invalid_signature" ||
      resultCode === "missing_signature" ||
      resultCode === "timestamp_expired"
    );

    await supabase.from("webhook_replay_audit").insert({
      inbox_id: row.id,
      provider: row.source,
      event_id: row.event_id,
      replayed_by: userData.user.id,
      signature_valid: signatureValid,
      idempotent_skip: idempotentSkip,
      result_status: replayResp.status,
      result_code: resultCode,
    });

    return json({
      ok: true,
      result: {
        status: replayResp.status,
        code: resultCode,
        signature_valid: signatureValid,
        idempotent_skip: idempotentSkip,
        body: parsed ?? { raw: text.slice(0, 2000) },
      },
    });
  } catch (err) {
    const error_id = crypto.randomUUID().slice(0, 8);
    console.error(`[${error_id}] admin-webhook-replay:`, err);
    return json({ error: "internal_error", error_id }, 500);
  }
});
