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

    const { user_id, baseline_score } = await req.json();

    // Get user email
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    if (!userData || !userData.user?.email) {
      throw new Error('User email not found');
    }

    const userEmail = userData.user.email;
    const userName = userData.user.user_metadata?.full_name || 'there';

    // Determine score range
    let scoreRange = 'Fair';
    if (baseline_score >= 800) scoreRange = 'Excellent';
    else if (baseline_score >= 740) scoreRange = 'Very Good';
    else if (baseline_score >= 670) scoreRange = 'Good';
    else if (baseline_score >= 580) scoreRange = 'Fair';
    else scoreRange = 'Poor';

    // Get first actions
    const { data: actions } = await supabase
      .from('crediq_action_plans')
      .select('action_title, estimated_impact')
      .eq('user_id', user_id)
      .order('priority', { ascending: false })
      .limit(3);

    const firstActions = actions?.map(a => `• ${a.action_title} (+${a.estimated_impact} points)`).join('\n') || 
      '• Complete your KYC verification\n• Open a savings account\n• Make on-time payments';

    const dashboardUrl = `${supabaseUrl}/crediq/dashboard`;
    const learnMoreUrl = `${supabaseUrl}/crediq/info`;

    // Send email via send-communication function
    await supabase.functions.invoke('send-communication', {
      body: {
        recipient_user_id: user_id,
        recipient_email: userEmail,
        communication_type: 'email',
        subject: `Welcome to CrediQ - Your Credit Journey Starts Here! 🚀`,
        body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Inter', Arial, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #007A3D, #10B981); color: white; padding: 40px 30px; text-align: center; }
    .score-badge { background: white; color: #007A3D; font-size: 56px; font-weight: bold; border-radius: 50%; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center; margin: 20px auto; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
    .content { padding: 40px 30px; }
    .action-box { background: #f3f4f6; padding: 20px; margin: 25px 0; border-radius: 8px; }
    .cta-button { background: #007A3D; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 25px 0; font-weight: 600; }
    .footer { background: #f3f4f6; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
    h2 { color: #1f2937; margin-top: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 32px;">Welcome to CrediQ!</h1>
      <p style="margin: 15px 0; font-size: 18px;">Your Cameroon Credit Standard Journey Starts Now</p>
      <div class="score-badge">${baseline_score}</div>
      <p style="margin: 10px 0; font-size: 20px; font-weight: 600;">${scoreRange}</p>
    </div>
    
    <div class="content">
      <h2>Hi ${userName}! 👋</h2>
      <p style="font-size: 16px; line-height: 1.6;">
        Congratulations on taking the first step toward financial empowerment! Your baseline CrediQ score 
        is <strong>${baseline_score}</strong>, placing you in the <strong>${scoreRange}</strong> category.
      </p>
      
      <h3>What happens next?</h3>
      <p style="font-size: 15px; line-height: 1.6;">
        Your CrediQ score will automatically update as you use Kang Open Banking services. Every loan payment, 
        savings deposit, and financial activity helps build a more accurate picture of your creditworthiness.
      </p>
      
      <h3>Your First Actions</h3>
      <div class="action-box">
        <p style="margin: 0; font-size: 15px; line-height: 1.8; white-space: pre-line;">${firstActions}</p>
      </div>
      
      <p style="font-size: 15px; line-height: 1.6;">
        <strong>Tip:</strong> We'll send you weekly updates and personalized recommendations to help you improve your score!
      </p>
      
      <center>
        <a href="${dashboardUrl}" class="cta-button">View Your Dashboard</a>
      </center>
      
      <hr style="margin: 35px 0; border: none; border-top: 1px solid #e5e7eb;">
      
      <h3>Why CrediQ?</h3>
      <ul style="font-size: 15px; line-height: 1.8;">
        <li><strong>Free Forever:</strong> No hidden fees, always accessible</li>
        <li><strong>Real-Time Updates:</strong> Your score updates automatically</li>
        <li><strong>Personalized Tips:</strong> AI-powered recommendations</li>
        <li><strong>Better Loan Terms:</strong> Higher scores = lower interest rates</li>
      </ul>
      
      <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
        Questions? Visit our <a href="${learnMoreUrl}" style="color: #007A3D;">help center</a> or reply to this email.
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 0 0 15px;"><strong>CrediQ</strong> - Cameroon Credit Standard (CCS)</p>
      <p style="margin: 0 0 15px;">Powered by Kang Open Banking</p>
      <p style="font-size: 11px; color: #9ca3af; margin: 15px 0 0;">
        This email was sent to ${userEmail}. You're receiving this because you completed the CrediQ questionnaire.
      </p>
    </div>
  </div>
</body>
</html>
        `,
        metadata: {
          category: 'crediq',
          type: 'welcome',
          baseline_score
        }
      }
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Welcome email sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
