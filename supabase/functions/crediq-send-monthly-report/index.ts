import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * crediq-send-monthly-report
 * Cron-driven dispatcher that fans out monthly CrediQ report emails to every
 * user who has opted in. Iterates `crediq_email_preferences` (monthly_report=true)
 * and invokes the `crediq-emails` action handler for each user. Logs the run
 * to `crediq_report_dispatch_log` for compliance/observability.
 *
 * Triggered by:
 *   - GitHub Actions (.github/workflows/crediq-monthly-report.yml) on the 1st of each month
 *   - Manual: POST { "user_id": "<uuid>" } to dispatch a single user
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Audit row
  const { data: auditRow } = await supabase
    .from("crediq_report_dispatch_log")
    .insert({ dispatch_type: "monthly_report", triggered_by: req.headers.get("x-trigger-source") || "cron" })
    .select("id")
    .single();
  const dispatchId = auditRow?.id;

  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body ok */ }
    const singleUser = body?.user_id as string | undefined;

    let userIds: string[] = [];

    if (singleUser) {
      userIds = [singleUser];
    } else {
      // Page through preferences (up to 5000 users per run)
      const PAGE = 1000;
      let from = 0;
      while (from < 5000) {
        const { data, error } = await supabase
          .from("crediq_email_preferences")
          .select("user_id")
          .eq("monthly_report", true)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        userIds.push(...data.map((r: any) => r.user_id));
        if (data.length < PAGE) break;
        from += PAGE;
      }
    }

    let sent = 0, failed = 0;
    const errors: any[] = [];

    for (const uid of userIds) {
      try {
        const { error } = await supabase.functions.invoke("crediq-emails", {
          body: { action: "send-monthly-report", user_id: uid },
        });
        if (error) throw error;
        sent++;
      } catch (e: any) {
        failed++;
        errors.push({ user_id: uid, error: e?.message || String(e) });
        console.error(`[monthly-report] user=${uid}`, e);
      }
    }

    if (dispatchId) {
      await supabase.from("crediq_report_dispatch_log").update({
        completed_at: new Date().toISOString(),
        total_users: userIds.length,
        sent_count: sent,
        failed_count: failed,
        error_details: errors.length ? { errors: errors.slice(0, 50) } : null,
      }).eq("id", dispatchId);
    }

    return new Response(
      JSON.stringify({ success: true, dispatch_id: dispatchId, total: userIds.length, sent, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("crediq-send-monthly-report fatal:", err);
    if (dispatchId) {
      await supabase.from("crediq_report_dispatch_log").update({
        completed_at: new Date().toISOString(),
        error_details: { fatal: err?.message || String(err) },
      }).eq("id", dispatchId);
    }
    return new Response(
      JSON.stringify({ error: "Dispatch failed", details: err?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
