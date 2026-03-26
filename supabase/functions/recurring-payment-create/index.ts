import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { name, category, amount, frequency, start_date, end_date, next_payment_date, notify } = await req.json();

    if (!name || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'name and valid amount required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!start_date) {
      return new Response(JSON.stringify({ error: 'start_date required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const validFrequencies = ['Daily', 'Weekly', 'Monthly', 'Quarterly'];
    if (frequency && !validFrequencies.includes(frequency)) {
      return new Response(JSON.stringify({ error: 'frequency must be Daily, Weekly, Monthly, or Quarterly' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data, error } = await supabase.from('recurring_payments').insert({
      user_id: user.id,
      name: name.trim(),
      category: category || 'Other',
      amount,
      frequency: frequency || 'Monthly',
      start_date,
      end_date: end_date || null,
      next_payment_date: next_payment_date || start_date,
      is_active: true,
      notify: notify !== false,
    }).select().single();

    if (error) throw error;

    return new Response(JSON.stringify({ payment: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('recurring-payment-create error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
