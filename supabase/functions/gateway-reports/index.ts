// deno-lint-ignore-file no-explicit-any
/**
 * Gateway Reports — Phase 3 (additive)
 *
 * Backs three pre-existing OpenAPI operations with both JSON and CSV output:
 *   - GET /v1/gateway/reports/transactions  (gatewayReportTransactions)
 *   - GET /v1/gateway/reports/settlements   (gatewayReportSettlements)
 *   - GET /v1/gateway/reports/fees          (gatewayReportFees)
 *
 * Format selection (additive — JSON remains default):
 *   - ?format=csv  → text/csv attachment
 *   - ?format=json (or omitted) → application/json
 *
 * Auth: Bearer JWT of merchant owner. Service role bypasses scoping.
 *
 * NOTE: This function is additive. It does not modify or replace any
 * existing route. Existing JSON consumers are 100% backwards compatible.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const head = headers.join(',');
  const body = rows
    .map((r) => headers.map((h) => csvEscape(r[h])).join(','))
    .join('\n');
  return rows.length ? `${head}\n${body}\n` : `${head}\n`;
}

function csvResponse(filename: string, csv: string) {
  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // --- Authentication ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'unauthorized', message: 'Missing bearer token' }, 401);
  }
  const token = authHeader.slice(7);
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json({ error: 'unauthorized', message: 'Invalid token' }, 401);
  }
  const userId = userData.user.id;

  // --- Parse query ---
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  // Accept ?report=transactions|settlements|fees OR last path segment
  let report = url.searchParams.get('report') || segments[segments.length - 1] || '';
  if (!['transactions', 'settlements', 'fees'].includes(report)) {
    // Fall back to action param for router-style invocation
    report = url.searchParams.get('action') || '';
  }
  if (!['transactions', 'settlements', 'fees'].includes(report)) {
    return json({
      error: 'invalid_request',
      message: 'report must be one of: transactions, settlements, fees',
    }, 400);
  }

  const format = (url.searchParams.get('format') || 'json').toLowerCase();
  if (!['json', 'csv'].includes(format)) {
    return json({ error: 'invalid_request', message: 'format must be json or csv' }, 400);
  }

  const merchantIdParam = url.searchParams.get('merchant_id');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1000);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

  // Date range guard (reuse existing PAY_020 contract: max 90 days)
  if (from && to) {
    const days = (Date.parse(to) - Date.parse(from)) / 86400000;
    if (Number.isFinite(days) && days > 90) {
      return json({
        error: 'invalid_request',
        error_code: 'PAY_020',
        message: 'Date range exceeds maximum of 90 days',
        details: { max_days: 90 },
      }, 400);
    }
  }

  // --- Resolve allowed merchant scope ---
  let merchantIds: string[] = [];
  {
    const q = supabase.from('gateway_merchants').select('id').eq('user_id', userId);
    const { data: mineRows } = await q;
    merchantIds = (mineRows || []).map((r: any) => r.id);
  }
  if (merchantIdParam) {
    if (!merchantIds.includes(merchantIdParam)) {
      // Allow admins via has_role check
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin',
      });
      if (!isAdmin) return json({ error: 'forbidden' }, 403);
    }
    merchantIds = [merchantIdParam];
  }
  if (merchantIds.length === 0) {
    // No merchants — empty result
    if (format === 'csv') return csvResponse(`${report}.csv`, '');
    return json({ data: [], pagination: { total: 0, limit, offset, has_more: false } });
  }

  try {
    if (report === 'transactions') {
      let query = supabase
        .from('gateway_charges')
        .select('id, merchant_id, tx_ref, amount, currency, channel, status, provider, fee_amount, net_amount, customer_email, created_at', { count: 'exact' })
        .in('merchant_id', merchantIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);
      const { data, count, error } = await query;
      if (error) throw error;

      if (format === 'csv') {
        const headers = ['id', 'merchant_id', 'tx_ref', 'amount', 'currency', 'channel', 'status', 'provider', 'fee_amount', 'net_amount', 'customer_email', 'created_at'];
        return csvResponse('transactions.csv', toCsv(headers, (data || []) as any));
      }
      return json({
        data: data || [],
        pagination: { total: count || 0, limit, offset, has_more: (count || 0) > offset + limit },
      });
    }

    if (report === 'settlements') {
      let query = supabase
        .from('gateway_settlements')
        .select('id, merchant_id, amount, currency, fees_total, net_amount, charges_count, status, period_start, period_end, payout_ref, settled_at, created_at', { count: 'exact' })
        .in('merchant_id', merchantIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (from) query = query.gte('period_start', from);
      if (to) query = query.lte('period_end', to);
      const { data, count, error } = await query;
      if (error) throw error;

      if (format === 'csv') {
        const headers = ['id', 'merchant_id', 'amount', 'currency', 'fees_total', 'net_amount', 'charges_count', 'status', 'period_start', 'period_end', 'payout_ref', 'settled_at', 'created_at'];
        return csvResponse('settlements.csv', toCsv(headers, (data || []) as any));
      }
      return json({
        data: data || [],
        pagination: { total: count || 0, limit, offset, has_more: (count || 0) > offset + limit },
      });
    }

    // fees — aggregate by channel + currency
    let query = supabase
      .from('gateway_charges')
      .select('channel, currency, fee_amount, amount, status, created_at')
      .in('merchant_id', merchantIds)
      .eq('status', 'success');
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    const { data, error } = await query;
    if (error) throw error;

    const buckets = new Map<string, { channel: string; currency: string; charges_count: number; gross_amount: number; fees_total: number }>();
    for (const row of (data || []) as any[]) {
      const key = `${row.channel}|${row.currency}`;
      const b = buckets.get(key) || { channel: row.channel, currency: row.currency, charges_count: 0, gross_amount: 0, fees_total: 0 };
      b.charges_count += 1;
      b.gross_amount += Number(row.amount || 0);
      b.fees_total += Number(row.fee_amount || 0);
      buckets.set(key, b);
    }
    const rows = Array.from(buckets.values()).sort((a, b) => b.fees_total - a.fees_total);

    if (format === 'csv') {
      const headers = ['channel', 'currency', 'charges_count', 'gross_amount', 'fees_total'];
      return csvResponse('fees.csv', toCsv(headers, rows as any));
    }
    return json({
      data: rows,
      summary: {
        total_charges: rows.reduce((s, r) => s + r.charges_count, 0),
        total_fees: rows.reduce((s, r) => s + r.fees_total, 0),
      },
    });
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-reports error:`, err);
    return json({ error: 'internal_error', error_id: errorId, message: err?.message }, 500);
  }
});
