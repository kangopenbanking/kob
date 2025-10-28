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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { principal, interest_rate, tenure_months, repayment_frequency = 'monthly' } = body;

    console.log('Calculating loan terms:', { principal, interest_rate, tenure_months, repayment_frequency });

    // Calculate processing fee (1% of principal)
    const processingFee = principal * 0.01;

    // Calculate monthly interest rate
    const monthlyRate = interest_rate / 100 / 12;

    // Calculate number of payments based on frequency
    let numberOfPayments = tenure_months;
    let paymentFrequencyRate = monthlyRate;

    switch (repayment_frequency) {
      case 'daily':
        numberOfPayments = tenure_months * 30;
        paymentFrequencyRate = interest_rate / 100 / 365;
        break;
      case 'weekly':
        numberOfPayments = tenure_months * 4;
        paymentFrequencyRate = interest_rate / 100 / 52;
        break;
      case 'biweekly':
        numberOfPayments = tenure_months * 2;
        paymentFrequencyRate = interest_rate / 100 / 26;
        break;
      case 'quarterly':
        numberOfPayments = Math.ceil(tenure_months / 3);
        paymentFrequencyRate = interest_rate / 100 / 4;
        break;
      default: // monthly
        numberOfPayments = tenure_months;
        paymentFrequencyRate = monthlyRate;
    }

    // Calculate EMI using reducing balance method
    const emi = (principal * paymentFrequencyRate * Math.pow(1 + paymentFrequencyRate, numberOfPayments)) /
      (Math.pow(1 + paymentFrequencyRate, numberOfPayments) - 1);

    // Calculate total payable
    const totalPayable = emi * numberOfPayments + processingFee;
    const totalInterest = totalPayable - principal - processingFee;

    // Generate amortization schedule
    const schedule = [];
    let remainingBalance = principal;

    for (let i = 1; i <= numberOfPayments; i++) {
      const interestDue = remainingBalance * paymentFrequencyRate;
      const principalDue = emi - interestDue;
      remainingBalance -= principalDue;

      schedule.push({
        installment_number: i,
        principal_due: Math.round(principalDue * 100) / 100,
        interest_due: Math.round(interestDue * 100) / 100,
        total_due: Math.round(emi * 100) / 100,
        outstanding_balance: Math.max(0, Math.round(remainingBalance * 100) / 100),
      });
    }

    const result = {
      principal,
      interest_rate,
      tenure_months,
      repayment_frequency,
      processing_fee: Math.round(processingFee * 100) / 100,
      emi: Math.round(emi * 100) / 100,
      total_interest: Math.round(totalInterest * 100) / 100,
      total_payable: Math.round(totalPayable * 100) / 100,
      number_of_payments: numberOfPayments,
      schedule,
    };

    console.log('Loan calculation completed:', result);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Calculation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to calculate loan terms', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
