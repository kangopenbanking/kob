import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const SITE_NAME = "Kang OB";
const SENDER_DOMAIN = "notify.kangopenbanking.com";
const FROM_DOMAIN = "support.kangopenbanking.com";

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
    result = result.replace(regex, String(value || ''));
  }
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { template_key, recipient_email, recipient_phone, recipient_id, variables, test_mode } = await req.json() as CommunicationRequest;

    console.log('Sending communication with template:', template_key);

    // Fetch template
    const { data: template, error: templateError } = await supabaseClient
      .from('communication_templates')
      .select('*')
      .eq('template_key', template_key)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.error('Template not found:', templateError);
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Replace variables in subject and body
    const subject = template.subject ? replaceVariables(template.subject, variables) : '';
    const body = replaceVariables(template.body, variables);

    let success = false;
    let errorMessage = '';
    let sentAt = null;

    // Send email via Lovable email queue
    if (template.template_type === 'email' && recipient_email) {
      try {
        const messageId = crypto.randomUUID();

        const { error: enqueueError } = await supabaseClient.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: recipient_email,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: subject,
            html: body,
            text: subject,
            purpose: 'transactional',
            label: `communication-${template_key}`,
            idempotency_key: `comm-${template_key}-${messageId}`,
            queued_at: new Date().toISOString(),
          },
        });

        if (enqueueError) {
          errorMessage = enqueueError.message || 'Failed to enqueue email';
          console.error('Email enqueue error:', enqueueError);
        } else {
          success = true;
          sentAt = new Date().toISOString();
          console.log('Email enqueued successfully for:', recipient_email);
        }
      } catch (error: any) {
        errorMessage = error.message;
        console.error('Email enqueue failed:', error);
      }
    }

    // Send SMS (unchanged — still uses Vonage)
    if (template.template_type === 'sms' && recipient_phone) {
      try {
        const vonageApiKey = Deno.env.get('VONAGE_API_KEY');
        const vonageApiSecret = Deno.env.get('VONAGE_API_SECRET');

        const smsResponse = await fetch('https://rest.nexmo.com/sms/json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'OpenBanking',
            to: recipient_phone,
            text: body,
            api_key: vonageApiKey,
            api_secret: vonageApiSecret,
          }),
        });

        const smsResult = await smsResponse.json();

        if (smsResult.messages && smsResult.messages[0].status === '0') {
          success = true;
          sentAt = new Date().toISOString();
          console.log('SMS sent successfully to:', recipient_phone);
        } else {
          errorMessage = smsResult.messages?.[0]?.['error-text'] || 'SMS sending failed';
          console.error('SMS error:', errorMessage);
        }
      } catch (error: any) {
        errorMessage = error.message;
        console.error('SMS sending failed:', error);
      }
    }

    // Log communication
    const { error: logError } = await supabaseClient
      .from('communication_logs')
      .insert({
        template_id: template.id,
        recipient_type: recipient_id ? 'user' : 'external',
        recipient_id: recipient_id || null,
        recipient_email: recipient_email || null,
        recipient_phone: recipient_phone || null,
        communication_type: template.template_type,
        subject: subject || null,
        body: body,
        status: success ? 'sent' : 'failed',
        error_message: errorMessage || null,
        sent_at: sentAt,
        metadata: { variables },
      });

    if (logError) {
      console.error('Failed to log communication:', logError);
    }

    return new Response(
      JSON.stringify({
        success,
        message: success ? 'Communication sent successfully' : 'Communication failed',
        error: errorMessage || undefined,
      }),
      {
        status: success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Error in send-communication function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
