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
      .select('weekly_digest')
      .eq('user_id', user_id)
      .single();

    if (!prefs?.weekly_digest) {
      return new Response(
        JSON.stringify({ success: false, message: 'User has disabled weekly digest' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user email and current score
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    if (!userData || !userData.user?.email) {
      throw new Error('User email not found');
    }

    const { data: scoreData } = await supabase
      .from('credit_scores')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .single();

    // Get week's score changes
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { data: historyData } = await supabase
      .from('credit_score_history')
      .select('*')
      .eq('user_id', user_id)
      .gte('recorded_at', oneWeekAgo.toISOString())
      .order('recorded_at', { ascending: false });

    const scoreTrend = historyData && historyData.length > 0 
      ? historyData.reduce((sum, h) => sum + (h.score_change || 0), 0)
      : 0;

    // Get active goals
    const { data: goalsData } = await supabase
      .from('credit_goals')
      .select('*')
      .eq('user_id', user_id)
      .is('achieved_at', null)
      .order('created_at', { ascending: false });

    const goalsProgress = goalsData?.map(g => ({
      title: g.goal_title,
      target: g.target_score,
      current: scoreData?.score || 0,
      progress: Math.min(100, ((scoreData?.score || 0) / g.target_score) * 100)
    })) || [];

    // Get top tips
    const { data: tipsData } = await supabase.functions.invoke('credit-score-tips', {
      body: { user_id }
    });
    const topTips = tipsData?.tips?.slice(0, 3) || [];

    const dashboardUrl = `${supabaseUrl.replace('/functions/v1', '')}/crediq/dashboard`;
    const preferencesUrl = `${supabaseUrl.replace('/functions/v1', '')}/crediq/settings`;

    // Send email
    await supabase.functions.invoke('send-communication', {
      body: {
        recipient_user_id: user_id,
        recipient_email: userData.user.email,
        communication_type: 'email',
        subject: `Your Weekly Credit Health Update - CrediQ 📊`,
        body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: "Inter", Arial, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #007A3D, #10B981); color: white; padding: 40px 30px; text-align: center; }
    .score-badge { background: white; color: #007A3D; font-size: 48px; font-weight: bold; border-radius: 16px; padding: 20px 30px; display: inline-block; margin: 10px 0; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .trend { font-size: 24px; margin: 10px 0; }
    .content { padding: 40px 30px; }
    .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 15px 0; border-radius: 8px; }
    .cta-button { background: #007A3D; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: 600; }
    .footer { background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0 0 10px;">Your Weekly Credit Update</h1>
      <p style="margin: 0; opacity: 0.9;">Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      <div class="score-badge">${scoreData?.score || 'N/A'}</div>
      <div class="trend">
        ${scoreTrend > 0 ? '📈 +' + scoreTrend : scoreTrend < 0 ? '📉 ' + scoreTrend : '→ No change'} this week
      </div>
    </div>
    
    <div class="content">
      <h2>This Week's Highlights</h2>
      <div class="stat-card">
        <h3 style="margin: 0 0 10px;">Activity Summary</h3>
        <p style="margin: 0; font-size: 15px; color: #6b7280;">
          ${historyData?.length || 0} score update${historyData?.length !== 1 ? 's' : ''} this week
        </p>
      </div>
      
      ${goalsProgress.length > 0 ? `
      <h3>Your Goals Progress</h3>
      ${goalsProgress.map(g => `
        <div class="stat-card">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <strong>${g.title}</strong>
            <span>${g.current} / ${g.target}</span>
          </div>
          <div style="background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
            <div style="background: #007A3D; height: 100%; width: ${g.progress}%;"></div>
          </div>
        </div>
      `).join('')}
      ` : ''}
      
      <h3>💡 Top Tips for This Week</h3>
      <ul style="font-size: 15px; line-height: 1.8; color: #374151;">
        ${topTips.map((tip: string) => `<li>${tip}</li>`).join('')}
      </ul>
      
      <center>
        <a href="${dashboardUrl}" class="cta-button">View Full Dashboard</a>
      </center>
    </div>
    
    <div class="footer">
      <p style="margin: 0 0 15px;"><strong>CrediQ</strong> - Cameroon Credit Standard (CCS)</p>
      <p style="margin: 0 0 15px;">Powered by Kang Open Banking</p>
      <p style="font-size: 11px; color: #9ca3af; margin: 15px 0 0;">
        Sent every Monday. <a href="${preferencesUrl}" style="color: #007A3D;">Manage preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
        `,
        metadata: {
          category: 'crediq',
          type: 'weekly_digest'
        }
      }
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Weekly digest sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending weekly digest:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
