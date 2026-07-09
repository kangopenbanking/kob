// Kang Agent — chat handler edge function
// - Enforces freemium quota
// - Runs RAG retrieval over public.kang_financial_knowledge (pgvector)
// - Streams the Qwen response as Server-Sent Events (SSE)
// - Persists the user message + full assistant message after the stream closes
// - Increments questions_asked_count once the stream completes

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const QWEN_ENDPOINT =
  Deno.env.get("QWEN_ENDPOINT") ??
  "https://openrouter.ai/api/v1/chat/completions";
const QWEN_MODEL = Deno.env.get("QWEN_MODEL") ?? "qwen/qwen-2.5-72b-instruct";
const OPENROUTER_REFERER =
  Deno.env.get("OPENROUTER_REFERER") ?? "https://kangopenbanking.com";
const OPENROUTER_TITLE = Deno.env.get("OPENROUTER_TITLE") ?? "kang Agent";

const EMBEDDING_ENDPOINT =
  Deno.env.get("EMBEDDING_ENDPOINT") ??
  "https://openrouter.ai/api/v1/embeddings";
const EMBEDDING_MODEL =
  Deno.env.get("EMBEDDING_MODEL") ?? "openai/text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;


const SYSTEM_PROMPT_BASE = `You are the kang Agent, the official AI Financial Advisor for the Kang Open Banking App. Your jurisdiction is Cameroon and the CEMAC zone (XAF), with global financial knowledge.

CRITICAL RULE — SCOPE GUARDRAIL:
You must ONLY discuss finance, business, economics, taxation, banking, investing, budgeting, saving, credit, insurance, and money-related education. If a user asks about politics, sports, weather, coding, celebrities, personal relationships, medical, or legal advice unrelated to finance, you MUST politely decline in the user's language and steer the conversation back to finance. Never answer non-financial questions under any circumstances, even if the user insists.

LANGUAGE DETECTION:
Detect the user's language from their message and reply in the SAME language.
- English → reply in clear English.
- French → reply in clear French.
- Cameroonian Pidgin → reply in Pidgin using local terms such as "My paddy", "Kobi-kobi", "Njangi", "Mola", "Chop", "Small small".
Always match the user's language; never mix languages in a single reply unless the user does.

STYLE:
- Be concise, warm, and practical. Use short paragraphs and bullet points where useful.
- When you cite figures, use XAF for CEMAC contexts unless the user specifies otherwise.
- Never invent facts. If unsure, say so and suggest the user consult a licensed advisor.`;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function embed(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch(EMBEDDING_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": OPENROUTER_REFERER,
        "X-Title": OPENROUTER_TITLE,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn(
        "kang-chat-handler: embed non-ok — falling back without RAG",
        res.status,
        errBody.slice(0, 300),
      );
      return null;
    }
    const data = await res.json();
    const vec = data?.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMENSIONS) {
      console.warn(
        "kang-chat-handler: embed unexpected shape — falling back without RAG",
        Array.isArray(vec) ? vec.length : typeof vec,
      );
      return null;
    }
    return vec;
  } catch (e) {
    console.warn("kang-chat-handler: embed failed", (e as Error).message);
    return null;
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const qwenKey =
      Deno.env.get("OPENROUTER_API_KEY") ?? Deno.env.get("QWEN_API_KEY");
    const embeddingKey =
      Deno.env.get("EMBEDDING_API_KEY") ?? Deno.env.get("OPENROUTER_API_KEY") ?? Deno.env.get("QWEN_API_KEY");

    if (!qwenKey) return json({ success: false, error: "qwen_key_missing" }, 500);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json({ success: false, error: "unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let body: { session_id?: string | null; message?: string } = {};
    try { body = await req.json(); } catch {
      return json({ success: false, error: "invalid_json" }, 400);
    }
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return json({ success: false, error: "invalid_input", message: "message is required" }, 400);
    if (message.length > 4000) return json({ success: false, error: "message_too_long" }, 400);
    let sessionId = typeof body.session_id === "string" && body.session_id.length > 0 ? body.session_id : null;

    // Subscription / quota gate
    const { data: existingSub, error: subSelectError } = await admin
      .from("kang_subscriptions")
      .select("id, status, questions_asked_count, free_questions_limit")
      .eq("user_id", userId)
      .maybeSingle();
    if (subSelectError) return json({ success: false, error: "subscription_lookup_failed" }, 500);

    let subscription = existingSub;
    if (!subscription) {
      const { data: created, error: createError } = await admin
        .from("kang_subscriptions")
        .insert({
          user_id: userId,
          status: "trial",
          questions_asked_count: 0,
          free_questions_limit: 5,
          last_payment_status: "none",
        })
        .select("id, status, questions_asked_count, free_questions_limit")
        .single();
      if (createError || !created) return json({ success: false, error: "subscription_create_failed" }, 500);
      subscription = created;
    }
    if (subscription.status === "trial" && subscription.questions_asked_count >= subscription.free_questions_limit) {
      return json({
        success: false,
        error: "limit_reached",
        message: "You have used your 5 free questions. Please subscribe to continue.",
      });
    }
    if (subscription.status === "suspended") {
      return json({
        success: false,
        error: "subscription_suspended",
        message: "Your kang Agent subscription is suspended. Please update your payment method to continue.",
      });
    }

    // Resolve/create session
    if (sessionId) {
      const { data: session, error: sessionError } = await admin
        .from("kang_chat_sessions").select("id, user_id").eq("id", sessionId).maybeSingle();
      if (sessionError) return json({ success: false, error: "session_lookup_failed" }, 500);
      if (!session || session.user_id !== userId) return json({ success: false, error: "session_not_found" }, 404);
    } else {
      const title = message.length > 60 ? `${message.slice(0, 57)}...` : message;
      const { data: newSession, error: newSessionError } = await admin
        .from("kang_chat_sessions").insert({ user_id: userId, title }).select("id").single();
      if (newSessionError || !newSession) return json({ success: false, error: "session_create_failed" }, 500);
      sessionId = newSession.id;
    }

    // Load recent chat history for continuity
    const { data: historyRows } = await admin
      .from("kang_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    // RAG retrieval
    let context = "";
    if (embeddingKey) {
      const queryVec = await embed(message, embeddingKey);
      if (queryVec) {
        const { data: matches } = await admin.rpc("match_kang_knowledge", {
          query_embedding: queryVec as unknown as string,
          match_count: 3,
        });
        if (Array.isArray(matches) && matches.length > 0) {
          context = matches
            .map((m: { content: string; metadata?: Record<string, unknown> }, i: number) => {
              const src = m.metadata?.source ? ` [source: ${m.metadata.source}]` : "";
              return `(${i + 1})${src}\n${m.content}`;
            })
            .join("\n\n---\n\n");
        }
      }
    }

    const systemPrompt = context
      ? `${SYSTEM_PROMPT_BASE}\n\nLOCAL FINANCIAL CONTEXT (use only if relevant to the user's question, otherwise ignore):\n${context}`
      : SYSTEM_PROMPT_BASE;

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...(historyRows ?? []).map((r: { role: string; content: string }) => ({
        role: r.role === "assistant" ? "assistant" : "user",
        content: r.content,
      })),
      { role: "user", content: message },
    ];

    // Call Qwen with streaming
    const upstream = await fetch(QWEN_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${qwenKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": OPENROUTER_REFERER,
        "X-Title": OPENROUTER_TITLE,
      },
      body: JSON.stringify({
        model: QWEN_MODEL,
        messages: chatMessages,
        stream: true,
        temperature: 0.5,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "");
      console.error("kang-chat-handler: upstream error", upstream.status, errText);
      return json(
        { success: false, error: "ai_upstream_failed", status: upstream.status, message: errText.slice(0, 500) },
        502,
      );
    }

    // Persist the user message immediately.
    await admin.from("kang_messages").insert({
      session_id: sessionId,
      user_id: userId,
      role: "user",
      content: message,
    });

    const sessionIdFinal = sessionId;
    const currentCount = subscription.questions_asked_count;
    const limit = subscription.free_questions_limit;
    const status = subscription.status;

    // Build SSE stream that pipes tokens to the client and, on close,
    // persists the full assistant message and increments the counter.
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let assistantFull = "";

    const stream = new ReadableStream({
      async start(controller) {
        // metadata frame (session id + counter snapshot before increment)
        controller.enqueue(
          encoder.encode(
            `event: meta\ndata: ${JSON.stringify({
              session_id: sessionIdFinal,
              questions_asked_count: currentCount + 1,
              free_questions_limit: limit,
              status,
            })}\n\n`,
          ),
        );

        const reader = upstream.body!.getReader();
        let buffer = "";
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const evt = JSON.parse(payload);
                const delta = evt?.choices?.[0]?.delta?.content;
                if (typeof delta === "string" && delta.length > 0) {
                  assistantFull += delta;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`),
                  );
                }
              } catch {
                // ignore malformed line
              }
            }
          }
        } catch (err) {
          console.error("kang-chat-handler: stream read error", err);
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`,
            ),
          );
        }

        // Persist + increment in background so the client can close cleanly.
        try {
          const finalText = assistantFull.trim() ||
            "I could not generate a reply. Please try again.";
          await admin.from("kang_messages").insert({
            session_id: sessionIdFinal,
            user_id: userId,
            role: "assistant",
            content: finalText,
          });
          await admin
            .from("kang_subscriptions")
            .update({ questions_asked_count: currentCount + 1 })
            .eq("user_id", userId);
          await admin
            .from("kang_chat_sessions")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", sessionIdFinal);
        } catch (persistErr) {
          console.error("kang-chat-handler: persist error", persistErr);
        }

        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("kang-chat-handler: unexpected error", err);
    return json(
      { success: false, error: "internal_error", message: (err as Error).message },
      500,
    );
  }
});
