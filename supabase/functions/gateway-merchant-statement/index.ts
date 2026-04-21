import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const problem = (status: number, title: string, detail: string) =>
  new Response(JSON.stringify({ type: 'about:blank', title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Auth — accepts sk_test_/sk_live_ API keys, sbx_ legacy, or Supabase JWT
    const __authResult = await resolveAuth(req, supabase);
    if (__authResult.response) return __authResult.response;
    const __auth = __authResult.auth!;
    const user = { id: __auth.user_id, email: __auth.email } as any;

    const url = new URL(req.url);
    const merchantId = url.searchParams.get('merchant_id');
    const periodMonth = url.searchParams.get('month'); // YYYY-MM
    const format = (url.searchParams.get('format') || 'json').toLowerCase();

    if (!merchantId) return problem(400, 'Bad Request', 'merchant_id is required');
    if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) {
      return problem(400, 'Bad Request', 'month is required in YYYY-MM format');
    }

    // Verify ownership or admin
    const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    const isAdmin = !!adminRole;

    if (!isAdmin) {
      const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchantId).eq('user_id', user.id).maybeSingle();
      if (!merchant) return problem(403, 'Forbidden', 'Not authorized for this merchant');
    }

    // Get merchant details
    const { data: merchant } = await supabase.from('gateway_merchants').select('id, business_name, status, country').eq('id', merchantId).single();
    if (!merchant) return problem(404, 'Not Found', 'Merchant not found');

    const periodStart = `${periodMonth}-01T00:00:00Z`;
    const periodEndDate = new Date(parseInt(periodMonth.split('-')[0]), parseInt(periodMonth.split('-')[1]), 0);
    const periodEnd = `${periodMonth}-${String(periodEndDate.getDate()).padStart(2, '0')}T23:59:59Z`;

    // Fetch charges
    const { data: charges } = await supabase.from('gateway_charges')
      .select('id, tx_ref, amount, fee_amount, net_amount, currency, channel, status, created_at')
      .eq('merchant_id', merchantId)
      .gte('created_at', periodStart).lte('created_at', periodEnd)
      .order('created_at', { ascending: true }).limit(1000);

    // Fetch payouts
    const { data: payouts } = await supabase.from('gateway_payouts')
      .select('id, tx_ref, amount, fee_amount, currency, destination_type, status, created_at')
      .eq('merchant_id', merchantId)
      .gte('created_at', periodStart).lte('created_at', periodEnd)
      .order('created_at', { ascending: true }).limit(1000);

    // Fetch refunds
    const { data: refunds } = await supabase.from('gateway_refunds')
      .select('id, amount, currency, status, created_at, reason')
      .eq('merchant_id', merchantId)
      .gte('created_at', periodStart).lte('created_at', periodEnd)
      .order('created_at', { ascending: true }).limit(1000);

    // Fetch wallet balance
    const { data: wallets } = await supabase.from('gateway_merchant_wallets')
      .select('currency, available_balance, pending_balance, ledger_balance')
      .eq('merchant_id', merchantId);

    const chargeList = charges || [];
    const payoutList = payouts || [];
    const refundList = refunds || [];

    const successfulCharges = chargeList.filter(c => c.status === 'successful');
    const successfulPayouts = payoutList.filter(p => p.status === 'successful');
    const successfulRefunds = refundList.filter(r => r.status === 'successful');

    const summary = {
      merchant: { id: merchant.id, business_name: merchant.business_name, country: merchant.country },
      period: { month: periodMonth, start: periodStart, end: periodEnd },
      generated_at: new Date().toISOString(),
      collections: {
        total_count: successfulCharges.length,
        total_volume: successfulCharges.reduce((s, c) => s + (c.amount || 0), 0),
        total_fees: successfulCharges.reduce((s, c) => s + (c.fee_amount || 0), 0),
        total_net: successfulCharges.reduce((s, c) => s + (c.net_amount || 0), 0),
        by_channel: groupBy(successfulCharges, 'channel'),
      },
      payouts: {
        total_count: successfulPayouts.length,
        total_volume: successfulPayouts.reduce((s, p) => s + (p.amount || 0), 0),
        total_fees: successfulPayouts.reduce((s, p) => s + (p.fee_amount || 0), 0),
      },
      refunds: {
        total_count: successfulRefunds.length,
        total_volume: successfulRefunds.reduce((s, r) => s + (r.amount || 0), 0),
      },
      failed_transactions: {
        charges: chargeList.filter(c => c.status === 'failed').length,
        payouts: payoutList.filter(p => p.status === 'failed').length,
        refunds: refundList.filter(r => r.status === 'failed').length,
      },
      wallet_balances: wallets || [],
    };

    // CSV format
    if (format === 'csv') {
      const rows = [
        ['Date', 'Type', 'Reference', 'Channel', 'Amount', 'Fee', 'Net', 'Currency', 'Status'].join(','),
      ];

      for (const c of chargeList) {
        rows.push([c.created_at, 'Charge', c.tx_ref || c.id, c.channel || '', c.amount, c.fee_amount || 0, c.net_amount || 0, c.currency || 'XAF', c.status].join(','));
      }
      for (const p of payoutList) {
        rows.push([p.created_at, 'Payout', p.tx_ref || p.id, p.destination_type || '', p.amount, p.fee_amount || 0, '', p.currency || 'XAF', p.status].join(','));
      }
      for (const r of refundList) {
        rows.push([r.created_at, 'Refund', r.id, r.reason || '', r.amount, 0, '', r.currency || 'XAF', r.status].join(','));
      }

      return new Response(rows.join('\n'), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="statement_${merchantId}_${periodMonth}.csv"`,
        },
      });
    }

    // JSON format (default) — includes summary + line items
    return json({
      statement: summary,
      line_items: {
        charges: chargeList,
        payouts: payoutList,
        refunds: refundList,
      },
    });

  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] [gateway-merchant-statement] Error:`, err);
    return problem(500, 'Internal Server Error', `Reference: ${errorId}`);
  }
});

function groupBy(items: any[], key: string): Record<string, { count: number; volume: number; fees: number }> {
  const result: Record<string, { count: number; volume: number; fees: number }> = {};
  for (const item of items) {
    const k = item[key] || 'unknown';
    if (!result[k]) result[k] = { count: 0, volume: 0, fees: 0 };
    result[k].count++;
    result[k].volume += item.amount || 0;
    result[k].fees += item.fee_amount || 0;
  }
  return result;
}
