// Admin-only: send a one-off test email (arbitrary subject + HTML) via the
// Resend-first provider with Lovable Email fallback. Used by
// /admin/email-templates and any other admin tooling that needs to confirm
// a template renders and delivers without going through the production queue.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { loadProviderSettings, sendEmailWithFallback } from '../_shared/email-sender.ts';

const SENDER_DOMAIN = 'notify.info.kangfintechsolutions.com';
const SITE_NAME = 'Kang Open Banking';
const LOGO_URL = 'https://info.kangfintechsolutions.com/kfs-logo.png';
const PRIMARY = '#007A3D';

function wrap(subject: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${subject}</title>
<style>
  body{margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;}
  .wrap{max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;}
  .hd{padding:28px 40px 20px;text-align:center;border-bottom:3px solid ${PRIMARY};}
  .hd img{max-height:48px;margin-bottom:12px;}
  .hd .name{font-size:14px;font-weight:600;color:${PRIMARY};letter-spacing:0.3px;}
  .bd{padding:32px 40px;font-size:15px;line-height:1.7;}
  .bd h1,.bd h2,.bd h3{color:#111827;margin:0 0 16px;font-weight:600;}
  .bd p{margin:0 0 16px;}
  .bd a{color:${PRIMARY};text-decoration:none;}
  .bd strong{color:#111827;}
  .bd ul{margin:8px 0 16px;padding-left:20px;}
  .bd li{margin-bottom:6px;}
  .ft{padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;}
  .test-badge{display:inline-block;padding:4px 10px;background:#fef3c7;color:#92400e;border-radius:999px;font-size:11px;font-weight:600;margin-bottom:16px;letter-spacing:0.5px;text-transform:uppercase;}
</style></head><body>
<div class="wrap">
  <div class="hd"><img src="${LOGO_URL}" alt="${SITE_NAME}"/><div class="name">${SITE_NAME}</div></div>
  <div class="bd"><div class="test-badge">Test Email</div>${bodyHtml}</div>
  <div class="ft"><p style="margin:0 0 8px;">Powered by ${SITE_NAME} · info.kangfintechsolutions.com</p><p style="margin:0;">This is a test message dispatched from the admin console.</p></div>
</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const recipient = String(body.recipient_email || user.email || '').trim();
    const subject = String(body.subject || 'Test email from Kang Open Banking').trim();
    const rawHtml = String(body.body_html || body.html || '<p>This is a test email.</p>');
    const templateLabel = String(body.template_key || body.label || 'admin-test');

    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return new Response(JSON.stringify({ error: 'Valid recipient_email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const settings = await loadProviderSettings(admin);
    const fromEmail = settings.environment === 'production' ? settings.production_from_email : settings.sandbox_from_email;
    const fromName = settings.environment === 'production' ? settings.production_from_name : settings.sandbox_from_name;
    const messageId = crypto.randomUUID();

    // Get-or-create unsubscribe token (Lovable Email requires it for
    // transactional sends; Resend ignores it). One token per recipient address.
    const normalizedEmail = recipient.toLowerCase();
    let unsubscribeToken: string | undefined;
    try {
      const { data: existing } = await admin
        .from('email_unsubscribe_tokens')
        .select('token, used_at')
        .eq('email', normalizedEmail)
        .maybeSingle();
      if (existing?.token && !existing.used_at) {
        unsubscribeToken = existing.token;
      } else if (!existing) {
        const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        await admin
          .from('email_unsubscribe_tokens')
          .upsert({ token: newToken, email: normalizedEmail }, { onConflict: 'email', ignoreDuplicates: true });
        const { data: stored } = await admin
          .from('email_unsubscribe_tokens')
          .select('token')
          .eq('email', normalizedEmail)
          .maybeSingle();
        unsubscribeToken = stored?.token || newToken;
      }
    } catch (tokenErr) {
      console.error('admin-test-email unsubscribe token error:', tokenErr);
    }

    const result = await sendEmailWithFallback({
      to: recipient,
      from: `${fromName || SITE_NAME} <${fromEmail}>`,
      subject,
      html: wrap(subject, rawHtml),
      text: subject,
      sender_domain: SENDER_DOMAIN,
      purpose: 'transactional',
      label: `admin-test-${templateLabel}`,
      idempotency_key: `admin-test-${templateLabel}-${messageId}`,
      message_id: messageId,
      unsubscribe_token: unsubscribeToken,
    }, settings, { forceFallbackOn403: true });

    // Always return HTTP 200 so the Supabase Functions client surfaces the
    // structured JSON body to the admin UI instead of throwing a generic
    // "non-2xx" error. The `success` flag carries the real outcome.
    return new Response(JSON.stringify({
      success: result.ok,
      delivered: result.ok,
      provider: result.finalProvider,
      provider_status: result.ok ? 'sent' : 'failed',
      message_id: messageId,
      recipient,
      from: `${fromName} <${fromEmail}>`,
      environment: settings.environment,
      primary: result.primary,
      fallback: result.fallback,
      error: result.ok ? null : (result.fallback?.error || result.primary?.error || 'Unknown send error'),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('admin-test-email error:', e);
    return new Response(JSON.stringify({ success: false, error: e?.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
