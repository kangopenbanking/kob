// Kang Agent — session messages (paginated, ownership-checked)
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ success: false, error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ success: false, error: "unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) return json({ success: false, error: "session_id_required" }, 400);

    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Ownership check
    const { data: session, error: sessErr } = await admin
      .from("kang_chat_sessions")
      .select("id, user_id, title, created_at, updated_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessErr) return json({ success: false, error: sessErr.message }, 500);
    if (!session) return json({ success: false, error: "session_not_found" }, 404);
    if (session.user_id !== userId) return json({ success: false, error: "forbidden" }, 403);

    const { data: messages, count, error } = await admin
      .from("kang_messages")
      .select("id, role, content, created_at", { count: "exact" })
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .range(from, to);

    if (error) return json({ success: false, error: error.message }, 500);

    const total = count ?? (messages?.length ?? 0);
    return json({
      success: true,
      messages: messages ?? [],
      session_info: {
        id: session.id,
        title: session.title,
        created_at: session.created_at,
        updated_at: session.updated_at,
      },
      total_count: total,
      has_more: from + (messages?.length ?? 0) < total,
      page,
      limit,
    });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
