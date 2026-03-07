import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { bvn } = await req.json();
    if (!bvn) return new Response(JSON.stringify({ error: 'missing_fields', message: 'bvn is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const flwKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
    const res = await fetch(`https://api.flutterwave.com/v3/kyc/bvns/${bvn}`, {
      headers: { 'Authorization': `Bearer ${flwKey}` },
    });
    const data = await res.json();

    if (data.status !== 'success') throw new Error(data.message || 'BVN resolution failed');

    return new Response(JSON.stringify({
      bvn: data.data.bvn, first_name: data.data.first_name, last_name: data.data.last_name,
      middle_name: data.data.middle_name, date_of_birth: data.data.date_of_birth,
      phone_number: data.data.phone_number,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'bvn_resolution_failed', message: err.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
