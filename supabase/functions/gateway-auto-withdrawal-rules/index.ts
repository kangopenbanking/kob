import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * CRUD for auto-withdrawal rules (payout_schedules).
 * 
 * POST   — create a new rule
 * GET    — list user's rules
 * PUT    — update a rule
 * DELETE — disable a rule
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return res({ error: 'unauthorized' }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return res({ error: 'unauthorized' }, 401);

    const url = new URL(req.url);
    const body = req.method !== 'GET' ? await req.json() : {};

    // ─── GET: List rules ───
    if (req.method === 'GET') {
      const ownerType = url.searchParams.get('owner_type') || 'consumer';
      const ownerId = url.searchParams.get('owner_id') || user.id;

      const { data, error } = await supabase
        .from('payout_schedules')
        .select('*')
        .eq('owner_type', ownerType)
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res({ data });
    }

    // ─── POST: Create rule ───
    if (req.method === 'POST') {
      const {
        owner_type = 'consumer',
        owner_id,
        destination_id,
        destination_type,
        schedule_type,
        schedule_config = {},
        amount_mode = 'sweep_all',
        amount_value = 0,
        min_balance_to_keep = 0,
        currency = 'XAF',
      } = body;

      const effectiveOwnerId = owner_id || user.id;

      // Validate destination exists
      if (owner_type === 'consumer') {
        const { data: linked } = await supabase
          .from('customer_linked_accounts')
          .select('id')
          .eq('id', destination_id)
          .eq('user_id', effectiveOwnerId)
          .eq('is_active', true)
          .maybeSingle();
        if (!linked) return res({ error: 'destination_not_found', message: 'Linked account not found or inactive' }, 404);
      } else {
        const { data: settlement } = await supabase
          .from('gateway_merchant_settlement_accounts')
          .select('id')
          .eq('id', destination_id)
          .eq('merchant_id', effectiveOwnerId)
          .eq('is_active', true)
          .maybeSingle();
        if (!settlement) return res({ error: 'destination_not_found', message: 'Settlement account not found' }, 404);
      }

      // Limit to 3 active rules per owner
      const { count } = await supabase
        .from('payout_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', effectiveOwnerId)
        .eq('is_enabled', true);
      
      if ((count || 0) >= 3) {
        return res({ error: 'limit_reached', message: 'Maximum 3 active auto-withdrawal rules allowed' }, 400);
      }

      const nextRunAt = computeNextRun(schedule_type, schedule_config);

      const { data, error } = await supabase.from('payout_schedules').insert({
        owner_type,
        owner_id: effectiveOwnerId,
        destination_id,
        destination_type: destination_type || owner_type,
        schedule_type,
        schedule_config,
        amount_mode,
        amount_value,
        min_balance_to_keep,
        currency,
        next_run_at: nextRunAt,
      }).select().single();

      if (error) throw error;

      // Audit
      await supabase.from('audit_logs').insert({
        action_type: 'auto_withdrawal_rule_created',
        entity_type: 'payout_schedule',
        entity_id: data.id,
        performed_by: user.id,
        details: { schedule_type, amount_mode, amount_value },
      }).catch(() => {});

      return res({ data }, 201);
    }

    // ─── PUT: Update rule ───
    if (req.method === 'PUT') {
      const { id, ...updates } = body;
      if (!id) return res({ error: 'id required' }, 400);

      // Verify ownership
      const { data: existing } = await supabase
        .from('payout_schedules')
        .select('owner_id')
        .eq('id', id)
        .single();
      
      if (!existing) return res({ error: 'not_found' }, 404);
      
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (existing.owner_id !== user.id && !isAdmin) return res({ error: 'forbidden' }, 403);

      // Recompute next_run_at if schedule changed
      if (updates.schedule_type || updates.schedule_config) {
        updates.next_run_at = computeNextRun(
          updates.schedule_type || 'daily',
          updates.schedule_config || {}
        );
      }

      // Reset failures if re-enabling
      if (updates.is_enabled === true) {
        updates.consecutive_failures = 0;
      }

      const { data, error } = await supabase
        .from('payout_schedules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res({ data });
    }

    // ─── DELETE: Disable rule ───
    if (req.method === 'DELETE') {
      const id = body.id || url.searchParams.get('id');
      if (!id) return res({ error: 'id required' }, 400);

      const { error } = await supabase
        .from('payout_schedules')
        .update({ is_enabled: false })
        .eq('id', id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        action_type: 'auto_withdrawal_rule_disabled',
        entity_type: 'payout_schedule',
        entity_id: id,
        performed_by: user.id,
        details: {},
      }).catch(() => {});

      return res({ success: true });
    }

    return res({ error: 'method_not_allowed' }, 405);
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] auto-withdrawal-rules error:`, err);
    return res({ error: 'internal_error', error_id: errorId }, 500);
  }
});

function res(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function computeNextRun(scheduleType: string, config: any): string {
  const now = new Date();
  const hour = config.hour ?? 18;
  const minute = config.minute ?? 0;

  const next = new Date(now);
  next.setUTCHours(hour, minute, 0, 0);

  switch (scheduleType) {
    case 'daily':
      if (next <= now) next.setDate(next.getDate() + 1);
      break;
    case 'weekly': {
      const dayOfWeek = config.day_of_week ?? 5; // Friday
      const diff = (dayOfWeek - next.getDay() + 7) % 7 || 7;
      next.setDate(next.getDate() + diff);
      if (next <= now) next.setDate(next.getDate() + 7);
      break;
    }
    case 'monthly': {
      const dayOfMonth = config.day_of_month ?? 1;
      next.setDate(dayOfMonth);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      break;
    }
    case 'threshold':
      // For threshold rules, next_run_at is checked every 5 min by cron
      next.setTime(now.getTime() + 5 * 60 * 1000);
      break;
  }

  return next.toISOString();
}
