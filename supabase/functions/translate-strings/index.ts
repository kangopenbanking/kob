import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { strings, target_language } = await req.json();

    if (!strings || !Array.isArray(strings) || !target_language) {
      return new Response(
        JSON.stringify({ error: "Missing strings array or target_language" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt for batch translation
    const stringsMap = strings.map((s: { key: string; value: string }) => ({
      key: s.key,
      value: s.value,
    }));

    const langName = target_language === "fr" ? "French" : target_language;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a professional translator. Translate the provided UI strings from English to ${langName}. Maintain the same tone, formality, and context. Keep technical terms, brand names, and currency abbreviations (XAF, USD) unchanged. Return ONLY a valid JSON object mapping each key to its translated value. Do not add explanations.`,
            },
            {
              role: "user",
              content: JSON.stringify(
                Object.fromEntries(stringsMap.map((s: any) => [s.key, s.value]))
              ),
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_translations",
                description: "Return translated strings",
                parameters: {
                  type: "object",
                  properties: {
                    translations: {
                      type: "object",
                      description:
                        "Object mapping string keys to their translated values",
                      additionalProperties: { type: "string" },
                    },
                  },
                  required: ["translations"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_translations" },
          },
        }),
      }
    );

    if (!response.ok) {
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
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let translations: Record<string, string> = {};

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      translations = parsed.translations || parsed;
    }

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
