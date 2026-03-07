import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const url = new URL(req.url);
    const method = req.method;
    const merchantId = url.searchParams.get('merchant_id');
    const action = url.searchParams.get('action'); // submit, status, review

    if (!merchantId) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Verify merchant access
    const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', merchantId).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    const isAdmin = !!adminRole;
    const isOwner = merchant.user_id === user.id;

    if (!isOwner && !isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // GET - KYB status
    if (method === 'GET') {
      return new Response(JSON.stringify({
        data: {
          merchant_id: merchant.id,
          kyb_status: merchant.kyb_status,
          status: merchant.status,
          business_name: merchant.business_name,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (method === 'POST') {
      // Submit KYB
      if (action === 'submit') {
        if (merchant.kyb_status !== 'not_submitted' && merchant.kyb_status !== 'rejected') {
          return new Response(JSON.stringify({ error: 'kyb_already_submitted', current: merchant.kyb_status }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const body = await req.json();
        const { documents, registration_number, tax_id, business_address } = body;

        const updates: Record<string, unknown> = {
          kyb_status: 'submitted',
          metadata: {
            ...(merchant.metadata as Record<string, unknown> || {}),
            kyb_submission: { documents, registration_number, tax_id, business_address, submitted_at: new Date().toISOString(), submitted_by: user.id },
          },
        };

        const { data: updated, error } = await supabase.from('gateway_merchants').update(updates).eq('id', merchantId).select().single();
        if (error) throw error;

        await supabase.from('audit_logs').insert({
          action_type: 'merchant.kyb_submitted', entity_type: 'gateway_merchant', entity_id: merchantId,
          performed_by: user.id, details: { registration_number },
        });

        return new Response(JSON.stringify({ data: updated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Admin review KYB
      if (action === 'review') {
        if (!isAdmin) return new Response(JSON.stringify({ error: 'admin_only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        if (merchant.kyb_status !== 'submitted' && merchant.kyb_status !== 'under_review') {
          return new Response(JSON.stringify({ error: 'not_reviewable', current: merchant.kyb_status }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const body = await req.json();
        const { decision, reason } = body; // approved | rejected
        if (!decision || !['approved', 'rejected'].includes(decision)) {
          return new Response(JSON.stringify({ error: 'invalid_decision', valid: ['approved', 'rejected'] }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const updates: Record<string, unknown> = {
          kyb_status: decision,
          status: decision === 'approved' ? 'verified' : merchant.status,
          metadata: {
            ...(merchant.metadata as Record<string, unknown> || {}),
            kyb_review: { decision, reason, reviewed_at: new Date().toISOString(), reviewed_by: user.id },
          },
        };

        const { data: updated, error } = await supabase.from('gateway_merchants').update(updates).eq('id', merchantId).select().single();
        if (error) throw error;

        await supabase.from('audit_logs').insert({
          action_type: `merchant.kyb_${decision}`, entity_type: 'gateway_merchant', entity_id: merchantId,
          performed_by: user.id, details: { decision, reason },
        });

        return new Response(JSON.stringify({ data: updated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'invalid_action', valid: ['submit', 'review'] }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
