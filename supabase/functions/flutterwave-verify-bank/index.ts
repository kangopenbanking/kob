import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
    
    const { account_number, account_bank } = await req.json();

    console.log('Verifying bank account:', { account_number, account_bank });

    if (!account_number || !account_bank) {
      throw new Error('Missing required fields: account_number, account_bank');
    }

    const response = await fetch(
      'https://api.flutterwave.com/v3/accounts/resolve',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${flutterwaveSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_number,
          account_bank
        })
      }
    );

    const data = await response.json();

    if (!response.ok || data.status !== 'success') {
      console.error('Flutterwave verification error:', data);
      throw new Error(data.message || 'Failed to verify bank account');
    }

    console.log('Account verified:', data.data?.account_name);

    return new Response(
      JSON.stringify({
        account_name: data.data.account_name,
        account_number: data.data.account_number,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in flutterwave-verify-bank:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'FLUTTERWAVE_VERIFY_BANK_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
