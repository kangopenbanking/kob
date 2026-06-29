// /functions/v1/nium-rfi
// GET            -> list caller's open Requests-For-Information
// POST {id, ...} -> submit a response to an RFI; sets status = responded
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return j({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: claims, error: cErr } = await anon.auth.getClaims(auth.replace("Bearer ", ""));
  if (cErr || !claims?.claims?.sub) return j({ error: "unauthorized" }, 401);
  const userId = claims.claims.sub as string;

  const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (req.method === "GET") {
    const u = new URL(req.url);
    const status = u.searchParams.get("status");
    let q = svc.from("nium_rfi").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return j({ error: error.message }, 500);
    return j({ rfis: data });
  }

  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return j({ error: "invalid_json" }, 400); }
  if (!body.id) return j({ error: "missing_field", field: "id" }, 400);
  if (!body.response_payload || typeof body.response_payload !== "object") {
    return j({ error: "missing_field", field: "response_payload" }, 400);
  }

  const { data: rfi } = await svc.from("nium_rfi").select("*").eq("id", body.id).eq("user_id", userId).maybeSingle();
  if (!rfi) return j({ error: "rfi_not_found" }, 404);
  if (rfi.status !== "open") return j({ error: "rfi_not_open", status: rfi.status }, 409);

  const { data: updated, error } = await svc.from("nium_rfi").update({
    status: "responded",
    response_payload: body.response_payload,
    responded_by: userId,
    responded_at: new Date().toISOString(),
  }).eq("id", body.id).select().single();
  if (error) return j({ error: error.message }, 500);

  return j({ rfi: updated }, 200);
});

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}
