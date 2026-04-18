// Consolidated router for njangi operations: create, join, leave, contribute, payout, overdue-detect
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
    if (!action) return json({ error: 'action parameter required' }, 400);

    switch (action) {
      case 'create': return handleCreate(req, body);
      case 'join': return handleJoin(req, body);
      case 'leave': return handleLeave(req, body);
      case 'contribute': return handleContribute(req, body);
      case 'payout': return handlePayout(req, body);
      case 'overdue-detect': return handleOverdueDetect(req);
      default: return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error('njangi-ops error:', err);
    const msg = err?.message || 'An internal error occurred.';
    return json({ error: msg }, 400);
  }
});

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function getAuthUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Unauthorized');
  return { user, supabase };
}

// ─── Wallet helpers (mirrors piggybank pattern) ───
async function getPrimaryWallet(supabase: any, userId: string) {
  const { data } = await supabase.from('accounts').select('id').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: true }).limit(1).maybeSingle();
  return data?.id || null;
}

async function debitWallet(supabase: any, accountId: string, amount: number, userId: string, description: string, metadata: any) {
  const { error: rpcErr } = await supabase.rpc('atomic_debit_balance', { _account_id: accountId, _amount: amount, _currency: 'XAF' });
  if (rpcErr) {
    const msg = rpcErr.message || 'Failed to debit wallet';
    if (msg.includes('Insufficient funds')) throw new Error('insufficient_funds');
    throw new Error(msg);
  }
  const now = new Date().toISOString();
  await supabase.from('transactions').insert({
    account_id: accountId, amount, currency: 'XAF',
    credit_debit_indicator: 'Debit', status: 'Booked',
    booking_datetime: now, value_datetime: now,
    transaction_type: 'njangi_contribution', transaction_information: description,
    user_id: userId, metadata,
  });
}

async function creditWallet(supabase: any, accountId: string, amount: number, userId: string, description: string, metadata: any) {
  // ✅ G8: Atomic credit via single RPC (row-locked, currency-validated, auto-creates balance)
  const { error: rpcErr } = await supabase.rpc('atomic_credit_balance', {
    _account_id: accountId, _amount: amount, _currency: 'XAF',
  });
  if (rpcErr) throw new Error(rpcErr.message || 'Failed to credit wallet');

  const now = new Date().toISOString();
  await supabase.from('transactions').insert({
    account_id: accountId, amount, currency: 'XAF',
    credit_debit_indicator: 'Credit', status: 'Booked',
    booking_datetime: now, value_datetime: now,
    transaction_type: 'njangi_payout', transaction_information: description,
    user_id: userId, metadata,
  });
}

// ─── CREATE ───
async function handleCreate(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { name, contribution_amount, frequency, payout_method, late_interest_rate, max_members, institution_id } = body;
  if (!name || !contribution_amount) throw new Error('name and contribution_amount required');

  const { data: group, error: groupErr } = await supabase.from('njangi_groups').insert({
    name, institution_id: institution_id || null, creator_id: user.id,
    contribution_amount, frequency: frequency || 'monthly',
    payout_method: payout_method || 'random',
    late_interest_rate: late_interest_rate || 0,
    max_members: max_members || 5, status: 'forming', current_cycle: 1,
  }).select().single();
  if (groupErr) throw groupErr;

  await supabase.from('njangi_members').insert({ group_id: group.id, user_id: user.id, status: 'active' });
  return json({ group });
}

// ─── JOIN (auto-activate when full or 2+ members) ───
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

  const newCount = memberCount + 1;

  // ✅ Auto-activate when group reaches max OR creator chose to start with at least 2 members
  if (group.status === 'forming' && newCount >= group.max_members) {
    await activateGroup(supabase, group.id, group.contribution_amount, group.frequency, group.current_cycle);
  }

  // Notify creator
  const { data: groupData } = await supabase.from('njangi_groups').select('creator_id, name, max_members').eq('id', group_id).single();
  if (groupData) {
    const newMemberName = await getUserName(supabase, user.id);
    const creatorName = await getUserName(supabase, groupData.creator_id);
    sendManagedEmail(supabase, {
      email_key: 'njangi_member_joined',
      recipient_user_id: groupData.creator_id,
      variables: {
        creator_name: creatorName, member_name: newMemberName,
        group_name: groupData.name, member_count: newCount.toString(),
        max_members: groupData.max_members.toString(),
      },
    });
  }

  return json({ member, member_count: newCount, max_members: group.max_members, activated: newCount >= group.max_members });
}

// Generate this cycle's pending contributions for all members
async function activateGroup(supabase: any, groupId: string, amount: number, frequency: string, cycleNumber: number) {
  await supabase.from('njangi_groups').update({ status: 'active' }).eq('id', groupId);
  const { data: members } = await supabase.from('njangi_members').select('id, user_id').eq('group_id', groupId).eq('status', 'active');
  if (!members || members.length === 0) return;

  const dueDate = new Date();
  if (frequency === 'weekly') dueDate.setDate(dueDate.getDate() + 7);
  else dueDate.setMonth(dueDate.getMonth() + 1);

  const rows = members.map((m: any) => ({
    group_id: groupId, member_id: m.id, user_id: m.user_id,
    cycle_number: cycleNumber, amount,
    due_date: dueDate.toISOString().split('T')[0],
    status: 'pending', late_interest_amount: 0,
  }));
  await supabase.from('njangi_contributions').insert(rows);

  // Notify members
  for (const m of members) {
    await supabase.from('app_notifications').insert({
      user_id: m.user_id, type: 'info',
      title: 'Njangi Cycle Started',
      message: `Cycle ${cycleNumber} is now active. Your contribution of ${amount.toLocaleString()} XAF is due ${dueDate.toISOString().split('T')[0]}.`,
      icon: 'njangi', metadata: { group_id: groupId, cycle_number: cycleNumber },
    });
  }
}

// ─── LEAVE (G5) ───
async function handleLeave(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { group_id } = body;
  if (!group_id) throw new Error('group_id required');

  const { data: group } = await supabase.from('njangi_groups').select('*').eq('id', group_id).single();
  if (!group) throw new Error('Group not found');

  // Block leaving if active and unpaid contributions exist
  if (group.status === 'active') {
    const { data: unpaid } = await supabase.from('njangi_contributions')
      .select('id').eq('group_id', group_id).eq('user_id', user.id)
      .in('status', ['pending', 'late', 'missed']).limit(1);
    if (unpaid && unpaid.length > 0) {
      throw new Error('Cannot leave: pending contributions. Complete or wait until cycle ends.');
    }
  }

  // Creator cannot leave a forming group with other members — must delete instead
  if (group.creator_id === user.id) {
    const { data: otherMembers } = await supabase.from('njangi_members').select('id').eq('group_id', group_id).neq('user_id', user.id);
    if (otherMembers && otherMembers.length > 0) {
      throw new Error('Group creator cannot leave while other members exist. Remove them first or wait for cycle completion.');
    }
    // Solo creator → delete the group entirely
    await supabase.from('njangi_groups').delete().eq('id', group_id);
    return json({ success: true, deleted: true });
  }

  await supabase.from('njangi_members').update({ status: 'inactive' }).eq('group_id', group_id).eq('user_id', user.id);
  return json({ success: true, deleted: false });
}

// ─── CONTRIBUTE (with idempotency, real wallet debit, auto-activate fallback) ───
async function handleContribute(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { group_id, idempotency_key } = body;
  if (!group_id) throw new Error('group_id required');

  // ✅ G2: Idempotency check
  if (idempotency_key) {
    const { data: existingTx } = await supabase.from('transactions')
      .select('id, status, amount')
      .eq('user_id', user.id)
      .eq('transaction_type', 'njangi_contribution')
      .filter('metadata->>idempotency_key', 'eq', idempotency_key)
      .maybeSingle();
    if (existingTx) {
      return json({ success: true, idempotent_replay: true, transaction_id: existingTx.id });
    }
  }

  const { data: group } = await supabase.from('njangi_groups').select('*, njangi_members(count)').eq('id', group_id).single();
  if (!group) throw new Error('Group not found');

  // ✅ G3: Auto-activate forming group if full
  if (group.status === 'forming') {
    const memberCount = group.njangi_members?.[0]?.count || 0;
    if (memberCount >= group.max_members) {
      await activateGroup(supabase, group.id, group.contribution_amount, group.frequency, group.current_cycle);
      group.status = 'active';
    } else {
      throw new Error(`Group not yet active. Needs ${group.max_members - memberCount} more member(s).`);
    }
  }
  if (group.status !== 'active') throw new Error('Group is not active');

  const { data: member } = await supabase.from('njangi_members').select('*').eq('group_id', group_id).eq('user_id', user.id).eq('status', 'active').single();
  if (!member) throw new Error('Not a member of this group');

  const { data: existingContrib } = await supabase.from('njangi_contributions').select('id').eq('group_id', group_id).eq('member_id', member.id).eq('cycle_number', group.current_cycle).in('status', ['paid', 'late']).maybeSingle();
  if (existingContrib) throw new Error('Already contributed this cycle');

  const now = new Date();
  const { data: pendingContrib } = await supabase.from('njangi_contributions').select('*').eq('group_id', group_id).eq('member_id', member.id).eq('cycle_number', group.current_cycle).in('status', ['pending', 'missed', 'late']).maybeSingle();

  const dueDate = pendingContrib?.due_date ? new Date(pendingContrib.due_date) : now;
  const isLate = pendingContrib ? now > dueDate : false;
  const lateInterest = isLate ? (group.contribution_amount * group.late_interest_rate / 100) : 0;
  const totalDebit = group.contribution_amount + lateInterest;
  const eventType = isLate ? 'NJANGI_CONTRIBUTION_LATE' : 'NJANGI_CONTRIBUTION_ON_TIME';

  // ✅ G1: Real wallet debit
  const walletId = await getPrimaryWallet(supabase, user.id);
  if (!walletId) throw new Error('No active wallet found');

  await debitWallet(supabase, walletId, totalDebit, user.id,
    `Njangi contribution - ${group.name} cycle ${group.current_cycle}${isLate ? ' (late + interest)' : ''}`,
    { group_id, cycle_number: group.current_cycle, late_interest: lateInterest, idempotency_key: idempotency_key || null });

  if (pendingContrib) {
    await supabase.from('njangi_contributions').update({
      status: isLate ? 'late' : 'paid', paid_at: now.toISOString(), late_interest_amount: lateInterest,
    }).eq('id', pendingContrib.id);
  } else {
    await supabase.from('njangi_contributions').insert({
      group_id, member_id: member.id, user_id: user.id,
      cycle_number: group.current_cycle, amount: group.contribution_amount,
      due_date: now.toISOString().split('T')[0], paid_at: now.toISOString(),
      status: isLate ? 'late' : 'paid', late_interest_amount: lateInterest,
    });
  }

  const daysLate = isLate ? Math.floor((now.getTime() - dueDate.getTime()) / 86400000) : 0;
  await supabase.from('credit_events').insert({
    user_id: user.id, event_type: eventType,
    value_numeric: isLate ? daysLate : group.contribution_amount,
    description: `Njangi contribution ${isLate ? `(late by ${daysLate} days)` : '(on-time)'} - ${group.name} cycle ${group.current_cycle}`,
    event_time: now.toISOString(),
    metadata: { group_id, cycle_number: group.current_cycle, amount: group.contribution_amount, late_interest: lateInterest, days_late: daysLate },
    source: 'njangi_service',
  });

  // Email
  const contribMemberName = await getUserName(supabase, user.id);
  sendManagedEmail(supabase, {
    email_key: 'njangi_contribution_confirmed',
    recipient_user_id: user.id,
    variables: {
      member_name: contribMemberName, group_name: group.name, currency: 'XAF',
      amount: new Intl.NumberFormat('fr-CM').format(group.contribution_amount),
      cycle_number: group.current_cycle,
      late_notice: isLate ? `This contribution was ${daysLate} day(s) late. Late interest: XAF ${new Intl.NumberFormat('fr-CM').format(lateInterest)}` : '',
    },
  });

  let scoreResult = null;
  try { const { data } = await supabase.functions.invoke('credit-score', { body: { action: 'engine', user_id: user.id } }); scoreResult = data; } catch (e) { console.error('Score engine error:', e); }

  return json({
    success: true,
    contribution_status: isLate ? 'late' : 'paid',
    amount_debited: totalDebit, late_interest: lateInterest,
    credit_event_type: eventType, score_delta: scoreResult?.delta || 0,
  });
}

// ─── PAYOUT (real credit to recipient + positive credit event) ───
async function handlePayout(req: Request, body: any) {
  const { user, supabase } = await getAuthUser(req);
  const { group_id, recipient_member_id, idempotency_key } = body;
  if (!group_id) throw new Error('group_id required');

  // Idempotency for payouts
  if (idempotency_key) {
    const { data: existingTx } = await supabase.from('transactions')
      .select('id').eq('transaction_type', 'njangi_payout')
      .filter('metadata->>idempotency_key', 'eq', idempotency_key).maybeSingle();
    if (existingTx) return json({ success: true, idempotent_replay: true });
  }

  const { data: group } = await supabase.from('njangi_groups').select('*').eq('id', group_id).single();
  if (!group) throw new Error('Group not found');
  if (group.creator_id !== user.id) throw new Error('Only the group creator can trigger payouts');

  const { data: members } = await supabase.from('njangi_members').select('*').eq('group_id', group_id).eq('status', 'active');
  const { data: contributions } = await supabase.from('njangi_contributions').select('*').eq('group_id', group_id).eq('cycle_number', group.current_cycle).in('status', ['paid', 'late']);

  const paidMemberIds = new Set((contributions || []).map((c: any) => c.member_id));
  const allPaid = (members || []).every((m: any) => paidMemberIds.has(m.id));
  if (!allPaid) throw new Error('Not all members have contributed this cycle');

  let selectedMemberId: string;
  if (recipient_member_id) {
    const validMember = (members || []).find((m: any) => m.id === recipient_member_id && !m.has_received_payout);
    if (!validMember) throw new Error('Invalid recipient or already received payout');
    selectedMemberId = recipient_member_id;
  } else {
    const eligible = (members || []).filter((m: any) => !m.has_received_payout);
    if (eligible.length === 0) {
      await supabase.from('njangi_members').update({ has_received_payout: false }).eq('group_id', group_id);
      const refreshed = (members || []).map((m: any) => ({ ...m, has_received_payout: false }));
      selectedMemberId = refreshed[Math.floor(Math.random() * refreshed.length)].id;
    } else {
      selectedMemberId = eligible[Math.floor(Math.random() * eligible.length)].id;
    }
  }

  const totalAmount = group.contribution_amount * (members || []).length;
  const recipient = (members || []).find((m: any) => m.id === selectedMemberId);
  if (!recipient?.user_id) throw new Error('Recipient user not found');

  // ✅ G1: Real credit to recipient wallet
  const recipientWallet = await getPrimaryWallet(supabase, recipient.user_id);
  if (!recipientWallet) throw new Error('Recipient has no active wallet');

  await creditWallet(supabase, recipientWallet, totalAmount, recipient.user_id,
    `Njangi payout - ${group.name} cycle ${group.current_cycle}`,
    { group_id, cycle_number: group.current_cycle, idempotency_key: idempotency_key || null });

  const { data: payout, error: payoutErr } = await supabase.from('njangi_payouts').insert({
    group_id, recipient_member_id: selectedMemberId, cycle_number: group.current_cycle,
    amount: totalAmount, selection_method: recipient_member_id ? 'manual' : 'random',
  }).select().single();
  if (payoutErr) throw payoutErr;

  await supabase.from('njangi_members').update({ has_received_payout: true }).eq('id', selectedMemberId);

  // ✅ G6: Emit positive credit event for receiving payout (proves group reliability)
  await supabase.from('credit_events').insert({
    user_id: recipient.user_id, event_type: 'NJANGI_PAYOUT_RECEIVED',
    value_numeric: totalAmount,
    description: `Njangi payout received - ${group.name} cycle ${group.current_cycle}`,
    event_time: new Date().toISOString(),
    metadata: { group_id, cycle_number: group.current_cycle, amount: totalAmount },
    source: 'njangi_service',
  });

  // Advance cycle and create next cycle's pending rows
  const nextCycle = group.current_cycle + 1;
  await supabase.from('njangi_groups').update({ current_cycle: nextCycle }).eq('id', group_id);

  const nextDue = new Date();
  if (group.frequency === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
  else nextDue.setMonth(nextDue.getMonth() + 1);
  const nextRows = (members || []).map((m: any) => ({
    group_id, member_id: m.id, user_id: m.user_id,
    cycle_number: nextCycle, amount: group.contribution_amount,
    due_date: nextDue.toISOString().split('T')[0],
    status: 'pending', late_interest_amount: 0,
  }));
  await supabase.from('njangi_contributions').insert(nextRows);

  // Recompute recipient's score
  try { await supabase.functions.invoke('credit-score', { body: { action: 'engine', user_id: recipient.user_id } }); } catch (e) { console.error('Score engine error:', e); }

  // Email recipient
  const payoutMemberName = await getUserName(supabase, recipient.user_id);
  sendManagedEmail(supabase, {
    email_key: 'njangi_payout_received',
    recipient_user_id: recipient.user_id,
    variables: {
      member_name: payoutMemberName, group_name: group.name, currency: 'XAF',
      amount: new Intl.NumberFormat('fr-CM').format(totalAmount),
      cycle_number: group.current_cycle,
    },
  });

  return json({ payout, recipient_user_id: recipient.user_id, total_amount: totalAmount, next_cycle: nextCycle });
}

// ─── OVERDUE DETECT ───
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
    await supabase.from('credit_events').insert({
      user_id: contrib.user_id, event_type: 'NJANGI_CONTRIBUTION_MISSED',
      value_numeric: contrib.amount,
      description: `Missed njangi contribution - ${contrib.njangi_groups?.name || 'Unknown'} cycle ${contrib.cycle_number}`,
      event_time: new Date().toISOString(),
      source: 'njangi_service',
    });
    try { await supabase.functions.invoke('credit-score', { body: { action: 'engine', user_id: contrib.user_id } }); } catch (e) { console.error('Score recompute failed:', e); }

    const missedMemberName = await getUserName(supabase, contrib.user_id);
    sendManagedEmail(supabase, {
      email_key: 'njangi_contribution_missed',
      recipient_user_id: contrib.user_id,
      variables: {
        member_name: missedMemberName,
        group_name: contrib.njangi_groups?.name || 'Njangi Group',
        currency: 'XAF',
        amount: new Intl.NumberFormat('fr-CM').format(contrib.amount),
        cycle_number: contrib.cycle_number,
      },
    });
    processed++;
  }

  return json({ processed });
}
