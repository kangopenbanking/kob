// Consolidated router for njangi operations: create, join, contribute, payout, overdue-detect
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { verifyCronAuth } from '../_shared/cron-auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { sendManagedEmail, getUserName } from '../_shared/send-managed-email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    let body: any;
    try { body = await req.json(); } catch { body = {}; }
    const action = body.action;
    if (!action) return new Response(JSON.stringify({ error: 'action parameter required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    switch (action) {
      case 'create': return handleCreate(req, body);
      case 'join': return handleJoin(req, body);
      case 'contribute': return handleContribute(req, body);
      case 'payout': return handlePayout(req, body);
      case 'overdue-detect': return handleOverdueDetect(req);
      default: return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    console.error('njangi-ops error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function getAuthUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Unauthorized');
  return { user, supabase };
}

async function handleCreate(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { name, contribution_amount, frequency, payout_method, late_interest_rate, max_members, institution_id } = body;
  if (!name || !contribution_amount) throw new Error('name and contribution_amount required');

  const { data: group, error: groupErr } = await supabase.from('njangi_groups').insert({ name, institution_id: institution_id || null, creator_id: user.id, contribution_amount, frequency: frequency || 'monthly', payout_method: payout_method || 'random', late_interest_rate: late_interest_rate || 0, max_members: max_members || 5, status: 'forming', current_cycle: 1 }).select().single();
  if (groupErr) throw groupErr;

  await supabase.from('njangi_members').insert({ group_id: group.id, user_id: user.id, status: 'active' });
  return new Response(JSON.stringify({ group }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleJoin(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { group_id } = body;
  if (!group_id) throw new Error('group_id required');

  const { data: group } = await supabase.from('njangi_groups').select('*, njangi_members(count)').eq('id', group_id).single();
  if (!group) throw new Error('Group not found');
  if (group.status !== 'forming' && group.status !== 'active') throw new Error('Group is not accepting members');

  const memberCount = group.njangi_members?.[0]?.count || 0;
  if (memberCount >= group.max_members) throw new Error('Group is full');

  const { data: existing } = await supabase.from('njangi_members').select('id').eq('group_id', group_id).eq('user_id', user.id).maybeSingle();
  if (existing) throw new Error('Already a member');

  const { data: member, error: memberErr } = await supabase.from('njangi_members').insert({ group_id, user_id: user.id, status: 'active' }).select().single();
  if (memberErr) throw memberErr;

  // ✉️ Notify group creator about new member
  const { data: groupData } = await supabase.from('njangi_groups').select('creator_id, name, max_members').eq('id', group_id).single();
  if (groupData) {
    const newMemberName = await getUserName(supabase, user.id);
    const creatorName = await getUserName(supabase, groupData.creator_id);
    sendManagedEmail(supabase, {
      email_key: 'njangi_member_joined',
      recipient_user_id: groupData.creator_id,
      variables: {
        creator_name: creatorName,
        member_name: newMemberName,
        group_name: groupData.name,
        member_count: (memberCount + 1).toString(),
        max_members: groupData.max_members.toString(),
      },
    });
  }

  return new Response(JSON.stringify({ member }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleContribute(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { group_id } = body;
  if (!group_id) throw new Error('group_id required');

  const { data: group } = await supabase.from('njangi_groups').select('*').eq('id', group_id).single();
  if (!group) throw new Error('Group not found');
  if (group.status !== 'active') throw new Error('Group is not active');

  const { data: member } = await supabase.from('njangi_members').select('*').eq('group_id', group_id).eq('user_id', user.id).eq('status', 'active').single();
  if (!member) throw new Error('Not a member of this group');

  const { data: existingContrib } = await supabase.from('njangi_contributions').select('id').eq('group_id', group_id).eq('member_id', member.id).eq('cycle_number', group.current_cycle).eq('status', 'paid').maybeSingle();
  if (existingContrib) throw new Error('Already contributed this cycle');

  const now = new Date();
  const { data: pendingContrib } = await supabase.from('njangi_contributions').select('*').eq('group_id', group_id).eq('member_id', member.id).eq('cycle_number', group.current_cycle).in('status', ['pending', 'missed', 'late']).maybeSingle();

  const dueDate = pendingContrib?.due_date ? new Date(pendingContrib.due_date) : now;
  const isLate = pendingContrib ? now > dueDate : false;
  const lateInterest = isLate ? (group.contribution_amount * group.late_interest_rate / 100) : 0;
  const eventType = isLate ? 'NJANGI_CONTRIBUTION_LATE' : 'NJANGI_CONTRIBUTION_ON_TIME';

  if (pendingContrib) {
    await supabase.from('njangi_contributions').update({ status: isLate ? 'late' : 'paid', paid_at: now.toISOString(), late_interest_amount: lateInterest }).eq('id', pendingContrib.id);
  } else {
    await supabase.from('njangi_contributions').insert({ group_id, member_id: member.id, user_id: user.id, cycle_number: group.current_cycle, amount: group.contribution_amount, due_date: now.toISOString().split('T')[0], paid_at: now.toISOString(), status: 'paid', late_interest_amount: 0 });
  }

  const daysLate = isLate ? Math.floor((now.getTime() - dueDate.getTime()) / 86400000) : 0;
  await supabase.from('credit_events').insert({ user_id: user.id, event_type: eventType, value_numeric: isLate ? daysLate : group.contribution_amount, description: `Njangi contribution ${isLate ? `(late by ${daysLate} days)` : '(on-time)'} - ${group.name} cycle ${group.current_cycle}`, event_time: now.toISOString(), metadata: { group_id, cycle_number: group.current_cycle, amount: group.contribution_amount, late_interest: lateInterest, days_late: daysLate }, source: 'njangi_service' });

  let scoreResult = null;
  try { const { data } = await supabase.functions.invoke('credit-score', { body: { action: 'engine', user_id: user.id } }); scoreResult = data; } catch (e) { console.error('Score engine error:', e); }

  return new Response(JSON.stringify({ success: true, contribution_status: isLate ? 'late' : 'paid', late_interest: lateInterest, credit_event_type: eventType, score_delta: scoreResult?.delta || 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handlePayout(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { group_id, recipient_member_id } = body;
  if (!group_id) throw new Error('group_id required');

  const { data: group } = await supabase.from('njangi_groups').select('*').eq('id', group_id).single();
  if (!group) throw new Error('Group not found');
  if (group.creator_id !== user.id) throw new Error('Only the group creator can trigger payouts');

  const { data: members } = await supabase.from('njangi_members').select('*').eq('group_id', group_id).eq('status', 'active');
  const { data: contributions } = await supabase.from('njangi_contributions').select('*').eq('group_id', group_id).eq('cycle_number', group.current_cycle).in('status', ['paid', 'late']);

  const paidMemberIds = new Set((contributions || []).map(c => c.member_id));
  const allPaid = (members || []).every(m => paidMemberIds.has(m.id));
  if (!allPaid) throw new Error('Not all members have contributed this cycle');

  let selectedMemberId: string;
  if (recipient_member_id) {
    const validMember = (members || []).find(m => m.id === recipient_member_id && !m.has_received_payout);
    if (!validMember) throw new Error('Invalid recipient or already received payout');
    selectedMemberId = recipient_member_id;
  } else {
    const eligible = (members || []).filter(m => !m.has_received_payout);
    if (eligible.length === 0) {
      await supabase.from('njangi_members').update({ has_received_payout: false }).eq('group_id', group_id);
      const refreshed = (members || []).map(m => ({ ...m, has_received_payout: false }));
      selectedMemberId = refreshed[Math.floor(Math.random() * refreshed.length)].id;
    } else {
      selectedMemberId = eligible[Math.floor(Math.random() * eligible.length)].id;
    }
  }

  const totalAmount = group.contribution_amount * (members || []).length;
  const { data: payout, error: payoutErr } = await supabase.from('njangi_payouts').insert({ group_id, recipient_member_id: selectedMemberId, cycle_number: group.current_cycle, amount: totalAmount, selection_method: recipient_member_id ? 'manual' : 'random' }).select().single();
  if (payoutErr) throw payoutErr;

  await supabase.from('njangi_members').update({ has_received_payout: true }).eq('id', selectedMemberId);
  await supabase.from('njangi_groups').update({ current_cycle: group.current_cycle + 1 }).eq('id', group_id);

  const recipient = (members || []).find(m => m.id === selectedMemberId);
  return new Response(JSON.stringify({ payout, recipient_user_id: recipient?.user_id, total_amount: totalAmount, next_cycle: group.current_cycle + 1 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleOverdueDetect(req: Request) {
  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const today = new Date().toISOString().split('T')[0];

  const { data: overdue, error } = await supabase.from('njangi_contributions').select('*, njangi_groups(name)').eq('status', 'pending').lt('due_date', today);
  if (error) throw error;

  let processed = 0;
  for (const contrib of (overdue || [])) {
    await supabase.from('njangi_contributions').update({ status: 'missed' }).eq('id', contrib.id);
    await supabase.from('credit_events').insert({ user_id: contrib.user_id, event_type: 'NJANGI_CONTRIBUTION_MISSED', value_numeric: contrib.amount, description: `Missed njangi contribution - ${contrib.njangi_groups?.name || 'Unknown'} cycle ${contrib.cycle_number}`, event_time: new Date().toISOString() });
    try { await supabase.functions.invoke('credit-score', { body: { action: 'engine', user_id: contrib.user_id } }); } catch (e) { console.error('Score recompute failed:', e); }
    processed++;
  }

  return new Response(JSON.stringify({ processed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}