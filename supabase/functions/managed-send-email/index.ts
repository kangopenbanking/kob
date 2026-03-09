import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
}): string {
  const logoBlock = opts.logoUrl
    ? `<img src="${opts.logoUrl}" alt="${opts.fromName}" style="max-height:48px;margin-bottom:16px;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" /><div style="display:none;font-size:22px;font-weight:700;color:${opts.primaryColor};">${opts.fromName}</div>`
    : `<div style="font-size:22px;font-weight:700;color:${opts.primaryColor};">${opts.fromName}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
  .email-wrapper{max-width:600px;margin:0 auto;background:#ffffff;}
  .email-header{padding:32px 40px 24px;text-align:center;border-bottom:3px solid ${opts.primaryColor};}
  .email-body{padding:32px 40px;color:#1f2937;font-size:15px;line-height:1.7;}
  .email-body p{margin:0 0 16px;}
  .email-body strong{color:#111827;}
  .email-body ul{margin:8px 0 16px;padding-left:20px;}
  .email-body li{margin-bottom:6px;}
  .email-footer{padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;}
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

    // 1. Fetch the email type definition
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

    // 2. Check for institution override
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

    // 3. Resolve recipient email
    let finalEmail = recipient_email;
    if (!finalEmail && recipient_user_id) {
      const { data: userData } = await supabase.auth.admin.getUserById(recipient_user_id);
      finalEmail = userData?.user?.email;
      if (!variables.customer_name && userData?.user?.user_metadata?.full_name) {
        variables.customer_name = userData.user.user_metadata.full_name;
      }
    }

    if (!finalEmail) throw new Error('No recipient email available');

    // 4. Get branding settings
    let branding = {
      logoUrl: 'https://kangopenbanking.com/kob-logo-email.png',
      primaryColor: '#007A3D',
      secondaryColor: '#1e3a8a',
      footerText: 'Powered by Kang Open Banking',
      fromName: 'Kang Open Banking',
    };

    if (institution_id) {
      // Customer-facing emails use institution branding
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

      // Get institution name for variables
      const { data: inst } = await supabase
        .from('institutions')
        .select('institution_name')
        .eq('id', institution_id)
        .single();

      if (inst && !variables.institution_name) {
        variables.institution_name = inst.institution_name;
      }
    }

    // 5. Replace variables
    const finalSubject = replaceVariables(subject, variables);
    const finalBody = replaceVariables(bodyHtml, variables);

    // 6. Wrap in professional layout
    const fullHtml = wrapInLayout(finalBody, branding);

    // 7. Send via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

    const resend = new Resend(resendApiKey);
    const fromAddress = Deno.env.get('RESEND_FROM') || `${branding.fromName} <noreply@kangopenbanking.com>`;

    const { error: sendErr } = await resend.emails.send({
      from: fromAddress,
      to: [finalEmail],
      subject: finalSubject,
      html: fullHtml,
    });

    const status = sendErr ? 'failed' : 'sent';

    // 8. Log
    await supabase.from('managed_email_logs').insert({
      email_type_id: emailType.id,
      institution_id: institution_id || null,
      recipient_user_id: recipient_user_id || null,
      recipient_email: finalEmail,
      subject: finalSubject,
      status,
      error_message: sendErr?.message || null,
      metadata: variables,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    });

    if (sendErr) {
      console.error('Email send error:', sendErr);
      return new Response(JSON.stringify({ success: false, error: sendErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`managed-send-email: ${email_key} sent to ${finalEmail}`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] managed-send-email error:`, err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.', error_id: errorId }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
