/**
 * Shared cron authentication guard.
 * Verifies that the request includes a valid CRON_SECRET header
 * or a service_role JWT (for pg_cron invocations).
 */
export function verifyCronAuth(req: Request): { authorized: boolean; response?: Response } {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  };

  // Check for cron secret header
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');

  if (expectedSecret && cronSecret === expectedSecret) {
    return { authorized: true };
  }

  // Check for service_role JWT in Authorization header
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (serviceRoleKey && token === serviceRoleKey) {
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
