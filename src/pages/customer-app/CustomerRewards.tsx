import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Gift, Star, Copy, Share2, Loader2, CheckCircle2, Banknote, UserPlus, Ticket, Tag } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const CustomerRewards: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [tab, setTab] = useState<'cashback' | 'coupons' | 'referrals'>('cashback');

  // Fetch rewards config from institution
  const { data: rewardsConfig } = useQuery({
    queryKey: ['rewards-config', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data } = await supabase
        .from('institutions')
        .select('app_config')
        .eq('id', institutionId!)
        .maybeSingle();
      return (data as any)?.app_config?.customer_app_config?.rewards_config || {
        cashback_enabled: true,
        cashback_min_transfer: 10000,
        cashback_rate: 1,
        coupons: [],
        referral_bonus: 500,
        referral_enabled: true,
      };
    },
  });

  // Fetch user's earned cashback from transactions
  const { data: cashbackHistory = [], isLoading } = useQuery({
    queryKey: ['customer-cashback', user?.id, institutionId],
    enabled: !!user?.id && !!institutionId,
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('id, amount, currency, transaction_information, booking_datetime, metadata')
        .eq('user_id', user!.id)
        .eq('institution_id', institutionId!)
        .in('transaction_type', ['cashback', 'reward', 'referral_bonus'])
        .order('booking_datetime', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Total transfers to check cashback eligibility
  const { data: transferStats } = useQuery({
    queryKey: ['transfer-stats', user?.id, institutionId],
    enabled: !!user?.id && !!institutionId,
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user!.id)
        .eq('institution_id', institutionId!)
        .eq('transaction_type', 'transfer')
        .eq('status', 'Booked');
      const total = (data || []).reduce((s, t) => s + Math.abs(t.amount || 0), 0);
      return { totalTransferred: total, count: data?.length || 0 };
    },
  });

  const totalCashback = cashbackHistory.reduce((s, t: any) => s + Math.abs(t.amount || 0), 0);
  const referralLink = `${window.location.origin}/app/${institutionId}/register?ref=${user?.id?.slice(0, 8)}`;

  const coupons = rewardsConfig?.coupons || [];
  const activeCoupons = coupons.filter((c: any) => c.active);

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
              <p className="text-2xl font-bold text-foreground">{totalCashback.toLocaleString()} XAF</p>
            )}
          </div>
        </div>
        {rewardsConfig?.cashback_enabled && (
          <div className="mt-3 rounded-2xl bg-background/50 p-3">
            <p className="text-[11px] text-foreground font-medium">
              Earn <span className="font-bold">{rewardsConfig.cashback_rate || 1}% cashback</span> on transfers over{' '}
              <span className="font-bold">{(rewardsConfig.cashback_min_transfer || 10000).toLocaleString()} XAF</span>
            </p>
          </div>
        )}
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
                style={{ width: `${Math.min(((transferStats?.totalTransferred || 0) / (rewardsConfig?.cashback_min_transfer || 10000)) * 100, 100)}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {(transferStats?.totalTransferred || 0) >= (rewardsConfig?.cashback_min_transfer || 10000)
                ? '✓ Eligible for cashback on future transfers'
                : `Transfer ${((rewardsConfig?.cashback_min_transfer || 10000) - (transferStats?.totalTransferred || 0)).toLocaleString()} XAF more to unlock cashback`
              }
            </p>
          </div>

          {/* History */}
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Cashback History</p>
          {cashbackHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Star className="h-10 w-10 text-muted-foreground" strokeWidth={1} />
              <p className="text-sm text-muted-foreground">No cashback earned yet</p>
              <p className="text-xs text-muted-foreground text-center">Make qualifying transfers to start earning</p>
            </div>
          ) : (
            cashbackHistory.map((tx: any, i: number) => (
              <motion.div key={tx.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }} className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                <CheckCircle2 className="h-5 w-5 text-[hsl(150,60%,40%)] shrink-0" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{tx.transaction_information || 'Cashback'}</p>
                  <p className="text-[10px] text-muted-foreground">{tx.booking_datetime ? new Date(tx.booking_datetime).toLocaleDateString() : ''}</p>
                </div>
                <span className="text-sm font-bold text-[hsl(150,60%,40%)]">+{Math.abs(tx.amount || 0).toLocaleString()}</span>
              </motion.div>
            ))
          )}
        </div>
      )}

      {tab === 'coupons' && (
        <div className="space-y-3">
          {activeCoupons.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Tag className="h-10 w-10 text-muted-foreground" strokeWidth={1} />
              <p className="text-sm text-muted-foreground">No coupons available</p>
              <p className="text-xs text-muted-foreground text-center">Check back later for special offers</p>
            </div>
          ) : (
            activeCoupons.map((c: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }} className="rounded-3xl bg-[hsl(340,60%,92%)] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/50">
                    <Ticket className="h-5 w-5 text-[hsl(340,50%,40%)]" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">{c.description}</p>
                  </div>
                </div>
                {c.code && (
                  <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success('Code copied!'); }}
                    className="mt-3 w-full rounded-2xl bg-background/50 p-2.5 flex items-center justify-center gap-2">
                    <span className="text-xs font-mono font-bold text-foreground">{c.code}</span>
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </motion.div>
            ))
          )}
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
                  Earn {(rewardsConfig?.referral_bonus || 500).toLocaleString()} XAF for each friend who signs up
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

          {/* How it works */}
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">How It Works</p>
          {[
            { step: '1', text: 'Share your unique referral link with friends' },
            { step: '2', text: 'They sign up and link their account' },
            { step: '3', text: `You both earn ${(rewardsConfig?.referral_bonus || 500).toLocaleString()} XAF` },
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
