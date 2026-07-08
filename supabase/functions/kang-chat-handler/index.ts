// Kang Agent — chat handler edge function
// Enforces freemium quota, persists chat history, and returns a mock assistant
// reply. AI provider integration will replace the mock response in a later step.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MOCK_ASSISTANT_REPLY =
  "Hello! I am the kang Agent. This is a mock response to confirm that Step 2 backend logic, database saving, and limit enforcement are working perfectly! How can I help you with your finances today?";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "method_not_allowed" }, 405);
  }

  try {
    // 1. Authenticate the caller.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return jsonResponse({ success: false, error: "unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // Admin client for privileged writes (subscription + ledger updates).
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2. Parse & validate body.
    let body: { session_id?: string | null; message?: string } = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: "invalid_json" }, 400);
    }
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return jsonResponse(
        { success: false, error: "invalid_input", message: "message is required" },
        400,
      );
    }
    if (message.length > 4000) {
      return jsonResponse(
        { success: false, error: "message_too_long", message: "message exceeds 4000 characters" },
        400,
      );
    }
    let sessionId =
      typeof body.session_id === "string" && body.session_id.length > 0
        ? body.session_id
        : null;

    // 3. Load or create subscription row, then enforce the freemium limit.
    const { data: existingSub, error: subSelectError } = await admin
      .from("kang_subscriptions")
      .select("id, status, questions_asked_count, free_questions_limit")
      .eq("user_id", userId)
      .maybeSingle();
    if (subSelectError) {
      console.error("kang-chat-handler: subscription lookup failed", subSelectError);
      return jsonResponse({ success: false, error: "subscription_lookup_failed" }, 500);
    }

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
      if (createError || !created) {
        console.error("kang-chat-handler: subscription create failed", createError);
        return jsonResponse({ success: false, error: "subscription_create_failed" }, 500);
      }
      subscription = created;
    }

    if (
      subscription.status === "trial" &&
      subscription.questions_asked_count >= subscription.free_questions_limit
    ) {
      return jsonResponse({
        success: false,
        error: "limit_reached",
        message:
          "You have used your 5 free questions. Please subscribe to continue.",
      });
    }

    if (subscription.status === "suspended") {
      return jsonResponse({
        success: false,
        error: "subscription_suspended",
        message:
          "Your kang Agent subscription is suspended. Please update your payment method to continue.",
      });
    }

    // 4. Resolve or create the chat session.
    if (sessionId) {
      const { data: session, error: sessionError } = await admin
        .from("kang_chat_sessions")
        .select("id, user_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (sessionError) {
        console.error("kang-chat-handler: session lookup failed", sessionError);
        return jsonResponse({ success: false, error: "session_lookup_failed" }, 500);
      }
      if (!session || session.user_id !== userId) {
        return jsonResponse({ success: false, error: "session_not_found" }, 404);
      }
    } else {
      const title = message.length > 60 ? `${message.slice(0, 57)}...` : message;
      const { data: newSession, error: newSessionError } = await admin
        .from("kang_chat_sessions")
        .insert({ user_id: userId, title })
        .select("id")
        .single();
      if (newSessionError || !newSession) {
        console.error("kang-chat-handler: session create failed", newSessionError);
        return jsonResponse({ success: false, error: "session_create_failed" }, 500);
      }
      sessionId = newSession.id;
    }

    // 5. Persist the user message.
    const { error: userMsgError } = await admin.from("kang_messages").insert({
      session_id: sessionId,
      user_id: userId,
      role: "user",
      content: message,
    });
    if (userMsgError) {
      console.error("kang-chat-handler: user message insert failed", userMsgError);
      return jsonResponse({ success: false, error: "message_persist_failed" }, 500);
    }

    // 6. Mock assistant reply (AI provider integration comes in a later step).
    const assistantMessage = MOCK_ASSISTANT_REPLY;
    const { error: assistantMsgError } = await admin.from("kang_messages").insert({
      session_id: sessionId,
      user_id: userId,
      role: "assistant",
      content: assistantMessage,
    });
    if (assistantMsgError) {
      console.error(
        "kang-chat-handler: assistant message insert failed",
        assistantMsgError,
      );
      return jsonResponse({ success: false, error: "assistant_persist_failed" }, 500);
    }

    // 7. Increment counter + bump session updated_at.
    const { error: incError } = await admin
      .from("kang_subscriptions")
      .update({
        questions_asked_count: subscription.questions_asked_count + 1,
      })
      .eq("user_id", userId);
    if (incError) {
      console.error("kang-chat-handler: counter increment failed", incError);
    }

    await admin
      .from("kang_chat_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    return jsonResponse({
      success: true,
      session_id: sessionId,
      assistant_message: assistantMessage,
      questions_asked_count: subscription.questions_asked_count + 1,
      free_questions_limit: subscription.free_questions_limit,
      status: subscription.status,
    });
  } catch (err) {
    console.error("kang-chat-handler: unexpected error", err);
    return jsonResponse(
      { success: false, error: "internal_error", message: (err as Error).message },
      500,
    );
  }
});
