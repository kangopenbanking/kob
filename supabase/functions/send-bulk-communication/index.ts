import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const SITE_NAME = "Kang OB";
const SENDER_DOMAIN = "notify.kangopenbanking.com";
const FROM_DOMAIN = "kangopenbanking.com";

interface BulkCommunicationRequest {
  template_key: string;
  recipient_filter: {
    type: 'all_institutions' | 'specific_institution' | 'all_users';
    institution_id?: string;
  };
  variables: Record<string, any>;
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

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (!roles || !roles.some(r => r.role === 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { template_key, recipient_filter, variables } = await req.json() as BulkCommunicationRequest;

    console.log('Starting bulk communication:', template_key, recipient_filter);

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

    // Get recipients based on filter
    let recipients: any[] = [];

    if (recipient_filter.type === 'all_institutions') {
      const { data: institutions } = await supabaseClient
        .from('institutions')
        .select(`
          id,
          user_id,
          institution_name,
          profiles!inner(email, full_name)
        `)
        .eq('status', 'approved');

      recipients = institutions || [];
    } else if (recipient_filter.type === 'specific_institution' && recipient_filter.institution_id) {
      const { data: institution } = await supabaseClient
        .from('institutions')
        .select(`
          id,
          user_id,
          institution_name,
          profiles!inner(email, full_name)
        `)
        .eq('id', recipient_filter.institution_id)
        .single();

      if (institution) recipients = [institution];
    } else if (recipient_filter.type === 'all_users') {
      const { data: users } = await supabaseClient
        .from('profiles')
        .select('*');

      recipients = users || [];
    }

    // Create bulk communication record
    const { data: bulkComm, error: bulkError } = await supabaseClient
      .from('bulk_communications')
      .insert({
        template_id: template.id,
        subject: replaceVariables(template.subject || '', variables),
        body: replaceVariables(template.body, variables),
        recipient_filter: recipient_filter,
        total_recipients: recipients.length,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (bulkError) {
      console.error('Failed to create bulk communication record:', bulkError);
      return new Response(
        JSON.stringify({ error: 'Failed to start bulk communication' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send emails via Lovable email queue
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        const email = recipient.profiles?.email || recipient.email;
        const name = recipient.profiles?.full_name || recipient.full_name || recipient.institution_name;

        if (!email) {
          failedCount++;
          continue;
        }

        const personalizedVars = {
          ...variables,
          contact_name: name,
          institution_name: recipient.institution_name || variables.institution_name,
        };

        const subject = replaceVariables(template.subject || '', personalizedVars);
        const body = replaceVariables(template.body, personalizedVars);

        const messageId = crypto.randomUUID();

        const { error: enqueueError } = await supabaseClient.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: email,
            from: `${SITE_NAME} <support@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: subject,
            html: body,
            text: subject,
            purpose: 'transactional',
            label: `bulk-${template_key}`,
            idempotency_key: `bulk-${bulkComm.id}-${messageId}`,
            queued_at: new Date().toISOString(),
          },
        });

        if (enqueueError) {
          failedCount++;
          console.error('Failed to enqueue to:', email, enqueueError);
        } else {
          sentCount++;

          await supabaseClient
            .from('communication_logs')
            .insert({
              template_id: template.id,
              recipient_type: 'institution',
              recipient_id: recipient.user_id || recipient.id,
              recipient_email: email,
              communication_type: 'email',
              subject: subject,
              body: body,
              status: 'sent',
              sent_at: new Date().toISOString(),
              metadata: { bulk_communication_id: bulkComm.id, variables: personalizedVars },
            });
        }
      } catch (error: any) {
        failedCount++;
        console.error('Error enqueuing for recipient:', error);
      }
    }

    // Update bulk communication record
    await supabaseClient
      .from('bulk_communications')
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', bulkComm.id);

    console.log(`Bulk communication completed: ${sentCount} enqueued, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Bulk communication started',
        bulk_id: bulkComm.id,
        total_recipients: recipients.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-bulk-communication function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
