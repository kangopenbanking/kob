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
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      loan_product_id,
      requested_amount,
      tenure_months,
      purpose,
      repayment_frequency = 'monthly',
      employment_details,
      guarantors,
      collateral_details,
      supporting_documents,
      submit = false,
      institution_id,
    } = body;

    console.log('Creating loan application for user:', user.id);

    // Fetch credit score for auto-decision
    let creditScore = null;
    let autoDecision = null;
    let recommendedAmount = null;

    try {
      const { data: scoreData } = await supabase.functions.invoke('credit-score-fetch', {
        body: { user_id: user.id, include_report: false }
      });
      
      if (scoreData?.score) {
        creditScore = scoreData.score;
        
        // Automatic decision logic based on credit score
        if (creditScore >= 720) {
          autoDecision = 'pre_approved';
          recommendedAmount = requested_amount; // Full amount
        } else if (creditScore >= 650) {
          autoDecision = 'under_review';
          recommendedAmount = requested_amount * 0.7; // 70% of requested
        } else if (creditScore >= 580) {
          autoDecision = 'conditional';
          recommendedAmount = requested_amount * 0.5; // 50% of requested
        } else {
          autoDecision = 'requires_review';
          recommendedAmount = requested_amount * 0.3; // 30% of requested
        }
        
        console.log('Credit score checked:', creditScore, 'Auto-decision:', autoDecision);
      }
    } catch (scoreError) {
      console.error('Error fetching credit score:', scoreError);
      // Continue without credit score
    }

    // Validate loan product
    const { data: product, error: productError } = await supabase
      .from('loan_products')
      .select('*')
      .eq('id', loan_product_id)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      console.error('Invalid loan product:', productError);
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive loan product' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate amount and tenure
    if (requested_amount < product.min_amount || requested_amount > product.max_amount) {
      return new Response(
        JSON.stringify({ 
          error: `Amount must be between ${product.min_amount} and ${product.max_amount}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tenure_months < product.min_tenure_months || tenure_months > product.max_tenure_months) {
      return new Response(
        JSON.stringify({ 
          error: `Tenure must be between ${product.min_tenure_months} and ${product.max_tenure_months} months` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate application number
    const applicationNumber = `LA-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create application
    const applicationData = {
      application_number: applicationNumber,
      user_id: user.id,
      loan_product_id,
      requested_amount,
      tenure_months,
      purpose,
      repayment_frequency,
      employment_details,
      guarantors,
      collateral_details,
      supporting_documents,
      status: submit ? 'submitted' : 'draft',
      submitted_at: submit ? new Date().toISOString() : null,
      credit_score: creditScore,
      auto_decision: autoDecision,
      recommended_amount: recommendedAmount,
      institution_id: institution_id || null,
    };

    const { data: application, error: applicationError } = await supabase
      .from('loan_applications')
      .insert(applicationData)
      .select()
      .single();

    if (applicationError) {
      console.error('Error creating application:', applicationError);
      return new Response(
        JSON.stringify({ error: 'Failed to create loan application', details: applicationError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Loan application created successfully:', application.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        application,
        message: submit ? 'Application submitted successfully' : 'Application saved as draft'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
