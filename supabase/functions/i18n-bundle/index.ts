// Public i18n bundle endpoint.
// Returns { [string_key]: value } for a given (lang, namespace).
// Namespace == translation_strings.category. Pass ns="*" for all.
// Cached at the edge for 60s; clients revalidate via realtime invalidation.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_LANG = /^[a-z]{2}(-[A-Z]{2})?$/;
const VALID_NS = /^[a-zA-Z0-9_\-]{1,64}$|^\*$/;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const lang = (url.searchParams.get("lang") || "en").trim();
    const ns = (url.searchParams.get("ns") || "*").trim();

    if (!VALID_LANG.test(lang) || !VALID_NS.test(ns)) {
      return new Response(JSON.stringify({ error: "Invalid lang or ns" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const PAGE = 1000;
    let from = 0;
    const map: Record<string, string> = {};

    while (true) {
      let q = supabase
        .from("translation_values")
        .select("value, translation_strings!inner(string_key, category)")
        .eq("language", lang)
        .range(from, from + PAGE - 1);

      if (ns !== "*") {
        q = q.eq("translation_strings.category", ns);
      }

      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const row of data as any[]) {
        const k = row.translation_strings?.string_key;
        if (k) map[k] = row.value;
      }

      if (data.length < PAGE) break;
      from += PAGE;
    }

    return new Response(JSON.stringify(map), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    console.error("i18n-bundle error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
