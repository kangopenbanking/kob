import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Comprehensive sample variables for all template types
const getSampleVariables = (templateKey: string): Record<string, any> => {
  const baseVariables = {
    user_name: "John Doe",
    platform_name: "KOB Open Banking Platform",
    institution_name: "Test Financial Institution Ltd",
    contact_name: "Jane Smith",
    support_email: "support@kangopenbanking.com",
    support_phone: "+237 6XX XXX XXX",
    portal_url: "https://kangopenbanking.com/fi-portal",
    dashboard_url: "https://kangopenbanking.com/dashboard",
    verification_code: "123456",
    reset_link: "https://kangopenbanking.com/reset-password?token=sample_token_123",
    current_year: new Date().getFullYear().toString(),
  };

  // Category-specific variables
  const categoryVariables: Record<string, Record<string, any>> = {
    user_auth: {
      verification_link: "https://kangopenbanking.com/verify-email?token=sample",
      login_url: "https://kangopenbanking.com/auth",
    },
    institution_management: {
      institution_type: "Commercial Bank",
      license_number: "CB-2025-001",
      registration_date: new Date().toLocaleDateString(),
      rejection_reason: "Incomplete documentation - missing business license",
      status: "Under Review",
      status_details: "Your application is being reviewed by our compliance team",
    },
    kyc_verification: {
      document_type: "National ID Card",
      submission_date: new Date().toLocaleDateString(),
      verification_date: new Date().toLocaleDateString(),
      required_documents: "Proof of address, Business registration certificate",
      upload_link: "https://kangopenbanking.com/kyc/upload",
    },
    loan_management: {
      loan_id: "LOAN-2025-001234",
      loan_amount: "5,000,000 XAF",
      loan_type: "Personal Loan",
      interest_rate: "12%",
      loan_term: "24 months",
      approval_date: new Date().toLocaleDateString(),
      payment_amount: "250,000 XAF",
      payment_due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      days_overdue: "3",
    },
    transaction_alerts: {
      transaction_id: "TXN-2025-567890",
      transaction_amount: "1,500,000 XAF",
      transaction_date: new Date().toLocaleDateString(),
      transaction_type: "Bank Transfer",
      account_number: "****5678",
      recipient_name: "ABC Corporation",
      reason: "Unusual transaction pattern detected",
      sender_name: "Test Sender Ltd",
    },
    consent_management: {
      consent_id: "CONSENT-2025-ABC123",
      tpp_name: "FinTech Solutions Ltd",
      consent_type: "Account Information",
      permissions: "View balances, View transactions",
      expiry_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      granted_date: new Date().toLocaleDateString(),
      revoked_date: new Date().toLocaleDateString(),
      consent_scope: "Read account information and transaction history",
    },
    compliance_reporting: {
      report_month: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      report_type: "Monthly Compliance Summary",
      total_transactions: "1,234",
      flagged_transactions: "12",
      report_url: "https://kangopenbanking.com/reports/monthly-compliance.pdf",
      retention_period: "7 years",
      data_categories: "Transaction history, KYC documents, Audit logs",
      deletion_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    },
    payment_notifications: {
      payment_id: "PAY-2025-789012",
      payment_amount: "750,000 XAF",
      payment_method: "Mobile Money",
      payment_date: new Date().toLocaleDateString(),
      payment_status: "Completed",
      recipient: "Utility Company Ltd",
      failure_reason: "Insufficient funds in account",
      retry_link: "https://kangopenbanking.com/payments/retry",
    },
    credit_score: {
      credit_score: "725",
      score_range: "Good (670-739)",
      score_date: new Date().toLocaleDateString(),
      view_score_url: "https://kangopenbanking.com/credit-score",
      old_score: "698",
      new_score: "725",
      score_change: "+27",
      change_reason: "Consistent on-time payments and reduced credit utilization",
    },
    webhook_notification: {
      webhook_url: "https://api.example.com/webhooks/kob",
      event_type: "payment.completed",
      failure_count: "3",
      last_error: "Connection timeout after 30 seconds",
      webhook_id: "WEBHOOK-2025-XYZ789",
    },
    system_maintenance: {
      maintenance_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      maintenance_time: "02:00 AM - 06:00 AM GMT+1",
      affected_services: "API endpoints, Mobile app, Web portal",
      estimated_duration: "4 hours",
      status_page: "https://status.kangopenbanking.com",
    },
  };

  // Merge base variables with category-specific ones
  return {
    ...baseVariables,
    ...(categoryVariables[templateKey.split('_').slice(0, -1).join('_')] || {}),
  };
};

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
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roles, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError || !roles?.some(r => r.role === 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { test_email } = await req.json();
    const targetEmail = test_email || 'umojami@gmail.com';

    console.log(`Starting to send all templates to: ${targetEmail}`);

    // Fetch all active email templates
    const { data: templates, error: templatesError } = await supabaseClient
      .from('communication_templates')
      .select('*')
      .eq('is_active', true)
      .eq('template_type', 'email')
      .order('category', { ascending: true })
      .order('template_key', { ascending: true });

    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch templates' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Send each template
    for (const template of templates) {
      try {
        console.log(`Sending template: ${template.template_key}`);
        
        const variables = getSampleVariables(template.template_key);
        
        // Call the send-communication function
        const { data: sendResult, error: sendError } = await supabaseClient.functions.invoke(
          'send-communication',
          {
            body: {
              template_key: template.template_key,
              recipient_email: targetEmail,
              variables: variables,
            },
          }
        );

        if (sendError) {
          console.error(`Failed to send ${template.template_key}:`, sendError);
          failureCount++;
          results.push({
            template_key: template.template_key,
            template_name: template.template_name,
            category: template.category,
            status: 'failed',
            error: sendError.message,
          });
        } else {
          console.log(`Successfully sent ${template.template_key}`);
          successCount++;
          results.push({
            template_key: template.template_key,
            template_name: template.template_name,
            category: template.category,
            status: 'sent',
          });
        }

        // Small delay to avoid overwhelming the email service
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`Error sending ${template.template_key}:`, error);
        failureCount++;
        results.push({
          template_key: template.template_key,
          template_name: template.template_name,
          category: template.category,
          status: 'failed',
          error: error.message,
        });
      }
    }

    const summary = {
      test_email: targetEmail,
      total_templates: templates.length,
      sent: successCount,
      failed: failureCount,
      results: results,
      timestamp: new Date().toISOString(),
    };

    console.log('Test complete:', summary);

    return new Response(
      JSON.stringify(summary),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: any) {
    console.error('Error in test-all-templates function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
