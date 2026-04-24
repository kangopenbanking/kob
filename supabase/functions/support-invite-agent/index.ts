// Admin-only endpoint to invite a new support agent.
// - Creates auth user (or reuses existing) with auto-generated temp password
// - Grants 'support_agent' role
// - Creates support_agents row + department memberships
// - Sends invite email containing temp credentials
// - Marks password_reset_required=true so the agent must change on first login
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function genPassword() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 12);
  return `Tmp-${b64.slice(0, 4)}-${b64.slice(4, 8)}-${b64.slice(8, 12)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') || '';
    const jwt = auth.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: caller } = await admin.auth.getUser(jwt);
    if (!caller?.user) return json({ error: 'Unauthorized' }, 401);

    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: caller.user.id, _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.full_name || '').trim().slice(0, 120);
    const displayName = String(body.display_name || fullName || '').trim().slice(0, 120) || null;
    const isSupervisor = !!body.is_supervisor;
    const maxConcurrent = Math.min(50, Math.max(1, Number(body.max_concurrent_chats) || 5));
    const departmentIds: string[] = Array.isArray(body.department_ids) ? body.department_ids.map(String) : [];

    if (!EMAIL_RX.test(email)) return json({ error: 'A valid email is required.' }, 400);
    if (!fullName) return json({ error: 'Full name is required.' }, 400);

    // Find existing user by email
    let userId: string | null = null;
    let alreadyExisted = false;
    const { data: existingList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = existingList?.users?.find(u => (u.email || '').toLowerCase() === email);
    if (found) { userId = found.id; alreadyExisted = true; }

    const tempPassword = genPassword();

    if (!userId) {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password: tempPassword, email_confirm: true,
        user_metadata: { full_name: fullName, invited_as: 'support_agent' },
      });
      if (cErr || !created?.user) return json({ error: cErr?.message || 'Could not create user.' }, 500);
      userId = created.user.id;
    } else {
      await admin.auth.admin.updateUserById(userId, { password: tempPassword });
    }

    await admin.from('profiles').upsert({ id: userId, email, full_name: fullName }, { onConflict: 'id' });

    await admin.from('user_roles').upsert({ user_id: userId, role: 'support_agent' }, { onConflict: 'user_id,role' });

    const { data: agent, error: aErr } = await admin.from('support_agents').upsert({
      user_id: userId,
      display_name: displayName,
      is_active: true,
      is_supervisor: isSupervisor,
      max_concurrent_chats: maxConcurrent,
      password_reset_required: true,
      invited_at: new Date().toISOString(),
      invited_by: caller.user.id,
    }, { onConflict: 'user_id' }).select('id').single();
    if (aErr || !agent) return json({ error: aErr?.message || 'Could not create agent profile.' }, 500);

    if (departmentIds.length) {
      await admin.from('support_agent_departments').delete().eq('agent_id', agent.id);
      const rows = departmentIds.map(dId => ({ agent_id: agent.id, department_id: dId }));
      await admin.from('support_agent_departments').insert(rows);
    }

    let deptNames = '';
    if (departmentIds.length) {
      const { data: dn } = await admin.from('support_departments').select('name').in('id', departmentIds);
      deptNames = (dn || []).map((d: any) => d.name).join(', ');
    }

    const loginUrl = String(body.login_url || 'https://info.kangfintechsolutions.com/support-agent');

    const { data: inviterProf } = await admin.from('profiles')
      .select('full_name').eq('id', caller.user.id).maybeSingle();
    const inviterName = (inviterProf as any)?.full_name || caller.user.email || 'An administrator';

    const idempotencyKey = `support-invite-${userId}-${Date.now()}`;
    const sendRes = await admin.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'support-agent-invite',
        recipientEmail: email,
        idempotencyKey,
        templateData: {
          agentName: fullName, email, tempPassword, loginUrl, inviterName, departments: deptNames,
        },
      },
    });

    await admin.from('app_notifications').insert({
      user_id: userId,
      type: 'info',
      title: 'Welcome to the Support Team',
      message: `You have been invited as a support agent. Sign in at ${loginUrl} and update your password.`,
      icon: 'info',
      metadata: { event_type: 'support_agent_invited', login_url: loginUrl },
    });

    return json({
      ok: true,
      agent_id: agent.id,
      user_id: userId,
      already_existed: alreadyExisted,
      email_sent: !sendRes.error,
      email_error: sendRes.error?.message || null,
    });
  } catch (e: any) {
    return json({ error: e?.message || 'Unexpected error' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
