import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, ...params } = body;

    if (!action) throw new Error('Missing action parameter');

    switch (action) {
      case 'send-welcome-email':
        return await handleWelcomeEmail(supabase, supabaseUrl, params);
      case 'send-score-change-email':
        return await handleScoreChangeEmail(supabase, supabaseUrl, params);
      case 'send-monthly-report':
        return await handleMonthlyReport(supabase, supabaseUrl, params);
      case 'send-weekly-digest':
        return await handleWeeklyDigest(supabase, supabaseUrl, params);
      case 'send-goal-achieved-email':
        return await handleGoalAchievedEmail(supabase, supabaseUrl, params);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error in crediq-emails:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function ok(data: any) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function getUserEmail(supabase: any, user_id: string) {
  const { data: userData } = await supabase.auth.admin.getUserById(user_id);
  if (!userData || !userData.user?.email) throw new Error('User email not found');
  return userData;
}

// ─── Welcome Email ───
async function handleWelcomeEmail(supabase: any, supabaseUrl: string, params: any) {
  const { user_id, baseline_score, credit_score } = params;
  const score = baseline_score || credit_score || 0;
  const userData = await getUserEmail(supabase, user_id);
  const userEmail = userData.user.email;
  const userName = userData.user.user_metadata?.full_name || 'there';

  let scoreRange = 'Fair';
  if (score >= 800) scoreRange = 'Excellent';
  else if (score >= 740) scoreRange = 'Very Good';
  else if (score >= 670) scoreRange = 'Good';
  else if (score >= 580) scoreRange = 'Fair';
  else scoreRange = 'Poor';

  const { data: actions } = await supabase
    .from('crediq_action_plans')
    .select('action_title, estimated_impact')
    .eq('user_id', user_id)
    .order('priority', { ascending: false })
    .limit(3);

  const firstActions = actions?.map((a: any) => `• ${a.action_title} (+${a.estimated_impact} points)`).join('\n') ||
    '• Complete your KYC verification\n• Open a savings account\n• Make on-time payments';

  const dashboardUrl = `${supabaseUrl}/crediq/dashboard`;
  const learnMoreUrl = `${supabaseUrl}/crediq/info`;

  await supabase.functions.invoke('send-communication', {
    body: {
      recipient_user_id: user_id,
      recipient_email: userEmail,
      communication_type: 'email',
      subject: `Welcome to CrediQ - Your Credit Journey Starts Here! 🚀`,
      body: `<!DOCTYPE html><html><head><style>body{font-family:'Inter',Arial,sans-serif;background:#f9fafb;margin:0;padding:0}.container{max-width:600px;margin:0 auto;background:white}.header{background:linear-gradient(135deg,#007A3D,#10B981);color:white;padding:40px 30px;text-align:center}.score-badge{background:white;color:#007A3D;font-size:56px;font-weight:bold;border-radius:50%;width:140px;height:140px;display:flex;align-items:center;justify-content:center;margin:20px auto;box-shadow:0 10px 40px rgba(0,0,0,0.2)}.content{padding:40px 30px}.action-box{background:#f3f4f6;padding:20px;margin:25px 0;border-radius:8px}.cta-button{background:#007A3D;color:white;padding:16px 32px;text-decoration:none;border-radius:8px;display:inline-block;margin:25px 0;font-weight:600}.footer{background:#f3f4f6;padding:30px;text-align:center;color:#6b7280;font-size:14px}h2{color:#1f2937;margin-top:0}</style></head><body><div class="container"><div class="header"><h1 style="margin:0;font-size:32px">Welcome to CrediQ!</h1><p style="margin:15px 0;font-size:18px">Your Cameroon Credit Standard Journey Starts Now</p><div class="score-badge">${score}</div><p style="margin:10px 0;font-size:20px;font-weight:600">${scoreRange}</p></div><div class="content"><h2>Hi ${userName}! 👋</h2><p style="font-size:16px;line-height:1.6">Congratulations on taking the first step toward financial empowerment! Your baseline CrediQ score is <strong>${score}</strong>, placing you in the <strong>${scoreRange}</strong> category.</p><h3>What happens next?</h3><p style="font-size:15px;line-height:1.6">Your CrediQ score will automatically update as you use Kang Open Banking services.</p><h3>Your First Actions</h3><div class="action-box"><p style="margin:0;font-size:15px;line-height:1.8;white-space:pre-line">${firstActions}</p></div><center><a href="${dashboardUrl}" class="cta-button">View Your Dashboard</a></center><hr style="margin:35px 0;border:none;border-top:1px solid #e5e7eb"><h3>Why CrediQ?</h3><ul style="font-size:15px;line-height:1.8"><li><strong>Free Forever:</strong> No hidden fees</li><li><strong>Real-Time Updates:</strong> Your score updates automatically</li><li><strong>Personalized Tips:</strong> AI-powered recommendations</li><li><strong>Better Loan Terms:</strong> Higher scores = lower interest rates</li></ul></div><div class="footer"><p style="margin:0 0 15px"><strong>CrediQ</strong> - Cameroon Credit Standard (CCS)</p><p style="margin:0 0 15px">Powered by Kang Open Banking</p><p style="font-size:11px;color:#9ca3af;margin:15px 0 0">This email was sent to ${userEmail}.</p></div></div></body></html>`,
      metadata: { category: 'crediq', type: 'welcome', baseline_score: score }
    }
  });

  return ok({ success: true, message: 'Welcome email sent' });
}

// ─── Score Change Email ───
async function handleScoreChangeEmail(supabase: any, supabaseUrl: string, params: any) {
  const { user_id, old_score, new_score, score_change, change_reason } = params;
  const userData = await getUserEmail(supabase, user_id);
  const userEmail = userData.user.email;
  const changeDirection = score_change > 0 ? 'up' : 'down';
  const changeEmoji = score_change > 0 ? '📈' : '📉';
  const changeMessage = score_change > 0
    ? `Great news! Your score increased by ${Math.abs(score_change)} points`
    : `Your score decreased by ${Math.abs(score_change)} points`;

  const { data: tipData } = await supabase.functions.invoke('credit-score-tips', { body: { user_id } });
  const personalizedTip = tipData?.tips?.[0] || 'Keep making on-time payments to improve your score.';

  const getScoreStatus = (score: number) => {
    if (score >= 800) return 'Excellent ✓';
    if (score >= 740) return 'Very Good ✓';
    if (score >= 670) return 'Good ✓';
    if (score >= 580) return 'Fair ⚠';
    return 'Poor ✗';
  };

  const dashboardUrl = `${supabaseUrl.replace('/functions/v1', '')}/crediq/dashboard`;

  await supabase.functions.invoke('send-communication', {
    body: {
      recipient_user_id: user_id,
      recipient_email: userEmail,
      communication_type: 'email',
      subject: `Your CrediQ Score ${changeDirection === 'up' ? 'Increased' : 'Decreased'}: ${changeEmoji} ${Math.abs(score_change)} points`,
      body: `<!DOCTYPE html><html><head><style>body{font-family:"Inter",Arial,sans-serif;background:#f9fafb;margin:0;padding:0}.container{max-width:600px;margin:0 auto;background:white}.header{background:linear-gradient(135deg,#007A3D,#10B981);color:white;padding:40px 30px;text-align:center}.score-badge{background:white;color:#007A3D;font-size:56px;font-weight:bold;border-radius:50%;width:140px;height:140px;display:flex;align-items:center;justify-content:center;margin:20px auto;box-shadow:0 10px 40px rgba(0,0,0,0.2)}.content{padding:40px 30px}.reason-box{background:#f3f4f6;border-left:4px solid #007A3D;padding:20px;margin:25px 0}.cta-button{background:#007A3D;color:white;padding:16px 32px;text-decoration:none;border-radius:8px;display:inline-block;margin:25px 0;font-weight:600}.tip-box{background:#FFFBEB;border:1px solid #FCD34D;padding:20px;margin:25px 0;border-radius:8px}.footer{background:#f3f4f6;padding:30px;text-align:center;color:#6b7280;font-size:14px}</style></head><body><div class="container"><div class="header"><h1 style="margin:0;font-size:32px">Your CrediQ Score Changed!</h1><div class="score-badge">${new_score}</div><div style="font-size:28px;margin:15px 0">${changeEmoji} ${Math.abs(score_change)} points</div><p style="margin:10px 0 0;font-size:16px;opacity:0.9">${changeMessage}</p></div><div class="content"><h2>What caused this change?</h2><div class="reason-box"><p style="margin:0;font-size:16px;line-height:1.6">${change_reason || 'Recent financial activity'}</p></div><h3>💡 Your Next Step</h3><div class="tip-box"><p style="margin:0;font-size:15px;line-height:1.6">${personalizedTip}</p></div><center><a href="${dashboardUrl}" class="cta-button">View Full Dashboard</a></center><h3>Your Credit Health Snapshot</h3><table style="width:100%;margin:20px 0"><tr style="border-bottom:1px solid #e5e7eb"><td style="padding:12px 0;font-size:15px">Overall Score</td><td style="padding:12px 0;text-align:right;font-weight:600;color:#3B82F6">${getScoreStatus(new_score)}</td></tr></table></div><div class="footer"><p style="margin:0 0 15px"><strong>CrediQ</strong> - Cameroon Credit Standard (CCS)</p><p style="margin:0 0 15px">Powered by Kang Open Banking</p><p style="font-size:11px;color:#9ca3af;margin:15px 0 0">This email was sent to ${userEmail}.</p></div></div></body></html>`,
      metadata: { category: 'crediq', type: 'score_change', old_score, new_score, score_change }
    }
  });

  return ok({ success: true, message: 'Score change email sent' });
}

// ─── Monthly Report ───
async function handleMonthlyReport(supabase: any, supabaseUrl: string, params: any) {
  const { user_id } = params;

  const { data: prefs } = await supabase
    .from('crediq_email_preferences').select('monthly_report').eq('user_id', user_id).single();
  if (!prefs?.monthly_report) return ok({ success: false, message: 'User has disabled monthly reports' });

  const userData = await getUserEmail(supabase, user_id);
  const { data: scoreData } = await supabase.from('credit_scores').select('*').eq('user_id', user_id).eq('status', 'active').single();

  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const { data: historyData } = await supabase.from('credit_score_history').select('*').eq('user_id', user_id).gte('recorded_at', sixMonthsAgo.toISOString()).order('recorded_at', { ascending: true });
  const monthlyChange = historyData && historyData.length > 1 ? (historyData[historyData.length - 1].score || 0) - (historyData[0].score || 0) : 0;

  const { data: goalsData } = await supabase.from('credit_goals').select('*').eq('user_id', user_id).not('achieved_at', 'is', null).gte('achieved_at', sixMonthsAgo.toISOString());

  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dashboardUrl = `${supabaseUrl.replace('/functions/v1', '')}/crediq/dashboard`;

  await supabase.functions.invoke('send-communication', {
    body: {
      recipient_user_id: user_id, recipient_email: userData.user.email, communication_type: 'email',
      subject: `Your Monthly CrediQ Report - ${monthYear} 📈`,
      body: `<!DOCTYPE html><html><head><style>body{font-family:"Inter",Arial,sans-serif;background:#f9fafb;margin:0;padding:0}.container{max-width:600px;margin:0 auto;background:white}.header{background:linear-gradient(135deg,#007A3D,#10B981);color:white;padding:40px 30px;text-align:center}.content{padding:40px 30px}.metric-card{background:#f9fafb;border:2px solid #e5e7eb;padding:20px;margin:15px 0;border-radius:12px}.cta-button{background:#007A3D;color:white;padding:16px 32px;text-decoration:none;border-radius:8px;display:inline-block;margin:20px 0;font-weight:600}.footer{background:#f3f4f6;padding:30px;text-align:center;color:#6b7280;font-size:14px}</style></head><body><div class="container"><div class="header"><h1 style="margin:0;font-size:32px">Your Monthly Report</h1><p style="margin:10px 0;font-size:18px;opacity:0.9">${monthYear}</p><div style="margin:20px 0"><div style="font-size:56px;font-weight:bold">${scoreData?.score || 'N/A'}</div><div style="font-size:24px;margin-top:10px">${monthlyChange > 0 ? '📈 +' + monthlyChange : monthlyChange < 0 ? '📉 ' + monthlyChange : '→ 0'} this month</div></div></div><div class="content"><h2>Key Metrics</h2><div class="metric-card"><h3 style="margin:0 0 10px;color:#007A3D">Score Changes</h3><p style="margin:0;font-size:32px;font-weight:bold">${historyData?.length || 0}</p></div><div class="metric-card"><h3 style="margin:0 0 10px;color:#007A3D">Goals Achieved</h3><p style="margin:0;font-size:32px;font-weight:bold">${goalsData?.length || 0}</p></div><center><a href="${dashboardUrl}" class="cta-button">View Full Dashboard</a></center></div><div class="footer"><p><strong>CrediQ</strong> - CCS</p><p>Powered by Kang Open Banking</p></div></div></body></html>`,
      metadata: { category: 'crediq', type: 'monthly_report', month: monthYear }
    }
  });

  return ok({ success: true, message: 'Monthly report sent' });
}

// ─── Weekly Digest ───
async function handleWeeklyDigest(supabase: any, supabaseUrl: string, params: any) {
  const { user_id } = params;

  const { data: prefs } = await supabase.from('crediq_email_preferences').select('weekly_digest').eq('user_id', user_id).single();
  if (!prefs?.weekly_digest) return ok({ success: false, message: 'User has disabled weekly digest' });

  const userData = await getUserEmail(supabase, user_id);
  const { data: scoreData } = await supabase.from('credit_scores').select('*').eq('user_id', user_id).eq('status', 'active').single();

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const { data: historyData } = await supabase.from('credit_score_history').select('*').eq('user_id', user_id).gte('recorded_at', oneWeekAgo.toISOString()).order('recorded_at', { ascending: false });
  const scoreTrend = historyData && historyData.length > 0 ? historyData.reduce((sum: number, h: any) => sum + (h.score_change || 0), 0) : 0;

  const { data: tipsData } = await supabase.functions.invoke('credit-score-tips', { body: { user_id } });
  const topTips = tipsData?.tips?.slice(0, 3) || [];

  const dashboardUrl = `${supabaseUrl.replace('/functions/v1', '')}/crediq/dashboard`;

  await supabase.functions.invoke('send-communication', {
    body: {
      recipient_user_id: user_id, recipient_email: userData.user.email, communication_type: 'email',
      subject: `Your Weekly Credit Health Update - CrediQ 📊`,
      body: `<!DOCTYPE html><html><head><style>body{font-family:"Inter",Arial,sans-serif;background:#f9fafb;margin:0;padding:0}.container{max-width:600px;margin:0 auto;background:white}.header{background:linear-gradient(135deg,#007A3D,#10B981);color:white;padding:40px 30px;text-align:center}.content{padding:40px 30px}.cta-button{background:#007A3D;color:white;padding:16px 32px;text-decoration:none;border-radius:8px;display:inline-block;margin:20px 0;font-weight:600}.footer{background:#f3f4f6;padding:30px;text-align:center;color:#6b7280;font-size:14px}</style></head><body><div class="container"><div class="header"><h1 style="margin:0 0 10px">Your Weekly Credit Update</h1><div style="font-size:48px;font-weight:bold;margin:10px 0">${scoreData?.score || 'N/A'}</div><div style="font-size:24px">${scoreTrend > 0 ? '📈 +' + scoreTrend : scoreTrend < 0 ? '📉 ' + scoreTrend : '→ No change'} this week</div></div><div class="content"><h2>This Week</h2><p>${historyData?.length || 0} score update(s)</p><h3>💡 Tips</h3><ul style="font-size:15px;line-height:1.8">${topTips.map((tip: string) => `<li>${tip}</li>`).join('')}</ul><center><a href="${dashboardUrl}" class="cta-button">View Dashboard</a></center></div><div class="footer"><p><strong>CrediQ</strong> - CCS</p><p>Powered by Kang Open Banking</p></div></div></body></html>`,
      metadata: { category: 'crediq', type: 'weekly_digest' }
    }
  });

  return ok({ success: true, message: 'Weekly digest sent' });
}

// ─── Goal Achieved Email ───
async function handleGoalAchievedEmail(supabase: any, supabaseUrl: string, params: any) {
  const { user_id, goal_id } = params;

  const { data: goalData } = await supabase.from('credit_goals').select('*').eq('id', goal_id).single();
  if (!goalData) throw new Error('Goal not found');

  const userData = await getUserEmail(supabase, user_id);
  const userName = userData.user.user_metadata?.full_name || 'there';
  const daysTaken = goalData.achieved_at
    ? Math.floor((new Date(goalData.achieved_at).getTime() - new Date(goalData.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const dashboardUrl = `${supabaseUrl.replace('/functions/v1', '')}/crediq/dashboard`;

  await supabase.functions.invoke('send-communication', {
    body: {
      recipient_user_id: user_id, recipient_email: userData.user.email, communication_type: 'email',
      subject: `🎉 Congratulations! You reached your CrediQ goal!`,
      body: `<!DOCTYPE html><html><head><style>body{font-family:"Inter",Arial,sans-serif;background:#f9fafb;margin:0;padding:0}.container{max-width:600px;margin:0 auto;background:white}.header{background:linear-gradient(135deg,#FFCD00,#FFA500);padding:40px 30px;text-align:center}.content{padding:40px 30px}.cta-button{background:#007A3D;color:white;padding:16px 32px;text-decoration:none;border-radius:8px;display:inline-block;margin:20px 0;font-weight:600}.footer{background:#f3f4f6;padding:30px;text-align:center;color:#6b7280;font-size:14px}</style></head><body><div class="container"><div class="header"><div style="font-size:80px;margin:20px 0">🎉🎊🎈</div><h1 style="margin:0;font-size:36px;color:#1f2937">Congratulations, ${userName}!</h1><p style="margin:15px 0;font-size:20px;color:#374151">You've achieved your credit goal!</p></div><div class="content"><h2 style="text-align:center;color:#007A3D">"${goalData.goal_title}"</h2><div style="display:flex;justify-content:space-around;margin:30px 0"><div style="text-align:center;padding:20px;background:#f9fafb;border-radius:12px;flex:1;margin:0 10px"><p style="margin:0;font-size:14px;color:#6b7280;font-weight:600">STARTED AT</p><p style="margin:10px 0;font-size:48px;font-weight:bold;color:#1f2937">${goalData.starting_score || 'N/A'}</p></div><div style="display:flex;align-items:center;font-size:32px;color:#10B981">→</div><div style="text-align:center;padding:20px;background:#f9fafb;border:2px solid #007A3D;border-radius:12px;flex:1;margin:0 10px"><p style="margin:0;font-size:14px;color:#6b7280;font-weight:600">ACHIEVED</p><p style="margin:10px 0;font-size:48px;font-weight:bold;color:#007A3D">${goalData.target_score}</p></div></div><div style="text-align:center;background:#f0fdf4;border:2px solid #10B981;padding:20px;border-radius:12px;margin:30px 0"><p style="margin:0;font-size:18px;font-weight:600;color:#047857">⏱️ Achieved in ${daysTaken} days!</p></div><center><a href="${dashboardUrl}" class="cta-button">Set Your Next Goal</a></center></div><div class="footer"><p><strong>CrediQ</strong> - CCS</p><p>Powered by Kang Open Banking</p></div></div></body></html>`,
      metadata: { category: 'crediq', type: 'goal_achieved', goal_title: goalData.goal_title }
    }
  });

  return ok({ success: true, message: 'Goal achievement email sent' });
}
