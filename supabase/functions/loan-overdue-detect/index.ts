import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const graceDays = 3;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - graceDays);
    const cutoff = cutoffDate.toISOString().split('T')[0];

    // Find overdue schedule items not yet flagged
    const { data: overdueItems, error } = await supabase
      .from('loan_schedule')
      .select('id, loan_id, due_date, total_amount, paid_amount, installment_number')
      .in('status', ['pending', 'partial'])
      .eq('missed_event_created', false)
      .lt('due_date', cutoff);

    if (error) throw error;

    console.log(`Found ${(overdueItems || []).length} overdue schedule items`);

    const affectedUsers = new Set<string>();
    let processed = 0;

    for (const item of (overdueItems || [])) {
      // Get loan to find user_id and institution_id
      const { data: loan } = await supabase
        .from('loan_accounts')
        .select('user_id, institution_id')
        .eq('id', item.loan_id)
        .single();

      if (!loan) continue;

      const daysLate = Math.floor((Date.now() - new Date(item.due_date).getTime()) / (1000 * 60 * 60 * 24));

      // Insert credit event
      await supabase.from('credit_events').insert({
        user_id: loan.user_id,
        institution_id: loan.institution_id,
        event_type: 'LOAN_INSTALLMENT_MISSED',
        event_time: new Date().toISOString(),
        value_numeric: daysLate,
        metadata: {
          loan_id: item.loan_id,
          schedule_item_id: item.id,
          installment_number: item.installment_number,
          due_date: item.due_date,
          amount_due: Number(item.total_amount) - Number(item.paid_amount),
        },
        source: 'overdue_job',
      });

      // Mark dedupe flag and update status
      await supabase
        .from('loan_schedule')
        .update({ missed_event_created: true, status: 'overdue' })
        .eq('id', item.id);

      affectedUsers.add(loan.user_id);
      processed++;
    }

    // Recompute scores for affected users
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    for (const userId of affectedUsers) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/credit-score-engine`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ user_id: userId }),
        });
      } catch (e) {
        console.error(`Score recompute failed for ${userId}:`, e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed,
      users_affected: affectedUsers.size,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('loan-overdue-detect error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
