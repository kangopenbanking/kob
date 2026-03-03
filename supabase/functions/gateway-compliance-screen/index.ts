import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const rfc7807 = (type: string, title: string, status: number, detail: string) =>
  new Response(JSON.stringify({ type: `https://api.kangopenbanking.com/errors/${type}`, title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return rfc7807('method_not_allowed', 'Method Not Allowed', 405, 'Only POST is supported');

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return rfc7807('unauthorized', 'Unauthorized', 401, 'Missing Authorization header');

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return rfc7807('unauthorized', 'Unauthorized', 401, 'Invalid or expired token');

    const body = await req.json();
    const {
      user_id,           // User to screen (defaults to authenticated user)
      amount,            // Payout amount
      currency = 'XAF',  // Payout currency
      destination_type,  // bank_account | card | momo | paypal
      destination_country,
    } = body;

    const targetUserId = user_id || user.id;

    if (!amount || amount <= 0) return rfc7807('validation_error', 'Validation Error', 400, 'amount must be a positive number');
    if (!destination_type) return rfc7807('validation_error', 'Validation Error', 400, 'destination_type is required');

    // ─── 1. KYC Risk Score ───
    const { data: riskScore } = await supabase.rpc('calculate_kyc_risk_score', { _user_id: targetUserId });
    const kycRisk = riskScore || 0;

    // ─── 2. Sanctions Check (most recent) ───
    const { data: sanctionsRecord } = await supabase
      .from('sanctions_screening')
      .select('screening_status, match_score, screening_date')
      .eq('user_id', targetUserId)
      .order('screening_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sanctionsStatus = sanctionsRecord?.screening_status || 'not_screened';
    const sanctionsScore = sanctionsRecord?.match_score || 0;

    // ─── 3. Velocity Checks (24h rolling) ───
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentPayouts, count: payoutCount } = await supabase
      .from('gateway_payouts')
      .select('amount', { count: 'exact' })
      .eq('metadata->>user_id', targetUserId)
      .gte('created_at', oneDayAgo)
      .in('status', ['pending', 'processing', 'successful']);

    const recentTotal = (recentPayouts || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const velocityCount = payoutCount || 0;

    // Also check consumer withdrawals
    const { data: recentWithdrawals, count: wdCount } = await supabase
      .from('transactions')
      .select('amount', { count: 'exact' })
      .eq('user_id', targetUserId)
      .eq('transaction_type', 'withdrawal')
      .eq('credit_debit_indicator', 'Debit')
      .gte('booking_datetime', oneDayAgo)
      .neq('status', 'failed');

    const wdTotal = (recentWithdrawals || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

    // ─── 4. CDD / PEP Check ───
    const { data: cddRecord } = await supabase
      .from('customer_due_diligence')
      .select('pep_status, risk_category, adverse_media')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const isPep = cddRecord?.pep_status || false;
    const riskCategory = cddRecord?.risk_category || 'standard';

    // ─── 5. High-Risk Country Check ───
    const highRiskCountries = ['KP', 'IR', 'SY', 'CU', 'MM', 'VE', 'SD', 'SO', 'LY', 'YE'];
    const destCountryRisk = highRiskCountries.includes(destination_country?.toUpperCase() || '');

    // ─── 6. Compute Decision ───
    const flags: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'blocked' = 'low';

    // KYC risk
    if (kycRisk >= 80) { flags.push('kyc_risk_critical'); riskLevel = 'blocked'; }
    else if (kycRisk >= 50) { flags.push('kyc_risk_elevated'); riskLevel = maxRisk(riskLevel, 'high'); }
    else if (kycRisk >= 30) { flags.push('kyc_risk_moderate'); riskLevel = maxRisk(riskLevel, 'medium'); }

    // Sanctions
    if (sanctionsStatus === 'confirmed_match') { flags.push('sanctions_match'); riskLevel = 'blocked'; }
    else if (sanctionsStatus === 'potential_match') { flags.push('sanctions_potential_match'); riskLevel = maxRisk(riskLevel, 'high'); }
    else if (sanctionsStatus === 'not_screened') { flags.push('no_recent_sanctions_screening'); riskLevel = maxRisk(riskLevel, 'medium'); }

    // Velocity
    const totalVolume24h = recentTotal + wdTotal;
    const totalCount24h = velocityCount + (wdCount || 0);
    if (totalVolume24h + amount > 5_000_000) { flags.push('volume_24h_exceeds_5m'); riskLevel = maxRisk(riskLevel, 'high'); }
    else if (totalVolume24h + amount > 1_000_000) { flags.push('volume_24h_exceeds_1m'); riskLevel = maxRisk(riskLevel, 'medium'); }
    if (totalCount24h >= 20) { flags.push('velocity_count_24h_exceeded'); riskLevel = maxRisk(riskLevel, 'high'); }

    // PEP
    if (isPep) { flags.push('politically_exposed_person'); riskLevel = maxRisk(riskLevel, 'high'); }

    // Enhanced due diligence
    if (riskCategory === 'enhanced') { flags.push('enhanced_due_diligence_required'); riskLevel = maxRisk(riskLevel, 'medium'); }

    // Destination country
    if (destCountryRisk) { flags.push('high_risk_destination_country'); riskLevel = maxRisk(riskLevel, 'high'); }

    // Large single transaction
    if (amount > 2_000_000) { flags.push('large_transaction_over_2m'); riskLevel = maxRisk(riskLevel, 'medium'); }
    if (amount > 10_000_000) { flags.push('very_large_transaction_over_10m'); riskLevel = maxRisk(riskLevel, 'high'); }

    const decision = riskLevel === 'blocked' ? 'deny' : riskLevel === 'high' ? 'review' : 'approve';

    // ─── 7. Log screening result ───
    await supabase.from('audit_logs').insert({
      action_type: 'payout_compliance_screen',
      entity_type: 'payout_screen',
      entity_id: targetUserId,
      performed_by: user.id,
      details: {
        amount, currency, destination_type, destination_country,
        decision, risk_level: riskLevel, flags,
        kyc_risk_score: kycRisk, sanctions_status: sanctionsStatus,
        volume_24h: totalVolume24h, count_24h: totalCount24h,
      },
    });

    // Create alert if high risk
    if (riskLevel === 'high' || riskLevel === 'blocked') {
      await supabase.from('transaction_monitoring_alerts').insert({
        alert_type: 'pre_payout_compliance',
        severity: riskLevel === 'blocked' ? 'critical' : 'high',
        description: `Pre-payout compliance screen flagged: ${flags.join(', ')}`,
        metadata: { user_id: targetUserId, amount, currency, destination_type, flags, decision },
        status: 'open',
      });
    }

    return json({
      decision,
      risk_level: riskLevel,
      flags,
      details: {
        kyc_risk_score: kycRisk,
        sanctions_status: sanctionsStatus,
        sanctions_score: sanctionsScore,
        is_pep: isPep,
        cdd_risk_category: riskCategory,
        volume_24h: totalVolume24h,
        count_24h: totalCount24h,
        amount_requested: amount,
      },
      screened_at: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error('[gateway-compliance-screen] Error:', err);
    return rfc7807('internal_error', 'Internal Server Error', 500, err.message || 'Unexpected error');
  }
});

function maxRisk(current: string, candidate: string): 'low' | 'medium' | 'high' | 'blocked' {
  const levels: Record<string, number> = { low: 0, medium: 1, high: 2, blocked: 3 };
  return (levels[candidate] || 0) > (levels[current] || 0) ? candidate as any : current as any;
}
