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

    // Verify admin role
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { settlement_id, action, notes } = await req.json();
    if (!settlement_id || !action) {
      return new Response(JSON.stringify({ error: 'settlement_id and action are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!['approved', 'rejected', 'on_hold'].includes(action)) {
      return new Response(JSON.stringify({ error: 'invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get settlement
    const { data: settlement, error: fetchErr } = await supabase
      .from('settlement_transactions')
      .select('*')
      .eq('id', settlement_id)
      .single();

    if (fetchErr || !settlement) {
      return new Response(JSON.stringify({ error: 'settlement_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Update settlement status
    const statusMap: Record<string, string> = {
      approved: 'approved',
      rejected: 'rejected',
      on_hold: 'on_hold',
    };

    const { error: updateErr } = await supabase
      .from('settlement_transactions')
      .update({
        status: statusMap[action],
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
      })
      .eq('id', settlement_id);

    if (updateErr) throw updateErr;

    // Insert audit record
    await supabase.from('settlement_reviews').insert({
      settlement_id,
      reviewed_by: user.id,
      action,
      review_notes: notes || null,
      metadata: { ip: req.headers.get('x-forwarded-for') },
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      action_type: `settlement_${action}`,
      entity_type: 'settlement_transaction',
      entity_id: settlement_id,
      performed_by: user.id,
      details: { action, notes, net_amount: settlement.net_settlement_amount, institution_id: settlement.institution_id },
    });

    // If approved, trigger settlement processing
    if (action === 'approved') {
      await supabase.functions.invoke('settlement-process', {
        body: { settlement_id },
      });
    }

    return new Response(JSON.stringify({ success: true, action, settlement_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
