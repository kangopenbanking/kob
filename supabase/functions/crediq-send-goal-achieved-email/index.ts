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

    const { user_id, goal_id } = await req.json();

    // Get goal details
    const { data: goalData } = await supabase
      .from('credit_goals')
      .select('*')
      .eq('id', goal_id)
      .single();

    if (!goalData) throw new Error('Goal not found');

    // Get user email
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    if (!userData || !userData.user?.email) {
      throw new Error('User email not found');
    }

    const userName = userData.user.user_metadata?.full_name || 'there';
    const daysTaken = goalData.achieved_at 
      ? Math.floor((new Date(goalData.achieved_at).getTime() - new Date(goalData.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const dashboardUrl = `${supabaseUrl.replace('/functions/v1', '')}/crediq/dashboard`;

    // Send email
    await supabase.functions.invoke('send-communication', {
      body: {
        recipient_user_id: user_id,
        recipient_email: userData.user.email,
        communication_type: 'email',
        subject: `🎉 Congratulations! You reached your CrediQ goal!`,
        body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: "Inter", Arial, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #FFCD00, #FFA500); padding: 40px 30px; text-align: center; }
    .celebration { font-size: 80px; margin: 20px 0; }
    .content { padding: 40px 30px; }
    .score-comparison { display: flex; justify-content: space-around; margin: 30px 0; }
    .score-box { text-align: center; padding: 20px; background: #f9fafb; border-radius: 12px; flex: 1; margin: 0 10px; }
    .cta-button { background: #007A3D; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: 600; }
    .footer { background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="celebration">🎉🎊🎈</div>
      <h1 style="margin: 0; font-size: 36px; color: #1f2937;">Congratulations, ${userName}!</h1>
      <p style="margin: 15px 0; font-size: 20px; color: #374151;">You've achieved your credit goal!</p>
    </div>
    
    <div class="content">
      <h2 style="text-align: center; color: #007A3D;">"${goalData.goal_title}"</h2>
      
      <div class="score-comparison">
        <div class="score-box">
          <p style="margin: 0; font-size: 14px; color: #6b7280; font-weight: 600;">STARTED AT</p>
          <p style="margin: 10px 0; font-size: 48px; font-weight: bold; color: #1f2937;">${goalData.starting_score || 'N/A'}</p>
        </div>
        <div style="display: flex; align-items: center; font-size: 32px; color: #10B981;">→</div>
        <div class="score-box" style="border: 2px solid #007A3D;">
          <p style="margin: 0; font-size: 14px; color: #6b7280; font-weight: 600;">ACHIEVED</p>
          <p style="margin: 10px 0; font-size: 48px; font-weight: bold; color: #007A3D;">${goalData.target_score}</p>
        </div>
      </div>
      
      <div style="text-align: center; background: #f0fdf4; border: 2px solid #10B981; padding: 20px; border-radius: 12px; margin: 30px 0;">
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #047857;">
          ⏱️ Achieved in ${daysTaken} days!
        </p>
      </div>
      
      <h3>What This Means for You</h3>
      <ul style="font-size: 15px; line-height: 1.8; color: #374151;">
        <li>✓ Access to better loan terms and lower interest rates</li>
        <li>✓ Higher approval chances for credit applications</li>
        <li>✓ Stronger financial reputation with lenders</li>
      </ul>
      
      <h3>Keep the Momentum Going</h3>
      <p style="font-size: 15px; line-height: 1.6; color: #374151;">
        Set a new goal and continue building your credit strength. Every point counts toward better financial opportunities!
      </p>
      
      <center>
        <a href="${dashboardUrl}" class="cta-button">Set Your Next Goal</a>
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
          type: 'goal_achieved',
          goal_title: goalData.goal_title
        }
      }
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Goal achievement email sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending goal achievement email:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
