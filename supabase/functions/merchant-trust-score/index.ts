import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let body: Record<string, unknown> = {};
    if (req.method === 'POST') { try { body = await req.json(); } catch { /* ok */ } }

    const action = (body.action as string) || new URL(req.url).searchParams.get('action') || 'get';
    const merchantId = (body.merchant_id as string) || new URL(req.url).searchParams.get('merchant_id');

    const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    const isAdmin = !!adminRole;

    // GET - Retrieve trust score
    if (action === 'get') {
      if (!merchantId) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: merchant } = await supabase.from('gateway_merchants').select('id, user_id, business_name').eq('id', merchantId).single();
      if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!isAdmin && merchant.user_id !== user.id) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: score } = await supabase.from('merchant_trust_scores').select('*').eq('merchant_id', merchantId).maybeSingle();
      return new Response(JSON.stringify({ data: score || { merchant_id: merchantId, overall_score: 0, risk_level: 'unscored' } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // CALCULATE - Compute trust score
    if (action === 'calculate') {
      if (!isAdmin) return new Response(JSON.stringify({ error: 'admin_only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!merchantId) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', merchantId).single();
      if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // 1. Verification Score (0-25)
      let verificationScore = 0;
      const kybStatus = merchant.kyb_status;
      if (kybStatus === 'approved') verificationScore = 25;
      else if (kybStatus === 'submitted' || kybStatus === 'under_review') verificationScore = 10;
      else if (kybStatus === 'draft') verificationScore = 5;

      // Check business_kyc completeness
      const { data: kyc } = await supabase.from('business_kyc').select('*').eq('user_id', merchant.user_id).maybeSingle();
      if (kyc) {
        const docCount = [kyc.registration_certificate_url, kyc.articles_of_association_url, kyc.tax_certificate_url, kyc.proof_of_address_url, kyc.bank_statement_url].filter(Boolean).length;
        verificationScore = Math.min(25, verificationScore + docCount * 2);
      }

      // 2. Transaction Score (0-30)
      let transactionScore = 0;
      const { count: txCount } = await supabase.from('gateway_charges').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId).eq('status', 'succeeded');
      if (txCount !== null) {
        if (txCount >= 1000) transactionScore = 30;
        else if (txCount >= 500) transactionScore = 25;
        else if (txCount >= 100) transactionScore = 20;
        else if (txCount >= 50) transactionScore = 15;
        else if (txCount >= 10) transactionScore = 10;
        else if (txCount >= 1) transactionScore = 5;
      }

      // 3. Failure Rate Score (0-25, inverted - lower failures = higher score)
      let failureRateScore = 25;
      const { count: failedCount } = await supabase.from('gateway_charges').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId).eq('status', 'failed');
      const totalTx = (txCount || 0) + (failedCount || 0);
      if (totalTx > 0) {
        const failureRate = (failedCount || 0) / totalTx;
        if (failureRate > 0.5) failureRateScore = 0;
        else if (failureRate > 0.3) failureRateScore = 5;
        else if (failureRate > 0.2) failureRateScore = 10;
        else if (failureRate > 0.1) failureRateScore = 15;
        else if (failureRate > 0.05) failureRateScore = 20;
        else failureRateScore = 25;
      }

      // 4. Dispute Score (0-20, inverted - fewer disputes = higher score)
      let disputeScore = 20;
      const { count: disputeCount } = await supabase.from('gateway_disputes').select('id', { count: 'exact', head: true }).eq('merchant_id', merchantId);
      if (disputeCount !== null && disputeCount > 0) {
        const disputeRatio = totalTx > 0 ? disputeCount / totalTx : 1;
        if (disputeRatio > 0.1) disputeScore = 0;
        else if (disputeRatio > 0.05) disputeScore = 5;
        else if (disputeRatio > 0.02) disputeScore = 10;
        else if (disputeRatio > 0.01) disputeScore = 15;
        else disputeScore = 18;
      }

      const overallScore = verificationScore + transactionScore + failureRateScore + disputeScore;
      let riskLevel = 'medium';
      if (overallScore >= 80) riskLevel = 'low';
      else if (overallScore >= 50) riskLevel = 'medium';
      else if (overallScore >= 25) riskLevel = 'high';
      else riskLevel = 'critical';

      const scoreBreakdown = {
        verification: { score: verificationScore, max: 25, kyb_status: kybStatus, documents: kyc ? [kyc.registration_certificate_url, kyc.articles_of_association_url, kyc.tax_certificate_url, kyc.proof_of_address_url, kyc.bank_statement_url].filter(Boolean).length : 0 },
        transactions: { score: transactionScore, max: 30, successful_count: txCount || 0 },
        failure_rate: { score: failureRateScore, max: 25, failed_count: failedCount || 0, total: totalTx, rate: totalTx > 0 ? ((failedCount || 0) / totalTx * 100).toFixed(1) + '%' : '0%' },
        disputes: { score: disputeScore, max: 20, count: disputeCount || 0, ratio: totalTx > 0 ? ((disputeCount || 0) / totalTx * 100).toFixed(1) + '%' : '0%' },
      };

      const { data: upserted, error } = await supabase.from('merchant_trust_scores').upsert({
        merchant_id: merchantId,
        overall_score: overallScore,
        verification_score: verificationScore,
        transaction_score: transactionScore,
        failure_rate_score: failureRateScore,
        dispute_score: disputeScore,
        score_breakdown: scoreBreakdown,
        risk_level: riskLevel,
        last_calculated_at: new Date().toISOString(),
      }, { onConflict: 'merchant_id' }).select().single();

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        action_type: 'trust_score_calculated', entity_type: 'merchant_trust_score', entity_id: merchantId,
        performed_by: user.id, details: { overall_score: overallScore, risk_level: riskLevel },
      });

      return new Response(JSON.stringify({ data: upserted }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // LIST - Admin list all scores
    if (action === 'list') {
      if (!isAdmin) return new Response(JSON.stringify({ error: 'admin_only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const riskFilter = (body.risk_level as string) || new URL(req.url).searchParams.get('risk_level');
      let query = supabase.from('merchant_trust_scores').select('*, gateway_merchants(business_name, status, kyb_status)');
      if (riskFilter) query = query.eq('risk_level', riskFilter);

      const { data, error } = await query.order('overall_score', { ascending: true }).limit(100);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'invalid_action', valid: ['get', 'calculate', 'list'] }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] trust-score error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
