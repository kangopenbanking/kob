import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { sendManagedEmail, getUserName } from '../_shared/send-managed-email.ts';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const rfc7807 = (type: string, title: string, status: number, detail: string) =>
  new Response(JSON.stringify({ type: `https://api.kangopenbanking.com/errors/${type}`, title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });

// Valid status transitions
const TRANSITIONS: Record<string, { allowed: string[]; adminOnly: boolean }> = {
  submit:   { allowed: ['DRAFT'], adminOnly: false },
  activate: { allowed: ['VERIFIED'], adminOnly: true },
  suspend:  { allowed: ['ACTIVE'], adminOnly: true },
  unsuspend:{ allowed: ['SUSPENDED'], adminOnly: true },
  close:    { allowed: ['ACTIVE', 'SUSPENDED'], adminOnly: true },
  reject:   { allowed: ['SUBMITTED', 'UNDER_REVIEW'], adminOnly: true },
};

const TARGET_STATUS: Record<string, string> = {
  submit: 'SUBMITTED',
  activate: 'ACTIVE',
  suspend: 'SUSPENDED',
  unsuspend: 'ACTIVE',
  close: 'CLOSED',
  reject: 'REJECTED',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return rfc7807('unauthorized', 'Unauthorized', 401, 'Missing Authorization header');

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return rfc7807('unauthorized', 'Unauthorized', 401, 'Invalid or expired token');

    const url = new URL(req.url);
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin');

    // Route: POST with action in body (multi-method router)
    if (req.method === 'POST') {
      const body = await req.json();
      const { action, merchant_id } = body;

      // ─── CREATE ───
      if (action === 'create') {
        const { business_name, business_email, business_type, country, webhook_url, fee_bearer, metadata } = body;
        if (!business_name) return rfc7807('validation_error', 'Validation Error', 400, 'business_name is required');

        const { data: merchant, error } = await supabase.from('gateway_merchants').insert({
          user_id: user.id,
          business_name,
          business_email: business_email || user.email,
          business_type: business_type || 'individual',
          country: country || 'CM',
          webhook_url,
          fee_bearer: fee_bearer || 'merchant',
          status: 'DRAFT',
          kyb_status: 'not_submitted',
          metadata: metadata || {},
        }).select().single();

        if (error) return rfc7807('create_failed', 'Create Failed', 500, error.message);

        await supabase.from('audit_logs').insert({
          action_type: 'merchant_created', entity_type: 'gateway_merchant',
          entity_id: merchant.id, performed_by: user.id,
          details: { business_name, status: 'DRAFT' },
        });

        return json(merchant, 201);
      }

      // ─── GET ONE ───
      if (action === 'get') {
        if (!merchant_id) return rfc7807('validation_error', 'Validation Error', 400, 'merchant_id required');

        const { data: merchant } = await supabase
          .from('gateway_merchants').select('*').eq('id', merchant_id).single();
        if (!merchant) return rfc7807('not_found', 'Not Found', 404, 'Merchant not found');
        if (merchant.user_id !== user.id && !isAdmin) return rfc7807('forbidden', 'Forbidden', 403, 'Access denied');

        return json(merchant);
      }

      // ─── LIST ───
      if (action === 'list') {
        const { status: filterStatus, page = 1, limit = 20 } = body;
        const safeLimit = Math.min(limit, 100);
        const offset = (page - 1) * safeLimit;

        let query = supabase.from('gateway_merchants').select('*', { count: 'exact' });
        if (!isAdmin) query = query.eq('user_id', user.id);
        if (filterStatus) query = query.eq('status', filterStatus);

        const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + safeLimit - 1);
        if (error) return rfc7807('query_error', 'Query Error', 500, error.message);

        return json({ merchants: data, total: count, page, limit: safeLimit });
      }

      // ─── UPDATE ───
      if (action === 'update') {
        if (!merchant_id) return rfc7807('validation_error', 'Validation Error', 400, 'merchant_id required');

        const { data: merchant } = await supabase
          .from('gateway_merchants').select('*').eq('id', merchant_id).single();
        if (!merchant) return rfc7807('not_found', 'Not Found', 404, 'Merchant not found');
        if (merchant.user_id !== user.id && !isAdmin) return rfc7807('forbidden', 'Forbidden', 403, 'Access denied');

        if (!['DRAFT', 'ACTIVE'].includes(merchant.status) && !isAdmin) {
          return rfc7807('invalid_state', 'Invalid State', 409, `Cannot update in '${merchant.status}' state`);
        }

        const allowedFields = ['business_name', 'business_email', 'business_type', 'country',
          'webhook_url', 'webhook_secret', 'fee_bearer', 'metadata',
          'daily_payout_limit', 'max_single_charge', 'max_daily_charges', 'max_daily_payouts'];

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const f of allowedFields) { if (body[f] !== undefined) updates[f] = body[f]; }

        const { data: updated, error } = await supabase
          .from('gateway_merchants').update(updates).eq('id', merchant_id).select().single();
        if (error) return rfc7807('update_failed', 'Update Failed', 500, error.message);

        await supabase.from('audit_logs').insert({
          action_type: 'merchant_updated', entity_type: 'gateway_merchant',
          entity_id: merchant_id, performed_by: user.id,
          details: { fields_updated: Object.keys(updates).filter(k => k !== 'updated_at') },
        });

        return json(updated);
      }

      // ─── STATUS TRANSITIONS (submit, activate, suspend, unsuspend, close, reject) ───
      const transition = TRANSITIONS[action];
      if (transition) {
        if (!merchant_id) return rfc7807('validation_error', 'Validation Error', 400, 'merchant_id required');
        if (transition.adminOnly && !isAdmin) return rfc7807('forbidden', 'Forbidden', 403, `Only admins can ${action}`);

        const { data: merchant } = await supabase
          .from('gateway_merchants').select('*').eq('id', merchant_id).single();
        if (!merchant) return rfc7807('not_found', 'Not Found', 404, 'Merchant not found');

        if (!transition.adminOnly && merchant.user_id !== user.id && !isAdmin) {
          return rfc7807('forbidden', 'Forbidden', 403, 'Access denied');
        }

        if (!transition.allowed.includes(merchant.status)) {
          return rfc7807('invalid_transition', 'Invalid Transition', 409,
            `Cannot ${action} from '${merchant.status}'. Allowed: ${transition.allowed.join(', ')}`);
        }

        const newStatus = TARGET_STATUS[action];
        const updateData: Record<string, any> = { status: newStatus, updated_at: new Date().toISOString() };
        if (action === 'reject' && body.reason) updateData.rejection_reason = body.reason;
        if (action === 'suspend' && body.reason) updateData.suspension_reason = body.reason;

        const { error } = await supabase.from('gateway_merchants').update(updateData).eq('id', merchant_id);
        if (error) return rfc7807('transition_failed', 'Transition Failed', 500, error.message);

        await supabase.from('audit_logs').insert({
          action_type: `merchant_${action}`, entity_type: 'gateway_merchant',
          entity_id: merchant_id, performed_by: user.id,
          details: { previous_status: merchant.status, new_status: newStatus, reason: body.reason || null },
        });

        // ✉️ Email merchant on lifecycle transitions
        const merchantOwnerName = await getUserName(supabase, merchant.user_id);
        const emailMap: Record<string, string> = {
          activate: 'merchant_activated',
          suspend: 'merchant_suspended',
          reject: 'merchant_rejected',
          submit: 'merchant_application_submitted',
        };
        if (emailMap[action]) {
          sendManagedEmail(supabase, {
            email_key: emailMap[action],
            recipient_user_id: merchant.user_id,
            variables: {
              merchant_name: merchantOwnerName,
              business_name: merchant.business_name,
              reason: body.reason || 'N/A',
            },
          });
        }

        // ✉️ Admin alert on submission
        if (action === 'submit') {
          const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
          for (const admin of (admins || [])) {
            sendManagedEmail(supabase, {
              email_key: 'merchant_kyb_submitted_alert',
              recipient_user_id: admin.user_id,
              variables: {
                business_name: merchant.business_name,
                business_type: merchant.business_type || 'N/A',
                country: merchant.country || 'N/A',
              },
            });
          }
        }

        return json({
          merchant_id, previous_status: merchant.status, new_status: newStatus,
          action, performed_at: new Date().toISOString(),
        });
      }

      return rfc7807('invalid_action', 'Invalid Action', 400, `Unknown action: ${action}`);
    }

    return rfc7807('method_not_allowed', 'Method Not Allowed', 405, 'Only POST supported');
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] [gateway-merchant-lifecycle] Error:`, err);
    return rfc7807('internal_error', 'Internal Server Error', 500, `An unexpected error occurred. Reference: ${errorId}`);
  }
});
