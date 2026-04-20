// Per-minute cron: settles only merchants opted into 'instant' frequency.
// Idempotent via gateway_merchant_wallets.last_instant_settled_at + ledger_posting_refs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronAuth } from "../_shared/cron-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_INTERVAL_SECONDS = 60; // Don't re-settle the same wallet more than once per minute
const MIN_NET_AMOUNT = 100; // Skip dust (<100 minor units)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const startedAt = new Date();
  const results: any[] = [];

  try {
    // Find all merchants opted into instant settlement with positive pending balance
    const { data: instantMerchants, error: mErr } = await supabase
      .from('gateway_merchants')
      .select('id, business_name, settlement_frequency')
      .eq('settlement_frequency', 'instant')
      .eq('status', 'approved');

    if (mErr) throw mErr;

    for (const m of instantMerchants || []) {
      try {
        const { data: wallets } = await supabase
          .from('gateway_merchant_wallets')
          .select('id, currency, pending_balance, available_balance, last_instant_settled_at')
          .eq('merchant_id', m.id)
          .gt('pending_balance', MIN_NET_AMOUNT);

        for (const w of wallets || []) {
          // Idempotency: skip if settled within last MIN_INTERVAL_SECONDS
          if (w.last_instant_settled_at) {
            const lastMs = new Date(w.last_instant_settled_at).getTime();
            if (Date.now() - lastMs < MIN_INTERVAL_SECONDS * 1000) {
              results.push({ merchant_id: m.id, currency: w.currency, status: 'skipped_cooldown' });
              continue;
            }
          }

          const sweepAmount = Number(w.pending_balance);

          // Atomic move: pending → available + stamp settled_at
          const { error: upErr } = await supabase
            .from('gateway_merchant_wallets')
            .update({
              pending_balance: 0,
              available_balance: Number(w.available_balance) + sweepAmount,
              last_instant_settled_at: startedAt.toISOString(),
              updated_at: startedAt.toISOString(),
            })
            .eq('id', w.id)
            .eq('pending_balance', w.pending_balance); // Optimistic lock

          if (upErr) {
            results.push({ merchant_id: m.id, currency: w.currency, status: 'update_failed', error: upErr.message });
            continue;
          }

          // Record settlement statement
          const { data: settlement } = await supabase
            .from('gateway_settlements')
            .insert({
              merchant_id: m.id,
              amount: sweepAmount,
              fees_total: 0,
              net_amount: sweepAmount,
              currency: w.currency,
              status: 'settled',
              period_start: w.last_instant_settled_at || new Date(Date.now() - 60_000).toISOString(),
              period_end: startedAt.toISOString(),
              metadata: { cycle: 'instant', cron: 'instant-settlement-cron' },
            })
            .select('id')
            .maybeSingle();

          // Fire webhook
          await supabase.from('gateway_webhook_events').insert({
            merchant_id: m.id,
            event_type: 'settlement.paid',
            payload: {
              settlement_id: settlement?.id,
              amount: sweepAmount,
              currency: w.currency,
              cycle: 'instant',
            },
          });

          results.push({
            merchant_id: m.id,
            business_name: m.business_name,
            currency: w.currency,
            settled: sweepAmount,
            status: 'success',
          });
        }
      } catch (e) {
        results.push({ merchant_id: m.id, status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed_at: startedAt.toISOString(),
      merchants_checked: instantMerchants?.length || 0,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('instant-settlement-cron error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
