import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import {
  getClientIdentifier,
  softCheckRateLimit,
  tooManyRequestsResponse,
} from "../_shared/soft-rate-limit.ts";

const MAX_BATCH = 200;
const MAX_KEY_LEN = 200;
const MAX_VALUE_LEN = 4000;
const VALID_KEY = /^[a-zA-Z0-9_.\-]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // Soft IP-based limit: protects against harvester abuse. Fails open.
    const ipId = getClientIdentifier(req, "ip");
    const rl = await softCheckRateLimit(ipId, "register-translation-strings", 30, 10);
    if (!rl.allowed) return tooManyRequestsResponse(corsHeaders, 60);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { strings } = body;

    if (!strings || !Array.isArray(strings) || strings.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing strings array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (strings.length > MAX_BATCH) {
      return new Response(
        JSON.stringify({ error: `Batch too large (max ${MAX_BATCH})` }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each
    const cleaned = strings
      .filter((s: any) =>
        s &&
        typeof s.key === "string" &&
        typeof s.default_value === "string" &&
        s.key.length > 0 &&
        s.key.length <= MAX_KEY_LEN &&
        VALID_KEY.test(s.key) &&
        s.default_value.length <= MAX_VALUE_LEN
      )
      .slice(0, MAX_BATCH);

    if (cleaned.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid strings in batch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // De-dup against existing
    const keys = cleaned.map((s: any) => s.key);
    const { data: existing } = await supabase
      .from("translation_strings")
      .select("string_key")
      .in("string_key", keys);

    const existingKeys = new Set((existing || []).map((e: any) => e.string_key));
    const newStrings = cleaned.filter((s: any) => !existingKeys.has(s.key));

    if (newStrings.length === 0) {
      return new Response(
        JSON.stringify({ registered: 0, message: "All strings already exist" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toInsert = newStrings.map((s: any) => ({
      string_key: s.key,
      default_value: s.default_value,
      category: typeof s.category === "string" ? s.category.slice(0, 64) : "general",
      context: s.context ? String(s.context).slice(0, 500) : null,
      description: s.description ? String(s.description).slice(0, 500) : null,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("translation_strings")
      .insert(toInsert)
      .select("id, string_key, default_value");

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(insertError.message);
    }

    // Auto-create EN translation_values
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

      if (valError) console.error("EN values insert error:", valError);

      // Fire-and-forget: auto-translate to FR (non-blocking)
      const targetLanguages = ["fr"];
      for (const lang of targetLanguages) {
        try {
          // Invoke translate-strings without awaiting (async pattern via fetch)
          const aiResp = await fetch(`${supabaseUrl}/functions/v1/translate-strings`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              strings: inserted.map((s: any) => ({ key: s.string_key, value: s.default_value })),
              target_language: lang,
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const translations = aiData.translations || {};
            const upserts = inserted
              .filter((s: any) => translations[s.string_key])
              .map((s: any) => ({
                string_id: s.id,
                language: lang,
                value: translations[s.string_key],
                is_auto_translated: true,
                translated_at: new Date().toISOString(),
              }));
            if (upserts.length > 0) {
              await supabase
                .from("translation_values")
                .upsert(upserts, { onConflict: "string_id,language" });
              console.log(`Auto-translated ${upserts.length} new strings to ${lang}`);
            }
          } else {
            console.warn(`Auto-translation to ${lang} failed:`, aiResp.status);
          }
        } catch (e) {
          console.warn(`Auto-translation error for ${lang}:`, e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        registered: inserted?.length || 0,
        keys: inserted?.map((i: any) => i.string_key),
      }),
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
