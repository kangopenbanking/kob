import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Star, Copy, Share2, Loader2, CheckCircle2, Banknote, UserPlus, Ticket, Tag, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { API_CONFIG } from '@/config/api';

const CustomerRewards: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [tab, setTab] = useState<'cashback' | 'coupons' | 'referrals'>('cashback');

  // Fetch all rewards from customer_rewards table
  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ['customer-rewards', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('customer_rewards')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch referrals made by this user
  const { data: referrals = [] } = useQuery({
    queryKey: ['customer-referrals', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('customer_referrals')
        .select('*')
        .eq('referrer_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Total transfers to check cashback eligibility
  const { data: transferStats } = useQuery({
    queryKey: ['transfer-stats', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user!.id)
        .eq('transaction_type', 'transfer')
        .eq('status', 'Booked');
      const total = (data || []).reduce((s, t) => s + Math.abs(t.amount || 0), 0);
      return { totalTransferred: total, count: data?.length || 0 };
    },
  });

  const cashbackRewards = rewards.filter((r: any) => r.reward_type === 'cashback');
  const referralRewards = rewards.filter((r: any) => r.reward_type === 'referral_bonus');
  const totalCashback = cashbackRewards.reduce((s: number, r: any) => s + (r.amount || 0), 0);
  const totalReferralBonus = referralRewards.reduce((s: number, r: any) => s + (r.amount || 0), 0);
  const totalEarned = rewards.reduce((s: number, r: any) => s + (r.amount || 0), 0);

  const referralLink = `${API_CONFIG.SITE_URL}/app/register?ref=${user?.id?.slice(0, 8)}`;

  const cashbackRate = 1;
  const cashbackMinTransfer = 10000;
  const referralBonus = 500;

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied!');
  };

  const shareReferralLink = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Join me!', text: 'Sign up and earn rewards', url: referralLink });
    } else {
      copyReferralLink();
    }
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Rewards</h1>
      </div>

      {/* Summary Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-[hsl(45,70%,90%)] p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/50">
            <Gift className="h-7 w-7 text-[hsl(45,60%,35%)]" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total Earned</p>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-1" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{totalEarned.toLocaleString()} XAF</p>
            )}
          </div>
        </div>
        {/* Breakdown mini stats */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-background/50 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground font-medium">Cashback</p>
            <p className="text-sm font-bold text-foreground">{totalCashback.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-background/50 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground font-medium">Referrals</p>
            <p className="text-sm font-bold text-foreground">{totalReferralBonus.toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-3 rounded-2xl bg-background/50 p-3">
          <p className="text-[11px] text-foreground font-medium">
            Earn <span className="font-bold">{cashbackRate}% cashback</span> on transfers over{' '}
            <span className="font-bold">{cashbackMinTransfer.toLocaleString()} XAF</span>
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex rounded-2xl bg-muted p-1">
        {(['cashback', 'coupons', 'referrals'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors ${tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            {t === 'cashback' ? 'Cashback' : t === 'coupons' ? 'Coupons' : 'Referrals'}
          </button>
        ))}
      </div>

      {tab === 'cashback' && (
        <div className="space-y-3">
          {/* Transfer milestone */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3 mb-3">
              <Banknote className="h-5 w-5 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />
              <div>
                <p className="text-xs font-bold text-foreground">Transfer Milestone</p>
                <p className="text-[11px] text-muted-foreground">
                  {(transferStats?.totalTransferred || 0).toLocaleString()} XAF transferred across {transferStats?.count || 0} transfers
                </p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(((transferStats?.totalTransferred || 0) / cashbackMinTransfer) * 100, 100)}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {(transferStats?.totalTransferred || 0) >= cashbackMinTransfer
                ? '✓ Eligible for cashback on future transfers'
                : `Transfer ${(cashbackMinTransfer - (transferStats?.totalTransferred || 0)).toLocaleString()} XAF more to unlock cashback`
              }
            </p>
          </div>

          {/* History */}
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Cashback History</p>
          {cashbackRewards.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Star className="h-10 w-10 text-muted-foreground" strokeWidth={1} />
              <p className="text-sm text-muted-foreground">No cashback earned yet</p>
              <p className="text-xs text-muted-foreground text-center">Make qualifying transfers to start earning</p>
            </div>
          ) : (
            cashbackRewards.map((r: any, i: number) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }} className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                <CheckCircle2 className="h-5 w-5 text-[hsl(150,60%,40%)] shrink-0" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{r.description || 'Cashback'}</p>
                  <p className="text-[10px] text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</p>
                </div>
                <span className="text-sm font-bold text-[hsl(150,60%,40%)]">+{(r.amount || 0).toLocaleString()}</span>
              </motion.div>
            ))
          )}
        </div>
      )}

      {tab === 'coupons' && (
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-3 py-10">
            <Tag className="h-10 w-10 text-muted-foreground" strokeWidth={1} />
            <p className="text-sm text-muted-foreground">No coupons available</p>
            <p className="text-xs text-muted-foreground text-center">Check back later for special offers</p>
          </div>
        </div>
      )}

      {tab === 'referrals' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-[hsl(210,80%,93%)] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/50">
                <UserPlus className="h-6 w-6 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Invite & Earn</p>
                <p className="text-[11px] text-muted-foreground">
                  Earn {referralBonus.toLocaleString()} XAF for each friend who signs up
                </p>
              </div>
            </div>

            {/* Referral link */}
            <div className="rounded-2xl bg-background/50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Your Referral Link</p>
              <p className="text-[11px] font-mono text-foreground break-all">{referralLink}</p>
            </div>

            <div className="flex gap-2 mt-3">
              <Button onClick={copyReferralLink} variant="outline" className="flex-1 rounded-2xl h-10 gap-2 text-xs">
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
              <Button onClick={shareReferralLink} className="flex-1 rounded-2xl h-10 gap-2 text-xs">
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
            </div>
          </div>

          {/* Referral Stats */}
          <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Friends Referred</p>
              <p className="text-2xl font-bold text-foreground">{referrals.length}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total Earned</p>
              <p className="text-2xl font-bold text-foreground">{totalReferralBonus.toLocaleString()} <span className="text-xs text-muted-foreground">XAF</span></p>
            </div>
          </div>

          {/* Referral history */}
          {referrals.length > 0 && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Referral History</p>
              {referrals.map((ref: any, i: number) => (
                <motion.div key={ref.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }} className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                  <UserPlus className="h-5 w-5 text-[hsl(210,60%,45%)] shrink-0" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">Friend joined</p>
                    <p className="text-[10px] text-muted-foreground">{ref.created_at ? new Date(ref.created_at).toLocaleDateString() : ''}</p>
                  </div>
                  <span className="text-sm font-bold text-[hsl(150,60%,40%)]">+{(ref.bonus_amount || 0).toLocaleString()}</span>
                </motion.div>
              ))}
            </>
          )}

          {/* How it works */}
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">How It Works</p>
          {[
            { step: '1', text: 'Share your unique referral link with friends' },
            { step: '2', text: 'They sign up and link their account' },
            { step: '3', text: `You both earn ${referralBonus.toLocaleString()} XAF` },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl bg-card border border-border p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{s.step}</span>
              <p className="text-xs text-foreground pt-0.5">{s.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerRewards;
