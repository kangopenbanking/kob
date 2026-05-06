// merchants-qr-directory — Public, paginated list of KYB-approved KOB merchants
// that external virtual-card apps can use to recognise QR payees.
//
// GET /functions/v1/merchants-qr-directory?country=CM&category=5411&cursor=&limit=25
//
// Public (no auth required). Reads from the public.merchant_qr_directory view.
// Standing Order P1 (Public First) + P3 (Free Sandbox).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405);
  }
  const url = new URL(req.url);
  const country = url.searchParams.get('country')?.toUpperCase() || null;
  const category = url.searchParams.get('category') || null;
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '25', 10) || 25, 1), 100);

  if (country && !/^[A-Z]{2}$/.test(country)) return json({ error: 'invalid_country' }, 400);
  if (category && !/^[0-9]{3,5}$/.test(category)) return json({ error: 'invalid_category' }, 400);
  if (cursor && !UUID_RE.test(cursor)) return json({ error: 'invalid_cursor' }, 400);

  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  // Note: status/kyb_status filtering already enforced by the merchant_qr_directory view.
  // Filtering on raw `status='active'` here would exclude rows whose underlying value is
  // 'VERIFIED' (uppercase) which the view legitimately exposes.
  let q = supabase
    .from('merchant_qr_directory')
    .select('merchant_id, name, environment, status, mcc, country, logo_url, verified, created_at, kob_wallet_id, wallet_currency')
    .eq('verified', true)
    .order('merchant_id', { ascending: true })
    .limit(limit + 1);

  if (country) q = q.eq('country', country);
  if (category) q = q.eq('mcc', category);
  if (cursor) q = q.gt('merchant_id', cursor);

  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].merchant_id : null;

  return json({
    object: 'list',
    data: items,
    has_more: hasMore,
    next_cursor: nextCursor,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
  });
}
