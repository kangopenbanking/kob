// Admin-only: set an agent's password (custom or auto-generated) and optionally email it.
// - Generates a strong password if none provided
// - Sets password_reset_required=true so the agent must change on first login
// - Optionally emails the new credentials to the agent (reuses support-agent-invite template)
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function genPassword() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 12);
  return `Tmp-${b64.slice(0, 4)}-${b64.slice(4, 8)}-${b64.slice(8, 12)}`;
}

function isStrong(pw: string) {
  // min 8 chars, at least one letter and one number
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
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
    const agentId = body.agent_id ? String(body.agent_id) : null;
    if (!agentId) return json({ error: 'agent_id is required' }, 400);

    const sendEmail = body.send_email !== false; // default true
    const requestedPw = body.password ? String(body.password) : '';
    if (requestedPw && !isStrong(requestedPw)) {
      return json({ error: 'Password must be at least 8 characters and contain letters and numbers.' }, 400);
    }

    const { data: agentRow } = await admin.from('support_agents')
      .select('id, user_id, display_name').eq('id', agentId).maybeSingle();
    if (!agentRow) return json({ error: 'Agent not found' }, 404);

    const { data: prof } = await admin.from('profiles')
      .select('email, full_name').eq('id', agentRow.user_id).maybeSingle();
    const email = (prof?.email || '').toLowerCase();
    const fullName = prof?.full_name || agentRow.display_name || 'Support Agent';

    const newPassword = requestedPw || genPassword();

    const { error: updErr } = await admin.auth.admin.updateUserById(agentRow.user_id, {
      password: newPassword,
    });
    if (updErr) return json({ error: updErr.message }, 500);

    await admin.from('support_agents')
      .update({ password_reset_required: true })
      .eq('id', agentId);

    let email_sent = false;
    let email_error: string | null = null;
    if (sendEmail && email) {
      const CANONICAL = 'https://info.kangfintechsolutions.com/support-agent';
      const incoming = String(body.login_url || '');
      const loginUrl = (incoming && !/lovable\.app|localhost|127\.0\.0\.1/i.test(incoming))
        ? incoming
        : CANONICAL;

      const { data: inviterProf } = await admin.from('profiles')
        .select('full_name').eq('id', caller.user.id).maybeSingle();
      const inviterName = (inviterProf as any)?.full_name || caller.user.email || 'An administrator';

      const sendRes = await admin.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'support-agent-invite',
          recipientEmail: email,
          idempotencyKey: `support-pw-reset-${agentRow.user_id}-${Date.now()}`,
          templateData: {
            agentName: fullName, email, tempPassword: newPassword, loginUrl, inviterName,
          },
        },
        headers: { Authorization: `Bearer ${jwt}` },
      });
      email_sent = !sendRes.error;
      email_error = sendRes.error?.message || null;
      if (sendRes.error) console.error('[support-set-agent-password] email failed', sendRes.error);
    }

    // Always return the password so the admin can copy/share it manually if needed.
    return json({
      ok: true,
      password: newPassword,
      email_sent,
      email_error,
      generated: !requestedPw,
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
