import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error('Unauthorized');

    const { group_id } = await req.json();
    if (!group_id) throw new Error('group_id required');

    // Get group and member
    const { data: group } = await supabase
      .from('njangi_groups')
      .select('*')
      .eq('id', group_id)
      .single();
    if (!group) throw new Error('Group not found');
    if (group.status !== 'active') throw new Error('Group is not active');

    const { data: member } = await supabase
      .from('njangi_members')
      .select('*')
      .eq('group_id', group_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();
    if (!member) throw new Error('Not a member of this group');

    // Check if already contributed this cycle
    const { data: existingContrib } = await supabase
      .from('njangi_contributions')
      .select('id')
      .eq('group_id', group_id)
      .eq('member_id', member.id)
      .eq('cycle_number', group.current_cycle)
      .eq('status', 'paid')
      .maybeSingle();
    if (existingContrib) throw new Error('Already contributed this cycle');

    const now = new Date();
    // Check for existing pending contribution
    const { data: pendingContrib } = await supabase
      .from('njangi_contributions')
      .select('*')
      .eq('group_id', group_id)
      .eq('member_id', member.id)
      .eq('cycle_number', group.current_cycle)
      .in('status', ['pending', 'missed', 'late'])
      .maybeSingle();

    const dueDate = pendingContrib?.due_date ? new Date(pendingContrib.due_date) : now;
    const isLate = pendingContrib ? now > dueDate : false;
    const lateInterest = isLate ? (group.contribution_amount * group.late_interest_rate / 100) : 0;

    const eventType = isLate ? 'NJANGI_CONTRIBUTION_LATE' : 'NJANGI_CONTRIBUTION_ON_TIME';

    if (pendingContrib) {
      // Update existing
      await supabase
        .from('njangi_contributions')
        .update({
          status: isLate ? 'late' : 'paid',
          paid_at: now.toISOString(),
          late_interest_amount: lateInterest,
        })
        .eq('id', pendingContrib.id);
    } else {
      // Create new
      await supabase
        .from('njangi_contributions')
        .insert({
          group_id,
          member_id: member.id,
          user_id: user.id,
          cycle_number: group.current_cycle,
          amount: group.contribution_amount,
          due_date: now.toISOString().split('T')[0],
          paid_at: now.toISOString(),
          status: 'paid',
          late_interest_amount: 0,
        });
    }

    // Emit credit event
    const { data: creditEvent } = await supabase.from('credit_events').insert({
      user_id: user.id,
      event_type: eventType,
      value_numeric: group.contribution_amount + lateInterest,
      description: `Njangi contribution ${isLate ? '(late)' : '(on-time)'} - ${group.name} cycle ${group.current_cycle}`,
      event_time: now.toISOString(),
    }).select('id').single();

    // Link credit event to contribution
    if (creditEvent) {
      const contribId = pendingContrib?.id;
      if (contribId) {
        await supabase
          .from('njangi_contributions')
          .update({ credit_event_id: creditEvent.id })
          .eq('id', contribId);
      }
    }

    // Recompute score
    let scoreResult = null;
    try {
      const { data } = await supabase.functions.invoke('credit-score-engine', {
        body: { user_id: user.id },
      });
      scoreResult = data;
    } catch (e) { console.error('Score engine error:', e); }

    return new Response(JSON.stringify({
      success: true,
      contribution_status: isLate ? 'late' : 'paid',
      late_interest: lateInterest,
      credit_event_type: eventType,
      score_delta: scoreResult?.delta || 0,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
