// Daily Needs — Search across stores + products
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const vertical = url.searchParams.get("vertical"); // food | pharmacy | null
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 50);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const storesQ = supabase.from("daily_needs_stores")
    .select("id, name, slug, vertical, logo_url, banner_url, rating, preparation_time_min")
    .eq("status", "active")
    .limit(limit);
  if (vertical) storesQ.eq("vertical", vertical);
  if (q) storesQ.ilike("name", `%${q}%`);

  const productsQ = supabase.from("daily_needs_products")
    .select("id, name, price_xaf, store_id, daily_needs_stores!inner(vertical, status)")
    .eq("is_available", true)
    .eq("daily_needs_stores.status", "active")
    .limit(limit);
  if (vertical) productsQ.eq("daily_needs_stores.vertical", vertical);
  if (q) productsQ.ilike("name", `%${q}%`);

  const [stores, products] = await Promise.all([storesQ, productsQ]);

  return new Response(JSON.stringify({
    query: q,
    vertical,
    stores: stores.data ?? [],
    products: products.data ?? [],
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
