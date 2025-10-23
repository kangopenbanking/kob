import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { pin_code } = await req.json();

    if (!pin_code) {
      return new Response(
        JSON.stringify({ error: 'pin_code is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate PIN format (exactly 6 digits)
    if (!/^\d{6}$/.test(pin_code)) {
      return new Response(
        JSON.stringify({ error: 'PIN must be exactly 6 digits' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Hash the PIN
    const pinHash = await bcrypt.hash(pin_code);

    // Update profile with PIN
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        pin_code_hash: pinHash,
        pin_code_set_at: new Date().toISOString(),
        pin_attempts: 0,
        pin_locked_until: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to set PIN:', updateError);
      throw new Error('Failed to set PIN code');
    }

    // Log security event
    await supabase.rpc('log_security_event', {
      _user_id: user.id,
      _event_type: 'pin_code_set',
      _event_category: 'authentication',
      _metadata: { action: 'set_pin_code' },
    });

    console.log(`PIN code set successfully for user: ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'PIN code set successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Set PIN error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to set PIN code', details: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
