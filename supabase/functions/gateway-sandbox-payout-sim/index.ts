import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function problem(status: number, title: string, detail: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ type: 'about:blank', title, status, detail, ...extra }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });
}

/**
 * Payout Sandbox Simulation Engine
 * 
 * POST ?action=simulate       — Simulate a payout with a specific scenario
 * GET  ?action=scenarios       — List available simulation scenarios
 * POST ?action=trigger_webhook — Manually trigger a webhook callback for a simulated payout
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return problem(401, 'Unauthorized', 'Missing Authorization header');

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return problem(401, 'Unauthorized', 'Invalid or expired token');

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'simulate';

    if (req.method === 'GET' && action === 'scenarios') {
      const { data: scenarios } = await supabase.from('sandbox_payout_scenarios')
        .select('*').eq('is_active', true).order('scenario_name');
      return new Response(JSON.stringify({ data: scenarios || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST' && action === 'simulate') {
      const body = await req.json();
      const { merchant_id, scenario, amount, currency = 'XAF', channel = 'bank_transfer', beneficiary } = body;

      if (!merchant_id || !scenario) {
        return problem(400, 'Bad Request', 'merchant_id and scenario are required');
      }

      // Verify merchant ownership
      const { data: merchant } = await supabase.from('gateway_merchants')
        .select('id, environment').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) return problem(403, 'Forbidden', 'Not authorized or merchant not found');

      // Only allow in sandbox
      if (merchant.environment !== 'sandbox') {
        return problem(400, 'Bad Request', 'Payout simulation is only available in sandbox environment');
      }

      // Load scenario config
      const { data: scenarioConfig } = await supabase.from('sandbox_payout_scenarios')
        .select('*').eq('scenario_name', scenario).eq('is_active', true).single();
      if (!scenarioConfig) return problem(404, 'Not Found', `Scenario "${scenario}" not found`);

      // Generate simulated payout
      const payoutRef = `sim_payout_${crypto.randomUUID().slice(0, 12)}`;
      const simResult = {
        payout_id: crypto.randomUUID(),
        tx_ref: payoutRef,
        merchant_id,
        amount: amount || 10000,
        currency,
        channel,
        beneficiary: beneficiary || { account_number: '0000000000', bank_code: 'SIM', name: 'Test Beneficiary' },
        scenario: scenarioConfig.scenario_name,
        simulated_status: scenarioConfig.simulated_status,
        processing_delay_seconds: scenarioConfig.delay_seconds,
        failure_reason: scenarioConfig.failure_reason,
        timeline: [] as Array<{ event: string; timestamp: string; detail?: string }>,
      };

      // Build timeline
      const now = new Date();
      simResult.timeline.push({ event: 'payout.created', timestamp: now.toISOString() });

      if (scenarioConfig.delay_seconds > 0) {
        const processingAt = new Date(now.getTime() + scenarioConfig.delay_seconds * 1000);
        simResult.timeline.push({
          event: 'payout.processing',
          timestamp: new Date(now.getTime() + 1000).toISOString(),
          detail: `Processing for ~${scenarioConfig.delay_seconds}s`,
        });
        simResult.timeline.push({
          event: `payout.${scenarioConfig.simulated_status}`,
          timestamp: processingAt.toISOString(),
          detail: scenarioConfig.failure_reason || undefined,
        });
      } else {
        simResult.timeline.push({
          event: `payout.${scenarioConfig.simulated_status}`,
          timestamp: new Date(now.getTime() + 500).toISOString(),
          detail: scenarioConfig.failure_reason || undefined,
        });
      }

      // If scenario triggers reversal after success
      if (scenarioConfig.simulated_status === 'reversed') {
        const reversalAt = new Date(now.getTime() + (scenarioConfig.delay_seconds + 300) * 1000);
        simResult.timeline.push({
          event: 'payout.successful',
          timestamp: new Date(now.getTime() + 2000).toISOString(),
        });
        simResult.timeline.push({
          event: 'payout.reversed',
          timestamp: reversalAt.toISOString(),
          detail: scenarioConfig.failure_reason,
        });
      }

      // If webhook trigger enabled, dispatch to merchant webhook endpoints
      if (scenarioConfig.trigger_webhook) {
        const webhookPayload = {
          event: `payout.${scenarioConfig.simulated_status}`,
          data: {
            id: simResult.payout_id,
            tx_ref: payoutRef,
            amount: simResult.amount,
            currency,
            channel,
            status: scenarioConfig.simulated_status,
            failure_reason: scenarioConfig.failure_reason,
            is_simulation: true,
          },
        };

        // Fan-out via webhook delivery v2
        try {
          await supabase.functions.invoke('gateway-webhook-deliver-v2', {
            body: {
              merchant_id,
              event_type: `payout.${scenarioConfig.simulated_status}`,
              payload: webhookPayload.data,
            },
          });
          simResult.timeline.push({
            event: 'webhook.dispatched',
            timestamp: new Date().toISOString(),
            detail: `Event: payout.${scenarioConfig.simulated_status}`,
          });
        } catch {
          // Non-critical: webhook dispatch failure shouldn't fail simulation
        }
      }

      return new Response(JSON.stringify({ simulation: simResult }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST' && action === 'trigger_webhook') {
      const { merchant_id, event_type, payload } = await req.json();
      if (!merchant_id || !event_type) {
        return problem(400, 'Bad Request', 'merchant_id and event_type are required');
      }

      const { data: merchant } = await supabase.from('gateway_merchants')
        .select('id').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) return problem(403, 'Forbidden', 'Not authorized');

      const result = await supabase.functions.invoke('gateway-webhook-deliver-v2', {
        body: { merchant_id, event_type, payload: payload || { test: true, is_simulation: true } },
      });

      return new Response(JSON.stringify({ dispatched: true, result: result.data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return problem(405, 'Method Not Allowed', `${req.method} with action=${action} is not supported`);
  } catch (err) {
    return problem(500, 'Internal Server Error', err.message);
  }
});
