import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { strings } = await req.json();

    if (!strings || !Array.isArray(strings) || strings.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing strings array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing keys to avoid duplicates
    const keys = strings.map((s: any) => s.key);
    const { data: existing } = await supabase
      .from("translation_strings")
      .select("string_key")
      .in("string_key", keys);

    const existingKeys = new Set((existing || []).map((e: any) => e.string_key));
    const newStrings = strings.filter((s: any) => !existingKeys.has(s.key));

    if (newStrings.length === 0) {
      return new Response(
        JSON.stringify({ registered: 0, message: "All strings already exist" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert new strings
    const toInsert = newStrings.map((s: any) => ({
      string_key: s.key,
      default_value: s.default_value,
      category: s.category || "general",
      context: s.context || null,
      description: s.description || null,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("translation_strings")
      .insert(toInsert)
      .select("id, string_key, default_value");

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(insertError.message);
    }

    // Auto-create English translation_values for each new string
    if (inserted && inserted.length > 0) {
      const enValues = inserted.map((s: any) => ({
        string_id: s.id,
        language: "en",
        value: s.default_value,
        is_auto_translated: false,
      }));

      const { error: valError } = await supabase
        .from("translation_values")
        .insert(enValues);

      if (valError) {
        console.error("Translation values insert error:", valError);
      }
    }

    return new Response(
      JSON.stringify({ registered: inserted?.length || 0, keys: inserted?.map((i: any) => i.string_key) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("register-translation-strings error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
