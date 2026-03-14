import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    // Fetch dynamic config from system_config
    const { data: configRows } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['referral_bonus_amount', 'cashback_rate', 'cashback_min_transfer']);

    const cfg: Record<string, string> = {};
    (configRows || []).forEach((r: any) => { cfg[r.key] = r.value; });

    const { action, transaction_id, referral_code } = await req.json();

    if (action === 'cashback' && transaction_id) {
      const { data: existing } = await supabase
        .from('customer_rewards')
        .select('id')
        .eq('user_id', user.id)
        .eq('reward_type', 'cashback')
        .eq('reference_id', transaction_id)
        .maybeSingle();
      if (existing) throw new Error('Cashback already credited for this transaction');

      const { data: tx } = await supabase
        .from('transactions')
        .select('amount, currency, transaction_type, status')
        .eq('id', transaction_id)
        .eq('user_id', user.id)
        .single();
      if (!tx) throw new Error('Transaction not found');
      if (tx.status !== 'Booked') throw new Error('Transaction not booked');
      if (tx.transaction_type !== 'transfer') throw new Error('Only transfers qualify for cashback');

      const amount = Math.abs(tx.amount || 0);
      const minTransfer = Number(cfg.cashback_min_transfer) || 10000;
      const cashbackRate = Number(cfg.cashback_rate) || 1;

      if (amount < minTransfer) throw new Error(`Transfer must be at least ${minTransfer} ${tx.currency}`);

      const cashbackAmount = Math.floor(amount * cashbackRate / 100);

      const { data: reward, error: rewardErr } = await supabase
        .from('customer_rewards')
        .insert({
          user_id: user.id,
          reward_type: 'cashback',
          amount: cashbackAmount,
          currency: tx.currency || 'XAF',
          status: 'credited',
          description: `${cashbackRate}% cashback on ${amount.toLocaleString()} ${tx.currency || 'XAF'} transfer`,
          reference_id: transaction_id,
        })
        .select()
        .single();
      if (rewardErr) throw rewardErr;

      return new Response(JSON.stringify({
        success: true,
        reward,
        cashback_amount: cashbackAmount,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'referral' && referral_code) {
      // Find the referrer by code (first 8 chars of their user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .limit(100);

      const referrer = (profiles || []).find(p => p.id.slice(0, 8) === referral_code);
      if (!referrer) throw new Error('Invalid referral code');
      if (referrer.id === user.id) throw new Error('Cannot refer yourself');

      // Check if already referred
      const { data: existingRef } = await supabase
        .from('customer_referrals')
        .select('id')
        .eq('referred_id', user.id)
        .maybeSingle();
      if (existingRef) throw new Error('You have already been referred');

      const bonusAmount = 500;

      // Create referral record
      await supabase.from('customer_referrals').insert({
        referrer_id: referrer.id,
        referred_id: user.id,
        referral_code,
        bonus_amount: bonusAmount,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      // Credit both users
      await supabase.from('customer_rewards').insert([
        {
          user_id: referrer.id,
          reward_type: 'referral_bonus',
          amount: bonusAmount,
          currency: 'XAF',
          status: 'credited',
          description: `Referral bonus - new user signed up`,
          reference_id: user.id,
        },
        {
          user_id: user.id,
          reward_type: 'referral_bonus',
          amount: bonusAmount,
          currency: 'XAF',
          status: 'credited',
          description: `Welcome bonus via referral`,
          reference_id: referrer.id,
        },
      ]);

      return new Response(JSON.stringify({
        success: true,
        bonus_amount: bonusAmount,
        message: 'Referral bonus credited to both users',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error('Invalid action. Use "cashback" or "referral".');
  } catch (err: any) {
    console.error('rewards-process-cashback error:', err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
