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

      const q = query.trim();
      const cleanQuery = q.replace(/[\s\-\(\)]/g, '');
      const isPhoneish = /^\+?\d{3,}$/.test(cleanQuery);
      const isKangish = /^KANG-/i.test(q) || /^\d{6,12}$/.test(cleanQuery);

      // Search by name (partial, case-insensitive)
      const { data: nameResults, error: nameErr } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, kang_id')
        .neq('id', user.id)
        .ilike('full_name', `%${q}%`)
        .limit(8);
      if (nameErr) console.error('Name search error:', nameErr);

      // Phone search
      let phoneResults: any[] = [];
      if (isPhoneish) {
        const phoneVariants = [cleanQuery];
        if (!cleanQuery.startsWith('+')) phoneVariants.push(`+${cleanQuery}`);
        if (/^6\d{8}$/.test(cleanQuery)) phoneVariants.push(`+237${cleanQuery}`, `237${cleanQuery}`);
        const { data: partialPhone } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, kang_id')
          .neq('id', user.id)
          .ilike('phone_number', `%${cleanQuery}%`)
          .limit(5);
        if (partialPhone?.length) phoneResults.push(...partialPhone);
        for (const pv of phoneVariants) {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, phone_number, kang_id')
            .eq('phone_number', pv)
            .neq('id', user.id)
            .limit(3);
          if (data?.length) phoneResults.push(...data);
        }
      }

      // KANG ID search
      let kangResults: any[] = [];
      if (isKangish) {
        const kangIdNorm = /^KANG-/i.test(q) ? q.toUpperCase() : `KANG-${cleanQuery}`;
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, kang_id')
          .eq('kang_id', kangIdNorm)
          .neq('id', user.id)
          .limit(3);
        if (data?.length) kangResults.push(...data);
      }

      const seen = new Set<string>();
      const merged = [...(nameResults || []), ...phoneResults, ...kangResults].filter(u => {
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      }).slice(0, 10);

      const users = merged.map(u => ({
        id: u.id,
        name: u.full_name || 'Unknown',
        kang_id: u.kang_id || null,
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
        user_id: i === 0 ? user.id : (p.user_id || null),
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

      // Resolve recipient user_id — try user_id → phone (multi-variant) → exact name → back-fill
      let recipientId: string | null = part.user_id ?? null;

      if (!recipientId && part.phone) {
        const cleanPhone = part.phone.replace(/[\s\-\(\)]/g, '');
        // Skip masked phones (e.g. "+********5254"); they cannot resolve
        if (!/\*/.test(cleanPhone)) {
          const phoneVariants = [cleanPhone];
          if (!cleanPhone.startsWith('+')) phoneVariants.push(`+${cleanPhone}`);
          if (/^6\d{8}$/.test(cleanPhone)) phoneVariants.push(`+237${cleanPhone}`, `237${cleanPhone}`);
          for (const pv of phoneVariants) {
            const { data: profile } = await supabase
              .from('profiles').select('id').eq('phone_number', pv).maybeSingle();
            if (profile?.id) { recipientId = profile.id; break; }
          }
        }
      }

      // Fallback: exact name match (case-insensitive) — helps legacy rows saved without user_id
      if (!recipientId && part.name) {
        const { data: nameMatches } = await supabase
          .from('profiles')
          .select('id')
          .ilike('full_name', part.name.trim())
          .limit(2);
        if (nameMatches?.length === 1) recipientId = nameMatches[0].id;
      }

      // Back-fill the participant row so future actions are instant
      if (recipientId && !part.user_id) {
        await supabase.from('split_bill_participants')
          .update({ user_id: recipientId }).eq('id', participant_id);
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

    // PAY SHARE — participant pays their share from wallet
    if (action === 'pay_share') {
      const { participant_id } = body;
      if (!participant_id) {
        return new Response(JSON.stringify({ error: 'participant_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get participant record
      const { data: part, error: partErr } = await supabase.from('split_bill_participants')
        .select('id, split_bill_id, name, user_id, share_amount, paid, is_owner')
        .eq('id', participant_id)
        .single();
      if (partErr || !part) {
        return new Response(JSON.stringify({ error: 'Participant not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify the caller IS this participant
      if (part.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'You can only pay your own share' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (part.paid) {
        return new Response(JSON.stringify({ error: 'This share has already been paid' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const amount = Number(part.share_amount);
      if (amount <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid share amount' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get payer's account & balance
      const { data: payerAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (!payerAccount) {
        return new Response(JSON.stringify({ error: 'No active wallet found. Please fund your account first.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: payerBalance } = await supabase
        .from('account_balances')
        .select('id, amount')
        .eq('account_id', payerAccount.id)
        .eq('balance_type', 'ClosingAvailable')
        .maybeSingle();
      if (!payerBalance || payerBalance.amount < amount) {
        return new Response(JSON.stringify({ error: `Insufficient funds. You need ${amount.toLocaleString()} XAF but have ${(payerBalance?.amount || 0).toLocaleString()} XAF.` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get bill owner's account
      const { data: bill } = await supabase.from('split_bills')
        .select('id, user_id, title')
        .eq('id', part.split_bill_id)
        .single();
      if (!bill) {
        return new Response(JSON.stringify({ error: 'Bill not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: ownerAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', bill.user_id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (!ownerAccount) {
        return new Response(JSON.stringify({ error: 'Bill creator\'s wallet not found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Debit payer
      await supabase.from('account_balances')
        .update({ amount: payerBalance.amount - amount, balance_datetime: new Date().toISOString() })
        .eq('id', payerBalance.id);

      // Credit bill owner
      const { data: ownerBalance } = await supabase
        .from('account_balances')
        .select('id, amount')
        .eq('account_id', ownerAccount.id)
        .eq('balance_type', 'ClosingAvailable')
        .maybeSingle();
      if (ownerBalance) {
        await supabase.from('account_balances')
          .update({ amount: ownerBalance.amount + amount, balance_datetime: new Date().toISOString() })
          .eq('id', ownerBalance.id);
      }

      // Record transactions
      const now = new Date().toISOString();
      const idempotencyKey = `splitbill_${part.id}_${Date.now()}`;
      await supabase.from('transactions').insert([
        {
          account_id: payerAccount.id,
          amount,
          currency: 'XAF',
          transaction_type: 'debit',
          credit_debit_indicator: 'Debit',
          status: 'Booked',
          description: `Split bill payment: ${bill.title}`,
          reference: idempotencyKey,
          booking_date: now,
          value_date: now,
          merchant_name: 'Split Bill',
          category: 'transfer',
        },
        {
          account_id: ownerAccount.id,
          amount,
          currency: 'XAF',
          transaction_type: 'credit',
          credit_debit_indicator: 'Credit',
          status: 'Booked',
          description: `Split bill received from ${part.name}: ${bill.title}`,
          reference: idempotencyKey,
          booking_date: now,
          value_date: now,
          merchant_name: 'Split Bill',
          category: 'transfer',
        },
      ]);

      // Mark participant as paid
      await supabase.from('split_bill_participants')
        .update({ paid: true, paid_at: now })
        .eq('id', participant_id);

      // Check if all paid → settle bill
      const { data: allParts } = await supabase.from('split_bill_participants')
        .select('paid')
        .eq('split_bill_id', bill.id);
      if (allParts && allParts.every((p: any) => p.paid)) {
        await supabase.from('split_bills').update({ status: 'settled' }).eq('id', bill.id);
      }

      // Notify bill owner
      await supabase.from('app_notifications').insert({
        user_id: bill.user_id,
        type: 'info',
        title: 'Split Bill Payment Received',
        message: `${part.name} paid ${amount.toLocaleString()} XAF for "${bill.title}"`,
        icon: 'payment',
        metadata: { split_bill_id: bill.id, amount, paid_by: user.id },
      });

      return new Response(JSON.stringify({ success: true, amount }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: create, search_users, settle, remind, or pay_share' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('split-bills-ops error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Something went wrong' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
