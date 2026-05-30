/**
 * Shared cron authentication guard.
 *
 * Accepted credentials (in order of preference):
 *   1. `x-cron-secret` header matching the `CRON_SECRET` Supabase secret.
 *   2. `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (used by pg_cron → pg_net).
 *
 * The public Supabase anon/publishable key is NEVER accepted, because it ships
 * in the browser JS bundle and would allow any visitor to invoke billing,
 * settlement, withdrawal, and reconciliation jobs.
 */
export function verifyCronAuth(req: Request): { authorized: boolean; response?: Response } {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  };

  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');

  if (expectedSecret && cronSecret && cronSecret === expectedSecret) {
    return { authorized: true };
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (serviceRoleKey && token && token === serviceRoleKey) {
    return { authorized: true };
  }

  return {
    authorized: false,
    response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }),
  };
}
