import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const url = new URL(req.url);
    const merchant_id = url.searchParams.get('merchant_id');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!merchant_id) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: plans, error, count } = await supabase
      .from('gateway_payment_plans')
      .select('*', { count: 'exact' })
      .eq('merchant_id', merchant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return new Response(JSON.stringify({ data: plans, total: count, limit, offset }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
