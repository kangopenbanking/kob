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

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // Soft IP-based limit: protects against LLM cost-abuse. Fails open.
    const ipId = getClientIdentifier(req, "ip");
    const rl = await softCheckRateLimit(ipId, "translate-strings", 60, 10);
    if (!rl.allowed) return tooManyRequestsResponse(corsHeaders, 60);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { strings, target_language } = await req.json();

    if (!strings || !Array.isArray(strings) || !target_language) {
      return new Response(
        JSON.stringify({ error: "Missing strings array or target_language" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stringsMap = strings.map((s: { key: string; value: string }) => ({
      key: s.key,
      value: s.value,
    }));

    const langNames: Record<string, string> = { fr: "French", es: "Spanish", de: "German", pt: "Portuguese", ar: "Arabic", zh: "Chinese" };
    const langName = langNames[target_language] || target_language;
    
    const inputObj = Object.fromEntries(stringsMap.map((s: any) => [s.key, s.value]));

    // Use simple completion without tool_choice - more reliable across models
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a professional translator. Translate the provided JSON object values from English to ${langName}. Keep all keys exactly the same. Keep technical terms, brand names, and currency abbreviations (XAF, USD) unchanged. Return ONLY a valid JSON object with the same keys and translated values. No markdown, no code blocks, no explanations.`,
            },
            {
              role: "user",
              content: JSON.stringify(inputObj),
            },
          ],
          temperature: 0.1,
        }),
      }
    );

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let translations: Record<string, string> = {};

    // Try tool_calls first
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        translations = parsed.translations || parsed;
      } catch (e) {
        console.error("Failed to parse tool_call arguments:", e);
      }
    }

    // Fallback: parse from message content
    if (Object.keys(translations).length === 0) {
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        try {
          // Strip markdown code blocks if present
          let cleaned = content.trim();
          if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
          }
          const parsed = JSON.parse(cleaned);
          translations = parsed.translations || parsed;
        } catch (e) {
          console.error("Failed to parse content as JSON:", e, "Content:", content.substring(0, 200));
        }
      } else {
        console.error("No content or tool_calls in response. Full response:", JSON.stringify(data).substring(0, 500));
      }
    }

    console.log(`Translated ${Object.keys(translations).length}/${strings.length} strings to ${langName}`);

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-strings error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
