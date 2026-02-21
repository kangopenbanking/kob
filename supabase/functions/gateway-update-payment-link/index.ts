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

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { link_id, title, amount, description, status, redirect_url, max_uses, expires_at } = body;

    if (!link_id) return new Response(JSON.stringify({ error: 'link_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Verify ownership
    const { data: link } = await supabase
      .from('gateway_payment_links')
      .select('*, gateway_merchants!inner(user_id)')
      .eq('id', link_id)
      .single();

    if (!link || link.gateway_merchants.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (amount !== undefined) updates.amount = amount;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (redirect_url !== undefined) updates.redirect_url = redirect_url;
    if (max_uses !== undefined) updates.max_uses = max_uses;
    if (expires_at !== undefined) updates.expires_at = expires_at;

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'no_updates' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('gateway_payment_links')
      .update(updates)
      .eq('id', link_id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify(updated), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
