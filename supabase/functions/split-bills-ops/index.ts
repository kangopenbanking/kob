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
    const { action } = body;

    // CREATE split bill
    if (action === 'create') {
      const { title, total_amount, split_mode, notes, participants } = body;
      if (!title || !total_amount || !participants || participants.length < 2) {
        return new Response(JSON.stringify({ error: 'title, total_amount, and at least 2 participants required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: bill, error: billErr } = await supabase.from('split_bills')
        .insert({ user_id: user.id, title, total_amount, split_mode: split_mode || 'equal', notes: notes || null, status: 'pending' })
        .select().single();
      if (billErr) throw billErr;

      const participantRows = participants.map((p: any, i: number) => ({
        split_bill_id: bill.id,
        name: p.name,
        phone: p.phone || null,
        share_amount: p.share_amount,
        share_percent: p.share_percent || 0,
        is_owner: i === 0,
        paid: i === 0,
      }));
      const { error: partErr } = await supabase.from('split_bill_participants').insert(participantRows);
      if (partErr) throw partErr;

      // Send notifications to participants with phones
      for (let i = 1; i < participants.length; i++) {
        const p = participants[i];
        if (!p.phone) continue;
        const { data: matched } = await supabase.rpc('search_profiles_by_name', { _query: p.phone, _limit: 1 });
        const recipientId = matched?.[0]?.id;
        if (recipientId) {
          await supabase.from('app_notifications').insert({
            user_id: recipientId,
            type: 'info',
            title: 'Split Bill Request',
            message: `${participants[0].name} is requesting ${p.share_amount?.toLocaleString()} XAF for "${title}"`,
            icon: 'payment',
            metadata: { split_bill_id: bill.id, amount: p.share_amount },
          });
        }
      }

      return new Response(JSON.stringify({ bill }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // SETTLE participant
    if (action === 'settle') {
      const { participant_id } = body;
      if (!participant_id) {
        return new Response(JSON.stringify({ error: 'participant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { error } = await supabase.from('split_bill_participants').update({ paid: true }).eq('id', participant_id);
      if (error) throw error;

      // Check if all paid → update bill status
      const { data: participant } = await supabase.from('split_bill_participants').select('split_bill_id').eq('id', participant_id).single();
      if (participant) {
        const { data: allParts } = await supabase.from('split_bill_participants').select('paid').eq('split_bill_id', participant.split_bill_id);
        if (allParts && allParts.every((p: any) => p.paid)) {
          await supabase.from('split_bills').update({ status: 'settled' }).eq('id', participant.split_bill_id);
        }
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // REMIND participant
    if (action === 'remind') {
      const { participant_id, split_bill_id } = body;
      if (!participant_id || !split_bill_id) {
        return new Response(JSON.stringify({ error: 'participant_id and split_bill_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: part } = await supabase.from('split_bill_participants').select('name, phone, share_amount').eq('id', participant_id).single();
      if (!part) {
        return new Response(JSON.stringify({ error: 'participant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: bill } = await supabase.from('split_bills').select('title').eq('id', split_bill_id).single();
      if (part.phone) {
        const { data: matched } = await supabase.rpc('search_profiles_by_name', { _query: part.phone, _limit: 1 });
        const recipientId = matched?.[0]?.id;
        if (recipientId) {
          await supabase.from('app_notifications').insert({
            user_id: recipientId,
            type: 'warning',
            title: 'Split Bill Reminder',
            message: `Reminder: You owe ${part.share_amount?.toLocaleString()} XAF for "${bill?.title || 'a split bill'}"`,
            icon: 'payment',
            metadata: { split_bill_id, amount: part.share_amount },
          });
        }
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'invalid_action', message: 'Use action=create|settle|remind' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('split-bills-ops error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
