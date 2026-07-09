// Shared helpers for Kang RAG ingestion (PDF + URL + text).
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMBEDDING_ENDPOINT =
  Deno.env.get("EMBEDDING_ENDPOINT") ??
  "https://openrouter.ai/api/v1/embeddings";
const EMBEDDING_MODEL =
  Deno.env.get("EMBEDDING_MODEL") ?? "openai/text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const OPENROUTER_REFERER =
  Deno.env.get("OPENROUTER_REFERER") ?? "https://kangopenbanking.com";
const OPENROUTER_TITLE = Deno.env.get("OPENROUTER_TITLE") ?? "kang Agent";

export const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export function getEmbeddingKey(): string | null {
  return (
    Deno.env.get("EMBEDDING_API_KEY") ??
    Deno.env.get("OPENROUTER_API_KEY") ??
    Deno.env.get("QWEN_API_KEY") ??
    null
  );
}

export async function embed(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(EMBEDDING_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": OPENROUTER_REFERER,
      "X-Title": OPENROUTER_TITLE,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `embedding_failed: ${res.status} ${body.slice(0, 300)}`,
    );
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

export function chunkText(
  text: string,
  size = 1000,
  overlap = 100,
): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  const step = Math.max(1, size - overlap);
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size));
    if (i + size >= clean.length) break;
    i += step;
  }
  return chunks;
}

export type AuthResult =
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; response: Response };

export async function requireAdmin(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: json({ success: false, error: "unauthorized" }, 401) };
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
    return { ok: false, response: json({ success: false, error: "unauthorized" }, 401) };
  }
  const userId = claimsData.claims.sub as string;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) {
    return { ok: false, response: json({ success: false, error: "forbidden" }, 403) };
  }
  return { ok: true, userId, admin };
}

export async function embedAndInsertChunks(
  admin: SupabaseClient,
  apiKey: string,
  chunks: string[],
  metadata: Record<string, unknown>,
): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const embedding = await embed(chunk, apiKey);
      const { error } = await admin
        .from("kang_financial_knowledge")
        .insert({
          content: chunk,
          metadata: { ...metadata, chunk_index: i, chunk_count: chunks.length },
          embedding: embedding as unknown as string,
        });
      if (error) throw error;
      inserted++;
    } catch (err) {
      errors.push(`chunk ${i}: ${(err as Error).message}`);
    }
  }
  return { inserted, errors };
}
