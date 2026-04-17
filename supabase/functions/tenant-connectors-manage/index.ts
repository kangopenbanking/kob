// Tenant Payment Connectors — create / update / delete BYO credentials.
// Owners only. Credentials encrypted server-side; never returned to the client.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { encryptCredentials, getConnector } from '../_shared/payment-connectors/registry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, PATCH, DELETE, OPTIONS',
};

const ConnectorIdEnum = z.enum(['mtn_momo', 'orange_money', 'flutterwave']);
const OwnerTypeEnum = z.enum(['institution', 'merchant', 'developer']);
const EnvEnum = z.enum(['sandbox', 'live']);

const CreateSchema = z.object({
  action: z.literal('create'),
  owner_type: OwnerTypeEnum,
  owner_id: z.string().uuid(),
  connector_id: ConnectorIdEnum,
  environment: EnvEnum.default('sandbox'),
  country: z.string().min(2).max(3).default('CM'),
  priority: z.number().int().min(1).max(1000).default(100),
  enabled: z.boolean().default(true),
  display_name: z.string().max(120).optional(),
  credentials: z.record(z.string()),
});

const UpdateSchema = z.object({
  action: z.literal('update'),
  id: z.string().uuid(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(1).max(1000).optional(),
  display_name: z.string().max(120).optional(),
  credentials: z.record(z.string()).optional(),
});

const DeleteSchema = z.object({ action: z.literal('delete'), id: z.string().uuid() });
const Body = z.discriminatedUnion('action', [CreateSchema, UpdateSchema, DeleteSchema]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'unauthenticated' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return json({ error: 'unauthenticated' }, 401);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
    const body = parsed.data;

    if (body.action === 'create') {
      // Validate required credential fields against connector contract
      const connector = getConnector(body.connector_id);
      const required = connector.requiredCredentialFields();
      const missing = required.filter(f => !body.credentials[f] && f !== 'target_environment');
      if (missing.length > 0) {
        return json({ error: 'missing_credential_fields', missing }, 400);
      }

      const encrypted = await encryptCredentials(body.credentials);
      const { data, error } = await supabase
        .from('tenant_payment_connectors')
        .insert({
          owner_type: body.owner_type,
          owner_id: body.owner_id,
          connector_id: body.connector_id,
          environment: body.environment,
          country: body.country.toUpperCase(),
          priority: body.priority,
          enabled: body.enabled,
          display_name: body.display_name,
          credentials_encrypted: encrypted,
          created_by: userData.user.id,
        })
        .select('id, owner_type, owner_id, connector_id, environment, country, enabled, priority, display_name, health_status, created_at')
        .single();

      if (error) return json({ error: error.message }, error.code === '23505' ? 409 : 400);
      return json({ connector: data }, 201);
    }

    if (body.action === 'update') {
      const patch: Record<string, unknown> = {};
      if (body.enabled !== undefined) patch.enabled = body.enabled;
      if (body.priority !== undefined) patch.priority = body.priority;
      if (body.display_name !== undefined) patch.display_name = body.display_name;
      if (body.credentials) patch.credentials_encrypted = await encryptCredentials(body.credentials);

      const { data, error } = await supabase
        .from('tenant_payment_connectors')
        .update(patch)
        .eq('id', body.id)
        .select('id, enabled, priority, display_name, health_status, updated_at')
        .single();

      if (error) return json({ error: error.message }, 400);
      return json({ connector: data });
    }

    // delete
    const { error } = await supabase.from('tenant_payment_connectors').delete().eq('id', body.id);
    if (error) return json({ error: error.message }, 400);
    return json({ deleted: true });
  } catch (e) {
    console.error('[tenant-connectors-manage]', e);
    return json({ error: 'internal_error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
