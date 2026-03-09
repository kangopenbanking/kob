import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

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

    const { group_id, recipient_member_id } = await req.json();
    if (!group_id) throw new Error('group_id required');

    const { data: group } = await supabase
      .from('njangi_groups')
      .select('*')
      .eq('id', group_id)
      .single();
    if (!group) throw new Error('Group not found');
    if (group.creator_id !== user.id) throw new Error('Only the group creator can trigger payouts');

    // Check all members have contributed this cycle
    const { data: members } = await supabase
      .from('njangi_members')
      .select('*')
      .eq('group_id', group_id)
      .eq('status', 'active');

    const { data: contributions } = await supabase
      .from('njangi_contributions')
      .select('*')
      .eq('group_id', group_id)
      .eq('cycle_number', group.current_cycle)
      .in('status', ['paid', 'late']);

    const paidMemberIds = new Set((contributions || []).map(c => c.member_id));
    const allPaid = (members || []).every(m => paidMemberIds.has(m.id));
    if (!allPaid) throw new Error('Not all members have contributed this cycle');

    // Select recipient
    let selectedMemberId: string;
    if (recipient_member_id) {
      // Manual selection
      const validMember = (members || []).find(m => m.id === recipient_member_id && !m.has_received_payout);
      if (!validMember) throw new Error('Invalid recipient or already received payout');
      selectedMemberId = recipient_member_id;
    } else {
      // Random selection from those who haven't received
      const eligible = (members || []).filter(m => !m.has_received_payout);
      if (eligible.length === 0) {
        // All have received — reset for next round
        await supabase
          .from('njangi_members')
          .update({ has_received_payout: false })
          .eq('group_id', group_id);
        const refreshed = (members || []).map(m => ({ ...m, has_received_payout: false }));
        const idx = Math.floor(Math.random() * refreshed.length);
        selectedMemberId = refreshed[idx].id;
      } else {
        const idx = Math.floor(Math.random() * eligible.length);
        selectedMemberId = eligible[idx].id;
      }
    }

    const totalAmount = group.contribution_amount * (members || []).length;

    // Record payout
    const { data: payout, error: payoutErr } = await supabase
      .from('njangi_payouts')
      .insert({
        group_id,
        recipient_member_id: selectedMemberId,
        cycle_number: group.current_cycle,
        amount: totalAmount,
        selection_method: recipient_member_id ? 'manual' : 'random',
      })
      .select()
      .single();
    if (payoutErr) throw payoutErr;

    // Mark recipient as having received
    await supabase
      .from('njangi_members')
      .update({ has_received_payout: true })
      .eq('id', selectedMemberId);

    // Advance cycle
    await supabase
      .from('njangi_groups')
      .update({ current_cycle: group.current_cycle + 1 })
      .eq('id', group_id);

    const recipient = (members || []).find(m => m.id === selectedMemberId);

    return new Response(JSON.stringify({
      payout,
      recipient_user_id: recipient?.user_id,
      total_amount: totalAmount,
      next_cycle: group.current_cycle + 1,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('njangi-payout error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
