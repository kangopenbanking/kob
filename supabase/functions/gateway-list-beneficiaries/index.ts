import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const url = new URL(req.url);
    const merchantId = url.searchParams.get('merchant_id');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const { data: merchants } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id);
    const merchantIds = merchants?.map(m => m.id) || [];
    if (merchantIds.length === 0) return new Response(JSON.stringify({ data: [], total: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let query = supabase.from('gateway_beneficiaries').select('*', { count: 'exact' }).eq('is_active', true);
    if (merchantId && merchantIds.includes(merchantId)) query = query.eq('merchant_id', merchantId);
    else query = query.in('merchant_id', merchantIds);

    const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;

    return new Response(JSON.stringify({ data, total: count, limit, offset }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] list-beneficiaries error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
