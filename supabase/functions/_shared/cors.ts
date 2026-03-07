/**
 * Standard CORS headers for all edge functions.
 * Import this instead of defining corsHeaders locally.
 *
 * Usage:
 *   import { corsHeaders } from "../_shared/cors.ts";
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, idempotency-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
