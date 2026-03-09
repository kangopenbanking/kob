import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateRentReference(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `KRENTS${digits}`;
}

function generateSchedule(startDate: string, endDate: string | null, frequency: string, installmentAmount: number): { due_date: string; amount: number }[] {
  const payments: { due_date: string; amount: number }[] = [];
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  let current = new Date(start);

  while (current <= end) {
    payments.push({ due_date: current.toISOString().split('T')[0], amount: installmentAmount });
    if (frequency === 'daily') current.setDate(current.getDate() + 1);
    else if (frequency === 'weekly') current.setDate(current.getDate() + 7);
    else current.setMonth(current.getMonth() + 1);
  }
  return payments;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error('Unauthorized');

    const body = await req.json();
    const { plan_name, plan_type, target_amount, schedule_frequency, installment_amount, payment_method, start_date, end_date, institution_id, landlord_user_id } = body;

    if (!plan_name || !start_date || !installment_amount) throw new Error('Missing required fields');

    let rent_reference: string | null = null;
    if (plan_type === 'rent') {
      // Generate unique KRENTS reference
      for (let i = 0; i < 10; i++) {
        const candidate = generateRentReference();
        const { data: existing } = await supabase
          .from('piggybank_plans')
          .select('id')
          .eq('rent_reference', candidate)
          .maybeSingle();
        if (!existing) { rent_reference = candidate; break; }
      }
      if (!rent_reference) throw new Error('Could not generate unique rent reference');
    }

    const { data: plan, error: planErr } = await supabase
      .from('piggybank_plans')
      .insert({
        user_id: user.id,
        institution_id: institution_id || null,
        plan_name,
        plan_type: plan_type || 'savings',
        target_amount: target_amount || 0,
        schedule_frequency: schedule_frequency || 'monthly',
        installment_amount,
        payment_method: payment_method || null,
        start_date,
        end_date: end_date || null,
        rent_reference,
        landlord_user_id: landlord_user_id || null,
      })
      .select()
      .single();

    if (planErr) throw planErr;

    // Generate payment schedule
    const schedule = generateSchedule(start_date, end_date, schedule_frequency || 'monthly', installment_amount);
    if (schedule.length > 0) {
      const paymentRows = schedule.map(s => ({
        plan_id: plan.id,
        user_id: user.id,
        amount: s.amount,
        due_date: s.due_date,
        status: 'pending',
      }));
      await supabase.from('piggybank_payments').insert(paymentRows);
    }

    return new Response(JSON.stringify({
      plan,
      payments_generated: schedule.length,
      rent_reference,
      credit_impact_notice: plan_type === 'rent'
        ? 'Your rent payments will be reported to your credit score. On-time payments improve your score; missed payments will lower it.'
        : 'Your savings plan payments will be tracked for credit scoring. Consistent payments build your credit history.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('piggybank-create error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
