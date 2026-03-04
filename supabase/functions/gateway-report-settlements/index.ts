import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function problem(status: number, title: string, detail: string) {
  return new Response(JSON.stringify({ type: 'about:blank', title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return problem(401, 'Unauthorized', 'Missing Authorization header');

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return problem(401, 'Unauthorized', 'Invalid or expired token');

    const url = new URL(req.url);
    const merchantId = url.searchParams.get('merchant_id');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const { data: merchants } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id);
    const merchantIds = merchants?.map(m => m.id) || [];
    if (merchantIds.length === 0) {
      return new Response(JSON.stringify({ data: [], summary: {} }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const targetIds = merchantId && merchantIds.includes(merchantId) ? [merchantId] : merchantIds;

    let query = supabase.from('gateway_settlements').select('*').in('merchant_id', targetIds);
    if (from) query = query.gte('period_start', from);
    if (to) query = query.lte('period_end', to);

    const { data: settlements, error } = await query.order('created_at', { ascending: false }).limit(200);
    if (error) throw error;

    const summary = {
      total_settlements: (settlements || []).length,
      total_settled: (settlements || []).filter(s => s.status === 'paid').reduce((sum, s) => sum + (s.amount || 0), 0),
      total_pending: (settlements || []).filter(s => s.status === 'pending').reduce((sum, s) => sum + (s.amount || 0), 0),
      total_fees: (settlements || []).reduce((sum, s) => sum + (s.fees_total || 0), 0),
    };

    return new Response(JSON.stringify({ summary, data: settlements }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return problem(500, 'Internal Server Error', err.message);
  }
});
