/**
 * Remittance Engine — Public API for remittance discovery, quotes, and tracking.
 * Consolidated router pattern (like loan-ops, banking-ops).
 *
 * Actions:
 *   list_partners, list_corridors, create_quote, get_quote,
 *   list_inbound, get_inbound, validate_destination,
 *   admin_list, admin_detail, admin_manage_partner, admin_manage_corridor
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get('action');
    let body: Record<string, any> = {};

    if (req.method === 'POST' || req.method === 'PATCH') {
      body = await req.json().catch(() => ({}));
      action = action || body.action;
    }

    if (!action) {
      return json({ error: 'missing_action' }, 400);
    }

    // ─── Auth: extract user for user-scoped actions ───
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    // ─── Admin check helper ───
    const isAdmin = user ? (await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })).data === true : false;

    switch (action) {
      // ─── PUBLIC: List Partners ───
      case 'list_partners': {
        const { data, error } = await supabase
          .from('remittance_partners')
          .select('id, name, display_name, supported_corridors')
          .eq('status', 'active');
        if (error) throw error;
        return json({ partners: data });
      }

      // ─── PUBLIC: List Corridors ───
      case 'list_corridors': {
        const toCountry = url.searchParams.get('to_country') || body.to_country || 'CM';
        const toCurrency = url.searchParams.get('to_currency') || body.to_currency;

        let query = supabase
          .from('remittance_corridors')
          .select('*, remittance_partners(id, name, display_name)')
          .eq('is_active', true)
          .eq('to_country', toCountry);

        if (toCurrency) query = query.eq('to_currency', toCurrency);
        const { data, error } = await query;
        if (error) throw error;
        return json({ corridors: data });
      }

      // ─── PUBLIC: Create Quote ───
      case 'create_quote': {
        const { partner_id, corridor_id, amount_in, currency_in, currency_out } = body;
        if (!partner_id || !amount_in || !currency_in) {
          return json({ error: 'missing_required_fields' }, 400);
        }

        // Look up corridor for FX rate
        let fxRate = 1;
        let feePct = 0;
        if (corridor_id) {
          const { data: corridor } = await supabase
            .from('remittance_corridors')
            .select('*')
            .eq('id', corridor_id)
            .single();
          if (corridor?.fees_model) {
            fxRate = (corridor.fees_model as any).fx_rate || 1;
            feePct = (corridor.fees_model as any).fee_percentage || 0;
          }
        }

        const feeTotal = Math.round(amount_in * feePct / 100);
        const amountOut = Math.round((amount_in - feeTotal) * fxRate);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

        const { data: quote, error } = await supabase
          .from('remittance_quotes')
          .insert({
            partner_id, corridor_id,
            amount_in, currency_in,
            amount_out: amountOut,
            currency_out: currency_out || 'XAF',
            fee_total: feeTotal,
            fx_rate: fxRate,
            expires_at: expiresAt,
            quote_raw: { source: 'kob_engine', computed: true },
            user_id: user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        return json({ quote });
      }

      // ─── PUBLIC: Get Quote ───
      case 'get_quote': {
        const quoteId = url.searchParams.get('id') || body.id;
        const { data, error } = await supabase
          .from('remittance_quotes')
          .select('*')
          .eq('id', quoteId)
          .single();
        if (error) throw error;
        return json({ quote: data });
      }

      // ─── USER: List Inbound Remittances ───
      case 'list_inbound': {
        if (!user) return json({ error: 'unauthorized' }, 401);
        const status = url.searchParams.get('status') || body.status;
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

        let query = supabase
          .from('remittances')
          .select('*, remittance_partners(name, display_name)', { count: 'exact' })
          .eq('receiver_user_id', user.id)
          .eq('direction', 'inbound')
          .order('created_at', { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (status) query = query.eq('status', status);
        const { data, error, count } = await query;
        if (error) throw error;
        return json({ remittances: data, total: count, page, limit });
      }

      // ─── USER: Get Inbound Detail ───
      case 'get_inbound': {
        if (!user) return json({ error: 'unauthorized' }, 401);
        const id = url.searchParams.get('id') || body.id;

        const { data: rem } = await supabase
          .from('remittances')
          .select('*, remittance_partners(name, display_name)')
          .eq('id', id)
          .eq('receiver_user_id', user.id)
          .single();

        const { data: events } = await supabase
          .from('remittance_events')
          .select('*')
          .eq('remittance_id', id)
          .order('created_at', { ascending: true });

        return json({ remittance: rem, events });
      }

      // ─── PUBLIC: Validate Destination ───
      case 'validate_destination': {
        const { destination_type, destination_ref } = body;
        if (!destination_type || !destination_ref) return json({ error: 'missing_fields' }, 400);

        let valid = false;
        let details: Record<string, unknown> = {};

        if (destination_type === 'kob_wallet') {
          const { data } = await supabase
            .from('accounts')
            .select('id, account_holder_name, currency')
            .eq('id', destination_ref)
            .eq('is_active', true)
            .maybeSingle();
          valid = !!data;
          details = data ? { holder: data.account_holder_name, currency: data.currency } : {};
        } else if (destination_type === 'bank_account') {
          const { data } = await supabase
            .from('accounts')
            .select('id, account_holder_name')
            .eq('identification_value', destination_ref)
            .eq('is_active', true)
            .maybeSingle();
          valid = !!data;
          details = data ? { holder: data.account_holder_name } : {};
        } else if (destination_type === 'merchant_invoice') {
          const { data } = await supabase
            .from('customer_invoices')
            .select('id, total_amount, currency, status')
            .eq('id', destination_ref)
            .neq('status', 'paid')
            .maybeSingle();
          valid = !!data;
          details = data || {};
        }

        return json({ valid, destination_type, destination_ref, details });
      }

      // ─── ADMIN: List All Remittances ───
      case 'admin_list': {
        if (!isAdmin) return json({ error: 'forbidden' }, 403);

        const status = url.searchParams.get('status') || body.status;
        const partnerId = url.searchParams.get('partner_id') || body.partner_id;
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

        let query = supabase
          .from('remittances')
          .select('*, remittance_partners(name, display_name)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (status) query = query.eq('status', status);
        if (partnerId) query = query.eq('partner_id', partnerId);

        const { data, error, count } = await query;
        if (error) throw error;

        // Stats
        const { data: stats } = await supabase
          .from('remittances')
          .select('status, amount_out')
          .eq('direction', 'inbound');

        const summary = {
          total: stats?.length || 0,
          total_volume: stats?.reduce((s: number, r: any) => s + (r.amount_out || 0), 0) || 0,
          by_status: {} as Record<string, number>,
        };
        stats?.forEach((r: any) => {
          summary.by_status[r.status] = (summary.by_status[r.status] || 0) + 1;
        });

        return json({ remittances: data, total: count, page, limit, summary });
      }

      // ─── ADMIN: Remittance Detail ───
      case 'admin_detail': {
        if (!isAdmin) return json({ error: 'forbidden' }, 403);
        const id = url.searchParams.get('id') || body.id;

        const [remRes, eventsRes, ledgerRes] = await Promise.all([
          supabase.from('remittances').select('*, remittance_partners(name, display_name)').eq('id', id).single(),
          supabase.from('remittance_events').select('*').eq('remittance_id', id).order('created_at'),
          supabase.from('remittance_ledger_links').select('*, journal_entries(*)').eq('remittance_id', id),
        ]);

        return json({
          remittance: remRes.data,
          events: eventsRes.data,
          ledger_links: ledgerRes.data,
        });
      }

      // ─── ADMIN: Manage Partner ───
      case 'admin_manage_partner': {
        if (!isAdmin) return json({ error: 'forbidden' }, 403);
        const { operation, partner_data } = body;

        if (operation === 'create') {
          const { data, error } = await supabase.from('remittance_partners').insert(partner_data).select().single();
          if (error) throw error;
          return json({ partner: data });
        } else if (operation === 'update') {
          const { data, error } = await supabase.from('remittance_partners').update(partner_data).eq('id', body.partner_id).select().single();
          if (error) throw error;
          return json({ partner: data });
        }
        return json({ error: 'invalid_operation' }, 400);
      }

      // ─── ADMIN: Manage Corridor ───
      case 'admin_manage_corridor': {
        if (!isAdmin) return json({ error: 'forbidden' }, 403);
        const { operation: op, corridor_data } = body;

        if (op === 'create') {
          const { data, error } = await supabase.from('remittance_corridors').insert(corridor_data).select().single();
          if (error) throw error;
          return json({ corridor: data });
        } else if (op === 'update') {
          const { data, error } = await supabase.from('remittance_corridors').update(corridor_data).eq('id', body.corridor_id).select().single();
          if (error) throw error;
          return json({ corridor: data });
        }
        return json({ error: 'invalid_operation' }, 400);
      }

      default:
        return json({ error: 'unknown_action', action }, 400);
    }
  } catch (err) {
    return safeErrorResponse(err, corsHeaders, 'remittance-engine');
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
