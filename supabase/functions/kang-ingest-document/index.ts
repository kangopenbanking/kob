// Kang Agent — Knowledge ingestion (admin-only)
// Accepts text (or an array of chunks) + metadata, generates 1536-dim
// embeddings via the DashScope-compatible embeddings endpoint, and stores
// them in public.kang_financial_knowledge for RAG retrieval.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const EMBEDDING_ENDPOINT =
  Deno.env.get("EMBEDDING_ENDPOINT") ??
  "https://openrouter.ai/api/v1/embeddings";
const EMBEDDING_MODEL =
  Deno.env.get("EMBEDDING_MODEL") ?? "openai/text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const OPENROUTER_REFERER =
  Deno.env.get("OPENROUTER_REFERER") ?? "https://kangopenbanking.com";
const OPENROUTER_TITLE = Deno.env.get("OPENROUTER_TITLE") ?? "kang Agent";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function embed(text: string, apiKey: string): Promise<number[]> {
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
    const body = await res.text();
    throw new Error(`embedding_failed: ${res.status} ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error("embedding_missing");
  if (vec.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `embedding_dimension_mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${vec.length}`,
    );
  }
  return vec;
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
    const embeddingKey =
      Deno.env.get("EMBEDDING_API_KEY") ?? Deno.env.get("OPENROUTER_API_KEY") ?? Deno.env.get("QWEN_API_KEY");

    if (!embeddingKey) {
      return json({ success: false, error: "embedding_key_missing" }, 500);
    }

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

    // Admin gate
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) return json({ success: false, error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const rawChunks: string[] = Array.isArray(body?.chunks)
      ? body.chunks.filter((c: unknown) => typeof c === "string")
      : typeof body?.content === "string"
        ? [body.content]
        : [];
    const chunks = rawChunks.map((c) => c.trim()).filter((c) => c.length > 0);
    if (chunks.length === 0) {
      return json({ success: false, error: "no_content" }, 400);
    }
    if (chunks.length > 25) {
      return json({ success: false, error: "too_many_chunks", limit: 25 }, 400);
    }
    const metadata = typeof body?.metadata === "object" && body.metadata
      ? body.metadata
      : {};

    const inserted: Array<{ id: string; length: number }> = [];
    for (const chunk of chunks) {
      const embedding = await embed(chunk, embeddingKey);
      const { data, error } = await admin
        .from("kang_financial_knowledge")
        .insert({
          content: chunk,
          metadata,
          embedding: embedding as unknown as string,
        })
        .select("id")
        .single();
      if (error) throw error;
      inserted.push({ id: (data as { id: string }).id, length: chunk.length });
    }

    return json({ success: true, inserted_count: inserted.length, inserted });
  } catch (err) {
    console.error("kang-ingest-document error", err);
    return json(
      { success: false, error: "internal_error", message: (err as Error).message },
      500,
    );
  }
});
