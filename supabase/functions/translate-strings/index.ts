import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getClientIdentifier,
  softCheckRateLimit,
  tooManyRequestsResponse,
} from "../_shared/soft-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANG_NAMES: Record<string, string> = {
  fr: "French", es: "Spanish", de: "German",
  pt: "Portuguese", ar: "Arabic", zh: "Chinese", en: "English",
};

async function translateWithOpenAI(inputObj: Record<string, string>, langName: string, apiKey: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are a professional translator. Translate the JSON object values from English to ${langName}. Keep keys identical. Keep technical terms, brand names, currency codes (XAF, USD, EUR) unchanged. Return ONLY a valid JSON object, no markdown.` },
        { role: "user", content: JSON.stringify(inputObj) },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}

async function translateWithLovable(inputObj: Record<string, string>, langName: string, apiKey: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-5-mini",
      messages: [
        { role: "system", content: `You are a professional translator. Translate the JSON object values from English to ${langName}. Keep keys identical. Keep technical terms, brand names, currency codes (XAF, USD, EUR) unchanged. Return ONLY a valid JSON object, no markdown.` },
        { role: "user", content: JSON.stringify(inputObj) },
      ],
      temperature: 0.1,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    const err: any = new Error(`Lovable AI ${res.status}: ${t}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  let content = data.choices?.[0]?.message?.content?.trim() || "{}";
  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }
  return JSON.parse(content);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ipId = getClientIdentifier(req, "ip");
    const rl = await softCheckRateLimit(ipId, "translate-strings", 60, 20);
    if (!rl.allowed) return tooManyRequestsResponse(corsHeaders, 60);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("No translation provider configured");
    }

    const { strings, target_language } = await req.json();
    if (!strings || !Array.isArray(strings) || !target_language) {
      return new Response(JSON.stringify({ error: "Missing strings or target_language" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langName = LANG_NAMES[target_language] || target_language;
    const inputObj = Object.fromEntries(
      strings.map((s: { key: string; value: string }) => [s.key, s.value])
    );

    let translations: Record<string, string> = {};
    let provider = "none";

    // Primary: OpenAI direct
    if (OPENAI_API_KEY) {
      try {
        translations = await translateWithOpenAI(inputObj, langName, OPENAI_API_KEY);
        provider = "openai";
      } catch (e) {
        console.warn("OpenAI failed, falling back to Lovable AI:", e instanceof Error ? e.message : e);
      }
    }

    // Fallback: Lovable AI Gateway
    if (Object.keys(translations).length === 0 && LOVABLE_API_KEY) {
      try {
        translations = await translateWithLovable(inputObj, langName, LOVABLE_API_KEY);
        provider = "lovable";
      } catch (e: any) {
        console.error("Lovable AI failed:", e?.message || e);
        if (e?.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (e?.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw e;
      }
    }

    console.log(`[${provider}] Translated ${Object.keys(translations).length}/${strings.length} → ${langName}`);

    return new Response(JSON.stringify({ translations, provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-strings error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
