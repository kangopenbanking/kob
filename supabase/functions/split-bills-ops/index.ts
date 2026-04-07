import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { action } = body;

    // SEARCH registered users for participant lookup
    if (action === 'search_users') {
      const { query } = body;
      if (!query || query.length < 2) {
        return new Response(JSON.stringify({ users: [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Search by name
      const { data: nameResults, error: nameErr } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number')
        .neq('id', user.id)
        .ilike('full_name', `%${query}%`)
        .limit(8);
      
      if (nameErr) console.error('Name search error:', nameErr);

      // Also search by phone if query looks like a phone number
      let phoneResults: any[] = [];
      const cleanQuery = query.replace(/[\s\-\(\)]/g, '');
      if (/^\+?\d{3,}$/.test(cleanQuery)) {
        const phoneVariants = [cleanQuery];
        if (!cleanQuery.startsWith('+')) phoneVariants.push(`+${cleanQuery}`);
        if (/^6\d{8}$/.test(cleanQuery)) {
          phoneVariants.push(`+237${cleanQuery}`);
        }
        // Also do a partial match on phone
        const { data: partialPhone } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number')
          .neq('id', user.id)
          .ilike('phone_number', `%${cleanQuery}%`)
          .limit(5);
        if (partialPhone?.length) phoneResults.push(...partialPhone);
        
        for (const pv of phoneVariants) {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, phone_number')
            .eq('phone_number', pv)
            .neq('id', user.id)
            .limit(3);
          if (data?.length) phoneResults.push(...data);
        }
      }

      // Merge and deduplicate
      const seen = new Set<string>();
      const merged = [...(nameResults || []), ...phoneResults].filter(u => {
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      }).slice(0, 8);

      // Mask phone numbers for privacy
      const users = merged.map(u => ({
        id: u.id,
        name: u.full_name || 'Unknown',
        phone_masked: u.phone_number
          ? u.phone_number.slice(0, -4).replace(/\d/g, '*') + u.phone_number.slice(-4)
          : null,
      }));

      return new Response(JSON.stringify({ users }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // CREATE split bill
    if (action === 'create') {
      const { title, total_amount, split_mode, notes, participants } = body;
      if (!title || !total_amount || !participants || participants.length < 2) {
        return new Response(JSON.stringify({ error: 'Title, total amount, and at least 2 participants are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: bill, error: billErr } = await supabase.from('split_bills')
        .insert({ user_id: user.id, title, total_amount, split_mode: split_mode || 'equal', notes: notes || null, status: 'pending' })
        .select().single();
      if (billErr) throw billErr;

      const participantRows = participants.map((p: any, i: number) => ({
        split_bill_id: bill.id,
        name: p.name,
        phone: p.phone || null,
        user_id: p.user_id || null,
        share_amount: p.share_amount,
        share_percent: p.share_percent || 0,
        is_owner: i === 0,
        paid: i === 0,
      }));
      const { error: partErr } = await supabase.from('split_bill_participants').insert(participantRows);
      if (partErr) throw partErr;

      // Send in-app notifications to registered participants
      for (let i = 1; i < participants.length; i++) {
        const p = participants[i];
        const recipientId = p.user_id || null;

        // If no user_id, try phone lookup
        let resolvedId = recipientId;
        if (!resolvedId && p.phone) {
          const cleanPhone = p.phone.replace(/[\s\-\(\)]/g, '');
          const phoneVariants = [cleanPhone];
          if (!cleanPhone.startsWith('+')) phoneVariants.push(`+${cleanPhone}`);
          if (/^6\d{8}$/.test(cleanPhone)) phoneVariants.push(`+237${cleanPhone}`);

          for (const pv of phoneVariants) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('phone_number', pv)
              .maybeSingle();
            if (profile) { resolvedId = profile.id; break; }
          }
        }

        if (resolvedId) {
          await supabase.from('app_notifications').insert({
            user_id: resolvedId,
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

    // SETTLE participant (mark as paid)
    if (action === 'settle') {
      const { participant_id } = body;
      if (!participant_id) {
        return new Response(JSON.stringify({ error: 'participant_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { error } = await supabase.from('split_bill_participants')
        .update({ paid: true, paid_at: new Date().toISOString() })
        .eq('id', participant_id);
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
        return new Response(JSON.stringify({ error: 'participant_id and split_bill_id are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: part } = await supabase.from('split_bill_participants')
        .select('name, phone, user_id, share_amount')
        .eq('id', participant_id).single();
      if (!part) {
        return new Response(JSON.stringify({ error: 'Participant not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: bill } = await supabase.from('split_bills').select('title').eq('id', split_bill_id).single();

      // Resolve recipient user_id
      let recipientId = part.user_id;
      if (!recipientId && part.phone) {
        const cleanPhone = part.phone.replace(/[\s\-\(\)]/g, '');
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone_number', cleanPhone)
          .maybeSingle();
        recipientId = profile?.id || null;
      }

      if (recipientId) {
        await supabase.from('app_notifications').insert({
          user_id: recipientId,
          type: 'warning',
          title: 'Split Bill Reminder',
          message: `Reminder: You owe ${part.share_amount?.toLocaleString()} XAF for "${bill?.title || 'a split bill'}"`,
          icon: 'payment',
          metadata: { split_bill_id, amount: part.share_amount },
        });
        return new Response(JSON.stringify({ success: true, notified: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, notified: false, message: 'Participant is not a registered user' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: create, search_users, settle, or remind' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('split-bills-ops error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Something went wrong' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
