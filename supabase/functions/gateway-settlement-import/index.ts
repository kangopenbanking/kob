import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const problem = (status: number, title: string, detail: string) =>
  new Response(JSON.stringify({ type: 'about:blank', title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return problem(405, 'Method Not Allowed', 'POST only');

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return problem(401, 'Unauthorized', 'Missing Authorization header');

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return problem(401, 'Unauthorized', 'Invalid or expired token');

    // Admin only
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    if (!(roles || []).some((r: any) => r.role === 'admin')) {
      return problem(403, 'Forbidden', 'Admin access required');
    }

    const body = await req.json();
    const { provider, period_start, period_end, settlement_data, format: dataFormat } = body;

    if (!provider || !settlement_data) {
      return problem(400, 'Bad Request', 'provider and settlement_data are required');
    }
    if (!period_start || !period_end) {
      return problem(400, 'Bad Request', 'period_start and period_end are required');
    }

    // Parse provider settlement data
    let providerRecords: ProviderRecord[];
    try {
      providerRecords = parseProviderData(provider, settlement_data, dataFormat || 'json');
    } catch (parseErr: any) {
      return problem(400, 'Parse Error', `Failed to parse settlement data: ${parseErr.message}`);
    }

    // Create reconciliation run
    const { data: run, error: runErr } = await supabase.from('reconciliation_runs').insert({
      run_type: 'settlement_import',
      provider,
      period_start,
      period_end,
      status: 'running',
      started_at: new Date().toISOString(),
      initiated_by: user.id,
      total_provider_records: providerRecords.length,
    }).select().single();

    if (runErr) return problem(500, 'Create Failed', runErr.message);

    try {
      // Fetch KOB platform charges for the period
      const { data: platformCharges } = await supabase.from('gateway_charges')
        .select('id, tx_ref, provider_ref, amount, fee_amount, net_amount, currency, status, provider')
        .eq('provider', provider)
        .gte('created_at', period_start).lte('created_at', period_end)
        .limit(1000);

      // Fetch KOB platform payouts for the period
      const { data: platformPayouts } = await supabase.from('gateway_payouts')
        .select('id, tx_ref, provider_ref, amount, fee_amount, currency, status, provider')
        .eq('provider', provider)
        .gte('created_at', period_start).lte('created_at', period_end)
        .limit(1000);

      const charges = platformCharges || [];
      const payouts = platformPayouts || [];

      // Build lookup maps by provider_ref
      const chargeByRef = new Map(charges.map(c => [c.provider_ref, c]));
      const chargeByTxRef = new Map(charges.map(c => [c.tx_ref, c]));
      const payoutByRef = new Map(payouts.map(p => [p.provider_ref, p]));

      const mismatches: any[] = [];
      let matchedCount = 0;
      let unmatchedProvider = 0;
      let amountMismatches = 0;
      let statusMismatches = 0;
      let feeMismatches = 0;

      for (const pr of providerRecords) {
        // Try to find matching platform record
        const platformRecord = chargeByRef.get(pr.reference) || chargeByTxRef.get(pr.reference) || payoutByRef.get(pr.reference);

        if (!platformRecord) {
          unmatchedProvider++;
          mismatches.push({
            run_id: run.id,
            mismatch_type: 'missing_in_platform',
            entity_type: pr.type || 'charge',
            provider_ref: pr.reference,
            provider_amount: pr.amount,
            provider_currency: pr.currency,
            provider_status: pr.status,
            details: { provider, reason: 'Provider record not found in KOB platform', provider_data: pr },
          });
          continue;
        }

        let hasIssue = false;

        // Amount mismatch
        if (Math.abs((platformRecord.amount || 0) - pr.amount) > 0.01) {
          amountMismatches++;
          hasIssue = true;
          mismatches.push({
            run_id: run.id,
            mismatch_type: 'amount_mismatch',
            entity_type: pr.type || 'charge',
            entity_id: platformRecord.id,
            provider_ref: pr.reference,
            platform_amount: platformRecord.amount,
            provider_amount: pr.amount,
            platform_currency: platformRecord.currency,
            provider_currency: pr.currency,
            details: { provider, difference: pr.amount - (platformRecord.amount || 0) },
          });
        }

        // Status mismatch
        const normalizedProviderStatus = normalizeStatus(pr.status);
        if (platformRecord.status !== normalizedProviderStatus) {
          statusMismatches++;
          hasIssue = true;
          mismatches.push({
            run_id: run.id,
            mismatch_type: 'status_mismatch',
            entity_type: pr.type || 'charge',
            entity_id: platformRecord.id,
            provider_ref: pr.reference,
            platform_status: platformRecord.status,
            provider_status: normalizedProviderStatus,
            platform_amount: platformRecord.amount,
            details: { provider, raw_provider_status: pr.status },
          });
        }

        // Fee mismatch
        if (pr.fee !== undefined && Math.abs((platformRecord.fee_amount || 0) - pr.fee) > 0.01) {
          feeMismatches++;
          hasIssue = true;
          mismatches.push({
            run_id: run.id,
            mismatch_type: 'fee_mismatch',
            entity_type: pr.type || 'charge',
            entity_id: platformRecord.id,
            provider_ref: pr.reference,
            platform_amount: platformRecord.fee_amount,
            provider_amount: pr.fee,
            details: { provider, platform_fee: platformRecord.fee_amount, provider_fee: pr.fee },
          });
        }

        if (!hasIssue) matchedCount++;
      }

      // Check for platform records missing from provider
      const providerRefs = new Set(providerRecords.map(p => p.reference));
      for (const c of charges) {
        if (c.status === 'successful' && c.provider_ref && !providerRefs.has(c.provider_ref)) {
          mismatches.push({
            run_id: run.id,
            mismatch_type: 'missing_in_provider',
            entity_type: 'charge',
            entity_id: c.id,
            provider_ref: c.provider_ref,
            platform_amount: c.amount,
            platform_currency: c.currency,
            platform_status: c.status,
            details: { provider, reason: 'KOB charge not found in provider settlement file' },
          });
        }
      }

      // Insert mismatches
      if (mismatches.length > 0) {
        await supabase.from('reconciliation_mismatches').insert(mismatches);
      }

      // Update run
      await supabase.from('reconciliation_runs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_provider_records: providerRecords.length,
        total_platform_records: charges.length + payouts.length,
        matched_count: matchedCount,
        mismatched_count: mismatches.length,
        summary: {
          provider,
          period: { start: period_start, end: period_end },
          breakdown: {
            matched: matchedCount,
            unmatched_provider: unmatchedProvider,
            amount_mismatches: amountMismatches,
            status_mismatches: statusMismatches,
            fee_mismatches: feeMismatches,
            missing_in_provider: mismatches.filter(m => m.mismatch_type === 'missing_in_provider').length,
          },
        },
      }).eq('id', run.id);

      // Audit log
      await supabase.from('audit_logs').insert({
        action_type: 'settlement_import_completed',
        entity_type: 'reconciliation_run',
        entity_id: run.id,
        performed_by: user.id,
        details: { provider, provider_records: providerRecords.length, mismatches: mismatches.length },
      });

      return json({
        run_id: run.id,
        status: 'completed',
        provider,
        period: { start: period_start, end: period_end },
        summary: {
          provider_records: providerRecords.length,
          platform_records: charges.length + payouts.length,
          matched: matchedCount,
          mismatches: mismatches.length,
          breakdown: {
            amount_mismatches: amountMismatches,
            status_mismatches: statusMismatches,
            fee_mismatches: feeMismatches,
            missing_in_platform: unmatchedProvider,
            missing_in_provider: mismatches.filter(m => m.mismatch_type === 'missing_in_provider').length,
          },
        },
      });

    } catch (runErr: any) {
      await supabase.from('reconciliation_runs').update({
        status: 'failed', completed_at: new Date().toISOString(), error_message: runErr.message,
      }).eq('id', run.id);
      return problem(500, 'Import Failed', runErr.message);
    }

  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] [gateway-settlement-import] Error:`, err);
    return problem(500, 'Internal Server Error', `Reference: ${errorId}`);
  }
});

// ─── Types & Parsers ─────────────────────────────────────────

interface ProviderRecord {
  reference: string;
  amount: number;
  fee?: number;
  net?: number;
  currency: string;
  status: string;
  type?: string; // charge | payout
  date?: string;
}

function parseProviderData(provider: string, data: any, format: string): ProviderRecord[] {
  if (format === 'csv') return parseCSVSettlement(data, provider);

  // JSON format — expect array of records
  if (Array.isArray(data)) {
    return data.map((item: any) => normalizeProviderRecord(item, provider));
  }

  // Provider-specific JSON structures
  if (provider === 'flutterwave' && data.data) {
    const items = Array.isArray(data.data) ? data.data : [data.data];
    return items.map((item: any) => ({
      reference: item.flw_ref || item.tx_ref || item.id?.toString(),
      amount: parseFloat(item.amount || item.charged_amount || 0),
      fee: parseFloat(item.app_fee || item.merchant_fee || 0),
      net: parseFloat(item.amount_settled || 0),
      currency: item.currency || 'NGN',
      status: item.status || 'unknown',
      type: item.tx_type === 'payout' ? 'payout' : 'charge',
      date: item.created_at || item.settlement_date,
    }));
  }

  if (provider === 'stripe' && data.data) {
    const items = Array.isArray(data.data) ? data.data : [data.data];
    return items.map((item: any) => ({
      reference: item.id || item.payment_intent,
      amount: (item.amount || 0) / 100, // Stripe uses cents
      fee: (item.fee || 0) / 100,
      net: (item.net || 0) / 100,
      currency: (item.currency || 'usd').toUpperCase(),
      status: item.status || 'unknown',
      type: item.type === 'payout' ? 'payout' : 'charge',
      date: item.created ? new Date(item.created * 1000).toISOString() : undefined,
    }));
  }

  if (provider === 'paypal') {
    const items = Array.isArray(data) ? data : data.transaction_details || [data];
    return items.map((item: any) => ({
      reference: item.transaction_id || item.invoice_id,
      amount: parseFloat(item.transaction_amount?.value || item.gross_amount?.value || 0),
      fee: Math.abs(parseFloat(item.fee_amount?.value || 0)),
      currency: item.transaction_amount?.currency_code || item.gross_amount?.currency_code || 'USD',
      status: item.transaction_status || 'S',
      type: 'charge',
      date: item.transaction_initiation_date,
    }));
  }

  throw new Error(`Cannot parse ${provider} data in ${format} format`);
}

function parseCSVSettlement(csvData: string, provider: string): ProviderRecord[] {
  const lines = csvData.split('\n').filter((l: string) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
  const records: ProviderRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v: string) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

    records.push(normalizeProviderRecord(row, provider));
  }

  return records;
}

function normalizeProviderRecord(row: any, provider: string): ProviderRecord {
  return {
    reference: row.reference || row.ref || row.tx_ref || row.flw_ref || row.id || row.transaction_id || '',
    amount: parseFloat(row.amount || row.charged_amount || row.gross_amount || 0),
    fee: row.fee !== undefined ? parseFloat(row.fee || row.app_fee || row.merchant_fee || 0) : undefined,
    net: row.net !== undefined ? parseFloat(row.net || row.amount_settled || 0) : undefined,
    currency: row.currency || 'XAF',
    status: row.status || 'unknown',
    type: row.type || 'charge',
    date: row.date || row.created_at || row.settlement_date,
  };
}

function normalizeStatus(status: string): string {
  const s = status.toLowerCase();
  if (['successful', 'success', 'completed', 'succeeded', 's'].includes(s)) return 'successful';
  if (['failed', 'failure', 'f'].includes(s)) return 'failed';
  if (['pending', 'processing', 'p'].includes(s)) return 'pending';
  if (['reversed', 'refunded'].includes(s)) return 'refunded';
  return s;
}
