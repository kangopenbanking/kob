import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
    
    const { country } = await req.json();
    const countryCode = country || 'CM'; // Default to Cameroon

    console.log('Fetching banks for country:', countryCode);

    const response = await fetch(
      `https://api.flutterwave.com/v3/banks/${countryCode}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${flutterwaveSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Flutterwave API error:', data);
      throw new Error(data.message || 'Failed to fetch banks');
    }

    console.log(`Fetched ${data.data?.length || 0} banks for ${countryCode}`);

    return new Response(
      JSON.stringify({
        banks: data.data || [],
        country: countryCode
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in flutterwave-list-banks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'FLUTTERWAVE_LIST_BANKS_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
