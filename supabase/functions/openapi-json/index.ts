import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch the OpenAPI spec from the existing endpoint
    const specResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/public-api-spec`
    );

    if (!specResponse.ok) {
      throw new Error('Failed to fetch OpenAPI specification');
    }

    const spec = await specResponse.json();

    // Return the spec with proper headers
    return new Response(JSON.stringify(spec, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error serving OpenAPI spec:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch OpenAPI specification',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
