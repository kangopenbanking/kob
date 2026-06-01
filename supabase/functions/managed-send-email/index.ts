import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { corsHeaders } from "../_shared/cors.ts";
import { loadProviderSettings, resolveFromAddress, sendEmailWithFallback } from "../_shared/email-sender.ts";

const SENDER_DOMAIN = "notify.info.kangfintechsolutions.com";

function replaceVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value ?? ''));
  }
  return result;
}

function wrapInLayout(bodyHtml: string, opts: {
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  footerText: string;
  fromName: string;
  subject: string;
}): string {
  const logoBlock = opts.logoUrl
    ? `<img src="${opts.logoUrl}" alt="${opts.fromName}" style="max-height:48px;margin-bottom:12px;" /><div style="font-size:14px;font-weight:600;color:${opts.primaryColor};letter-spacing:0.3px;">${opts.fromName}</div>`
    : `<div style="font-size:22px;font-weight:700;color:${opts.primaryColor};">${opts.fromName}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${opts.subject}</title>
<style>
  body{margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;}
  .email-wrapper{max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;}
  .email-header{padding:28px 40px 20px;text-align:center;border-bottom:3px solid ${opts.primaryColor};}
  .email-body{padding:32px 40px;color:#1f2937;font-size:15px;line-height:1.7;}
  .email-body h1,.email-body h2,.email-body h3{color:#111827;margin:0 0 16px;font-weight:600;}
  .email-body p{margin:0 0 16px;}
  .email-body a{color:${opts.primaryColor};text-decoration:none;}
  .email-body strong{color:#111827;}
  .email-body ul{margin:8px 0 16px;padding-left:20px;}
  .email-body li{margin-bottom:6px;}
  .email-cta{display:inline-block;padding:12px 24px;background:${opts.primaryColor};color:#ffffff !important;text-decoration:none;border-radius:6px;font-weight:600;margin:8px 0;}
  .email-footer{padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;}
  .email-footer a{color:${opts.primaryColor};text-decoration:none;}
</style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-header">${logoBlock}</div>
  <div class="email-body">${bodyHtml}</div>
  <div class="email-footer">
    <p style="margin:0 0 8px;">${opts.footerText}</p>
    <p style="margin:0;">This is an automated message. Please do not reply directly to this email.</p>
  </div>
</div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const {
      email_key,
      recipient_email,
      recipient_user_id,
      institution_id,
      variables = {},
    } = await req.json();

    if (!email_key) throw new Error('email_key is required');

    const { data: emailType, error: typeErr } = await supabase
      .from('managed_email_types')
      .select('*')
      .eq('email_key', email_key)
      .eq('is_active', true)
      .single();

    if (typeErr || !emailType) {
      return new Response(JSON.stringify({ error: `Email type '${email_key}' not found or inactive` }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let subject = emailType.default_subject;
    let bodyHtml = emailType.default_body_html;
    let isEnabled = true;

    if (institution_id) {
      const { data: override } = await supabase
        .from('institution_email_overrides')
        .select('*')
        .eq('institution_id', institution_id)
        .eq('email_type_id', emailType.id)
        .maybeSingle();

      if (override) {
        isEnabled = override.is_enabled;
        if (override.custom_subject) subject = override.custom_subject;
        if (override.custom_body_html) bodyHtml = override.custom_body_html;
      }
    }

    if (!isEnabled) {
      return new Response(JSON.stringify({ success: false, message: 'Email type disabled for this institution' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let finalEmail = recipient_email;
    if (!finalEmail && recipient_user_id) {
      const { data: userData } = await supabase.auth.admin.getUserById(recipient_user_id);
      finalEmail = userData?.user?.email;
      if (!variables.customer_name && userData?.user?.user_metadata?.full_name) {
        variables.customer_name = userData.user.user_metadata.full_name;
      }
    }

    if (!finalEmail) throw new Error('No recipient email available');

    let branding = {
      logoUrl: 'https://info.kangfintechsolutions.com/kfs-logo.png',
      primaryColor: '#007A3D',
      secondaryColor: '#1e3a8a',
      footerText: 'Powered by Kang Open Banking · info.kangfintechsolutions.com',
      fromName: 'Kang Open Banking',
    };

    if (institution_id) {
      const { data: instSettings } = await supabase
        .from('institution_email_settings')
        .select('*')
        .eq('institution_id', institution_id)
        .maybeSingle();

      if (instSettings) {
        if (instSettings.logo_url) branding.logoUrl = instSettings.logo_url;
        if (instSettings.primary_color) branding.primaryColor = instSettings.primary_color;
        if (instSettings.secondary_color) branding.secondaryColor = instSettings.secondary_color;
        if (instSettings.footer_text) branding.footerText = instSettings.footer_text;
        if (instSettings.from_name) branding.fromName = instSettings.from_name;
      }

      const { data: inst } = await supabase
        .from('institutions')
        .select('institution_name')
        .eq('id', institution_id)
        .single();

      if (inst && !variables.institution_name) {
        variables.institution_name = inst.institution_name;
      }
    }

    const finalSubject = replaceVariables(subject, variables);
    const finalBody = replaceVariables(bodyHtml, variables);
    const fullHtml = wrapInLayout(finalBody, { ...branding, subject: finalSubject });

    const messageId = crypto.randomUUID();

    await supabase.from('managed_email_logs').insert({
      email_type_id: emailType.id,
      institution_id: institution_id || null,
      recipient_user_id: recipient_user_id || null,
      recipient_email: finalEmail,
      subject: finalSubject,
      status: 'pending',
      error_message: null,
      metadata: { ...variables, message_id: messageId },
      sent_at: null,
    });

    // Send via Resend-first (Lovable Email fallback) so we get a live ack.
    const settings = await loadProviderSettings(supabase);
    const sendResult = await sendEmailWithFallback(
      {
        to: finalEmail,
        from: `${branding.fromName} <${settings.environment === 'production' ? settings.production_from_email : settings.sandbox_from_email}>`,
        subject: finalSubject,
        html: fullHtml,
        text: finalSubject,
        sender_domain: SENDER_DOMAIN,
        purpose: 'transactional',
        label: `managed-${email_key}`,
        idempotency_key: `managed-${email_key}-${messageId}`,
        message_id: messageId,
      },
      settings,
    );

    const delivered = sendResult.ok;
    await supabase.from('managed_email_logs').insert({
      email_type_id: emailType.id,
      institution_id: institution_id || null,
      recipient_user_id: recipient_user_id || null,
      recipient_email: finalEmail,
      subject: finalSubject,
      status: delivered ? 'sent' : 'failed',
      error_message: delivered ? null : (sendResult.primary?.error || sendResult.fallback?.error || 'Unknown send error'),
      metadata: {
        ...variables,
        message_id: messageId,
        provider: sendResult.finalProvider,
        primary_provider: sendResult.primary?.provider,
        primary_status: sendResult.primary?.status,
        fallback_provider: sendResult.fallback?.provider,
        fallback_status: sendResult.fallback?.status,
      },
      sent_at: delivered ? new Date().toISOString() : null,
    });

    console.log(`managed-send-email: ${email_key} → ${finalEmail} via ${sendResult.finalProvider} (ok=${delivered})`);

    return new Response(JSON.stringify({
      success: delivered,
      delivered,
      provider_status: delivered ? 'sent' : 'failed',
      provider: sendResult.finalProvider,
      message_id: messageId,
      primary: sendResult.primary,
      fallback: sendResult.fallback,
      error: delivered ? null : (sendResult.primary?.error || sendResult.fallback?.error || null),
    }), {
      status: delivered ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] managed-send-email error:`, err);
    return new Response(JSON.stringify({ success: false, error: err?.message || 'An internal error occurred.', error_id: errorId }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
