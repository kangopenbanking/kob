// Webhook receiver for Lovable Cloud delivery events.
// Reconciles delivered / bounced / complained / dropped events into
// email_send_log so the admin dashboard reflects real provider state.
//
// Expected payload (provider-agnostic):
//   { message_id: string, event: 'delivered'|'bounced'|'complained'|'opened'|'dropped', timestamp?: string, reason?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

const STATUS_MAP: Record<string, string | null> = {
  delivered: "sent",
  bounced: "bounced",
  bounce: "bounced",
  complained: "complained",
  complaint: "complained",
  spam: "complained",
  dropped: "failed",
  failed: "failed",
  opened: null, // informational only
  clicked: null,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const payload = await req.json().catch(() => ({}));
    // Allow both single-event and batched arrays
    const events: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.events) ? payload.events : [payload];

    let processed = 0;
    for (const ev of events) {
      const messageId: string | undefined = ev?.message_id || ev?.messageId || ev?.id;
      const rawEvent: string | undefined = (ev?.event || ev?.type || "").toLowerCase();
      if (!messageId || !rawEvent) continue;

      const newStatus = STATUS_MAP[rawEvent];
      const eventAt = ev?.timestamp ? new Date(ev.timestamp).toISOString() : new Date().toISOString();

      // Always insert an audit row so we have history per event
      await admin.from("email_send_log").insert({
        message_id: messageId,
        template_name: ev?.template_name || "webhook-event",
        recipient_email: ev?.recipient || ev?.recipient_email || "unknown@unknown",
        status: newStatus || "pending",
        provider_event: rawEvent,
        provider_event_at: eventAt,
        error_message: ev?.reason || ev?.error || null,
        metadata: { source: "webhook", raw: ev },
      } as any);

      // Promote the latest known status on the most recent send row for this id
      if (newStatus) {
        await admin
          .from("email_send_log")
          .update({
            status: newStatus,
            provider_event: rawEvent,
            provider_event_at: eventAt,
            error_message: ev?.reason || ev?.error || null,
          })
          .eq("message_id", messageId)
          .eq("status", "sent");
      }

      processed++;
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("support-email-webhook error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
