// Admin-only: invite a user (by email) as a Support Agent in a department.
// Creates the auth user if needed, assigns the support_agent role, and adds the support_agents row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // Validate caller and admin role using anon client + caller JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: caller.id, _role: 'admin' });
    if (!isAdmin) return json({ error: 'Forbidden — admin role required' }, 403);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const department_id = String(body.department_id || '').trim();
    const max_concurrent_chats = Number(body.max_concurrent_chats || 5);
    const full_name = body.full_name ? String(body.full_name).trim() : null;

    if (!email || !email.includes('@')) return json({ error: 'Valid email required' }, 400);
    if (!department_id) return json({ error: 'Department required' }, 400);

    // 1) Resolve or create the user (idempotent)
    let userId: string | null = null;
    let inviteSent = false;

    // Look up existing profile
    const { data: existingProfile } = await admin
      .from('profiles').select('id').eq('email', email).maybeSingle();

    if (existingProfile?.id) {
      userId = existingProfile.id;
    } else {
      // Try to invite via admin API (sends invite email so user sets their password)
      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: full_name ? { full_name } : undefined,
        redirectTo: `${new URL(req.url).origin.replace('functions.', '')}/auth`,
      });
      if (inviteErr) {
        // Fallback: maybe user already exists in auth without profile — try to look up
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const found = list?.users?.find((u: any) => (u.email || '').toLowerCase() === email);
        if (!found) return json({ error: `Failed to invite user: ${inviteErr.message}` }, 400);
        userId = found.id;
      } else {
        userId = invited.user?.id ?? null;
        inviteSent = true;
      }
    }

    if (!userId) return json({ error: 'Could not resolve user id' }, 500);

    // Ensure profile row exists
    await admin.from('profiles').upsert(
      { id: userId, email, ...(full_name ? { full_name } : {}) },
      { onConflict: 'id' }
    );

    // 2) Grant support_agent role (idempotent)
    await admin.from('user_roles').upsert(
      { user_id: userId, role: 'support_agent' as any },
      { onConflict: 'user_id,role', ignoreDuplicates: true }
    );

    // 3) Add to support_agents (unique on user_id + department_id)
    const { error: agentErr } = await admin.from('support_agents').upsert(
      { user_id: userId, department_id, max_concurrent_chats, status: 'offline' },
      { onConflict: 'user_id,department_id', ignoreDuplicates: false }
    );
    if (agentErr) return json({ error: `Failed to assign agent: ${agentErr.message}` }, 400);

    // 4) Send welcome / invite email (best effort)
    try {
      const { data: dept } = await admin.from('support_departments').select('name').eq('id', department_id).single();
      await admin.functions.invoke('managed-send-email', {
        body: {
          email_key: 'support_agent_invite',
          recipient_email: email,
          variables: {
            agent_name: full_name || email.split('@')[0],
            department_name: dept?.name || 'Support',
            portal_url: `${new URL(req.url).origin.replace('functions.', '')}/admin/support-chat`,
            invite_sent: inviteSent,
          },
        },
      });
    } catch (e) {
      console.warn('Invite email failed (non-fatal):', e);
    }

    return json({ success: true, user_id: userId, invite_sent: inviteSent });
  } catch (e: any) {
    console.error('support-invite-agent error:', e);
    return json({ error: e?.message || 'Internal error' }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
