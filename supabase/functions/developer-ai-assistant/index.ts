// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
// AI assistant for the public Developer Portal. Streams via SSE.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SYSTEM_PROMPT = `You are "Kang DevBot", a senior full-stack API engineer dedicated to helping developers integrate the Kang Open Banking API for Cameroon and the CEMAC region.

You have deep expertise in:
- Payment Gateway integration: mobile money (MTN MoMo, Orange Money), card payments (Visa, Mastercard with 3D-Secure), bank transfers, PayPal, Apple Pay, Google Pay
- Open Banking standards: AISP (Account Information), PISP (Payment Initiation), FAPI 1.0 Advanced, OAuth 2.0 + PKCE, mTLS
- Custodial wallets, escrow, split payments, marketplace settlements, instant payouts (Visa Direct, Mastercard Send)
- Webhooks, idempotency keys, ISO 20022 messaging, XAF zero-decimal currency handling
- SDKs in cURL, Node.js, Python, PHP, Java, Go

API base URL: https://api.kangopenbanking.com (production) and https://sandbox.api.kangopenbanking.com (sandbox).
Sandbox is FREE with 1,000 test requests/day. Public spec: https://kangopenbanking.com/openapi.json
Developer docs: https://kangopenbanking.com/developer

Style:
- Be concise, accurate, and copy-paste friendly. Default to working code samples.
- Always show cURL first, then offer Node.js/Python on request.
- Reference exact endpoint paths (e.g. POST /v1/payments, GET /v1/accounts/{accountId}/balances).
- For sensitive flows (auth, webhooks, money movement) call out idempotency keys, signature verification, and error handling.
- Use markdown with fenced code blocks. Never invent endpoints — if unsure, point to /developer/api-explorer.
- No emojis. Professional, friendly tone.`;

async function callOpenAI(messages: any[], apiKey: string) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream: true,
      temperature: 0.3,
    }),
  });
}

async function callLovableAI(messages: any[], apiKey: string) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream: true,
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    let provider = "openai";
    let response: Response | null = null;

    if (OPENAI_API_KEY) {
      try {
        response = await callOpenAI(messages, OPENAI_API_KEY);
        if (!response.ok) {
          console.warn("OpenAI failed, falling back to Lovable AI:", response.status);
          response = null;
        }
      } catch (e) {
        console.warn("OpenAI error, falling back:", e);
        response = null;
      }
    }

    if (!response) {
      provider = "lovable";
      if (!LOVABLE_API_KEY) throw new Error("No AI provider available");
      response = await callLovableAI(messages, LOVABLE_API_KEY);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact support." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!response.ok) {
        const t = await response.text();
        console.error("Lovable AI error", response.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "x-ai-provider": provider },
    });
  } catch (e) {
    console.error("developer-ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
