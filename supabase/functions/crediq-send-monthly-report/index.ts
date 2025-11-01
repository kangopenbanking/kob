import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id } = await req.json();

    // Check email preferences
    const { data: prefs } = await supabase
      .from('crediq_email_preferences')
      .select('monthly_report')
      .eq('user_id', user_id)
      .single();

    if (!prefs?.monthly_report) {
      return new Response(
        JSON.stringify({ success: false, message: 'User has disabled monthly reports' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user email
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    if (!userData || !userData.user?.email) {
      throw new Error('User email not found');
    }

    // Get current score
    const { data: scoreData } = await supabase
      .from('credit_scores')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .single();

    // Get 6-month history
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const { data: historyData } = await supabase
      .from('credit_score_history')
      .select('*')
      .eq('user_id', user_id)
      .gte('recorded_at', sixMonthsAgo.toISOString())
      .order('recorded_at', { ascending: true });

    // Calculate metrics
    const monthlyChange = historyData && historyData.length > 1
      ? (historyData[historyData.length - 1].score || 0) - (historyData[0].score || 0)
      : 0;

    // Get completed goals
    const { data: goalsData } = await supabase
      .from('credit_goals')
      .select('*')
      .eq('user_id', user_id)
      .not('achieved_at', 'is', null)
      .gte('achieved_at', sixMonthsAgo.toISOString());

    const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const dashboardUrl = `${supabaseUrl.replace('/functions/v1', '')}/crediq/dashboard`;

    // Send email
    await supabase.functions.invoke('send-communication', {
      body: {
        recipient_user_id: user_id,
        recipient_email: userData.user.email,
        communication_type: 'email',
        subject: `Your Monthly CrediQ Report - ${monthYear} 📈`,
        body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: "Inter", Arial, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #007A3D, #10B981); color: white; padding: 40px 30px; text-align: center; }
    .content { padding: 40px 30px; }
    .metric-card { background: #f9fafb; border: 2px solid #e5e7eb; padding: 20px; margin: 15px 0; border-radius: 12px; }
    .cta-button { background: #007A3D; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: 600; }
    .footer { background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 32px;">Your Monthly Report</h1>
      <p style="margin: 10px 0; font-size: 18px; opacity: 0.9;">${monthYear}</p>
      <div style="margin: 20px 0;">
        <div style="font-size: 56px; font-weight: bold;">${scoreData?.score || 'N/A'}</div>
        <div style="font-size: 24px; margin-top: 10px;">
          ${monthlyChange > 0 ? '📈 +' + monthlyChange : monthlyChange < 0 ? '📉 ' + monthlyChange : '→ 0'} this month
        </div>
      </div>
    </div>
    
    <div class="content">
      <h2>Key Metrics This Month</h2>
      
      <div class="metric-card">
        <h3 style="margin: 0 0 10px; color: #007A3D;">Score Changes</h3>
        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #1f2937;">${historyData?.length || 0}</p>
        <p style="margin: 5px 0 0; font-size: 14px; color: #6b7280;">Total updates this month</p>
      </div>
      
      <div class="metric-card">
        <h3 style="margin: 0 0 10px; color: #007A3D;">Goals Achieved</h3>
        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #1f2937;">${goalsData?.length || 0}</p>
        <p style="margin: 5px 0 0; font-size: 14px; color: #6b7280;">Milestones reached</p>
      </div>
      
      <h3>What's Next?</h3>
      <p style="font-size: 15px; line-height: 1.6; color: #374151;">
        Continue your credit journey by making on-time payments, maintaining low debt levels, and diversifying your accounts. 
        Your next score update is scheduled within 30 days.
      </p>
      
      <center>
        <a href="${dashboardUrl}" class="cta-button">View Full Dashboard</a>
      </center>
    </div>
    
    <div class="footer">
      <p style="margin: 0 0 15px;"><strong>CrediQ</strong> - Cameroon Credit Standard (CCS)</p>
      <p style="margin: 0 0 15px;">Powered by Kang Open Banking</p>
    </div>
  </div>
</body>
</html>
        `,
        metadata: {
          category: 'crediq',
          type: 'monthly_report',
          month: monthYear
        }
      }
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Monthly report sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending monthly report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
