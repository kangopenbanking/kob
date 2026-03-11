import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Wallet, TrendingUp, ShoppingBag, Clock, ArrowUpRight, ChevronRight, Bell, BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessData } from '@/hooks/useBusinessData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sounds } from '@/lib/sounds';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const BusinessHome: React.FC = () => {
  const { merchantId } = useParams<{ merchantId?: string }>();
  const navigate = useNavigate();
  const basePath = merchantId ? `/biz/${merchantId}` : '/biz';
  const {
    merchant,
    availableBalance,
    pendingBalance,
    todayRevenue,
    todayOrders,
    charges,
    isLoading,
  } = useBusinessData(merchantId);
  const queryClient = useQueryClient();

  // Realtime payment notifications
  useEffect(() => {
    if (!merchantId) return;
    const channel = supabase
      .channel(`biz-payments-${merchantId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pos_order_payments',
        filter: `merchant_id=eq.${merchantId}`,
      }, (payload: any) => {
        if (payload.new?.status === 'succeeded') {
          const amount = payload.new.amount;
          sounds.success();
          toast.success(`Payment received: ${formatXAF(amount)}`, {
            description: `Via ${payload.new.method || 'wallet'}`,
          });
          queryClient.invalidateQueries({ queryKey: ['business-data', merchantId] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [merchantId, queryClient]);

  const formatXAF = (amount: number) =>
    new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(amount);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (isLoading) {
    return (
      <div className="p-5 space-y-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-[140px] rounded-3xl" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Today's Revenue", value: formatXAF(todayRevenue), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-500/10' },
    { label: "Today's Orders", value: todayOrders.toString(), icon: ShoppingBag, color: 'text-sky-600 bg-sky-500/10' },
    { label: 'Available', value: formatXAF(availableBalance), icon: Wallet, color: 'text-violet-600 bg-violet-500/10' },
    { label: 'Pending', value: formatXAF(pendingBalance), icon: Clock, color: 'text-amber-600 bg-amber-500/10' },
  ];

  const recentCharges = (charges || []).slice(0, 5);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-muted-foreground">{greeting()} 👋</p>
            <h1 className="text-xl font-bold tracking-tight text-foreground mt-0.5">
              {merchant?.business_name || 'Dashboard'}
            </h1>
          </div>
          <button
            onClick={() => navigate(`${basePath}/more`)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 transition-colors hover:bg-muted"
          >
            <Bell className="h-[1.1rem] w-[1.1rem] text-foreground" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-5 mt-4"
      >
        <div className="rounded-[1.5rem] bg-foreground p-5 text-background">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-background/60 uppercase tracking-widest">Total Balance</p>
            <button
              onClick={() => navigate(`${basePath}/wallet`)}
              className="flex items-center gap-1 rounded-full bg-background/10 px-3 py-1.5 text-[11px] font-semibold text-background/80 hover:bg-background/15 transition-colors"
            >
              Details <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          <p className="mt-3 text-[2rem] font-bold tracking-tight leading-none">
            {formatXAF(availableBalance + pendingBalance)}
          </p>
          <div className="mt-4 flex items-center gap-6">
            <div>
              <p className="text-[10px] text-background/50 uppercase tracking-wider">Available</p>
              <p className="text-sm font-semibold text-emerald-300 mt-0.5">{formatXAF(availableBalance)}</p>
            </div>
            <div className="h-6 w-px bg-background/15" />
            <div>
              <p className="text-[10px] text-background/50 uppercase tracking-wider">Pending</p>
              <p className="text-sm font-semibold text-amber-300 mt-0.5">{formatXAF(pendingBalance)}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="mx-5 mt-5 grid grid-cols-2 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
              className="rounded-2xl border border-border/50 bg-card p-4"
            >
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', s.color.split(' ')[1])}>
                <Icon className={cn('h-4 w-4', s.color.split(' ')[0])} strokeWidth={1.8} />
              </div>
              <p className="mt-3 text-lg font-bold tracking-tight text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Quick links */}
      <div className="mx-5 mt-5 flex gap-2.5 overflow-x-auto pb-1 hide-scrollbar">
        {[
          { label: 'Analytics', icon: BarChart3, path: `${basePath}/analytics` },
          { label: 'POS Till', icon: ShoppingBag, path: `${basePath}/till` },
          { label: 'Wallet', icon: Wallet, path: `${basePath}/wallet` },
        ].map(q => {
          const Icon = q.icon;
          return (
            <button
              key={q.label}
              onClick={() => navigate(q.path)}
              className="flex items-center gap-2 whitespace-nowrap rounded-full border border-border/50 bg-card px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted/50 active:scale-[0.97]"
            >
              <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} /> {q.label}
            </button>
          );
        })}
      </div>

      {/* Recent activity */}
      <div className="mx-5 mt-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-foreground">Recent Activity</h2>
          <button
            onClick={() => navigate(`${basePath}/orders`)}
            className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentCharges.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 py-10 text-center">
            <ShoppingBag className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">No activity yet today</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentCharges.map((charge: any, i: number) => (
              <motion.div
                key={charge.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3.5 rounded-xl p-3 transition-colors hover:bg-muted/40"
              >
                <div className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl',
                  charge.status === 'successful' ? 'bg-emerald-500/10' : 'bg-muted',
                )}>
                  <ArrowUpRight className={cn(
                    'h-4 w-4',
                    charge.status === 'successful' ? 'text-emerald-600' : 'text-muted-foreground',
                  )} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">
                    {charge.channel || 'Payment'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(charge.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <p className={cn(
                  'text-[13px] font-bold',
                  charge.status === 'successful' ? 'text-emerald-600' : 'text-muted-foreground',
                )}>
                  +{formatXAF(charge.amount || 0)}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessHome;
