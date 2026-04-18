import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const body = await req.json();
    const action = body.action;

    switch (action) {
      case 'calculate': return await handleCalculate(req, body, supabaseUrl, serviceKey);
      case 'fetch': return await handleFetch(req, body, supabaseUrl, serviceKey);
      case 'engine': return await handleEngine(body, supabaseUrl, serviceKey);
      case 'simulate': return await handleSimulate(req, body, supabaseUrl, serviceKey);
      case 'tips': return await handleTips(req, body, supabaseUrl, serviceKey);
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error: any) {
    console.error('credit-score error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// ─── CALCULATE ───
async function handleCalculate(_req: Request, body: any, supabaseUrl: string, serviceKey: string) {
  const supabase = createClient(supabaseUrl, serviceKey);
  const { user_id, include_external = false, scoring_model = 'internal', trigger_event } = body;

  const { data: existingScore } = await supabase.from('credit_scores').select('score').eq('user_id', user_id).eq('status', 'active').order('calculated_at', { ascending: false }).limit(1).single();
  const oldScore = existingScore?.score || null;

  const { data: loanAccounts } = await supabase.from('loan_accounts').select('*, loan_payments(*)').eq('user_id', user_id);
  const { data: savingsAccounts } = await supabase.from('savings_accounts').select('*, savings_transactions(*)').eq('user_id', user_id);
  const { data: transactions } = await supabase.from('transactions').select('*').eq('user_id', user_id).order('created_at', { ascending: false }).limit(100);
  const { data: kycData } = await supabase.from('kyc_verifications').select('*').eq('user_id', user_id).eq('status', 'approved').single();
  const { data: postiqVerification } = await supabase.from('postiq_address_verifications').select('*').eq('user_id', user_id).eq('is_active', true).order('verified_at', { ascending: false }).limit(1).single();

  const components = {
    payment_history_score: calcPaymentHistory(loanAccounts || []),
    amounts_owed_score: calcAmountsOwed(loanAccounts || [], savingsAccounts || []),
    credit_history_length_score: calcCreditHistoryLength(loanAccounts || [], savingsAccounts || []),
    credit_mix_score: calcCreditMix(loanAccounts || [], savingsAccounts || []),
    new_credit_score: calcNewCredit(loanAccounts || []),
    savings_behavior_score: calcSavingsBehavior(savingsAccounts || []),
    transaction_pattern_score: calcTransactionPattern(transactions || []),
    kyc_compliance_score: kycData ? 750 : 300,
    postiq_verification_score: postiqVerification ? 50 : 0,
  };

  let internalScore = Math.round(
    components.payment_history_score * 0.30 + components.amounts_owed_score * 0.25 +
    components.credit_history_length_score * 0.15 + components.credit_mix_score * 0.10 +
    components.new_credit_score * 0.08 + components.postiq_verification_score * 0.05 +
    components.savings_behavior_score * 0.04 + components.transaction_pattern_score * 0.02 +
    components.kyc_compliance_score * 0.01
  );

  let finalScore = internalScore;
  let externalScore = null;
  let externalBureauData = null;

  if (include_external && kycData) {
    try {
      const { data: externalData, error: externalError } = await supabase.functions.invoke('njangibox-credit-fetch', { body: { user_id, fetch_type: 'score' } });
      if (!externalError && externalData?.success) {
        externalScore = externalData.external_score;
        externalBureauData = externalData;
        if (externalScore && externalScore >= 300 && externalScore <= 850) {
          finalScore = Math.round(internalScore * 0.7 + externalScore * 0.3);
        }
      }
    } catch (e) { console.error('External credit data error:', e); }
  }

  const confidence = calcConfidence(components, !!externalScore);
  const scoreData = {
    user_id, score: Math.max(300, Math.min(850, finalScore)), score_version: 'v2.0',
    scoring_model: externalScore ? 'blended' : scoring_model,
    score_factors: { components, details: { total_loans: loanAccounts?.length || 0, total_savings: savingsAccounts?.length || 0, total_transactions: transactions?.length || 0, kyc_verified: !!kycData, external_data_used: !!externalScore, blending_ratio: externalScore ? '70/30' : '100% internal' }, external_bureau_data: externalBureauData },
    confidence_level: confidence, ...components, external_bureau_score: externalScore,
    calculated_at: new Date().toISOString(), expires_at: new Date(Date.now() + 90*24*60*60*1000).toISOString(),
    next_update_date: new Date(Date.now() + 30*24*60*60*1000).toISOString(), status: 'active',
  };

  await supabase.from('credit_scores').update({ status: 'expired' }).eq('user_id', user_id).eq('status', 'active');
  const { data: creditScore, error: scoreError } = await supabase.from('credit_scores').insert(scoreData).select().single();
  if (scoreError) throw scoreError;

  const scoreChange = oldScore ? creditScore.score - oldScore : null;
  await supabase.from('credit_score_history').insert({ user_id, credit_score_id: creditScore.id, score: creditScore.score, score_change: scoreChange, change_reason: trigger_event || 'periodic_update', significant_events: { trigger_event } });

  if (scoreChange && Math.abs(scoreChange) >= 20) {
    await supabase.from('credit_monitoring_alerts').insert({ user_id, alert_type: 'score_change', severity: Math.abs(scoreChange) >= 50 ? 'critical' : 'warning', title: `Credit score ${scoreChange > 0 ? 'increased' : 'decreased'}`, description: `Your credit score changed by ${Math.abs(scoreChange)} points to ${creditScore.score}`, alert_data: { old_score: oldScore, new_score: creditScore.score, change: scoreChange } });
  }

  return new Response(JSON.stringify({ success: true, score: creditScore.score, score_id: creditScore.id, score_change: scoreChange, score_breakdown: components }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── FETCH ───
async function handleFetch(_req: Request, body: any, supabaseUrl: string, serviceKey: string) {
  const supabase = createClient(supabaseUrl, serviceKey);
  const { user_id, force_refresh = false, include_report = false } = body;

  const { data: eventProfile } = await supabase.from('credit_profiles').select('*').eq('user_id', user_id).maybeSingle();
  const { data: latestSnapshot } = await supabase.from('credit_score_snapshots').select('*').eq('user_id', user_id).order('computed_at', { ascending: false }).limit(1).maybeSingle();
  const { data: recentEvents } = await supabase.from('credit_events').select('id, event_type, event_time, value_numeric, metadata, source').eq('user_id', user_id).order('event_time', { ascending: false }).limit(20);

  let useEventSourced = false;
  let scoreData: any = null;

  if (eventProfile?.current_score && eventProfile.last_computed_at) {
    const hoursSince = (Date.now() - new Date(eventProfile.last_computed_at).getTime()) / 3600000;
    useEventSourced = hoursSince < 24 || !force_refresh;
  }

  if (useEventSourced && eventProfile) {
    scoreData = { score: eventProfile.current_score, score_range: getScoreRange(eventProfile.current_score), score_band: eventProfile.score_band, calculated_at: eventProfile.last_computed_at, expires_at: null, score_factors: latestSnapshot?.factors_json || null, source: 'event_sourced' };
  } else if (force_refresh || !eventProfile) {
    const { count } = await supabase.from('credit_events').select('*', { count: 'exact', head: true }).eq('user_id', user_id);
    if (count && count > 0) {
      try {
        const scoreRes = await fetch(`${supabaseUrl}/functions/v1/credit-score`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` }, body: JSON.stringify({ action: 'engine', user_id }) });
        const engineResult = await scoreRes.json();
        if (engineResult?.score) scoreData = { score: engineResult.score, score_range: getScoreRange(engineResult.score), score_band: engineResult.band, calculated_at: new Date().toISOString(), expires_at: null, score_factors: engineResult.factors || null, source: 'event_sourced' };
      } catch (e) { console.error('Engine call failed:', e); }
    }
    if (!scoreData) {
      const { data: existingScore } = await supabase.from('credit_scores').select('*').eq('user_id', user_id).eq('status', 'active').gte('expires_at', new Date().toISOString()).order('calculated_at', { ascending: false }).limit(1).maybeSingle();
      if (existingScore && !force_refresh) {
        scoreData = { ...existingScore, score_range: getScoreRange(existingScore.score), source: 'legacy' };
      } else {
        try {
          await supabase.functions.invoke('credit-score', { body: { action: 'calculate', user_id, include_external: false } });
          const { data: newScore } = await supabase.from('credit_scores').select('*').eq('user_id', user_id).eq('status', 'active').order('calculated_at', { ascending: false }).limit(1).maybeSingle();
          scoreData = newScore ? { ...newScore, score_range: getScoreRange(newScore.score), source: 'legacy' } : null;
        } catch (e) { console.error('Legacy calc failed:', e); }
      }
    }
  }

  if (scoreData?.score) {
    await supabase.from('credit_inquiries').insert({ user_id, inquiry_type: 'soft', inquirer_type: 'self', inquirer_name: 'Self Check', purpose: 'score_check', user_consent_given: true, score_provided: scoreData.score }).catch(() => {});
  }

  let reportData = null;
  if (include_report && scoreData?.id) {
    const { data: report } = await supabase.from('credit_reports').select('*').eq('credit_score_id', scoreData.id).maybeSingle();
    reportData = report;
  }

  return new Response(JSON.stringify({ success: true, score: scoreData?.score || 0, score_range: scoreData?.score_range || 'Unknown', score_band: scoreData?.score_band || null, calculated_at: scoreData?.calculated_at, expires_at: scoreData?.expires_at, score_factors: scoreData?.score_factors, source: scoreData?.source || 'none', report: reportData, recent_events: recentEvents || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── ENGINE (event-sourced) ───
const SCORING_RULES: Record<string, { min: number; max: number }> = {
  LOAN_REPAYMENT_ON_TIME: { min: 5, max: 15 }, LOAN_REPAYMENT_LATE: { min: -40, max: -10 },
  LOAN_INSTALLMENT_MISSED: { min: -50, max: -50 }, LOAN_DEFAULTED: { min: -250, max: -150 },
  LOAN_CLOSED: { min: 15, max: 15 }, SAVINGS_DEPOSIT: { min: 1, max: 3 },
  SAVINGS_WITHDRAWAL: { min: 0, max: 0 }, SAVINGS_BALANCE_STABLE: { min: 2, max: 2 },
  PIGGYBANK_PAYMENT_ON_TIME: { min: 3, max: 5 }, PIGGYBANK_PAYMENT_LATE: { min: -15, max: -5 },
  PIGGYBANK_PAYMENT_MISSED: { min: -20, max: -20 }, PIGGYBANK_PLAN_CANCELLED: { min: -5, max: -5 },
  NJANGI_CONTRIBUTION_ON_TIME: { min: 3, max: 5 }, NJANGI_CONTRIBUTION_LATE: { min: -15, max: -5 },
  NJANGI_CONTRIBUTION_MISSED: { min: -25, max: -25 }, NJANGI_PAYOUT_RECEIVED: { min: 8, max: 8 },
  RENT_PAYMENT_ON_TIME: { min: 5, max: 10 }, RENT_PAYMENT_LATE: { min: -25, max: -10 },
  RENT_PAYMENT_MISSED: { min: -30, max: -30 }, POSTIQ_VERIFIED: { min: 50, max: 50 },
  HARD_INQUIRY: { min: -5, max: -5 },
};

async function handleEngine(body: any, supabaseUrl: string, serviceKey: string) {
  const supabase = createClient(supabaseUrl, serviceKey);
  const { user_id } = body;
  if (!user_id) throw new Error('user_id required');

  const { data: existingProfile } = await supabase.from('credit_profiles').select('current_score').eq('user_id', user_id).maybeSingle();
  const previousScore = existingProfile?.current_score ?? 500;

  const { data: events, error: eventsErr } = await supabase.from('credit_events').select('*').eq('user_id', user_id).order('event_time', { ascending: true });
  if (eventsErr) throw eventsErr;

  let score = 500;
  const factorMap: Record<string, { count: number; total: number }> = {};
  const monthlyDepositCounts: Record<string, number> = {};

  for (const event of (events || [])) {
    const rule = SCORING_RULES[event.event_type];
    if (!rule) continue;
    let points = 0;
    switch (event.event_type) {
      case 'LOAN_REPAYMENT_ON_TIME': points = rule.max; break;
      case 'LOAN_REPAYMENT_LATE': { const d = Math.abs(event.value_numeric || 1); points = Math.max(rule.min, Math.min(rule.max, -10 - Math.floor(d / 3) * 3)); break; }
      case 'LOAN_INSTALLMENT_MISSED': case 'LOAN_DEFAULTED': case 'PIGGYBANK_PAYMENT_MISSED': case 'PIGGYBANK_PLAN_CANCELLED': case 'NJANGI_CONTRIBUTION_MISSED': case 'RENT_PAYMENT_MISSED': case 'HARD_INQUIRY': points = rule.min; break;
      case 'LOAN_CLOSED': case 'PIGGYBANK_PAYMENT_ON_TIME': case 'NJANGI_CONTRIBUTION_ON_TIME': case 'NJANGI_PAYOUT_RECEIVED': case 'RENT_PAYMENT_ON_TIME': case 'POSTIQ_VERIFIED': points = rule.max; break;
      case 'SAVINGS_DEPOSIT': {
        const mk = event.event_time.substring(0, 7);
        monthlyDepositCounts[mk] = (monthlyDepositCounts[mk] || 0) + 1;
        if (monthlyDepositCounts[mk] <= 10) { const amt = Number(event.value_numeric || 0); points = amt >= 50000 ? 3 : amt >= 10000 ? 2 : 1; }
        break;
      }
      case 'SAVINGS_BALANCE_STABLE': points = 2; break;
      case 'PIGGYBANK_PAYMENT_LATE': case 'NJANGI_CONTRIBUTION_LATE': { const dl = Math.abs(event.value_numeric || 1); points = Math.max(rule.min, Math.min(rule.max, -5 - Math.floor(dl / 7) * 2)); break; }
      case 'RENT_PAYMENT_LATE': { const rl = Math.abs(event.value_numeric || 1); points = Math.max(rule.min, Math.min(rule.max, -10 - Math.floor(rl / 7) * 3)); break; }
      default: points = 0;
    }
    score += points;
    if (points !== 0) {
      if (!factorMap[event.event_type]) factorMap[event.event_type] = { count: 0, total: 0 };
      factorMap[event.event_type].count++; factorMap[event.event_type].total += points;
    }
  }

  score = Math.max(300, Math.min(850, score));
  const band = score >= 750 ? 'A' : score >= 650 ? 'B' : score >= 550 ? 'C' : score >= 400 ? 'D' : 'F';
  const factors = Object.entries(factorMap).map(([type, { count, total }]) => ({ event_type: type, count, total_impact: total, description: `${count} ${type.replace(/_/g, ' ').toLowerCase()} events: ${total > 0 ? '+' : ''}${total} points` })).sort((a, b) => Math.abs(b.total_impact) - Math.abs(a.total_impact)).slice(0, 5);

  await supabase.from('credit_profiles').upsert({ user_id, current_score: score, score_band: band, last_computed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  await supabase.from('credit_score_snapshots').insert({ user_id, score, score_band: band, factors_json: factors, computed_at: new Date().toISOString() });

  return new Response(JSON.stringify({ score, band, delta: score - previousScore, previous_score: previousScore, factors, events_processed: (events || []).length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── SIMULATE ───
async function handleSimulate(req: Request, body: any, supabaseUrl: string, serviceKey: string) {
  const supabase = createClient(supabaseUrl, serviceKey);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('No authorization header');
  const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (userError || !user) throw new Error('Unauthorized');

  const { simulation_type, amount } = body;
  const { data: creditScore } = await supabase.from('credit_scores').select('*').eq('user_id', user.id).order('calculated_at', { ascending: false }).limit(1).single();
  if (!creditScore) throw new Error('No credit score found');

  const currentScore = creditScore.score;
  let scoreChange = 0;
  switch (simulation_type) {
    case 'loan_payoff': scoreChange = Math.round(Math.min(amount / 10000, 50)); break;
    case 'savings_deposit': scoreChange = Math.round(Math.min(amount / 50000, 30)); break;
    case 'new_account': scoreChange = -5; break;
    case 'payment_skip': scoreChange = -45; break;
    default: throw new Error('Invalid simulation type');
  }
  const predictedScore = Math.max(300, Math.min(850, currentScore + scoreChange));

  const { data: simulation, error: simError } = await supabase.from('credit_score_simulations').insert({ user_id: user.id, simulation_type, input_parameters: { amount }, current_score: currentScore, predicted_score: predictedScore, score_change: scoreChange }).select().single();
  if (simError) throw simError;

  return new Response(JSON.stringify({ success: true, current_score: currentScore, predicted_score: predictedScore, score_change: scoreChange, simulation }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── TIPS ───
async function handleTips(req: Request, body: any, supabaseUrl: string, serviceKey: string) {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

  const supabase = createClient(supabaseUrl, serviceKey);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('No authorization header');
  const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (userError || !user) throw new Error('Unauthorized');

  const { force_refresh = false } = body;
  if (!force_refresh) {
    const { data: cachedTips } = await supabase.from('credit_score_tips').select('*').eq('user_id', user.id).gte('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(5);
    if (cachedTips && cachedTips.length > 0) return new Response(JSON.stringify({ success: true, tips: cachedTips, cached: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: creditScore } = await supabase.from('credit_scores').select('*').eq('user_id', user.id).order('calculated_at', { ascending: false }).limit(1).single();
  if (!creditScore) throw new Error('No credit score found. Please calculate your score first.');

  const components = (creditScore.score_factors?.components) || {};
  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [
      { role: 'system', content: 'You are a financial advisor for Kang Open Banking in Cameroon. Currency is XAF.' },
      { role: 'user', content: `Generate 3-5 credit improvement tips JSON array for score ${creditScore.score}/850. Components: ${JSON.stringify(components)}. Format: [{"tip":"...","estimated_impact":15,"timeline":"quick_win","priority":"high","category":"..."}]` }
    ], temperature: 0.7, max_tokens: 2000 }),
  });
  if (!aiResponse.ok) throw new Error(`AI API failed: ${aiResponse.status}`);

  const aiData = await aiResponse.json();
  const aiContent = aiData.choices[0].message.content;
  const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const tipsArray = JSON.parse(jsonMatch ? jsonMatch[1] : aiContent);

  const expiresAt = new Date(Date.now() + 7*24*60*60*1000).toISOString();
  await supabase.from('credit_score_tips').delete().eq('user_id', user.id);
  const { data: insertedTips, error: insertError } = await supabase.from('credit_score_tips').insert(tipsArray.map((tip: any) => ({ user_id: user.id, credit_score_id: creditScore.id, tip_category: tip.timeline, tip_content: tip.tip, estimated_impact: tip.estimated_impact, priority: tip.priority, expires_at: expiresAt }))).select();
  if (insertError) throw insertError;

  return new Response(JSON.stringify({ success: true, tips: insertedTips, cached: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── Helper functions ───
function getScoreRange(score: number): string {
  if (score >= 800) return 'Excellent';
  if (score >= 740) return 'Very Good';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Poor';
}

function calcPaymentHistory(loans: any[]): number {
  if (loans.length === 0) return 300;
  let total = 0, onTime = 0;
  loans.forEach(l => { (l.loan_payments || []).forEach((p: any) => { total++; if (p.payment_status === 'completed') onTime++; }); });
  return total === 0 ? 300 : Math.round(300 + (onTime / total) * 550);
}

function calcAmountsOwed(loans: any[], savings: any[]): number {
  const totalBorrowed = loans.reduce((s, l) => s + (parseFloat(l.principal_amount) || 0), 0);
  const totalOwed = loans.reduce((s, l) => s + (parseFloat(l.outstanding_balance) || 0), 0);
  const totalSavings = savings.reduce((s, sv) => s + (parseFloat(sv.balance) || 0), 0);
  if (totalBorrowed === 0) return 600;
  return Math.round(Math.max(300, Math.min(850, 850 - (totalOwed / totalBorrowed) * 300 + Math.min(totalSavings / (totalOwed || 1), 1) * 100)));
}

function calcCreditHistoryLength(loans: any[], savings: any[]): number {
  const all = [...loans, ...savings];
  if (all.length === 0) return 300;
  const now = Date.now();
  const ages = all.map(a => (now - new Date(a.created_at).getTime()) / 31536000000);
  return Math.round(Math.min(850, 300 + Math.min(ages.reduce((s, a) => s + a, 0) / ages.length, 10) * 40 + Math.min(Math.max(...ages), 15) * 15));
}

function calcCreditMix(loans: any[], savings: any[]): number {
  let score = 300;
  if (loans.length > 0) score += 200;
  if (savings.length > 0) score += 150;
  score += Math.min(new Set(loans.map(l => l.loan_product_id)).size * 50, 200);
  return Math.min(850, score);
}

function calcNewCredit(loans: any[]): number {
  const now = Date.now();
  const recent = loans.filter(l => (now - new Date(l.created_at).getTime()) / 86400000 <= 180);
  return Math.max(300, 850 - Math.min(recent.length, 10) * 50);
}

function calcSavingsBehavior(savings: any[]): number {
  if (savings.length === 0) return 300;
  const avg = savings.reduce((s, sv) => s + (parseFloat(sv.balance) || 0), 0) / savings.length;
  return Math.round(Math.min(850, 300 + Math.min(avg / 1000, 550)));
}

function calcTransactionPattern(transactions: any[]): number {
  if (transactions.length === 0) return 500;
  const avg = transactions.reduce((s, t) => s + Math.abs(parseFloat(t.amount) || 0), 0) / transactions.length;
  return Math.round(Math.min(850, 500 + Math.min(transactions.length * 2, 200) + Math.min(avg / 100, 150)));
}

function calcConfidence(components: any, hasExternal: boolean): number {
  const nonZero = Object.values(components).filter((v: any) => v > 300).length;
  return Math.round((nonZero / 8 * 0.8 + (hasExternal ? 0.2 : 0)) * 100) / 100;
}
