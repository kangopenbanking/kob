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

    const body = await req.json();
    const { dispute_id, evidence } = body;

    if (!dispute_id || !evidence) return new Response(JSON.stringify({ error: 'dispute_id and evidence required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: dispute } = await supabase.from('gateway_disputes').select('*, gateway_merchants!inner(user_id)').eq('id', dispute_id).single();
    if (!dispute || dispute.gateway_merchants.user_id !== user.id) return new Response(JSON.stringify({ error: 'dispute_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (dispute.status !== 'open') {
      return new Response(JSON.stringify({ error: 'dispute_not_open', message: 'Evidence can only be submitted for open disputes' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Submit to Stripe if provider is stripe
    if (dispute.provider === 'stripe' && dispute.provider_ref) {
      const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
      if (STRIPE_SECRET) {
        const params = new URLSearchParams();
        if (evidence.customer_name) params.append('evidence[customer_name]', evidence.customer_name);
        if (evidence.customer_email) params.append('evidence[customer_email_address]', evidence.customer_email);
        if (evidence.product_description) params.append('evidence[product_description]', evidence.product_description);
        if (evidence.uncategorized_text) params.append('evidence[uncategorized_text]', evidence.uncategorized_text);
        if (evidence.submit !== false) params.append('submit', 'true');

        await fetch(`https://api.stripe.com/v1/disputes/${dispute.provider_ref}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${STRIPE_SECRET}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
      }
    }

    await supabase.from('gateway_disputes').update({ status: 'under_review', evidence_submitted: true, evidence_data: evidence, updated_at: new Date().toISOString() }).eq('id', dispute_id);

    // Send evidence submitted notification
    await supabase.functions.invoke('gateway-dispute-notify', {
      body: { dispute_id, event_type: 'dispute.evidence_submitted' },
    });

    const { gateway_merchants, ...disputeData } = dispute;
    return new Response(JSON.stringify({ ...disputeData, status: 'under_review' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
