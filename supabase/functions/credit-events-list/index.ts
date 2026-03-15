import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Support both URL params (GET) and body params (POST) for flexibility
    const url = new URL(req.url);
    let bodyParams: any = {};
    if (req.method === 'POST') {
      try { bodyParams = await req.json(); } catch { bodyParams = {}; }
    }

    const from = url.searchParams.get('from') || bodyParams.from || null;
    const to = url.searchParams.get('to') || bodyParams.to || null;
    const type = url.searchParams.get('type') || bodyParams.type || null;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || bodyParams.limit || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || bodyParams.offset || '0');

    let query = supabase
      .from('credit_events')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('event_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (from) query = query.gte('event_time', from);
    if (to) query = query.lte('event_time', to);
    if (type) query = query.eq('event_type', type);

    const { data: events, count, error } = await query;
    if (error) throw error;

    return new Response(JSON.stringify({
      events: events || [],
      total: count || 0,
      limit,
      offset,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('credit-events-list error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
