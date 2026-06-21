import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { loadProviderSettings, sendEmailWithFallback } from "../_shared/email-sender.ts";

const SITE_NAME = "Kang Open Banking";
const SENDER_DOMAIN = "notify.info.kangfintechsolutions.com";

interface CommunicationRequest {
  template_key: string;
  recipient_email?: string;
  recipient_phone?: string;
  recipient_id?: string;
  variables: Record<string, any>;
  test_mode?: boolean;
}

function replaceVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(value ?? ''));
  }
  return result;
}

function wrapInLayout(bodyHtml: string, subject: string): string {
  const primary = '#007A3D';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${subject}</title>
<style>
  body{margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;}
  .wrap{max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;}
  .hd{padding:28px 40px 20px;text-align:center;border-bottom:3px solid ${primary};}
  .hd img{max-height:48px;margin-bottom:12px;}
  .hd .name{font-size:14px;font-weight:600;color:${primary};letter-spacing:0.3px;}
  .bd{padding:32px 40px;font-size:15px;line-height:1.7;}
  .bd a{color:${primary};text-decoration:none;}
  .ft{padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;}
</style></head><body>
<div class="wrap">
  <div class="hd"><img src="https://info.kangfintechsolutions.com/kfs-logo.png" alt="Kang Open Banking"/><div class="name">Kang Open Banking</div></div>
  <div class="bd">${bodyHtml}</div>
  <div class="ft"><p style="margin:0 0 8px;">Powered by Kang Open Banking · info.kangfintechsolutions.com</p><p style="margin:0;">This is an automated message. Please do not reply directly to this email.</p></div>
</div></body></html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { template_key, recipient_email, recipient_phone, recipient_id, variables } = await req.json() as CommunicationRequest;

    const { data: template, error: templateError } = await supabaseClient
      .from('communication_templates')
      .select('*')
      .eq('template_key', template_key)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      return new Response(JSON.stringify({ success: false, error: 'Template not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subject = template.subject ? replaceVariables(template.subject, variables) : '';
    const body = replaceVariables(template.body, variables);

    let success = false;
    let errorMessage = '';
    let sentAt: string | null = null;
    let providerName: string | null = null;
    let messageId: string | null = null;

    if (template.template_type === 'email' && recipient_email) {
      try {
        messageId = crypto.randomUUID();
        const settings = await loadProviderSettings(supabaseClient);
        const fromEmail = settings.environment === 'production' ? settings.production_from_email : settings.sandbox_from_email;
        const fromName = settings.environment === 'production' ? settings.production_from_name : settings.sandbox_from_name;

        // Provision an unsubscribe token (required by Lovable Email for transactional sends)
        const normalizedEmail = recipient_email.toLowerCase().trim();
        let unsubscribeToken: string | null = null;
        try {
          const { data: existing } = await supabaseClient
            .from('email_unsubscribe_tokens')
            .select('token')
            .eq('email', normalizedEmail)
            .maybeSingle();
          if (existing?.token) {
            unsubscribeToken = existing.token as string;
          } else {
            const newToken = crypto.randomUUID();
            const { error: upsertErr } = await supabaseClient
              .from('email_unsubscribe_tokens')
              .upsert({ email: normalizedEmail, token: newToken }, { onConflict: 'email' });
            if (!upsertErr) unsubscribeToken = newToken;
          }
        } catch (tokenErr) {
          console.warn('Unsubscribe token provisioning failed:', tokenErr);
        }

        const result = await sendEmailWithFallback({
          to: recipient_email,
          from: `${fromName || SITE_NAME} <${fromEmail}>`,
          subject,
          html: wrapInLayout(body, subject),
          text: subject,
          sender_domain: SENDER_DOMAIN,
          purpose: 'transactional',
          label: `communication-${template_key}`,
          idempotency_key: `comm-${template_key}-${messageId}`,
          message_id: messageId,
          unsubscribe_token: unsubscribeToken ?? undefined,
        }, settings, { forceFallbackOn403: true });

        if (result.ok) {
          success = true;
          providerName = result.finalProvider;
          sentAt = new Date().toISOString();
        } else {
          providerName = result.finalProvider ?? null;
          errorMessage = result.primary?.error || result.fallback?.error || 'Failed to send email';
        }
      } catch (error: any) {
        errorMessage = error.message || 'Email send failed';
        console.error('Email send failed:', error);
      }
    }

    if (template.template_type === 'sms' && recipient_phone) {
      try {
        const vonageApiKey = Deno.env.get('VONAGE_API_KEY');
        const vonageApiSecret = Deno.env.get('VONAGE_API_SECRET');
        const smsResponse = await fetch('https://rest.nexmo.com/sms/json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'OpenBanking', to: recipient_phone, text: body, api_key: vonageApiKey, api_secret: vonageApiSecret }),
        });
        const smsResult = await smsResponse.json();
        if (smsResult.messages && smsResult.messages[0].status === '0') {
          success = true;
          providerName = 'vonage';
          sentAt = new Date().toISOString();
        } else {
          errorMessage = smsResult.messages?.[0]?.['error-text'] || 'SMS sending failed';
        }
      } catch (error: any) {
        errorMessage = error.message;
      }
    }

    await supabaseClient.from('communication_logs').insert({
      template_id: template.id,
      recipient_type: recipient_id ? 'user' : 'external',
      recipient_id: recipient_id || null,
      recipient_email: recipient_email || null,
      recipient_phone: recipient_phone || null,
      communication_type: template.template_type,
      subject: subject || null,
      body,
      status: success ? 'sent' : 'failed',
      error_message: errorMessage || null,
      sent_at: sentAt,
      metadata: { variables, provider: providerName, message_id: messageId },
    });

    return new Response(JSON.stringify({
      success,
      delivered: success,
      provider_status: success ? 'sent' : 'failed',
      provider: providerName,
      message_id: messageId,
      message: success ? 'Communication sent successfully' : 'Communication failed',
      error: errorMessage || undefined,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error in send-communication function:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
