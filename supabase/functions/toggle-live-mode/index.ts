// Toggle Go-Live mode for merchant / developer org / institution.
// Requires the entity owner (or admin) to have KYB approved before enabling.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

type EntityKind = 'merchant' | 'developer' | 'institution';

const TABLE_BY_KIND: Record<EntityKind, string> = {
  merchant: 'gateway_merchants',
  developer: 'developer_orgs',
  institution: 'institutions',
};

function problem(status: number, title: string, detail: string) {
  return new Response(
    JSON.stringify({ type: 'about:blank', title, status, detail, error: detail }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' } }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return problem(401, 'Unauthorized', 'Missing Authorization header');
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return problem(401, 'Unauthorized', 'Invalid token');

    const { entity, entity_id, enable } = await req.json();
    if (!entity || typeof enable !== 'boolean') {
      return problem(400, 'Bad Request', 'entity and enable are required');
    }
    const kind = entity as EntityKind;
    const table = TABLE_BY_KIND[kind];
    if (!table) return problem(400, 'Bad Request', 'Unknown entity');

    // Resolve target row
    let row: any;
    if (entity_id) {
      const { data } = await supabase.from(table).select('*').eq('id', entity_id).maybeSingle();
      row = data;
    } else {
      // Default to caller's owned row
      const { data } = await supabase.from(table).select('*').eq('user_id', user.id).maybeSingle();
      row = data;
    }
    if (!row) return problem(404, 'Not Found', 'Entity not found');

    // Authorization: row owner OR admin
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === 'admin');
    if (!isAdmin && row.user_id !== user.id) return problem(403, 'Forbidden', 'Not authorized for this entity');

    if (enable) {
      if (row.kyb_status !== 'approved') {
        return problem(403, 'KYB Required', 'KYB must be completed and approved before enabling Go Live.');
      }
    }

    const { data: updated, error } = await supabase
      .from(table)
      .update({
        live_mode_enabled: enable,
        live_mode_enabled_at: enable ? new Date().toISOString() : null,
        live_mode_enabled_by: enable ? user.id : null,
      })
      .eq('id', row.id)
      .select('id, live_mode_enabled, live_mode_enabled_at')
      .single();

    if (error) throw error;

    try {
      await supabase.from('audit_logs').insert({
        entity_type: table,
        entity_id: row.id,
        action_type: enable ? 'live_mode_enabled' : 'live_mode_disabled',
        performed_by: user.id,
        details: { entity: kind },
      });
    } catch (_) { /* best-effort */ }

    return new Response(JSON.stringify({ success: true, ...updated }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('toggle-live-mode error:', err);
    return problem(500, 'Internal Server Error', err instanceof Error ? err.message : 'Unknown error');
  }
});
