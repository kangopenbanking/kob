import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { force_refresh = false } = await req.json();

    console.log('Generating AI credit tips for user:', user.id);

    // Check for cached tips (valid for 7 days)
    if (!force_refresh) {
      const { data: cachedTips } = await supabase
        .from('credit_score_tips')
        .select('*')
        .eq('user_id', user.id)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      if (cachedTips && cachedTips.length > 0) {
        console.log('Returning cached tips');
        return new Response(
          JSON.stringify({ success: true, tips: cachedTips, cached: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get current credit score and components
    const { data: creditScore } = await supabase
      .from('credit_scores')
      .select('*')
      .eq('user_id', user.id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    if (!creditScore) {
      throw new Error('No credit score found. Please calculate your score first.');
    }

    const components = (creditScore.score_factors && creditScore.score_factors.components) || {
      payment_history_score: creditScore.payment_history_score,
      amounts_owed_score: creditScore.amounts_owed_score,
      credit_history_length_score: creditScore.credit_history_length_score,
      credit_mix_score: creditScore.credit_mix_score,
      new_credit_score: creditScore.new_credit_score,
      savings_behavior_score: creditScore.savings_behavior_score,
      transaction_pattern_score: creditScore.transaction_pattern_score,
      kyc_compliance_score: creditScore.kyc_compliance_score,
    };

    // Build context for AI
    const systemPrompt = `You are a financial advisor for Kang Open Banking in Cameroon. 
You provide personalized, actionable credit improvement tips to users based on their credit score components.
Currency is XAF (Central African Franc). Be specific with numbers and timelines.
Focus on realistic, achievable actions tailored to the Cameroon financial system.`;

    const userPrompt = `Generate 3-5 personalized credit improvement tips for a user with:
- Current Score: ${creditScore.score}/850
- Payment History: ${components.payment_history_score}/35 (weight: 30%)
- Amounts Owed: ${components.amounts_owed_score}/30 (weight: 25%)
- Credit History: ${components.credit_history_length_score}/15 (weight: 15%)
- Credit Mix: ${components.credit_mix_score}/10 (weight: 10%)
- New Credit: ${components.new_credit_score}/10 (weight: 8%)
- Savings Behavior: ${components.savings_behavior_score}/10 (weight: 10%)
- Transaction Patterns: ${components.transaction_pattern_score}/5 (weight: 8%)
- KYC Compliance: ${components.kyc_compliance_score}/2 (weight: 2%)

Confidence: ${creditScore.confidence_level}%

For each tip, provide:
1. A clear, specific action (e.g., "Pay off your XAF 50,000 loan within 60 days")
2. Estimated score impact (points gained)
3. Timeline (quick_win: 30 days, medium_term: 3-6 months, long_term: 6-12 months)
4. Priority (high/medium/low based on score component weakness)

Focus on the weakest components first. Return as JSON array with structure:
[
  {
    "tip": "Action description",
    "estimated_impact": 15,
    "timeline": "quick_win",
    "priority": "high",
    "category": "Payment History"
  }
]`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;

    // Parse AI response
    let tipsArray;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : aiContent;
      tipsArray = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response:', aiContent);
      throw new Error('Failed to parse AI tips');
    }

    // Store tips in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days cache

    const tipsToInsert = tipsArray.map((tip: any) => ({
      user_id: user.id,
      credit_score_id: creditScore.id,
      tip_category: tip.timeline,
      tip_content: tip.tip,
      estimated_impact: tip.estimated_impact,
      priority: tip.priority,
      expires_at: expiresAt.toISOString(),
    }));

    // Delete old tips
    await supabase
      .from('credit_score_tips')
      .delete()
      .eq('user_id', user.id);

    // Insert new tips
    const { data: insertedTips, error: insertError } = await supabase
      .from('credit_score_tips')
      .insert(tipsToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting tips:', insertError);
      throw insertError;
    }

    console.log('Generated and cached AI tips successfully');

    return new Response(
      JSON.stringify({
        success: true,
        tips: insertedTips,
        cached: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating credit tips:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to generate credit tips', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
