// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
// AI assistant for the public Developer Portal. Streams via SSE.
// Provider order: OpenAI (if key present) -> Lovable AI fallback.
// In-memory IP rate limit (best-effort) prevents abuse.

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are "Kang AI Agent", a senior full-stack API engineer dedicated to helping developers integrate the Kang Open Banking API for Cameroon and the CEMAC region.

You have deep expertise in:
- Payment Gateway integration: mobile money (MTN MoMo, Orange Money), card payments (Visa, Mastercard with 3D-Secure), bank transfers, PayPal, Apple Pay, Google Pay
- Open Banking standards: AISP (Account Information), PISP (Payment Initiation), FAPI 1.0 Advanced, OAuth 2.0 + PKCE, mTLS
- Custodial wallets, escrow, split payments, marketplace settlements, instant payouts (Visa Direct, Mastercard Send)
- Webhooks (HMAC-SHA256 X-KOB-Signature), idempotency keys, ISO 20022 messaging, XAF zero-decimal currency handling
- SDKs in cURL, Node.js, Python, PHP, Java, Go

Backend base URL (use this in ALL examples): https://api.kangopenbanking.com/v1
Public spec: https://kangopenbanking.com/openapi.json
Developer docs: https://kangopenbanking.com/developer
API Explorer: https://kangopenbanking.com/developer/api-explorer

Style:
- Be concise, accurate, and copy-paste friendly. Default to working code samples.
- Always reference exact endpoint paths in backticks (e.g. \`POST /v1/payments\`, \`GET /v1/accounts/{accountId}/balances\`).
- For sensitive flows (auth, webhooks, money movement) call out idempotency keys, signature verification, and error handling.
- Use markdown with fenced code blocks. Never invent endpoints — if unsure, point to /developer/api-explorer.
- No emojis. Professional, friendly tone.`;

// ---- Best-effort in-memory IP rate limit ----
const RATE_LIMIT_MAX = 15; // requests
const RATE_LIMIT_WINDOW_MS = 60_000; // per 60s
const ipHits = new Map<string, number[]>();

function checkRateLimit(ip: string, authed: boolean): { ok: boolean; retryAfter?: number } {
  const max = authed ? RATE_LIMIT_MAX * 4 : RATE_LIMIT_MAX;
  const now = Date.now();
  const bucket = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (bucket.length >= max) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - bucket[0])) / 1000);
    return { ok: false, retryAfter };
  }
  bucket.push(now);
  ipHits.set(ip, bucket);
  return { ok: true };
}

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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const messages = (body as any)?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "anon";
    const authed = !!req.headers.get("x-developer-token");
    const rl = checkRateLimit(ip, authed);
    if (!rl.ok) {
      return new Response(
        JSON.stringify({ error: `Rate limit reached. Try again in ${rl.retryAfter}s.` }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rl.retryAfter ?? 30),
          },
        },
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    let provider = "openai";
    let response: Response | null = null;

    if (OPENAI_API_KEY) {
      try {
        response = await callOpenAI(messages, OPENAI_API_KEY);
        if (!response.ok) {
          const txt = await response.text().catch(() => "");
          console.warn("OpenAI failed, falling back to Lovable AI:", response.status, txt.slice(0, 200));
          response = null;
        }
      } catch (e) {
        console.warn("OpenAI error, falling back:", e);
        response = null;
      }
    }

    if (!response) {
      provider = "lovable";
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "AI service not configured" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      response = await callLovableAI(messages, LOVABLE_API_KEY);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "AI provider rate limited. Please try again shortly." }), {
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
        const t = await response.text().catch(() => "");
        console.error("Lovable AI error", response.status, t.slice(0, 200));
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "x-ai-provider": provider,
      },
    });
  } catch (e) {
    console.error("developer-ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
