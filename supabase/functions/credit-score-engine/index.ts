import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { evaluateBasicCheck, persistBasicCheckFlag } from "../_shared/credit-basic-check.ts";

// Scoring rules (MVP defaults)
const SCORING_RULES: Record<string, { min: number; max: number }> = {
  LOAN_REPAYMENT_ON_TIME: { min: 5, max: 15 },
  LOAN_REPAYMENT_LATE: { min: -40, max: -10 },
  LOAN_INSTALLMENT_MISSED: { min: -50, max: -50 },
  LOAN_DEFAULTED: { min: -250, max: -150 },
  LOAN_CLOSED: { min: 15, max: 15 },
  SAVINGS_DEPOSIT: { min: 1, max: 3 },
  SAVINGS_WITHDRAWAL: { min: 0, max: 0 },
  SAVINGS_BALANCE_STABLE: { min: 2, max: 2 },
  // Piggy Bank
  PIGGYBANK_PAYMENT_ON_TIME: { min: 3, max: 5 },
  PIGGYBANK_PAYMENT_LATE: { min: -15, max: -5 },
  PIGGYBANK_PAYMENT_MISSED: { min: -20, max: -20 },
  PIGGYBANK_PLAN_CANCELLED: { min: -5, max: -5 },
  // Njangi
  NJANGI_CONTRIBUTION_ON_TIME: { min: 3, max: 5 },
  NJANGI_CONTRIBUTION_LATE: { min: -15, max: -5 },
  NJANGI_CONTRIBUTION_MISSED: { min: -25, max: -25 },
  NJANGI_PAYOUT_RECEIVED: { min: 8, max: 8 },
  // Rent
  RENT_PAYMENT_ON_TIME: { min: 5, max: 10 },
  RENT_PAYMENT_LATE: { min: -25, max: -10 },
  RENT_PAYMENT_MISSED: { min: -30, max: -30 },
  // PostiQ address verification
  POSTIQ_VERIFIED: { min: 50, max: 50 },
  // Loan application events
  HARD_INQUIRY: { min: -5, max: -5 },
};

const BASELINE = 500;
const MIN_SCORE = 300;
const MAX_SCORE = 850;
const MAX_SAVINGS_DEPOSITS_PER_MONTH = 10;

function getBand(score: number): string {
  if (score >= 750) return 'A';
  if (score >= 650) return 'B';
  if (score >= 550) return 'C';
  if (score >= 400) return 'D';
  return 'F';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { user_id } = await req.json();
    if (!user_id) throw new Error('user_id required');

    // ── Basic check gate ──────────────────────────────────────────
    // No score is computed until profile + KYC basic check passes.
    const basicCheck = await evaluateBasicCheck(supabase, user_id);
    await persistBasicCheckFlag(supabase, user_id, basicCheck.passed);

    if (!basicCheck.passed) {
      // Make sure no stale score is presented while ungated.
      await supabase
        .from('credit_profiles')
        .update({
          current_score: null,
          last_computed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user_id);

      return new Response(
        JSON.stringify({
          error: 'basic_check_required',
          message: 'Complete the basic identity check to unlock your CrediQ score.',
          basic_check: basicCheck,
          score: null,
          band: null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get previous score
    const { data: existingProfile } = await supabase
      .from('credit_profiles')
      .select('current_score')
      .eq('user_id', user_id)
      .maybeSingle();

    const previousScore = existingProfile?.current_score ?? BASELINE;

    // Fetch all credit events for user
    const { data: events, error: eventsErr } = await supabase
      .from('credit_events')
      .select('*')
      .eq('user_id', user_id)
      .order('event_time', { ascending: true });

    if (eventsErr) throw eventsErr;

    let score = BASELINE;
    const factorMap: Record<string, { count: number; total: number }> = {};
    const monthlyDepositCounts: Record<string, number> = {};

    for (const event of (events || [])) {
      const rule = SCORING_RULES[event.event_type];
      if (!rule) continue;

      let points = 0;

      switch (event.event_type) {
        case 'LOAN_REPAYMENT_ON_TIME':
          points = rule.max; // +15
          break;
        case 'LOAN_REPAYMENT_LATE': {
          const daysLate = Math.abs(event.value_numeric || 1);
          // Scale: 1 day = -10, 30+ days = -40
          points = Math.max(rule.min, Math.min(rule.max, -10 - Math.floor(daysLate / 3) * 3));
          break;
        }
        case 'LOAN_INSTALLMENT_MISSED':
          points = rule.min; // -50
          break;
        case 'LOAN_DEFAULTED':
          points = rule.min; // -250
          break;
        case 'LOAN_CLOSED':
          points = rule.max; // +15
          break;
        case 'SAVINGS_DEPOSIT': {
          const monthKey = event.event_time.substring(0, 7);
          monthlyDepositCounts[monthKey] = (monthlyDepositCounts[monthKey] || 0) + 1;
          if (monthlyDepositCounts[monthKey] <= MAX_SAVINGS_DEPOSITS_PER_MONTH) {
            const amount = Number(event.value_numeric || 0);
            points = amount >= 50000 ? 3 : amount >= 10000 ? 2 : 1;
          }
          break;
        }
        case 'SAVINGS_WITHDRAWAL':
          points = 0;
          break;
        case 'SAVINGS_BALANCE_STABLE':
          points = 2;
          break;
        // Piggy Bank events
        case 'PIGGYBANK_PAYMENT_ON_TIME':
          points = rule.max; // +5
          break;
        case 'PIGGYBANK_PAYMENT_LATE': {
          const pbDaysLate = Math.abs(event.value_numeric || 1);
          points = Math.max(rule.min, Math.min(rule.max, -5 - Math.floor(pbDaysLate / 7) * 2));
          break;
        }
        case 'PIGGYBANK_PAYMENT_MISSED':
          points = rule.min; // -20
          break;
        case 'PIGGYBANK_PLAN_CANCELLED':
          points = rule.min; // -5
          break;
        // Njangi events
        case 'NJANGI_CONTRIBUTION_ON_TIME':
          points = rule.max; // +5
          break;
        case 'NJANGI_CONTRIBUTION_LATE': {
          const njDaysLate = Math.abs(event.value_numeric || 1);
          points = Math.max(rule.min, Math.min(rule.max, -5 - Math.floor(njDaysLate / 7) * 2));
          break;
        }
        case 'NJANGI_CONTRIBUTION_MISSED':
          points = rule.min; // -25
          break;
        case 'NJANGI_PAYOUT_RECEIVED':
          points = rule.max; // +8 — proves reliable group standing
          break;
        // Rent events
        case 'RENT_PAYMENT_ON_TIME':
          points = rule.max; // +10
          break;
        case 'RENT_PAYMENT_LATE': {
          const rentDaysLate = Math.abs(event.value_numeric || 1);
          points = Math.max(rule.min, Math.min(rule.max, -10 - Math.floor(rentDaysLate / 7) * 3));
          break;
        }
        case 'RENT_PAYMENT_MISSED':
          points = rule.min; // -30
          break;
        // PostiQ
        case 'POSTIQ_VERIFIED':
          points = rule.max; // +50
          break;
        // Hard inquiries
        case 'HARD_INQUIRY':
          points = rule.min; // -5
          break;
      }

      score += points;

      if (points !== 0) {
        if (!factorMap[event.event_type]) {
          factorMap[event.event_type] = { count: 0, total: 0 };
        }
        factorMap[event.event_type].count++;
        factorMap[event.event_type].total += points;
      }
    }

    // Clamp
    score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, score));
    const band = getBand(score);

    // Build top 3 factors
    const factors = Object.entries(factorMap)
      .map(([type, { count, total }]) => ({
        event_type: type,
        count,
        total_impact: total,
        description: `${count} ${type.replace(/_/g, ' ').toLowerCase()} events: ${total > 0 ? '+' : ''}${total} points`,
      }))
      .sort((a, b) => Math.abs(b.total_impact) - Math.abs(a.total_impact))
      .slice(0, 5);

    // Upsert credit_profiles
    await supabase.from('credit_profiles').upsert({
      user_id,
      current_score: score,
      score_band: band,
      last_computed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // Insert snapshot
    await supabase.from('credit_score_snapshots').insert({
      user_id,
      score,
      score_band: band,
      factors_json: factors,
      computed_at: new Date().toISOString(),
    });

    const delta = score - previousScore;

    console.log(`Credit score computed for ${user_id}: ${score} (${band}), delta: ${delta}`);

    return new Response(JSON.stringify({
      score,
      band,
      delta,
      previous_score: previousScore,
      factors,
      events_processed: (events || []).length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] credit-score-engine error:`, err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.', error_id: errorId }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
