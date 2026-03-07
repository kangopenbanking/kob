import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone_number } = await req.json();

    if (!phone_number) {
      return new Response(
        JSON.stringify({ error: 'phone_number is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if user exists and has PIN set
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, pin_code_hash')
      .eq('phone_number', phone_number)
      .maybeSingle();

    const hasPIN = !error && profile && profile.pin_code_hash ? true : false;
    const userExists = !error && profile ? true : false;

    console.log(`PIN check for ${phone_number}: exists=${userExists}, hasPIN=${hasPIN}`);

    return new Response(
      JSON.stringify({
        user_exists: userExists,
        has_pin: hasPIN,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('PIN check error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to check PIN status',
        details: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
