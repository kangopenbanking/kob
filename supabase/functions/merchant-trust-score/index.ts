import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let body: Record<string, unknown> = {};
    if (req.method === 'POST') { try { body = await req.json(); } catch { /* ok */ } }

    const action = (body.action as string) || new URL(req.url).searchParams.get('action') || 'get';
    const merchantId = (body.merchant_id as string) || new URL(req.url).searchParams.get('merchant_id');

    // PUBLIC: Get trust score (no auth for public scores)
    if (action === 'get') {
      if (!merchantId) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // First try public score
      const { data: publicScore } = await supabase
        .from('merchant_trust_scores')
        .select('overall_score, trust_tier, risk_level, factors_summary, last_calculated_at')
        .eq('merchant_id', merchantId)
        .eq('is_public', true)
        .maybeSingle();

      if (publicScore) {
        return new Response(JSON.stringify({
          data: {
            merchant_id: merchantId,
            overall_score: publicScore.overall_score,
            trust_tier: publicScore.trust_tier,
            risk_level: publicScore.risk_level,
            factors: publicScore.factors_summary,
            last_updated: publicScore.last_calculated_at,
          }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // If not public, require auth
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return new Response(JSON.stringify({ error: 'score_not_public', message: 'This merchant trust score is not publicly available' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      const isAdmin = !!adminRole;
      const { data: merchant } = await supabase.from('gateway_merchants').select('id, user_id').eq('id', merchantId).single();
      if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!isAdmin && merchant.user_id !== user.id) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: score } = await supabase.from('merchant_trust_scores').select('*').eq('merchant_id', merchantId).maybeSingle();
      return new Response(JSON.stringify({ data: score || { merchant_id: merchantId, overall_score: 0, risk_level: 'unscored', trust_tier: 'unverified' } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // PUBLIC: Get trust history (no auth for public scores)
    if (action === 'history') {
      if (!merchantId) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: score } = await supabase
        .from('merchant_trust_scores')
        .select('overall_score, trust_tier, score_history, last_calculated_at')
        .eq('merchant_id', merchantId)
        .eq('is_public', true)
        .maybeSingle();

      if (!score) return new Response(JSON.stringify({ error: 'not_found_or_private' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      return new Response(JSON.stringify({
        data: {
          merchant_id: merchantId,
          current_score: score.overall_score,
          current_tier: score.trust_tier,
          history: score.score_history || [],
          last_updated: score.last_calculated_at,
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---- AUTHENTICATED ACTIONS ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    const isAdmin = !!adminRole;

    // CALCULATE - Compute trust score (admin only)
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

      // 3. Failure Rate Score (0-25)
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

      // 4. Dispute Score (0-20)
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

      // Determine tier
      let trustTier = 'bronze';
      if (overallScore >= 90) trustTier = 'platinum';
      else if (overallScore >= 75) trustTier = 'gold';
      else if (overallScore >= 50) trustTier = 'silver';
      else if (overallScore >= 25) trustTier = 'bronze';
      else trustTier = 'unverified';

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

      // Public-safe factors summary (no internal counts)
      const factorsSummary = {
        verification: verificationScore >= 20 ? 'strong' : verificationScore >= 10 ? 'moderate' : 'weak',
        transaction_volume: transactionScore >= 20 ? 'high' : transactionScore >= 10 ? 'moderate' : 'low',
        reliability: failureRateScore >= 20 ? 'excellent' : failureRateScore >= 10 ? 'good' : 'needs_improvement',
        dispute_record: disputeScore >= 15 ? 'clean' : disputeScore >= 10 ? 'moderate' : 'concerning',
      };

      // Get existing score for history
      const { data: existingScore } = await supabase.from('merchant_trust_scores').select('overall_score, trust_tier, score_history').eq('merchant_id', merchantId).maybeSingle();
      const history = existingScore?.score_history || [];
      if (existingScore) {
        history.push({ score: existingScore.overall_score, tier: existingScore.trust_tier, recorded_at: new Date().toISOString() });
        // Keep last 24 entries
        while (history.length > 24) history.shift();
      }

      const { data: upserted, error } = await supabase.from('merchant_trust_scores').upsert({
        merchant_id: merchantId,
        overall_score: overallScore,
        verification_score: verificationScore,
        transaction_score: transactionScore,
        failure_rate_score: failureRateScore,
        dispute_score: disputeScore,
        score_breakdown: scoreBreakdown,
        risk_level: riskLevel,
        trust_tier: trustTier,
        factors_summary: factorsSummary,
        score_history: history,
        badge_issued_at: trustTier !== 'unverified' && !existingScore?.badge_issued_at ? new Date().toISOString() : undefined,
        last_calculated_at: new Date().toISOString(),
      }, { onConflict: 'merchant_id' }).select().single();

      if (error) throw error;

      // Update public profile tier if it exists
      await supabase.from('public_business_profiles').update({ trust_tier: trustTier }).eq('merchant_id', merchantId);

      await supabase.from('audit_logs').insert({
        action_type: 'trust_score_calculated', entity_type: 'merchant_trust_score', entity_id: merchantId,
        performed_by: user.id, details: { overall_score: overallScore, risk_level: riskLevel, trust_tier: trustTier },
      });

      return new Response(JSON.stringify({ data: upserted }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // LIST - Admin list all scores
    if (action === 'list') {
      if (!isAdmin) return new Response(JSON.stringify({ error: 'admin_only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const riskFilter = (body.risk_level as string) || new URL(req.url).searchParams.get('risk_level');
      const tierFilter = (body.tier as string) || new URL(req.url).searchParams.get('tier');
      let query = supabase.from('merchant_trust_scores').select('*, gateway_merchants(business_name, status, kyb_status)');
      if (riskFilter) query = query.eq('risk_level', riskFilter);
      if (tierFilter) query = query.eq('trust_tier', tierFilter);

      const { data, error } = await query.order('overall_score', { ascending: true }).limit(100);
      if (error) throw error;
      return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // BATCH_CALCULATE - Admin batch recalculate all scores
    if (action === 'batch_calculate') {
      if (!isAdmin) return new Response(JSON.stringify({ error: 'admin_only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: merchants } = await supabase.from('gateway_merchants').select('id').eq('status', 'verified').limit(100);
      const results: { merchant_id: string; score: number; tier: string }[] = [];

      for (const m of merchants || []) {
        try {
          // Lightweight inline calculation
          const { count: txCount } = await supabase.from('gateway_charges').select('id', { count: 'exact', head: true }).eq('merchant_id', m.id).eq('status', 'succeeded');
          const score = Math.min(100, (txCount || 0) > 0 ? 45 + Math.min(55, Math.floor(Math.log10((txCount || 1)) * 20)) : 20);
          const tier = score >= 90 ? 'platinum' : score >= 75 ? 'gold' : score >= 50 ? 'silver' : 'bronze';
          results.push({ merchant_id: m.id, score, tier });
        } catch { /* skip failed */ }
      }

      return new Response(JSON.stringify({ data: { processed: results.length, results } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'invalid_action', valid: ['get', 'history', 'calculate', 'list', 'batch_calculate'] }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] trust-score error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
