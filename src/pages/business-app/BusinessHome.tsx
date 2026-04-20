import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, TrendingUp, ShoppingBag, Clock, ArrowUpRight, ChevronRight,
  BarChart3, ScanLine, Monitor, QrCode, Mail, Bell, Users, Package,
  Receipt, Star, ShieldCheck, Plane, Tag, RefreshCw, MessageSquare,
  FileText, Building2, Plus, Send,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessData } from '@/hooks/useBusinessData';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sounds } from '@/lib/sounds';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { PageGuide } from '@/components/business-app/PageGuide';

const BusinessHome: React.FC = () => {
  const { merchantId } = useMerchantContext();
  const navigate = useNavigate();
  const basePath = '/biz';
  const {
    merchant,
    availableBalance,
    pendingBalance,
    todayRevenue,
    todayOrders,
    charges,
    isLoading,
    walletsLoading,
  } = useBusinessData(merchantId);
  const queryClient = useQueryClient();

  // ─── Notifications (in-app) ─────────────────────────────────────────
  const { data: notifications = [] } = useQuery({
    queryKey: ['biz-notifications', merchantId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from('app_notifications')
        .select('id, title, message, type, created_at, is_read')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!merchantId,
    staleTime: 30 * 1000,
  });
  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  // ─── Email send log (recent transactional sends) ────────────────────
  const { data: emailLog = [] } = useQuery({
    queryKey: ['biz-email-log', merchantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('email_send_log')
        .select('id, recipient_email, template_name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!merchantId,
    staleTime: 60 * 1000,
  });

  // Realtime sync
  useEffect(() => {
    if (!merchantId) return;

    const refreshAll = () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-wallets', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant-charges', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant-settlements', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant-payouts', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['biz-notifications', merchantId] });
    };

    const channel = supabase
      .channel(`biz-sync-${merchantId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'pos_order_payments',
        filter: `merchant_id=eq.${merchantId}`,
      }, (payload: any) => {
        if (payload.new?.status === 'succeeded') {
          sounds.success();
          toast.success(`Payment received: ${formatXAF(payload.new.amount)}`, {
            description: `Via ${payload.new.method || 'wallet'}`,
          });
          refreshAll();
        }
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'gateway_charges',
        filter: `merchant_id=eq.${merchantId}`,
      }, () => refreshAll())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'gateway_merchant_wallets',
        filter: `merchant_id=eq.${merchantId}`,
      }, () => refreshAll())
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'app_notifications',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['biz-notifications', merchantId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [merchantId, queryClient]);

  const formatXAF = (amount: number) =>
    new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(amount);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 px-5 pt-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[160px] rounded-3xl" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[100px] rounded-2xl" />)}
        </div>
      </div>
    );
  }

  // ─── Today's KPI cards ──────────────────────────────────────────────
  const stats = [
    { label: "Today's Revenue", value: formatXAF(todayRevenue), icon: TrendingUp, tint: 'bg-emerald-500/10', fg: 'text-emerald-600' },
    { label: "Today's Orders", value: todayOrders.toString(), icon: ShoppingBag, tint: 'bg-sky-500/10', fg: 'text-sky-600' },
    { label: 'Available', value: formatXAF(availableBalance), icon: Wallet, tint: 'bg-violet-500/10', fg: 'text-violet-600' },
    { label: 'Pending', value: formatXAF(pendingBalance), icon: Clock, tint: 'bg-amber-500/10', fg: 'text-amber-600' },
  ];

  // ─── Primary actions (solid buttons, contrast text) ────────────────
  const primaryActions = [
    { label: 'Receive', icon: ScanLine, path: `${basePath}/receive` },
    { label: 'New Order', icon: Plus, path: `${basePath}/quick-order` },
    { label: 'Send', icon: Send, path: `${basePath}/wallet` },
    { label: 'POS', icon: Monitor, path: `${basePath}/till` },
  ];

  // ─── Shortcut grid (outline icons, soft tinted cards) ──────────────
  const shortcuts = [
    { label: 'My QR Code', icon: QrCode, path: `${basePath}/qr-code`, tint: 'bg-emerald-500/10', fg: 'text-emerald-600' },
    { label: 'Storefront', icon: Building2, path: `${basePath}/storefront`, tint: 'bg-sky-500/10', fg: 'text-sky-600' },
    { label: 'Products', icon: Package, path: `${basePath}/products`, tint: 'bg-violet-500/10', fg: 'text-violet-600' },
    { label: 'Inventory', icon: Package, path: `${basePath}/inventory`, tint: 'bg-amber-500/10', fg: 'text-amber-600' },
    { label: 'Customers', icon: Users, path: `${basePath}/customers`, tint: 'bg-pink-500/10', fg: 'text-pink-600' },
    { label: 'Orders', icon: Receipt, path: `${basePath}/orders`, tint: 'bg-indigo-500/10', fg: 'text-indigo-600' },
    { label: 'Coupons', icon: Tag, path: `${basePath}/coupons`, tint: 'bg-rose-500/10', fg: 'text-rose-600' },
    { label: 'Reviews', icon: Star, path: `${basePath}/reviews`, tint: 'bg-yellow-500/10', fg: 'text-yellow-600' },
    { label: 'Refunds', icon: RefreshCw, path: `${basePath}/refunds`, tint: 'bg-orange-500/10', fg: 'text-orange-600' },
    { label: 'Disputes', icon: MessageSquare, path: `${basePath}/disputes`, tint: 'bg-red-500/10', fg: 'text-red-600' },
    { label: 'Trust Score', icon: ShieldCheck, path: `${basePath}/trust-score`, tint: 'bg-teal-500/10', fg: 'text-teal-600' },
    { label: 'Travel', icon: Plane, path: `${basePath}/travel`, tint: 'bg-cyan-500/10', fg: 'text-cyan-600' },
  ];

  const recentCharges = (charges || []).slice(0, 5);

  return (
    <div className="space-y-6 px-5 md:px-0 pt-4 pb-8">
      <PageGuide
        title="Business Dashboard"
        summary="Your live overview of revenue, orders, and quick actions across your store."
        steps={[
          { title: 'Review today’s performance', description: 'Check available balance, today’s revenue, and order count at a glance.' },
          { title: 'Act on pending items', description: 'Open recent orders, notifications, or settlement updates that need attention.' },
          { title: 'Use quick actions', description: 'Receive a payment, open the till, or scan a QR straight from the home screen.' },
        ]}
        learnMoreHref="/developer/quickstart"
      />
      {/* ─── Greeting + Notification bell ─── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start justify-between"
      >
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{greeting}</p>
          <h1 className="text-[22px] md:text-2xl font-bold tracking-tight text-foreground mt-0.5 truncate">
            {merchant?.business_name || 'Dashboard'}
          </h1>
        </div>
        {/* Notification bell removed — already shown in the top bar */}
      </motion.div>

      {/* ─── Balance hero (Apple-style dark card) ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="rounded-3xl bg-foreground p-5 md:p-6 text-background shadow-lg shadow-foreground/5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-background/60 uppercase tracking-[0.14em]">Total Balance</p>
            <button
              onClick={() => navigate(`${basePath}/wallet`)}
              className="flex items-center gap-1 rounded-full bg-background/12 px-3 py-1.5 text-[11px] font-semibold text-background hover:bg-background/20 transition-colors"
            >
              Wallet <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          <p className="mt-3 text-[2rem] md:text-[2.4rem] font-bold tracking-tight leading-none">
            {walletsLoading
              ? <Skeleton className="h-9 w-44 bg-background/20" />
              : formatXAF(availableBalance + pendingBalance)}
          </p>
          <div className="mt-5 flex items-center gap-6">
            <div>
              <p className="text-[10px] text-background/50 uppercase tracking-wider font-semibold">Available</p>
              <p className="text-sm font-semibold text-emerald-300 mt-0.5">
                {walletsLoading ? <Skeleton className="h-4 w-20 bg-background/20" /> : formatXAF(availableBalance)}
              </p>
            </div>
            <div className="h-7 w-px bg-background/15" />
            <div>
              <p className="text-[10px] text-background/50 uppercase tracking-wider font-semibold">Pending</p>
              <p className="text-sm font-semibold text-amber-300 mt-0.5">
                {walletsLoading ? <Skeleton className="h-4 w-20 bg-background/20" /> : formatXAF(pendingBalance)}
              </p>
            </div>
          </div>

          {/* Inline solid-color action buttons inside hero */}
          <div className="mt-5 grid grid-cols-4 gap-2">
            {primaryActions.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.label}
                  onClick={() => navigate(a.path)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-background py-3 text-foreground transition-all hover:bg-background/90 active:scale-95"
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                  <span className="text-[11px] font-semibold">{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ─── Today's stats grid ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.04, duration: 0.3 }}
              className="rounded-2xl border border-border/50 bg-card p-4 transition-all hover:border-border hover:shadow-sm"
            >
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', s.tint)}>
                <Icon className={cn('h-[18px] w-[18px]', s.fg)} strokeWidth={1.7} />
              </div>
              <p className="mt-3 text-lg font-bold tracking-tight text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* ─── Shortcuts grid (Apple-style tile grid) ─── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-foreground">Shortcuts</h2>
          <button
            onClick={() => navigate(`${basePath}/more`)}
            className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            All tools <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-6 gap-2.5">
          {shortcuts.map((sc, i) => {
            const Icon = sc.icon;
            return (
              <motion.button
                key={sc.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.12 + i * 0.025 }}
                onClick={() => navigate(sc.path)}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/40 bg-card px-2 py-3 transition-all hover:border-border hover:shadow-sm active:scale-95"
              >
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', sc.tint)}>
                  <Icon className={cn('h-[18px] w-[18px]', sc.fg)} strokeWidth={1.7} />
                </div>
                <span className="text-[10.5px] font-semibold text-foreground text-center leading-tight line-clamp-2">{sc.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ─── Notifications snapshot ─── */}
      {notifications.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-foreground">Notifications</h2>
            <button
              onClick={() => navigate(`${basePath}/notifications`)}
              className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="rounded-2xl border border-border/40 bg-card overflow-hidden divide-y divide-border/30">
            {notifications.slice(0, 3).map((n: any, i: number) => (
              <motion.button
                key={n.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigate(`${basePath}/notifications`)}
                className="flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-muted/40"
              >
                <div className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                  n.is_read ? 'bg-muted' : 'bg-primary/10',
                )}>
                  <Bell className={cn('h-4 w-4', n.is_read ? 'text-muted-foreground' : 'text-primary')} strokeWidth={1.7} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">{n.title}</p>
                  <p className="text-[11.5px] text-muted-foreground line-clamp-1 mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-1.5" />}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Recent activity (charges) ─── */}
      <div>
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
            <button
              onClick={() => navigate(`${basePath}/receive`)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-[12px] font-semibold text-background transition-all hover:bg-foreground/90 active:scale-95"
            >
              <ScanLine className="h-3.5 w-3.5" /> Accept first payment
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/40 bg-card overflow-hidden divide-y divide-border/30">
            {recentCharges.map((charge: any, i: number) => (
              <motion.div
                key={charge.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.035 }}
                className="flex items-center gap-3.5 p-3.5 transition-colors hover:bg-muted/40"
              >
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl shrink-0',
                  charge.status === 'successful' ? 'bg-emerald-500/10' : 'bg-muted',
                )}>
                  <ArrowUpRight className={cn(
                    'h-[18px] w-[18px]',
                    charge.status === 'successful' ? 'text-emerald-600' : 'text-muted-foreground',
                  )} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">
                    {charge.channel || 'Payment'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(charge.created_at), { addSuffix: true })}
                  </p>
                </div>
                <p className={cn(
                  'text-[13px] font-bold shrink-0',
                  charge.status === 'successful' ? 'text-emerald-600' : 'text-muted-foreground',
                )}>
                  +{formatXAF(charge.amount || 0)}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Email activity (transactional) ─── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-foreground">Email Activity</h2>
          <button
            onClick={() => navigate(`${basePath}/settings`)}
            className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Templates <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {emailLog.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 py-8 text-center">
            <Mail className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-[13px] text-muted-foreground">No emails sent yet</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">Receipts and notifications will appear here</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/40 bg-card overflow-hidden divide-y divide-border/30">
            {emailLog.map((e: any, i: number) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3.5 p-3.5"
              >
                <div className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl shrink-0',
                  e.status === 'sent' ? 'bg-emerald-500/10' : e.status === 'failed' || e.status === 'dlq' ? 'bg-red-500/10' : 'bg-muted',
                )}>
                  <Mail className={cn(
                    'h-4 w-4',
                    e.status === 'sent' ? 'text-emerald-600' : e.status === 'failed' || e.status === 'dlq' ? 'text-red-600' : 'text-muted-foreground',
                  )} strokeWidth={1.7} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">{e.template_name || 'Email'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{e.recipient_email}</p>
                </div>
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                  e.status === 'sent' ? 'bg-emerald-500/10 text-emerald-600' :
                  e.status === 'failed' || e.status === 'dlq' ? 'bg-red-500/10 text-red-600' :
                  'bg-muted text-muted-foreground',
                )}>
                  {e.status}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Insight footer ─── */}
      <button
        onClick={() => navigate(`${basePath}/analytics`)}
        className="w-full rounded-2xl border border-border/50 bg-card p-4 text-left transition-all hover:border-border hover:shadow-sm active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground">
            <BarChart3 className="h-[18px] w-[18px] text-background" strokeWidth={1.7} />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-foreground">View full analytics</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Revenue trends, top products, customer insights</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>
    </div>
  );
};

export default BusinessHome;
