import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { evaluateBasicCheck, persistBasicCheckFlag } from "../_shared/credit-basic-check.ts";

/**
 * credit-recompute
 * User-triggered recomputation of credit score using the deterministic event-sourced engine.
 * Rate-limited to once per minute per user.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // ── Basic check gate: refuse to compute until the user passes ──
    const basicCheck = await evaluateBasicCheck(admin, user.id);
    await persistBasicCheckFlag(admin, user.id, basicCheck.passed);
    if (!basicCheck.passed) {
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

    // Rate limit: 1 recompute per 60s per user
    const { data: profile } = await admin
      .from('credit_profiles')
      .select('last_computed_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.last_computed_at) {
      const elapsed = (Date.now() - new Date(profile.last_computed_at).getTime()) / 1000;
      if (elapsed < 60) {
        return new Response(
          JSON.stringify({
            error: 'rate_limited',
            message: `Please wait ${Math.ceil(60 - elapsed)}s before recomputing again.`,
            retry_after_seconds: Math.ceil(60 - elapsed),
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Invoke deterministic engine
    const engineRes = await fetch(`${supabaseUrl}/functions/v1/credit-score-engine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ user_id: user.id }),
    });

    if (!engineRes.ok) {
      const errText = await engineRes.text();
      console.error('credit-score-engine failed:', errText);
      return new Response(
        JSON.stringify({ error: 'engine_failed', details: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await engineRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        score: result.score,
        band: result.band,
        delta: result.delta,
        previous_score: result.previous_score,
        factors: result.factors,
        events_processed: result.events_processed,
        recomputed_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] credit-recompute error:`, err);
    return new Response(
      JSON.stringify({ error: 'internal_error', error_id: errorId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
