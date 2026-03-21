/**
 * Remittance Bank Confirmation Handler
 * 
 * Called when a bank connector confirms (or rejects) a remittance bank credit.
 * Two modes:
 *   1. Real-time: bank connector calls this directly after processing
 *   2. Batch: status file ingestion calls this per-item after parsing
 *
 * Actions: confirm_credit, reject_credit, batch_status_update, list_pending
 *
 * Ledger flow on confirm:
 *   DR REMIT-BANK-PAYABLE (liability decreases)
 *   CR BANK-NOSTRO or BANK-SETTLED (asset)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { REMITTANCE_LEDGER_CODES } from "../_shared/remittance-adapters.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get('action');
    let body: Record<string, any> = {};

    if (req.method === 'POST' || req.method === 'PATCH') {
      body = await req.json().catch(() => ({}));
      action = action || body.action;
    }

    // Auth check
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: 'unauthorized' }, 401);

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return json({ error: 'forbidden' }, 403);

    switch (action) {
      case 'confirm_credit': {
        const { remittance_id, bank_reference, confirmed_amount } = body;
        if (!remittance_id) return json({ error: 'missing_remittance_id' }, 400);

        const { data: rem } = await supabase
          .from('remittances')
          .select('*')
          .eq('id', remittance_id)
          .single();

        if (!rem) return json({ error: 'remittance_not_found' }, 404);
        if (rem.destination_type !== 'bank_account') return json({ error: 'not_bank_destination' }, 400);

        const now = new Date().toISOString();

        // Update remittance bank confirmation
        await supabase.from('remittances').update({
          bank_confirm_status: 'confirmed',
          bank_confirmed_at: now,
          status: 'settled',
          settled_at: now,
        }).eq('id', remittance_id);

        // Update linked transaction from Pending to Booked
        await supabase.from('transactions')
          .update({ status: 'Booked', value_datetime: now })
          .eq('transaction_type', 'remittance_bank_credit')
          .match({ 'metadata->>remittance_id': remittance_id });

        // Post settlement ledger entry: DR REMIT-BANK-PAYABLE / CR BANK-SETTLED
        const entryNumber = `REM-SETTLE-${remittance_id.slice(0, 8).toUpperCase()}`;
        const netAmount = confirmed_amount || rem.amount_out;

        const { data: existingAccounts } = await supabase
          .from('ledger_accounts')
          .select('id, account_code')
          .in('account_code', [REMITTANCE_LEDGER_CODES.BANK_PAYABLE, 'BANK-SETTLED']);

        const accountMap = new Map((existingAccounts || []).map((a: any) => [a.account_code, a.id]));

        // Auto-create BANK-SETTLED if missing
        if (!accountMap.has('BANK-SETTLED')) {
          const { data: created } = await supabase
            .from('ledger_accounts')
            .insert({
              account_code: 'BANK-SETTLED',
              account_name: 'Bank Settled Credits',
              account_type: 'asset',
              currency: 'XAF',
              balance: 0,
            })
            .select().single();
          if (created) accountMap.set('BANK-SETTLED', created.id);
        }

        const bankPayableId = accountMap.get(REMITTANCE_LEDGER_CODES.BANK_PAYABLE);
        const bankSettledId = accountMap.get('BANK-SETTLED');

        if (bankPayableId && bankSettledId) {
          const { data: je } = await supabase.from('journal_entries').insert({
            entry_number: entryNumber,
            entry_date: now.split('T')[0],
            description: `Bank credit confirmed for remittance ${rem.partner_reference}`,
            reference_type: 'remittance_bank_confirm',
            reference_id: remittance_id,
          }).select().single();

          if (je) {
            await supabase.from('journal_lines').insert([
              { journal_entry_id: je.id, ledger_account_id: bankPayableId, debit: netAmount, credit: 0 },
              { journal_entry_id: je.id, ledger_account_id: bankSettledId, debit: 0, credit: netAmount },
            ]);

            await supabase.from('remittance_ledger_links').insert({
              remittance_id, journal_entry_id: je.id, posting_type: 'bank_settlement',
            });
          }
        }

        // Record event
        await supabase.from('remittance_events').insert({
          remittance_id,
          event_type: 'settled',
          payload_raw: { bank_reference, confirmed_amount: netAmount, confirmed_by: user.id },
          actor_type: 'admin',
        });

        // Audit
        await supabase.from('audit_logs').insert({
          action_type: 'remittance_bank_confirmed',
          entity_type: 'remittance',
          entity_id: remittance_id,
          performed_by: user.id,
          details: { bank_reference, confirmed_amount: netAmount },
        });

        return json({ confirmed: true, remittance_id, status: 'settled' });
      }

      case 'reject_credit': {
        const { remittance_id, rejection_reason } = body;
        if (!remittance_id) return json({ error: 'missing_remittance_id' }, 400);

        const now = new Date().toISOString();

        await supabase.from('remittances').update({
          bank_confirm_status: 'rejected',
          bank_confirmed_at: now,
          status: 'failed',
          failure_reason: rejection_reason || 'Bank rejected credit',
        }).eq('id', remittance_id);

        await supabase.from('remittance_events').insert({
          remittance_id,
          event_type: 'failed',
          payload_raw: { rejection_reason, rejected_by: user.id },
          actor_type: 'admin',
        });

        return json({ rejected: true, remittance_id });
      }

      case 'batch_status_update': {
        const { items } = body; // Array of { remittance_id, status: 'confirmed'|'rejected', bank_reference?, reason? }
        if (!items?.length) return json({ error: 'missing_items' }, 400);

        const results = [];
        for (const item of items) {
          try {
            if (item.status === 'confirmed') {
              await supabase.functions.invoke('remittance-bank-confirm', {
                body: { action: 'confirm_credit', remittance_id: item.remittance_id, bank_reference: item.bank_reference },
                headers: { Authorization: authHeader },
              });
              results.push({ remittance_id: item.remittance_id, result: 'confirmed' });
            } else {
              await supabase.functions.invoke('remittance-bank-confirm', {
                body: { action: 'reject_credit', remittance_id: item.remittance_id, rejection_reason: item.reason },
                headers: { Authorization: authHeader },
              });
              results.push({ remittance_id: item.remittance_id, result: 'rejected' });
            }
          } catch (err) {
            results.push({ remittance_id: item.remittance_id, result: 'error', error: String(err) });
          }
        }

        return json({ processed: results.length, results });
      }

      case 'list_pending': {
        const { data, error } = await supabase
          .from('remittances')
          .select('id, partner_reference, receiver_name, destination_ref, amount_out, currency_out, status, credited_at, bank_confirm_status, remittance_partners(name)')
          .eq('destination_type', 'bank_account')
          .eq('status', 'credited')
          .is('bank_confirm_status', null)
          .order('credited_at', { ascending: true });

        if (error) throw error;
        return json({ pending_confirmations: data, total: data?.length || 0 });
      }

      default:
        return json({ error: 'unknown_action', action }, 400);
    }
  } catch (err) {
    return safeErrorResponse(err, corsHeaders, 'remittance-bank-confirm');
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
