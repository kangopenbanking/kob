// Kang Agent — chat history (session list with previews)
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
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: sessions, count, error } = await admin
      .from("kang_chat_sessions")
      .select("id, title, created_at, updated_at", { count: "exact" })
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (error) return json({ success: false, error: error.message }, 500);

    const ids = (sessions ?? []).map((s) => s.id);
    let previews: Record<string, { content: string; created_at: string; role: string } | undefined> = {};
    if (ids.length) {
      const { data: msgs } = await admin
        .from("kang_messages")
        .select("session_id, content, role, created_at")
        .in("session_id", ids)
        .order("created_at", { ascending: false });
      for (const m of msgs ?? []) {
        if (!previews[m.session_id]) {
          previews[m.session_id] = { content: m.content, created_at: m.created_at, role: m.role };
        }
      }
    }

    const enriched = (sessions ?? []).map((s) => ({
      ...s,
      last_message: previews[s.id] ?? null,
    }));

    const total = count ?? enriched.length;
    return json({
      success: true,
      sessions: enriched,
      total_count: total,
      has_more: from + enriched.length < total,
      page,
      limit,
    });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
