import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { corsHeaders } from "../_shared/cors.ts";

/**
 * Returns the Stripe publishable key for frontend use.
 * This is safe — publishable keys are meant to be public.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const publishableKey = Deno.env.get('STRIPE_PUBLIC_KEY') || Deno.env.get('VITE_STRIPE_PUBLIC_KEY') || '';

  return new Response(JSON.stringify({ publishable_key: publishableKey }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
