import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    switch (action) {
      case 'profile-get': return await handleProfileGet(req);
      case 'events-list': return await handleEventsList(req);
      case 'explain': return await handleExplain(req);
      case 'recompute': return await handleRecompute(req);
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    console.error('credit-ops error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function handleProfileGet(req: Request) {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase.from('credit_profiles').select('*').eq('user_id', user.id).maybeSingle();
  const { data: latestSnapshot } = await supabase.from('credit_score_snapshots').select('*').eq('user_id', user.id).order('computed_at', { ascending: false }).limit(1).maybeSingle();

  return new Response(JSON.stringify({ profile: profile || { current_score: 500, score_band: 'C', last_computed_at: null }, latest_snapshot: latestSnapshot }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleEventsList(req: Request) {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const type = url.searchParams.get('type');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = supabase.from('credit_events').select('*', { count: 'exact' }).eq('user_id', user.id).order('event_time', { ascending: false }).range(offset, offset + limit - 1);
  if (from) query = query.gte('event_time', from);
  if (to) query = query.lte('event_time', to);
  if (type) query = query.eq('event_type', type);

  const { data: events, count, error } = await query;
  if (error) throw error;

  return new Response(JSON.stringify({ events: events || [], total: count || 0, limit, offset }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleExplain(req: Request) {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: snapshot } = await supabase.from('credit_score_snapshots').select('*').eq('user_id', user.id).order('computed_at', { ascending: false }).limit(1).maybeSingle();
  if (!snapshot) {
    return new Response(JSON.stringify({ score: 500, band: 'C', factors: [], summary: 'No credit history yet. Your score starts at the baseline of 500.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const factors = snapshot.factors_json || [];
  const positive = factors.filter((f: any) => f.total_impact > 0);
  const negative = factors.filter((f: any) => f.total_impact < 0);
  let summary = `Your credit score is ${snapshot.score} (${snapshot.score_band} band). `;
  if (positive.length > 0) summary += `Positive: ${positive.map((f: any) => f.description).join('; ')}. `;
  if (negative.length > 0) summary += `Areas to improve: ${negative.map((f: any) => f.description).join('; ')}.`;
  if (!positive.length && !negative.length) summary += 'Limited credit activity detected.';

  return new Response(JSON.stringify({ score: snapshot.score, band: snapshot.score_band, factors, summary, computed_at: snapshot.computed_at }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleRecompute(req: Request) {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const res = await fetch(`${supabaseUrl}/functions/v1/credit-score`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` }, body: JSON.stringify({ action: 'engine', user_id: user.id }) });
  const result = await res.json();

  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
