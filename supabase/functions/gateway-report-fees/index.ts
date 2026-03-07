import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

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

    // Verify access
    const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    const isAdmin = !!adminRole;

    if (merchantId && !isAdmin) {
      const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchantId).eq('user_id', user.id).single();
      if (!merchant) return problem(403, 'Forbidden', 'Not authorized for this merchant');
    }

    let query = supabase.from('gateway_charges').select('merchant_id, amount, fee_amount, net_amount, channel, currency, status, created_at')
      .eq('status', 'successful');
    if (merchantId) query = query.eq('merchant_id', merchantId);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    query = query.order('created_at', { ascending: false }).limit(1000);

    const { data: charges, error } = await query;
    if (error) throw error;

    const summary = {
      total_charges: charges?.length || 0,
      total_volume: 0,
      total_fees: 0,
      total_net: 0,
      by_channel: {} as Record<string, { count: number; volume: number; fees: number }>,
      by_currency: {} as Record<string, { count: number; volume: number; fees: number }>,
    };

    for (const charge of charges || []) {
      summary.total_volume += charge.amount || 0;
      summary.total_fees += charge.fee_amount || 0;
      summary.total_net += charge.net_amount || 0;

      const ch = charge.channel || 'unknown';
      if (!summary.by_channel[ch]) summary.by_channel[ch] = { count: 0, volume: 0, fees: 0 };
      summary.by_channel[ch].count++;
      summary.by_channel[ch].volume += charge.amount || 0;
      summary.by_channel[ch].fees += charge.fee_amount || 0;

      const cur = charge.currency || 'XAF';
      if (!summary.by_currency[cur]) summary.by_currency[cur] = { count: 0, volume: 0, fees: 0 };
      summary.by_currency[cur].count++;
      summary.by_currency[cur].volume += charge.amount || 0;
      summary.by_currency[cur].fees += charge.fee_amount || 0;
    }

    return new Response(JSON.stringify({ data: summary }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return problem(500, 'Internal Server Error', err.message);
  }
});
