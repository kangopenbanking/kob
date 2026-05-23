import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

import { corsHeaders } from "../_shared/cors.ts";
import { evaluateBasicCheck, persistBasicCheckFlag } from "../_shared/credit-basic-check.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { user_id, force_refresh = false, include_report = false } = body;

    console.log('Fetching credit score for user:', user_id);

    // ── Basic check gate ─────────────────────────────────────────
    // Customers do not have a score until the basic identity check completes.
    const basicCheck = await evaluateBasicCheck(supabase, user_id);
    await persistBasicCheckFlag(supabase, user_id, basicCheck.passed);
    if (!basicCheck.passed) {
      return new Response(
        JSON.stringify({
          success: true,
          score: null,
          score_range: 'Unknown',
          score_band: null,
          calculated_at: null,
          expires_at: null,
          score_factors: null,
          source: 'basic_check_required',
          basic_check: basicCheck,
          recent_events: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Try event-sourced system first (preferred) ──
    const { data: eventProfile } = await supabase
      .from('credit_profiles')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

    const { data: latestSnapshot } = await supabase
      .from('credit_score_snapshots')
      .select('*')
      .eq('user_id', user_id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── Fetch recent credit events for timeline ──
    const { data: recentEvents } = await supabase
      .from('credit_events')
      .select('id, event_type, event_time, value_numeric, metadata, source')
      .eq('user_id', user_id)
      .order('event_time', { ascending: false })
      .limit(20);

    // Use event-sourced score if available and recent (within 24h), or force recompute
    let useEventSourced = false;
    let scoreData: any = null;

    if (eventProfile?.current_score && eventProfile.last_computed_at && !force_refresh) {
      const lastComputed = new Date(eventProfile.last_computed_at);
      const hoursSinceCompute = (Date.now() - lastComputed.getTime()) / (1000 * 60 * 60);
      // Only use cached event-sourced score if fresh (< 24h) AND no force refresh requested
      useEventSourced = hoursSinceCompute < 24;
    }

    // Auto-init: if no profile exists yet but the user has events, trigger an initial computation.
    // This guarantees first-time visitors get a real score instead of a 0/placeholder.
    if (!eventProfile && !force_refresh) {
      const { count: bootEventCount } = await supabase
        .from('credit_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user_id);
      if (bootEventCount && bootEventCount > 0) {
        // Defer to the force_refresh branch below to call the engine
        // by flipping the flag for this request only.
        (body as any).force_refresh = true;
      }
    }

    if (useEventSourced && eventProfile) {
      // Use event-sourced score
      scoreData = {
        score: eventProfile.current_score,
        score_range: getScoreRange(eventProfile.current_score),
        score_band: eventProfile.score_band,
        calculated_at: eventProfile.last_computed_at,
        expires_at: null,
        score_factors: latestSnapshot?.factors_json || null,
        source: 'event_sourced',
      };
    } else if (force_refresh || !eventProfile) {
      // Try to recompute via credit-score-engine if events exist
      const { count } = await supabase
        .from('credit_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user_id);

      if (count && count > 0) {
        try {
          const scoreRes = await fetch(`${supabaseUrl}/functions/v1/credit-score-engine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ user_id }),
          });
          const engineResult = await scoreRes.json();
          if (engineResult?.score) {
            scoreData = {
              score: engineResult.score,
              score_range: getScoreRange(engineResult.score),
              score_band: engineResult.band,
              calculated_at: new Date().toISOString(),
              expires_at: null,
              score_factors: engineResult.factors || null,
              source: 'event_sourced',
            };
          }
        } catch (engineErr) {
          console.error('Credit score engine call failed:', engineErr);
        }
      }

      // Fall back to legacy system if no event-sourced score
      if (!scoreData) {
        const { data: existingScore } = await supabase
          .from('credit_scores')
          .select('*')
          .eq('user_id', user_id)
          .eq('status', 'active')
          .gte('expires_at', new Date().toISOString())
          .order('calculated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingScore && !force_refresh) {
          scoreData = {
            ...existingScore,
            score_range: getScoreRange(existingScore.score),
            source: 'legacy',
          };
        } else {
          // Calculate via legacy system
          try {
            await supabase.functions.invoke('credit-score-calculate', {
              body: { user_id, include_external: false },
            });
            const { data: newScore } = await supabase
              .from('credit_scores')
              .select('*')
              .eq('user_id', user_id)
              .eq('status', 'active')
              .order('calculated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            scoreData = newScore ? { ...newScore, score_range: getScoreRange(newScore.score), source: 'legacy' } : null;
          } catch (legacyErr) {
            console.error('Legacy score calculation failed:', legacyErr);
          }
        }
      }
    }

    // Log as soft inquiry
    if (scoreData?.score) {
      const { error: inquiryErr } = await supabase.from('credit_inquiries').insert({
        user_id,
        inquiry_type: 'soft',
        inquirer_type: 'self',
        inquirer_name: 'Self Check',
        purpose: 'score_check',
        user_consent_given: true,
        score_provided: scoreData.score,
      });
      if (inquiryErr) console.warn('Non-critical: inquiry log failed:', inquiryErr.message);
    }

    let reportData = null;
    if (include_report && scoreData?.id) {
      const { data: report } = await supabase
        .from('credit_reports')
        .select('*')
        .eq('credit_score_id', scoreData.id)
        .maybeSingle();
      reportData = report;
    }

    return new Response(
      JSON.stringify({
        success: true,
        score: scoreData?.score || 0,
        score_range: scoreData?.score_range || 'Unknown',
        score_band: scoreData?.score_band || null,
        calculated_at: scoreData?.calculated_at,
        expires_at: scoreData?.expires_at,
        score_factors: scoreData?.score_factors,
        source: scoreData?.source || 'none',
        report: reportData,
        recent_events: recentEvents || [],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching credit score:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to fetch credit score', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getScoreRange(score: number | undefined): string {
  if (!score) return 'Unknown';
  if (score >= 800) return 'Excellent';
  if (score >= 740) return 'Very Good';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Poor';
}
