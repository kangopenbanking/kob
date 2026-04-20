import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TARGET_LANGUAGES = ["fr"];
const BATCH_SIZE = 25;
const MAX_BATCHES_PER_RUN = 8; // 200 strings per cron tick

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const summary: Record<string, { translated: number; failed: number }> = {};

    for (const lang of TARGET_LANGUAGES) {
      summary[lang] = { translated: 0, failed: 0 };

      // Find strings with no value for this language
      const { data: missing, error: qErr } = await supabase
        .from("translation_strings")
        .select("id, string_key, default_value")
        .not(
          "id",
          "in",
          `(SELECT string_id FROM translation_values WHERE language = '${lang}')`
        )
        .limit(BATCH_SIZE * MAX_BATCHES_PER_RUN);

      if (qErr) {
        // Fallback: pull all, then filter (older PostgREST)
        const [{ data: allStrings }, { data: existingVals }] = await Promise.all([
          supabase.from("translation_strings").select("id, string_key, default_value"),
          supabase.from("translation_values").select("string_id").eq("language", lang),
        ]);
        const haveSet = new Set((existingVals || []).map((v: any) => v.string_id));
        const todo = (allStrings || [])
          .filter((s: any) => !haveSet.has(s.id))
          .slice(0, BATCH_SIZE * MAX_BATCHES_PER_RUN);
        await processList(supabase, supabaseUrl, serviceKey, lang, todo, summary[lang]);
        continue;
      }

      await processList(supabase, supabaseUrl, serviceKey, lang, missing || [], summary[lang]);
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translation-auto-translate-cron error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processList(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  lang: string,
  todo: any[],
  counter: { translated: number; failed: number }
) {
  if (todo.length === 0) return;

  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/translate-strings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          strings: batch.map((s: any) => ({ key: s.string_key, value: s.default_value })),
          target_language: lang,
        }),
      });

      if (!resp.ok) {
        counter.failed += batch.length;
        if (resp.status === 429 || resp.status === 402) {
          console.warn(`Stopping cron run, AI gateway returned ${resp.status}`);
          return;
        }
        continue;
      }

      const data = await resp.json();
      const translations = data.translations || {};
      const upserts = batch
        .filter((s: any) => translations[s.string_key])
        .map((s: any) => ({
          string_id: s.id,
          language: lang,
          value: translations[s.string_key],
          is_auto_translated: true,
          translated_at: new Date().toISOString(),
        }));

      if (upserts.length > 0) {
        const { error } = await supabase
          .from("translation_values")
          .upsert(upserts, { onConflict: "string_id,language" });
        if (error) {
          console.error("Upsert error:", error);
          counter.failed += upserts.length;
        } else {
          counter.translated += upserts.length;
        }
      }
      counter.failed += batch.length - upserts.length;

      // Gentle pacing
      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      console.error("Batch error:", e);
      counter.failed += batch.length;
    }
  }
}
