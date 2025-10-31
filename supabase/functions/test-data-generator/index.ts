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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || userRole.role !== 'admin') {
      throw new Error('Only admins can generate test data');
    }

    const { scenario = 'good_credit', clear_existing = false } = await req.json();

    console.log('Generating test data for scenario:', scenario);

    // Clear existing test data if requested
    if (clear_existing) {
      await supabase.from('loan_payments').delete().eq('user_id', user.id);
      await supabase.from('loan_accounts').delete().eq('user_id', user.id);
      await supabase.from('savings_transactions').delete().eq('user_id', user.id);
      await supabase.from('savings_accounts').delete().eq('user_id', user.id);
      await supabase.from('transactions').delete().eq('user_id', user.id);
    }

    const testData: any = { created: [] };

    // Create test data based on scenario
    switch (scenario) {
      case 'good_credit':
        // Create savings account
        const { data: savingsGood } = await supabase
          .from('savings_accounts')
          .insert({
            user_id: user.id,
            savings_product_id: (await supabase.from('savings_products').select('id').limit(1).single()).data?.id,
            account_number: `SAV${Date.now()}`,
            balance: 500000,
            interest_earned: 25000,
            status: 'active',
          })
          .select()
          .single();
        
        testData.created.push({ type: 'savings', id: savingsGood?.id });

        // Create loan with good payment history
        const { data: loanGood } = await supabase
          .from('loan_accounts')
          .insert({
            user_id: user.id,
            loan_product_id: (await supabase.from('loan_products').select('id').limit(1).single()).data?.id,
            loan_number: `LOAN${Date.now()}`,
            principal_amount: 100000,
            outstanding_balance: 20000,
            interest_rate: 12,
            loan_term_months: 12,
            monthly_payment: 10000,
            status: 'active',
          })
          .select()
          .single();

        testData.created.push({ type: 'loan', id: loanGood?.id });

        // Create on-time payments
        if (loanGood) {
          for (let i = 0; i < 8; i++) {
            await supabase.from('loan_payments').insert({
              loan_account_id: loanGood.id,
              user_id: user.id,
              payment_amount: 10000,
              payment_status: 'completed',
              payment_date: new Date(Date.now() - (i * 30 * 24 * 60 * 60 * 1000)).toISOString(),
            });
          }
        }
        break;

      case 'poor_credit':
        // Create loan with late payments
        const { data: loanPoor } = await supabase
          .from('loan_accounts')
          .insert({
            user_id: user.id,
            loan_product_id: (await supabase.from('loan_products').select('id').limit(1).single()).data?.id,
            loan_number: `LOAN${Date.now()}`,
            principal_amount: 100000,
            outstanding_balance: 95000,
            interest_rate: 18,
            loan_term_months: 12,
            monthly_payment: 12000,
            status: 'active',
          })
          .select()
          .single();

        testData.created.push({ type: 'loan', id: loanPoor?.id });

        // Create late/missed payments
        if (loanPoor) {
          for (let i = 0; i < 6; i++) {
            await supabase.from('loan_payments').insert({
              loan_account_id: loanPoor.id,
              user_id: user.id,
              payment_amount: i % 2 === 0 ? 12000 : 0,
              payment_status: i % 2 === 0 ? 'late' : 'failed',
              payment_date: new Date(Date.now() - (i * 30 * 24 * 60 * 60 * 1000)).toISOString(),
            });
          }
        }

        // Minimal savings
        await supabase.from('savings_accounts').insert({
          user_id: user.id,
          savings_product_id: (await supabase.from('savings_products').select('id').limit(1).single()).data?.id,
          account_number: `SAV${Date.now()}`,
          balance: 5000,
          interest_earned: 100,
          status: 'active',
        });
        break;

      case 'new_customer':
        // Create KYC but no financial history
        await supabase.from('kyc_verifications').upsert({
          user_id: user.id,
          full_name: 'Test User',
          status: 'approved',
          id_type: 'national_id',
          id_number: `TEST${Date.now()}`,
        });
        testData.created.push({ type: 'kyc', status: 'approved' });
        break;

      default:
        throw new Error('Invalid scenario');
    }

    // Generate regular transactions
    for (let i = 0; i < 20; i++) {
      await supabase.from('transactions').insert({
        user_id: user.id,
        account_id: (await supabase.from('accounts').select('id').eq('user_id', user.id).limit(1).single()).data?.id,
        amount: Math.random() * 50000,
        transaction_type: i % 2 === 0 ? 'credit' : 'debit',
        status: 'completed',
        description: `Test transaction ${i + 1}`,
      });
    }

    testData.created.push({ type: 'transactions', count: 20 });

    console.log('Test data generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        scenario,
        test_data: testData,
        message: 'Test data generated successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating test data:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to generate test data', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
