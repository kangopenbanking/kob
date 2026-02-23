import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Expected: .../gateway-merchant-lifecycle or .../gateway-merchant-lifecycle?merchant_id=xxx
    const merchantId = url.searchParams.get('merchant_id') || pathParts[pathParts.length - 1];

    // Check admin role
    const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    const isAdmin = !!adminRole;

    if (method === 'POST' && !url.searchParams.get('action')) {
      // Create merchant (DRAFT)
      const body = await req.json();
      const { business_name, business_email, business_phone, institution_id, metadata } = body;
      if (!business_name) return new Response(JSON.stringify({ error: 'business_name required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: merchant, error } = await supabase.from('gateway_merchants').insert({
        business_name, business_email, business_phone,
        institution_id: institution_id || null,
        user_id: user.id, status: 'draft', kyb_status: 'not_submitted',
        metadata: metadata || {},
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify({ data: merchant }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (method === 'GET') {
      const mid = url.searchParams.get('merchant_id');
      if (!mid) {
        // List merchants for user (or all if admin)
        let query = supabase.from('gateway_merchants').select('*').order('created_at', { ascending: false });
        if (!isAdmin) query = query.eq('user_id', user.id);
        const limit = parseInt(url.searchParams.get('limit') || '25');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        query = query.range(offset, offset + limit - 1);
        const { data, error } = await query;
        if (error) throw error;
        return new Response(JSON.stringify({ data: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Get single merchant
      let query = supabase.from('gateway_merchants').select('*').eq('id', mid);
      if (!isAdmin) query = query.eq('user_id', user.id);
      const { data: merchant, error } = await query.single();
      if (error || !merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ data: merchant }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (method === 'PATCH') {
      const mid = url.searchParams.get('merchant_id');
      if (!mid) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const body = await req.json();
      const { business_name, business_email, business_phone, metadata } = body;
      const updates: Record<string, unknown> = {};
      if (business_name) updates.business_name = business_name;
      if (business_email !== undefined) updates.business_email = business_email;
      if (business_phone !== undefined) updates.business_phone = business_phone;
      if (metadata) updates.metadata = metadata;

      let query = supabase.from('gateway_merchants').update(updates).eq('id', mid);
      if (!isAdmin) query = query.eq('user_id', user.id);
      const { data, error } = await query.select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Status transitions via POST with action param
    const action = url.searchParams.get('action');
    if (method === 'POST' && action) {
      const mid = url.searchParams.get('merchant_id');
      if (!mid) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', mid).single();
      if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Verify ownership or admin
      if (merchant.user_id !== user.id && !isAdmin) {
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const transitions: Record<string, { from: string[]; to: string; adminOnly: boolean }> = {
        submit: { from: ['draft'], to: 'submitted', adminOnly: false },
        activate: { from: ['verified', 'suspended'], to: 'active', adminOnly: true },
        suspend: { from: ['active'], to: 'suspended', adminOnly: true },
        close: { from: ['active', 'suspended', 'draft'], to: 'closed', adminOnly: true },
        verify: { from: ['submitted', 'under_review'], to: 'verified', adminOnly: true },
      };

      const t = transitions[action];
      if (!t) return new Response(JSON.stringify({ error: 'invalid_action', valid: Object.keys(transitions) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (t.adminOnly && !isAdmin) return new Response(JSON.stringify({ error: 'admin_only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!t.from.includes(merchant.status)) return new Response(JSON.stringify({ error: 'invalid_transition', current: merchant.status, allowed_from: t.from }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: updated, error } = await supabase.from('gateway_merchants').update({ status: t.to }).eq('id', mid).select().single();
      if (error) throw error;

      // Audit log
      await supabase.from('audit_logs').insert({
        action_type: `merchant.${action}`, entity_type: 'gateway_merchant', entity_id: mid,
        performed_by: user.id, details: { from: merchant.status, to: t.to },
      });

      return new Response(JSON.stringify({ data: updated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
