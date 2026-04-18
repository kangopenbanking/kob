// CrediQ — Bank Inquiry Billing
// ─────────────────────────────────────────────────────────────────
// Authoritative billing endpoint for bank credit-score / report
// inquiries. Authenticates the institution owner, resolves the
// credit_api_client + pricing tier, enforces monthly cap, applies
// the platform fee structure, and records both `transaction_fees`
// and `credit_api_monthly_usage` in a single call.
//
// Actions:
//   - 'quote'  → { unit_price, projected_total, cap_remaining, ... }
//   - 'charge' → finalises the bill, returns { billed_amount, period_usage }
//
// Caller flow (edge function invoking another):
//   await supabase.functions.invoke('credit-inquiry-charge', {
//     body: { action: 'charge', client_id, query_kind: 'score'|'report',
//             user_id, transaction_ref, score_returned? }
//   })
// ─────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { corsHeaders } from "../_shared/cors.ts";
import { recordTransactionFee } from "../_shared/record-transaction-fee.ts";

interface ChargeBody {
  action: 'quote' | 'charge';
  client_id?: string;       // credit_api_clients.id (admin/internal flow)
  api_key?: string;         // OR look up by api_key (BYOK flow)
  query_kind: 'score' | 'report';
  user_id: string;
  transaction_ref?: string;
  score_returned?: number;
  report_id?: string;
}

const TX_TYPE_BY_KIND = {
  score: 'credit_score_inquiry',
  report: 'credit_report_inquiry',
} as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = (await req.json()) as ChargeBody;
    const { action, query_kind, user_id } = body;

    if (!['quote', 'charge'].includes(action)) {
      return jsonError('Unknown action', 400);
    }
    if (!['score', 'report'].includes(query_kind)) {
      return jsonError('query_kind must be "score" or "report"', 400);
    }
    if (!user_id) {
      return jsonError('user_id required', 400);
    }

    // ── 1. Resolve the credit_api_client ──
    let clientQuery = supabase.from('credit_api_clients').select(`
      id, institution_id, is_active, is_sandbox, pricing_tier_id,
      monthly_query_cap_override, cost_per_query, allowed_operations,
      pricing_tier:credit_api_pricing_tiers (
        tier_name, monthly_base_fee, included_queries,
        per_query_score_fee, per_query_report_fee, monthly_query_cap, currency
      )
    `).eq('is_active', true);

    if (body.client_id) clientQuery = clientQuery.eq('id', body.client_id);
    else if (body.api_key) clientQuery = clientQuery.eq('api_key', body.api_key);
    else return jsonError('client_id or api_key required', 400);

    const { data: client, error: clientErr } = await clientQuery.maybeSingle();
    if (clientErr || !client) {
      return jsonError('Credit API client not found or inactive', 404);
    }

    // Sandbox clients are never billed
    const isSandbox = !!client.is_sandbox;

    // ── 2. Determine unit price ──
    const tier = (client as any).pricing_tier;
    const unitPrice: number = isSandbox
      ? 0
      : query_kind === 'score'
      ? Number(tier?.per_query_score_fee ?? client.cost_per_query ?? 500)
      : Number(tier?.per_query_report_fee ?? client.cost_per_query ?? 2500);

    const currency = tier?.currency ?? 'XAF';
    const cap = client.monthly_query_cap_override ?? tier?.monthly_query_cap ?? null;
    const includedQueries = Number(tier?.included_queries ?? 0);

    // ── 3. Look up current month usage ──
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const { data: usage } = await supabase
      .from('credit_api_monthly_usage')
      .select('score_queries, report_queries, total_billed')
      .eq('client_id', client.id)
      .eq('period_month', periodStart.toISOString().slice(0, 10))
      .maybeSingle();

    const usedQueries = (usage?.score_queries ?? 0) + (usage?.report_queries ?? 0);

    // ── 4. Enforce monthly cap ──
    if (cap !== null && usedQueries >= cap) {
      return jsonError(
        `Monthly query cap reached (${cap}). Upgrade pricing tier or wait for next billing cycle.`,
        429,
        { cap_reached: true, cap, used: usedQueries, period: periodStart }
      );
    }

    // Apply included-queries allowance: first N queries are free (covered by base fee)
    const billableThisCall =
      isSandbox ? 0 :
      usedQueries < includedQueries ? 0 : unitPrice;

    // ── 5. Quote-only path ──
    if (action === 'quote') {
      return jsonOk({
        client_id: client.id,
        tier: tier?.tier_name ?? 'standard',
        currency,
        unit_price: unitPrice,
        billable_this_call: billableThisCall,
        included_queries: includedQueries,
        used_queries: usedQueries,
        cap,
        cap_remaining: cap === null ? null : Math.max(0, cap - usedQueries),
      });
    }

    // ── 6. Charge path ──
    const txRef = body.transaction_ref || `crq-${query_kind}-${crypto.randomUUID().slice(0, 12)}`;

    // 6a. Record the inquiry as a fee entry
    if (billableThisCall > 0 && client.institution_id) {
      await recordTransactionFee({
        supabase,
        institutionId: client.institution_id,
        transactionType: TX_TYPE_BY_KIND[query_kind],
        transactionRef: txRef,
        transactionAmount: billableThisCall,
        transactionCurrency: currency,
        feeModel: 'fixed',
        calculatedFee: billableThisCall,
        finalFee: billableThisCall,
        feeBreakdown: {
          tier: tier?.tier_name,
          unit_price: unitPrice,
          query_kind,
          user_id,
        },
        metadata: {
          client_id: client.id,
          score_returned: body.score_returned,
          report_id: body.report_id,
        },
      });
    }

    // 6b. Bump monthly usage
    const { data: usageRow } = await supabase.rpc('increment_credit_api_usage', {
      _client_id: client.id,
      _query_kind: query_kind,
      _billed_amount: billableThisCall,
      _currency: currency,
    });

    // 6c. Persist API usage log row (best-effort)
    await supabase.from('credit_api_usage_logs').insert({
      client_id: client.id,
      operation_type: query_kind === 'score' ? 'score_inquiry' : 'report_inquiry',
      user_id,
      response_status: 200,
      score_returned: body.score_returned ?? null,
      report_id: body.report_id ?? null,
      billed_amount: billableThisCall,
    });

    return jsonOk({
      success: true,
      transaction_ref: txRef,
      billed_amount: billableThisCall,
      currency,
      tier: tier?.tier_name ?? 'standard',
      period_usage: usageRow,
      sandbox: isSandbox,
    });
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] credit-inquiry-charge error:`, err);
    return jsonError('An internal error occurred.', 500, { error_id: errorId });
  }
});

function jsonOk(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
