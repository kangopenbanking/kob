// KOB Integration Layer — Webhook Orchestrator
// Re-uses existing gateway webhook delivery pipeline. Adds replay capability.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function replayWebhookEvent(args: {
  eventId: string;
  merchantId: string | null;
  replayedBy: string | null;
}): Promise<{ replay_id: string; status: string; error?: string }> {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: replay, error: insErr } = await sb
    .from("integration_webhook_replays")
    .insert({
      original_event_id: args.eventId,
      merchant_id: args.merchantId,
      replayed_by: args.replayedBy,
      replay_status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !replay) {
    return { replay_id: "", status: "failed", error: insErr?.message ?? "could not log replay" };
  }

  // Re-invoke the existing delivery function — no upstream changes.
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gateway-deliver-webhook`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ event_id: args.eventId, replay: true, replay_id: replay.id }),
    });
    const ok = res.ok;
    const status = ok ? "delivered" : "failed";
    const errText = ok ? undefined : await res.text();
    await sb.from("integration_webhook_replays")
      .update({ replay_status: status, error_message: errText ?? null })
      .eq("id", replay.id);
    return { replay_id: replay.id, status, error: errText };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    await sb.from("integration_webhook_replays")
      .update({ replay_status: "failed", error_message: msg })
      .eq("id", replay.id);
    return { replay_id: replay.id, status: "failed", error: msg };
  }
}
