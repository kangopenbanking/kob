// KYC Incomplete Reminder dispatcher.
// Finds customer-app users who have NOT completed identity verification
// (no approved kyc_verifications row), whose account is at least MIN_AGE_DAYS old,
// and who have not received a reminder in the last COOLDOWN_DAYS. Enqueues the
// `kyc_incomplete_reminder` communication template per user.
//
// Trigger: pg_cron daily 09:00 UTC, or manual invoke.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trigger-source",
};

const MIN_AGE_DAYS = 3;
const COOLDOWN_DAYS = 7;
const PAGE = 200;
const KYC_URL = (Deno.env.get("APP_BASE_URL") || "https://info.kangfintechsolutions.com") + "/customer-app/kyc";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const triggeredBy = req.headers.get("x-trigger-source") || "manual";
  const cutoffAge = new Date(Date.now() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const cooldown = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Pull candidate profiles in pages
  let queued = 0, skipped = 0, failed = 0;
  let from = 0;
  while (from < 20000) {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, created_at")
      .lt("created_at", cutoffAge)
      .not("email", "is", null)
      .range(from, from + PAGE - 1);
    if (error) { console.error("profiles page error", error); break; }
    if (!profiles?.length) break;

    // Filter synthetic / undeliverable pseudo-emails BEFORE any per-user work.
    // These addresses (phone-signup placeholders, reserved test domains) generate
    // permanent bounces which spike the email_bounce_rate_high alert.
    const SYNTHETIC_SUFFIXES = ["@phone.kob.cm", "@kang.id", "@no-email.local"];
    const RESERVED_DOMAINS = new Set(["example.com", "example.org", "example.net", "test", "invalid", "localhost", "local"]);
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const deliverable = (profiles as any[]).filter((p) => {
      const e = (p.email || "").toLowerCase().trim();
      if (!e || !EMAIL_RE.test(e)) return false;
      if (e.endsWith(".local")) return false;
      if (SYNTHETIC_SUFFIXES.some((s) => e.endsWith(s))) return false;
      const d = e.split("@")[1] || "";
      if (RESERVED_DOMAINS.has(d)) return false;
      return true;
    });
    skipped += (profiles.length - deliverable.length);


    for (const p of profiles as any[]) {
      try {
        // Skip if user has an approved verification
        const { count: approvedCount } = await supabase
          .from("kyc_verifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", p.id)
          .eq("status", "approved");
        if ((approvedCount ?? 0) > 0) { skipped++; continue; }

        // Skip if reminded in last COOLDOWN_DAYS
        const { data: lastLog } = await supabase
          .from("kyc_reminder_log")
          .select("last_sent_at")
          .eq("user_id", p.id)
          .maybeSingle();
        if (lastLog?.last_sent_at && lastLog.last_sent_at > cooldown) { skipped++; continue; }

        const res = await supabase.functions.invoke("send-communication", {
          body: {
            template_key: "kyc_incomplete_reminder",
            recipient_email: p.email,
            recipient_id: p.id,
            variables: {
              recipient_name: p.full_name || "Valued Customer",
              kyc_url: KYC_URL,
            },
          },
        });

        if ((res as any)?.error) { failed++; continue; }

        await supabase
          .from("kyc_reminder_log")
          .upsert({ user_id: p.id, last_sent_at: new Date().toISOString() }, { onConflict: "user_id" });
        queued++;
      } catch (e) {
        console.error("reminder loop error", e);
        failed++;
      }
    }

    if (profiles.length < PAGE) break;
    from += PAGE;
  }

  console.log(JSON.stringify({ scope: "kyc-incomplete-reminder", triggeredBy, queued, skipped, failed }));

  return new Response(JSON.stringify({ ok: true, queued, skipped, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
