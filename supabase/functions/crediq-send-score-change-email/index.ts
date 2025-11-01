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

    const { user_id, old_score, new_score, score_change, change_reason } = await req.json();

    // Get user email
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    if (!userData || !userData.user?.email) {
      throw new Error('User email not found');
    }

    const userEmail = userData.user.email;
    const changeDirection = score_change > 0 ? 'up' : 'down';
    const changeEmoji = score_change > 0 ? '📈' : '📉';
    const changeMessage = score_change > 0 
      ? `Great news! Your score increased by ${Math.abs(score_change)} points` 
      : `Your score decreased by ${Math.abs(score_change)} points`;

    // Get personalized tip
    const { data: tipData } = await supabase.functions.invoke('credit-score-tips', {
      body: { user_id }
    });
    const personalizedTip = tipData?.tips?.[0] || 'Keep making on-time payments to improve your score.';

    // Determine status labels
    const getScoreStatus = (score: number) => {
      if (score >= 800) return 'Excellent ✓';
      if (score >= 740) return 'Very Good ✓';
      if (score >= 670) return 'Good ✓';
      if (score >= 580) return 'Fair ⚠';
      return 'Poor ✗';
    };

    const dashboardUrl = `${supabaseUrl.replace('/functions/v1', '')}/crediq/dashboard`;
    const preferencesUrl = `${supabaseUrl.replace('/functions/v1', '')}/crediq/settings`;
    const supportUrl = `${supabaseUrl.replace('/functions/v1', '')}/contact`;

    // Send email
    await supabase.functions.invoke('send-communication', {
      body: {
        recipient_user_id: user_id,
        recipient_email: userEmail,
        communication_type: 'email',
        subject: `Your CrediQ Score ${changeDirection === 'up' ? 'Increased' : 'Decreased'}: ${changeEmoji} ${Math.abs(score_change)} points`,
        body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: "Inter", Arial, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #007A3D, #10B981); color: white; padding: 40px 30px; text-align: center; }
    .score-badge { background: white; color: #007A3D; font-size: 56px; font-weight: bold; border-radius: 50%; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center; margin: 20px auto; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
    .change-indicator { font-size: 28px; margin: 15px 0; }
    .up { color: #10B981; }
    .down { color: #EF4444; }
    .content { padding: 40px 30px; }
    .reason-box { background: #f3f4f6; border-left: 4px solid #007A3D; padding: 20px; margin: 25px 0; }
    .cta-button { background: #007A3D; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 25px 0; font-weight: 600; }
    .tip-box { background: #FFFBEB; border: 1px solid #FCD34D; padding: 20px; margin: 25px 0; border-radius: 8px; }
    .footer { background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
    h2 { color: #1f2937; margin-top: 0; }
    h3 { color: #007A3D; font-size: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 32px;">Your CrediQ Score Changed!</h1>
      <div class="score-badge">${new_score}</div>
      <div class="change-indicator ${changeDirection}">
        ${changeEmoji} ${Math.abs(score_change)} points
      </div>
      <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">${changeMessage}</p>
    </div>
    
    <div class="content">
      <h2>What caused this change?</h2>
      <div class="reason-box">
        <p style="margin: 0; font-size: 16px; line-height: 1.6;">${change_reason || 'Recent financial activity'}</p>
      </div>
      
      <h3>💡 Your Next Step</h3>
      <div class="tip-box">
        <p style="margin: 0; font-size: 15px; line-height: 1.6;">${personalizedTip}</p>
      </div>
      
      <center>
        <a href="${dashboardUrl}" class="cta-button">View Full Dashboard</a>
      </center>
      
      <hr style="margin: 35px 0; border: none; border-top: 1px solid #e5e7eb;">
      
      <h3>Your Credit Health Snapshot</h3>
      <table style="width: 100%; margin: 20px 0;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 0; font-size: 15px;">Payment History</td>
          <td style="padding: 12px 0; text-align: right; font-weight: 600; color: #10B981;">${getScoreStatus(new_score)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 0; font-size: 15px;">Overall Score</td>
          <td style="padding: 12px 0; text-align: right; font-weight: 600; color: #3B82F6;">${getScoreStatus(new_score)}</td>
        </tr>
      </table>
      
      <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
        Your score is automatically updated when you make payments, open accounts, or complete verification steps. 
        Keep up the good work! 🎯
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 0 0 15px;"><strong>CrediQ</strong> - Cameroon Credit Standard (CCS)</p>
      <p style="margin: 0 0 15px;">Powered by Kang Open Banking</p>
      <p style="font-size: 12px; margin: 20px 0 10px;">
        <a href="${preferencesUrl}" style="color: #007A3D; text-decoration: none;">Email Preferences</a> | 
        <a href="${supportUrl}" style="color: #007A3D; text-decoration: none;">Support</a>
      </p>
      <p style="font-size: 11px; color: #9ca3af; margin: 15px 0 0;">
        This email was sent to ${userEmail}. You're receiving this because you have CrediQ enabled.
      </p>
    </div>
  </div>
</body>
</html>
        `,
        metadata: {
          category: 'crediq',
          type: 'score_change',
          old_score,
          new_score,
          score_change
        }
      }
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Score change email sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending score change email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
