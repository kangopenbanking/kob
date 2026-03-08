import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

/**
 * POS Locations + Staff management
 */
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

    const url = new URL(req.url);
    const entity = url.searchParams.get('entity') || 'location'; // location | staff

    if (entity === 'location') {
      return await handleLocations(supabase, user, req, url);
    } else if (entity === 'staff') {
      return await handleStaff(supabase, user, req, url);
    }

    return new Response(JSON.stringify({ error: 'invalid_entity' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('pos-manage-locations error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleLocations(supabase: any, user: any, req: Request, url: URL) {
  if (req.method === 'GET') {
    const merchantId = url.searchParams.get('merchant_id');
    if (!merchantId) {
      return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data, error } = await supabase.from('merchant_locations')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return new Response(JSON.stringify({ locations: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const { merchant_id, name, address_json, city, country, timezone, currency_default } = body;
    if (!merchant_id || !name) {
      return new Response(JSON.stringify({ error: 'merchant_id and name required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data, error } = await supabase.from('merchant_locations').insert({
      merchant_id, name,
      address_json: address_json || {},
      city: city || 'Douala',
      country: country || 'CM',
      timezone: timezone || 'Africa/Douala',
      currency_default: currency_default || 'XAF',
    }).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (req.method === 'PATCH') {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) {
      return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data, error } = await supabase.from('merchant_locations').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleStaff(supabase: any, user: any, req: Request, url: URL) {
  if (req.method === 'GET') {
    const merchantId = url.searchParams.get('merchant_id');
    if (!merchantId) {
      return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data, error } = await supabase.from('merchant_pos_staff')
      .select('*, profiles(email, full_name)')
      .eq('merchant_id', merchantId);
    if (error) throw error;
    return new Response(JSON.stringify({ staff: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const { merchant_id, user_id, role, pin } = body;
    if (!merchant_id || !user_id) {
      return new Response(JSON.stringify({ error: 'merchant_id and user_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Hash PIN if provided
    let pinHash = null;
    if (pin) {
      const encoder = new TextEncoder();
      const hash = await crypto.subtle.digest('SHA-256', encoder.encode(pin));
      pinHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const { data, error } = await supabase.from('merchant_pos_staff').insert({
      merchant_id,
      user_id,
      role: role || 'cashier',
      pin_hash: pinHash,
      status: 'active',
    }).select().single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
