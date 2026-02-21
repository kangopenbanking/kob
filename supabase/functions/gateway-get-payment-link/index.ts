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
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const id = url.searchParams.get('id');

    if (!slug && !id) {
      return new Response(JSON.stringify({ error: 'missing_fields', message: 'slug or id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let query = supabase.from('gateway_payment_links').select('*, gateway_merchants(business_name, logo_url)');
    if (slug) query = query.eq('slug', slug);
    else query = query.eq('id', id);

    const { data: link, error } = await query.single();
    if (error || !link) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Check expiry and max uses
    if (link.status !== 'active') return new Response(JSON.stringify({ error: 'link_inactive' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (link.expires_at && new Date(link.expires_at) < new Date()) return new Response(JSON.stringify({ error: 'link_expired' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (link.max_uses && link.use_count >= link.max_uses) return new Response(JSON.stringify({ error: 'link_exhausted' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    return new Response(JSON.stringify(link), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
