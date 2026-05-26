// Public resolver for customer pay links shared via /pay/{slug}.
// Returns sanitized link details + receiver's KANG ID so the payer can
// be deep-linked into /app/transfer prefilled.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { slug } = await req.json();
    if (!slug || typeof slug !== "string" || slug.length < 4 || slug.length > 120) {
      return new Response(JSON.stringify({ error: "Missing or invalid slug" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link, error } = await supabase
      .from("customer_pay_links")
      .select("id, slug, name, description, amount, currency, is_open_amount, expires_at, is_active, user_id")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !link) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!link.is_active) {
      return new Response(JSON.stringify({ error: "inactive" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "expired" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, kang_id")
      .eq("id", link.user_id)
      .maybeSingle();

    // Best-effort click increment (do not block on failure)
    supabase
      .from("customer_pay_links")
      .update({ clicks: (((link as any).clicks ?? 0) as number) + 1 })
      .eq("id", link.id)
      .then(() => {}, () => {});

    return new Response(JSON.stringify({
      link: {
        id: link.id,
        slug: link.slug,
        name: link.name,
        description: link.description,
        amount: link.amount,
        currency: link.currency || "XAF",
        is_open_amount: link.is_open_amount,
        expires_at: link.expires_at,
      },
      receiver: {
        full_name: profile?.full_name || "Kang User",
        kang_id: profile?.kang_id || null,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
