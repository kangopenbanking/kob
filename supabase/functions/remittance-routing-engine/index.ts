/**
 * Remittance Routing Engine
 * 
 * Called internally when a remittance reaches "received" status.
 * Routes funds to the correct destination with full double-entry ledger postings.
 *
 * Destination Types & Ledger Flows:
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ DESTINATION 1: KOB Wallet (kob_wallet)                            │
 * │                                                                     │
 * │  Journal Entry: "Inbound remittance credit — wallet"               │
 * │  ┌──────────────────────────┬──────────┬──────────┐                │
 * │  │ Account                  │  Debit   │  Credit  │                │
 * │  ├──────────────────────────┼──────────┼──────────┤                │
 * │  │ REMIT-CLEARING (Asset)   │ amt_out  │          │                │
 * │  │ CUST-WALLET (Liability)  │          │ net_amt  │                │
 * │  │ REMIT-FEE-REV (Revenue)  │          │ kob_fee  │                │
 * │  └──────────────────────────┴──────────┴──────────┘                │
 * │                                                                     │
 * │  + Upsert account_balances ClosingAvailable                        │
 * │  + Insert transaction (credit, deposit)                            │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ DESTINATION 2: Bank Account (bank_account)                         │
 * │                                                                     │
 * │  Journal Entry: "Inbound remittance — bank clearing"               │
 * │  ┌───────────────────────────────┬──────────┬──────────┐           │
 * │  │ Account                       │  Debit   │  Credit  │           │
 * │  ├───────────────────────────────┼──────────┼──────────┤           │
 * │  │ REMIT-CLEARING (Asset)        │ amt_out  │          │           │
 * │  │ REMIT-BANK-PAYABLE (Liab.)    │          │ net_amt  │           │
 * │  │ REMIT-FEE-REV (Revenue)       │          │ kob_fee  │           │
 * │  └───────────────────────────────┴──────────┴──────────┘           │
 * │                                                                     │
 * │  + Queue bank instruction (file connector / db connector)          │
 * │  + On bank confirmation: DR REMIT-BANK-PAYABLE / CR Bank Settled   │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ DESTINATION 3: Merchant Invoice / Bill (merchant_invoice/bill_pay) │
 * │                                                                     │
 * │  Journal Entry: "Inbound remittance — merchant/bill credit"        │
 * │  ┌──────────────────────────────┬──────────┬──────────┐            │
 * │  │ Account                      │  Debit   │  Credit  │            │
 * │  ├──────────────────────────────┼──────────┼──────────┤            │
 * │  │ REMIT-CLEARING (Asset)       │ amt_out  │          │            │
 * │  │ REMIT-MERCH-PAY (Liability)  │          │ net_amt  │            │
 * │  │ REMIT-FEE-REV (Revenue)      │          │ kob_fee  │            │
 * │  └──────────────────────────────┴──────────┴──────────┘            │
 * │                                                                     │
 * │  + Credit merchant wallet via update_merchant_wallet RPC           │
 * │  + Mark invoice/bill as paid                                       │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { REMITTANCE_LEDGER_CODES } from "../_shared/remittance-adapters.ts";
import { verifyCronAuth } from "../_shared/cron-auth.ts";
import { withRemittanceIdempotency } from "../_shared/remittance-idempotency.ts";
import { recordRemittanceAudit } from "../_shared/remittance-audit.ts";

// KOB fee percentage on remittances (configurable per corridor in future)
const KOB_REMITTANCE_FEE_PCT = 0.5; // 0.5%

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // P0 AUTH GATE — internal-only: require service-role/cron secret.
  const cronAuth = verifyCronAuth(req);
  if (!cronAuth.authorized) {
    await recordRemittanceAudit({
      endpoint: 'remittance-routing-engine',
      decision: 'denied_unauthenticated',
      req,
    });
    return cronAuth.response!;
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = await req.json();
    const remittanceId = body.remittance_id;
    if (!remittanceId) {
      await recordRemittanceAudit({
        endpoint: 'remittance-routing-engine',
        decision: 'denied_validation',
        req,
        metadata: { reason: 'missing_remittance_id' },
      });
      return new Response(JSON.stringify({ error: 'missing_remittance_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotency gate — replay-safe per remittance.
    const idem = await withRemittanceIdempotency({
      resource: 'remittance.routing-engine',
      defaultKey: remittanceId,
      headerKey: req.headers.get('Idempotency-Key'),
      payload: body,
      corsHeaders,
    });
    if (!idem.proceed) {
      await recordRemittanceAudit({
        endpoint: 'remittance-routing-engine',
        decision: 'denied_idempotency',
        remittanceId,
        req,
      });
      return idem.response;
    }

    // Load remittance
    const { data: rem, error: remErr } = await supabase
      .from('remittances')
      .select('*')
      .eq('id', remittanceId)
      .single();

    if (remErr || !rem) {
      return new Response(JSON.stringify({ error: 'remittance_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (rem.status !== 'received') {
      return new Response(JSON.stringify({ error: 'not_in_received_status', current: rem.status }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate KOB fee
    const kobFee = Math.round(rem.amount_out * KOB_REMITTANCE_FEE_PCT / 100);
    const netAmount = rem.amount_out - kobFee;
    const now = new Date().toISOString();
    const entryNumber = `REM-${rem.id.slice(0, 8).toUpperCase()}`;

    // ─── Resolve Ledger Account IDs ───
    const ledgerAccounts = await resolveLedgerAccounts(supabase, rem);

    // ─── Create Journal Entry ───
    const description = `Inbound remittance ${rem.partner_reference} — ${rem.destination_type} credit`;
    const { data: journalEntry, error: jeErr } = await supabase
      .from('journal_entries')
      .insert({
        entry_number: entryNumber,
        entry_date: now.split('T')[0],
        description,
        reference_type: 'remittance',
        reference_id: rem.id,
        institution_id: rem.receiver_institution_id,
      })
      .select()
      .single();

    if (jeErr) throw jeErr;

    // ─── Journal Lines (double-entry) ───
    const creditAccountCode = rem.destination_type === 'kob_wallet'
      ? REMITTANCE_LEDGER_CODES.CUSTOMER_WALLET
      : rem.destination_type === 'bank_account'
        ? REMITTANCE_LEDGER_CODES.BANK_PAYABLE
        : REMITTANCE_LEDGER_CODES.MERCHANT_PAYABLE;

    const creditAccountId = ledgerAccounts[creditAccountCode];
    const clearingAccountId = ledgerAccounts[REMITTANCE_LEDGER_CODES.CLEARING];
    const feeAccountId = ledgerAccounts[REMITTANCE_LEDGER_CODES.FEE_REVENUE];

    const journalLines = [
      // Debit: Remittance Clearing (asset increases)
      {
        journal_entry_id: journalEntry.id,
        ledger_account_id: clearingAccountId,
        debit: rem.amount_out,
        credit: 0,
      },
      // Credit: Destination account (liability increases)
      {
        journal_entry_id: journalEntry.id,
        ledger_account_id: creditAccountId,
        debit: 0,
        credit: netAmount,
      },
    ];

    // Credit: Fee revenue (if fee > 0)
    if (kobFee > 0 && feeAccountId) {
      journalLines.push({
        journal_entry_id: journalEntry.id,
        ledger_account_id: feeAccountId,
        debit: 0,
        credit: kobFee,
      });
    }

    await supabase.from('journal_lines').insert(journalLines);

    // ─── Link ledger to remittance ───
    await supabase.from('remittance_ledger_links').insert({
      remittance_id: rem.id,
      journal_entry_id: journalEntry.id,
      posting_type: `credit_${rem.destination_type}`,
    });

    // ─── Route to Destination ───
    let credited = false;

    if (rem.destination_type === 'kob_wallet') {
      credited = await creditWallet(supabase, rem, netAmount, now);
    } else if (rem.destination_type === 'bank_account') {
      credited = await creditBankAccount(supabase, rem, netAmount, now);
    } else if (rem.destination_type === 'merchant_invoice' || rem.destination_type === 'bill_payment') {
      credited = await creditMerchantOrBill(supabase, rem, netAmount, now);
    } else {
      // Default to wallet
      credited = await creditWallet(supabase, rem, netAmount, now);
    }

    // ─── Update remittance status to credited ───
    if (credited) {
      await supabase.from('remittances').update({
        status: 'credited',
        credited_at: now,
      }).eq('id', rem.id);

      // Record event
      await supabase.from('remittance_events').insert({
        remittance_id: rem.id,
        event_type: 'credited',
        payload_raw: {
          destination_type: rem.destination_type,
          net_amount: netAmount,
          kob_fee: kobFee,
          journal_entry_id: journalEntry.id,
        },
        actor_type: 'system',
      });

      // Record fee
      if (rem.receiver_institution_id) {
        await supabase.rpc('record_transaction_fee', {
          _institution_id: rem.receiver_institution_id,
          _transaction_type: 'remittance_inbound',
          _transaction_ref: rem.id,
          _transaction_amount: rem.amount_out,
        }).catch(() => { /* fee recording is non-blocking */ });
      }
    }

    // ─── Audit log ───
    await supabase.from('audit_logs').insert({
      action_type: 'remittance_credited',
      entity_type: 'remittance',
      entity_id: rem.id,
      performed_by: rem.receiver_user_id,
      details: {
        destination_type: rem.destination_type,
        amount_out: rem.amount_out,
        net_amount: netAmount,
        kob_fee: kobFee,
        journal_entry_id: journalEntry.id,
        credited,
      },
    });

    return new Response(JSON.stringify({
      success: credited,
      remittance_id: rem.id,
      destination_type: rem.destination_type,
      net_amount: netAmount,
      kob_fee: kobFee,
      journal_entry_id: journalEntry.id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return safeErrorResponse(err, corsHeaders, 'remittance-routing-engine');
  }
});

// ─── DESTINATION 1: KOB Wallet ───

async function creditWallet(
  supabase: ReturnType<typeof createClient>,
  rem: Record<string, any>,
  netAmount: number,
  now: string
): Promise<boolean> {
  // Resolve account: by destination_ref or by receiver_user_id
  let accountId = rem.destination_ref;

  if (!accountId && rem.receiver_user_id) {
    const { data: acct } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', rem.receiver_user_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    accountId = acct?.id;
  }

  if (!accountId) {
    console.error(`[routing] No wallet account found for remittance ${rem.id}`);
    return false;
  }

  // Upsert ClosingAvailable balance (same pattern as funding-scope-creditor.ts)
  const { data: existingBal } = await supabase
    .from('account_balances')
    .select('id, amount')
    .eq('account_id', accountId)
    .eq('balance_type', 'ClosingAvailable')
    .eq('credit_debit_indicator', 'Credit')
    .maybeSingle();

  if (existingBal) {
    await supabase.from('account_balances').update({
      amount: existingBal.amount + netAmount,
      balance_datetime: now,
    }).eq('id', existingBal.id);
  } else {
    await supabase.from('account_balances').insert({
      account_id: accountId,
      balance_type: 'ClosingAvailable',
      amount: netAmount,
      currency: rem.currency_out,
      credit_debit_indicator: 'Credit',
      balance_datetime: now,
    });
  }

  // Record transaction
  await supabase.from('transactions').insert({
    account_id: accountId,
    amount: netAmount,
    currency: rem.currency_out,
    credit_debit_indicator: 'Credit',
    status: 'Booked',
    booking_datetime: now,
    value_datetime: now,
    transaction_type: 'remittance_credit',
    transaction_information: `Remittance from ${rem.sender_name || 'sender'} (${rem.sender_country || ''}) — ${rem.partner_reference}`,
    user_id: rem.receiver_user_id,
    institution_id: rem.receiver_institution_id,
    metadata: {
      remittance_id: rem.id,
      partner_reference: rem.partner_reference,
      sender_name: rem.sender_name,
      sender_country: rem.sender_country,
      amount_in: rem.amount_in,
      currency_in: rem.currency_in,
      fx_rate: rem.fx_rate,
      source: 'remittance_inbound',
    },
  });

  return true;
}

// ─── DESTINATION 2: Bank Account ───

async function creditBankAccount(
  supabase: ReturnType<typeof createClient>,
  rem: Record<string, any>,
  netAmount: number,
  now: string
): Promise<boolean> {
  // Look up bank PSU link or direct account reference
  const destRef = rem.destination_ref;

  if (!destRef) {
    console.error(`[routing] No destination_ref for bank_account remittance ${rem.id}`);
    return false;
  }

  // Check if there's a real-time bank connector
  const { data: psuLink } = await supabase
    .from('bank_psu_links')
    .select('id, bank_id, external_account_id, status')
    .eq('external_account_id', destRef)
    .eq('status', 'active')
    .maybeSingle();

  if (psuLink) {
    // Real-time: attempt to queue instruction via bank connector
    // Create a pending bank instruction record
    const { data: bankBatch } = await supabase
      .from('bank_batch_items')
      .insert({
        batch_id: crypto.randomUUID(), // Will be assigned to next batch
        reference: `REM-${rem.id.slice(0, 8)}`,
        beneficiary_name: rem.receiver_name,
        beneficiary_account_number: destRef,
        amount: netAmount,
        currency: rem.currency_out,
        narration: `Remittance from ${rem.sender_name || 'sender'} — ${rem.partner_reference}`,
        status: 'pending',
      })
      .select()
      .maybeSingle();

    console.log(`[routing] Bank instruction queued for ${destRef}, batch item: ${bankBatch?.id}`);
  } else {
    // Batch fallback: record as pending bank credit for manual/file processing
    console.log(`[routing] No active PSU link for ${destRef}, queuing for batch processing`);
  }

  // Record transaction as pending bank credit
  if (rem.receiver_user_id) {
    // Find user's account linked to this bank account
    const { data: userAcct } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', rem.receiver_user_id)
      .eq('identification_value', destRef)
      .maybeSingle();

    if (userAcct) {
      await supabase.from('transactions').insert({
        account_id: userAcct.id,
        amount: netAmount,
        currency: rem.currency_out,
        credit_debit_indicator: 'Credit',
        status: 'Pending',
        booking_datetime: now,
        transaction_type: 'remittance_bank_credit',
        transaction_information: `Remittance to bank account ${destRef} from ${rem.sender_name || 'sender'}`,
        user_id: rem.receiver_user_id,
        institution_id: rem.receiver_institution_id,
        metadata: {
          remittance_id: rem.id,
          partner_reference: rem.partner_reference,
          bank_account: destRef,
          source: 'remittance_inbound',
          pending_bank_confirmation: true,
        },
      });
    }
  }

  return true;
}

// ─── DESTINATION 3: Merchant Invoice / Bill Payment ───

async function creditMerchantOrBill(
  supabase: ReturnType<typeof createClient>,
  rem: Record<string, any>,
  netAmount: number,
  now: string
): Promise<boolean> {
  const destRef = rem.destination_ref;

  if (!destRef) {
    console.error(`[routing] No destination_ref for merchant/bill remittance ${rem.id}`);
    return false;
  }

  if (rem.destination_type === 'merchant_invoice') {
    // Try to find and pay the invoice
    const { data: invoice } = await supabase
      .from('customer_invoices')
      .select('id, merchant_id, total_amount, status, currency')
      .eq('id', destRef)
      .maybeSingle();

    if (invoice && invoice.status !== 'paid') {
      // Mark invoice as paid
      await supabase.from('customer_invoices').update({
        status: 'paid',
        paid_at: now,
        payment_method: 'remittance',
        updated_at: now,
      }).eq('id', invoice.id);

      // Credit merchant wallet
      if (invoice.merchant_id) {
        await supabase.rpc('update_merchant_wallet', {
          _merchant_id: invoice.merchant_id,
          _currency: rem.currency_out,
          _available_delta: netAmount,
          _ledger_delta: netAmount,
        });

        // Record in gateway charges for the merchant's transaction history
        await supabase.from('audit_logs').insert({
          action_type: 'remittance_invoice_paid',
          entity_type: 'customer_invoice',
          entity_id: invoice.id,
          details: {
            remittance_id: rem.id,
            merchant_id: invoice.merchant_id,
            amount: netAmount,
            partner_reference: rem.partner_reference,
          },
        });
      }
    } else {
      console.warn(`[routing] Invoice ${destRef} not found or already paid`);
    }
  } else if (rem.destination_type === 'bill_payment') {
    // Bill payment: look up bill provider and record payment
    const { data: billProvider } = await supabase
      .from('bill_providers')
      .select('id, name, merchant_id')
      .eq('id', destRef)
      .maybeSingle();

    if (billProvider?.merchant_id) {
      // Credit the bill provider's merchant wallet
      await supabase.rpc('update_merchant_wallet', {
        _merchant_id: billProvider.merchant_id,
        _currency: rem.currency_out,
        _available_delta: netAmount,
        _ledger_delta: netAmount,
      });

      // Record bill payment
      await supabase.from('audit_logs').insert({
        action_type: 'remittance_bill_paid',
        entity_type: 'bill_provider',
        entity_id: billProvider.id,
        details: {
          remittance_id: rem.id,
          bill_provider: billProvider.name,
          amount: netAmount,
          payer: rem.sender_name,
          receiver: rem.receiver_name,
          purpose: rem.purpose_code,
        },
      });
    } else {
      console.warn(`[routing] Bill provider ${destRef} not found`);
    }
  }

  return true;
}

// ─── Resolve or auto-create ledger accounts ───

async function resolveLedgerAccounts(
  supabase: ReturnType<typeof createClient>,
  rem: Record<string, any>
): Promise<Record<string, string>> {
  const codes = [
    REMITTANCE_LEDGER_CODES.CLEARING,
    REMITTANCE_LEDGER_CODES.FEE_REVENUE,
    REMITTANCE_LEDGER_CODES.CUSTOMER_WALLET,
    REMITTANCE_LEDGER_CODES.BANK_PAYABLE,
    REMITTANCE_LEDGER_CODES.MERCHANT_PAYABLE,
  ];

  const accountTypeMap: Record<string, { name: string; type: string }> = {
    [REMITTANCE_LEDGER_CODES.CLEARING]: { name: 'Remittance Clearing', type: 'asset' },
    [REMITTANCE_LEDGER_CODES.FEE_REVENUE]: { name: 'Remittance Fee Revenue', type: 'revenue' },
    [REMITTANCE_LEDGER_CODES.CUSTOMER_WALLET]: { name: 'Customer Wallet Liability', type: 'liability' },
    [REMITTANCE_LEDGER_CODES.BANK_PAYABLE]: { name: 'Remittance Bank Payable', type: 'liability' },
    [REMITTANCE_LEDGER_CODES.MERCHANT_PAYABLE]: { name: 'Remittance Merchant Payable', type: 'liability' },
  };

  const { data: existing } = await supabase
    .from('ledger_accounts')
    .select('id, account_code')
    .in('account_code', codes);

  const result: Record<string, string> = {};
  const existingMap = new Map((existing || []).map((a: any) => [a.account_code, a.id]));

  for (const code of codes) {
    if (existingMap.has(code)) {
      result[code] = existingMap.get(code)!;
    } else {
      // Auto-create missing ledger account
      const meta = accountTypeMap[code];
      const { data: created } = await supabase
        .from('ledger_accounts')
        .insert({
          account_code: code,
          account_name: meta.name,
          account_type: meta.type,
          currency: 'XAF',
          balance: 0,
          institution_id: rem.receiver_institution_id,
        })
        .select()
        .single();
      if (created) result[code] = created.id;
    }
  }

  return result;
}
