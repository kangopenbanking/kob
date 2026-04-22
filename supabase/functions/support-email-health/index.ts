// Admin-only: end-to-end health probe for the support email pipeline.
// Performs three checks and reports the results plus last success/failure
// timestamps observed in `email_send_log`:
//   1. Webhook reachability — POSTs a synthetic event to support-email-webhook
//      and confirms the row was inserted.
//   2. Send pipeline — calls send-transactional-email for the
//      `support-agent-invite` template targeted at a synthetic admin sink
//      address and records the outcome.
//   3. Aggregate stats — last sent / last failed timestamp per support
//      template, used to drive the "Email health" status card.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SUPPORT_PORTAL_URL } from "../_shared/sendSupportEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORT_TEMPLATES = [
  "support-agent-invite",
  "support-new-chat-agent",
  "support-sla-supervisor",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden — admin role required" }, 403);

    const body = await req.json().catch(() => ({}));
    const runSendTest = !!body?.includeSendTest;
    const sinkEmail = String(body?.sinkEmail || user.email || "").trim();

    // ---- 1. Webhook reachability ---------------------------------------
    const probeId = `health-${crypto.randomUUID()}`;
    let webhook: { ok: boolean; status?: number; error?: string; latency_ms?: number } = { ok: false };
    const webhookUrl = `${SUPABASE_URL}/functions/v1/support-email-webhook`;
    const t0 = Date.now();
    try {
      const r = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          message_id: probeId,
          event: "delivered",
          template_name: "health-probe",
          recipient: "health-probe@kangopenbanking.com",
          timestamp: new Date().toISOString(),
        }),
      });
      webhook = { ok: r.ok, status: r.status, latency_ms: Date.now() - t0 };
    } catch (e: any) {
      webhook = { ok: false, error: e?.message || String(e), latency_ms: Date.now() - t0 };
    }

    // Confirm the audit row landed.
    let webhookRowSeen = false;
    if (webhook.ok) {
      const { count } = await admin
        .from("email_send_log")
        .select("id", { count: "exact", head: true })
        .eq("message_id", probeId);
      webhookRowSeen = (count || 0) > 0;
    }

    // ---- 2. Send pipeline (optional) -----------------------------------
    let send: { ok: boolean; idempotencyKey?: string; error?: string; latency_ms?: number } = { ok: false };
    if (runSendTest && sinkEmail) {
      const idem = `health-send-${Date.now()}`;
      const ts = Date.now();
      try {
        const { error } = await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "support-agent-invite",
            recipientEmail: sinkEmail,
            idempotencyKey: idem,
            templateData: {
              agentName: "Health probe",
              departmentName: "System",
              portalUrl: SUPPORT_PORTAL_URL,
              inviteSent: false,
            },
          },
        });
        if (error) throw error;
        send = { ok: true, idempotencyKey: idem, latency_ms: Date.now() - ts };
      } catch (e: any) {
        send = { ok: false, idempotencyKey: idem, error: e?.message || String(e), latency_ms: Date.now() - ts };
      }
    }

    // ---- 3. Aggregate stats from log ----------------------------------
    const since = new Date(Date.now() - 7 * 86400e3).toISOString();
    const { data: recent } = await admin
      .from("email_send_log")
      .select("template_name, status, created_at")
      .in("template_name", SUPPORT_TEMPLATES)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    const lastSent: Record<string, string | null> = {};
    const lastFailed: Record<string, string | null> = {};
    for (const t of SUPPORT_TEMPLATES) { lastSent[t] = null; lastFailed[t] = null; }
    for (const r of (recent as any[]) || []) {
      const t = r.template_name as string;
      if (!SUPPORT_TEMPLATES.includes(t)) continue;
      if (r.status === "sent" && !lastSent[t]) lastSent[t] = r.created_at;
      if (["failed", "dlq", "bounced", "complained"].includes(r.status) && !lastFailed[t]) {
        lastFailed[t] = r.created_at;
      }
    }

    const overallOk = webhook.ok && webhookRowSeen && (!runSendTest || send.ok);

    return json({
      overall_ok: overallOk,
      checked_at: new Date().toISOString(),
      webhook: { ...webhook, audit_row_seen: webhookRowSeen, probe_id: probeId },
      send,
      last_sent: lastSent,
      last_failed: lastFailed,
    });
  } catch (e: any) {
    console.error("support-email-health error:", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
