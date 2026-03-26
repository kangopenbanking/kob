import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const action = body.action || 'create';

    if (action === 'create') {
      const { name, description, amount, is_open_amount, expires_at } = body;

      if (!name || typeof name !== 'string' || name.trim().length < 1) {
        return new Response(JSON.stringify({ error: 'name required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!description || typeof description !== 'string' || description.trim().length < 1) {
        return new Response(JSON.stringify({ error: 'description required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!is_open_amount && (typeof amount !== 'number' || amount <= 0 || amount > 100000000)) {
        return new Response(JSON.stringify({ error: 'valid amount required (or enable open amount)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Validate expiry is in the future if provided
      if (expires_at) {
        const expiryDate = new Date(expires_at);
        if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
          return new Response(JSON.stringify({ error: 'expiry must be a future date' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Generate unique slug server-side
      const slug = `pay-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

      // Check slug uniqueness
      const { data: existing } = await supabase.from('customer_pay_links').select('id').eq('slug', slug).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: 'slug collision, please retry' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data, error } = await supabase.from('customer_pay_links').insert({
        user_id: user.id,
        slug,
        name: name.trim().slice(0, 200),
        description: description.trim().slice(0, 500),
        amount: is_open_amount ? null : amount,
        is_open_amount: !!is_open_amount,
        expires_at: expires_at || null,
      }).select().single();

      if (error) throw error;

      return new Response(JSON.stringify({ link: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'deactivate') {
      const { link_id } = body;
      if (!link_id) {
        return new Response(JSON.stringify({ error: 'link_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { error } = await supabase.from('customer_pay_links')
        .update({ is_active: false })
        .eq('id', link_id)
        .eq('user_id', user.id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('customer-paylinks-ops error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
