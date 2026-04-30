// Authenticated developer dashboard endpoint.
// Returns per-provider receiver health: enabled flag, last received_at,
// last processed_at, totals over the last 24h, and last error code seen.
// Available to authenticated merchants for their own visibility, and to
// admins for the global view.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const PROVIDERS = ["stripe", "flutterwave", "paypal"] as const;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate caller (always use getUser, never getSession).
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const results = await Promise.all(
      PROVIDERS.map(async (provider) => {
        const [latest, oldest24h, processedCount, errorCount, lastErr] = await Promise.all([
          supabase
            .from("webhook_inbox")
            .select("event_id,created_at,processed_at,is_processed,processing_error")
            .eq("source", provider)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("webhook_inbox")
            .select("id", { count: "exact", head: true })
            .eq("source", provider)
            .gte("created_at", since),
          supabase
            .from("webhook_inbox")
            .select("id", { count: "exact", head: true })
            .eq("source", provider)
            .eq("is_processed", true)
            .gte("created_at", since),
          supabase
            .from("webhook_inbox")
            .select("id", { count: "exact", head: true })
            .eq("source", provider)
            .not("processing_error", "is", null)
            .gte("created_at", since),
          supabase
            .from("webhook_inbox")
            .select("processing_error,created_at")
            .eq("source", provider)
            .not("processing_error", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const total = oldest24h.count ?? 0;
        const processed = processedCount.count ?? 0;
        const errors = errorCount.count ?? 0;
        const successRate = total === 0 ? null : Math.round((processed / total) * 1000) / 10;

        let status: "operational" | "degraded" | "down" | "idle" = "operational";
        if (total === 0) status = "idle";
        else if (errors / total > 0.5) status = "down";
        else if (errors > 0) status = "degraded";

        return {
          provider,
          status,
          enabled: true,
          last_received_at: latest.data?.created_at ?? null,
          last_processed_at: latest.data?.processed_at ?? null,
          last_event_id: latest.data?.event_id ?? null,
          last_error_code: lastErr.data?.processing_error ?? null,
          last_error_at: lastErr.data?.created_at ?? null,
          window_hours: 24,
          totals: { received: total, processed, errors, success_rate_percent: successRate },
        };
      }),
    );

    return json({
      generated_at: new Date().toISOString(),
      providers: results,
    });
  } catch (err) {
    const error_id = crypto.randomUUID().slice(0, 8);
    console.error(`[${error_id}] webhook-receiver-status:`, err);
    return json({ error: "internal_error", error_id }, 500);
  }
});
