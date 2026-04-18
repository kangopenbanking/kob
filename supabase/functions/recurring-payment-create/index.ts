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

    const body = await req.json();
    const action = body.action || 'create';

    if (action === 'toggle') {
      const { payment_id } = body;
      if (!payment_id) {
        return new Response(JSON.stringify({ error: 'payment_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify ownership
      const { data: existing, error: fetchErr } = await supabase.from('recurring_payments')
        .select('id, is_active')
        .eq('id', payment_id)
        .eq('user_id', user.id)
        .single();

      if (fetchErr || !existing) {
        return new Response(JSON.stringify({ error: 'payment not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const newActive = !existing.is_active;
      const { data, error } = await supabase.from('recurring_payments')
        .update({ is_active: newActive })
        .eq('id', payment_id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ payment: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Default: create action
    const {
      name, category, amount, frequency, start_date, end_date, next_payment_date, notify,
      payment_type, recipient_user_id, recipient_name, recipient_phone,
      source_account_id, destination_account_id, notes,
    } = body;

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
    const ptype = payment_type || 'bill';
    if (!['bill', 'salary', 'p2p'].includes(ptype)) {
      return new Response(JSON.stringify({ error: 'payment_type must be bill, salary, or p2p' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (ptype === 'p2p' && !recipient_user_id) {
      return new Response(JSON.stringify({ error: 'recipient_user_id required for P2P recurring payments' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      payment_type: ptype,
      recipient_user_id: recipient_user_id || null,
      recipient_name: recipient_name || null,
      recipient_phone: recipient_phone || null,
      source_account_id: source_account_id || null,
      destination_account_id: destination_account_id || null,
      notes: notes || null,
    }).select().single();

    if (error) throw error;

    return new Response(JSON.stringify({ payment: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('recurring-payment-create error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
