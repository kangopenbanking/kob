import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";

function problem(status: number, title: string, detail: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ type: 'about:blank', title, status, detail, ...extra }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Auth — accepts sk_test_/sk_live_ API keys, sbx_ legacy, or Supabase JWT
    const __authResult = await resolveAuth(req, supabase);
    if (__authResult.response) return __authResult.response;
    const __auth = __authResult.auth!;
    const user = { id: __auth.user_id, email: __auth.email } as any;

    const url = new URL(req.url);
    const method = req.method;

    // Helper: verify merchant ownership
    async function verifyMerchant(merchantId: string) {
      const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user!.id).eq('role', 'admin').maybeSingle();
      if (adminRole) return true;
      const { data: m } = await supabase.from('gateway_merchants').select('id').eq('id', merchantId).eq('user_id', user!.id).single();
      return !!m;
    }

    // POST - Create webhook endpoint
    if (method === 'POST') {
      const body = await req.json();
      const { merchant_id, url: endpointUrl, description, events } = body;
      if (!merchant_id || !endpointUrl || !events?.length) {
        return problem(400, 'Bad Request', 'merchant_id, url, and events[] are required');
      }
      if (!await verifyMerchant(merchant_id)) return problem(403, 'Forbidden', 'Not authorized for this merchant');

      // Generate per-endpoint secret
      const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`;

      const { data: endpoint, error } = await supabase.from('gateway_webhook_endpoints').insert({
        merchant_id, url: endpointUrl, description, events, secret,
      }).select('id, merchant_id, url, description, events, is_active, created_at').single();

      if (error) throw error;

      return new Response(JSON.stringify({
        ...endpoint, secret,
        warning: 'Store this signing secret securely. It will not be shown again.',
      }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET - List endpoints for merchant
    if (method === 'GET') {
      const merchantId = url.searchParams.get('merchant_id');
      if (!merchantId) return problem(400, 'Bad Request', 'merchant_id query parameter required');
      if (!await verifyMerchant(merchantId)) return problem(403, 'Forbidden', 'Not authorized for this merchant');

      const { data: endpoints } = await supabase.from('gateway_webhook_endpoints')
        .select('id, merchant_id, url, description, events, is_active, created_at, updated_at')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });

      // Also fetch recent deliveries per endpoint
      const endpointIds = (endpoints || []).map(e => e.id);
      const { data: recentDeliveries } = endpointIds.length > 0
        ? await supabase.from('gateway_webhook_deliveries_v2')
            .select('id, endpoint_id, event_type, status, response_status, attempt, created_at')
            .in('endpoint_id', endpointIds)
            .order('created_at', { ascending: false })
            .limit(50)
        : { data: [] };

      return new Response(JSON.stringify({
        data: endpoints || [],
        recent_deliveries: recentDeliveries || [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // PATCH - Update endpoint (url, events, is_active, description)
    if (method === 'PATCH') {
      const body = await req.json();
      const { endpoint_id, merchant_id, ...updates } = body;
      if (!endpoint_id || !merchant_id) return problem(400, 'Bad Request', 'endpoint_id and merchant_id required');
      if (!await verifyMerchant(merchant_id)) return problem(403, 'Forbidden', 'Not authorized for this merchant');

      const allowedFields: Record<string, unknown> = {};
      if (updates.url !== undefined) allowedFields.url = updates.url;
      if (updates.events !== undefined) allowedFields.events = updates.events;
      if (updates.is_active !== undefined) allowedFields.is_active = updates.is_active;
      if (updates.description !== undefined) allowedFields.description = updates.description;

      const { data: updated, error } = await supabase.from('gateway_webhook_endpoints')
        .update(allowedFields)
        .eq('id', endpoint_id).eq('merchant_id', merchant_id)
        .select('id, merchant_id, url, description, events, is_active, updated_at').single();

      if (error) throw error;
      return new Response(JSON.stringify(updated), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // DELETE - Remove endpoint
    if (method === 'DELETE') {
      const body = await req.json();
      const { endpoint_id, merchant_id } = body;
      if (!endpoint_id || !merchant_id) return problem(400, 'Bad Request', 'endpoint_id and merchant_id required');
      if (!await verifyMerchant(merchant_id)) return problem(403, 'Forbidden', 'Not authorized for this merchant');

      await supabase.from('gateway_webhook_endpoints').delete().eq('id', endpoint_id).eq('merchant_id', merchant_id);
      return new Response(JSON.stringify({ status: 'deleted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return problem(405, 'Method Not Allowed', `${method} is not supported`);
  } catch (err) {
    return problem(500, 'Internal Server Error', err.message);
  }
});
