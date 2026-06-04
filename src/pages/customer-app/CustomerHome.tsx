import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Eye, EyeOff, ArrowUpRight, ArrowDownLeft,
  ShoppingBag, Lock, Smartphone, Gift, Wallet,
  TrendingUp, TrendingDown, Send, Download, Banknote, Link2,
  Receipt, FileText, Users, RefreshCw, PiggyBank, CircleDollarSign,
  BarChart3, Home, Building2, ChevronRight, Loader2,
  Bus, Compass, Plane, Train, Globe, Vault, UtensilsCrossed,
} from 'lucide-react';
import { motion } from 'framer-motion';
import kangLogo from '@/assets/kang-logo.png';
import vaultIcon from '@/assets/saving-vault-icon.png';
import { useVaultBalance } from '@/hooks/savings/useSavingsVault';
import rentKobImage from '@/assets/rent-kob.png';
import travelCardBg from '@/assets/travel-card-bg.png';
import { useCustomerTenant } from '@/components/customer-app/CustomerTenantProvider';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useCustomerAccounts, useAccountBalances, useCustomerTransactions, useSpendingSummary, useCustomerCreditScore } from '@/hooks/useCustomerData';
import { MediaBanner } from '@/components/pwa/MediaBanner';
import { formatDistanceToNow } from 'date-fns';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';
import { SecureField } from '@/components/security/SecureField';
import { supabase } from '@/integrations/supabase/client';

/* ─── Animated Counter Hook ─── */
function useAnimatedCounter(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);
  useEffect(() => {
    if (target === prevTarget.current) return;
    const start = prevTarget.current;
    prevTarget.current = target;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (target - start) * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

/* ─── Service Section Data (static config — NOT mock data) ─── */
interface FeatureItem {
  label: string;
  description?: string;
  subtitle?: string;
  icon: React.ElementType;
  path: string;
  color: string;
  iconColor: string;
  borderColor: string;
  featureKey?: string;
}

const moneyMovement: FeatureItem[] = [
  { label: 'Add Money', description: 'Deposit from linked accounts', icon: Download, path: 'fund', color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]', borderColor: 'border-[hsl(150,40%,35%)]' },
  { label: 'Transfer', description: 'Send money to anyone instantly', icon: Send, path: 'transfer', color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', borderColor: 'border-[hsl(210,60%,45%)]', featureKey: 'transfer' },
  { label: 'Stores', description: 'Browse & shop local merchants', icon: ShoppingBag, path: 'stores', color: 'bg-[hsl(270,60%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]', borderColor: 'border-[hsl(270,50%,45%)]' },
  { label: 'Daily Needs', description: 'Food delivery & pharmacy', subtitle: 'New', icon: UtensilsCrossed, path: 'daily-needs', color: 'bg-[hsl(15,80%,92%)]', iconColor: 'text-[hsl(15,75%,40%)]', borderColor: 'border-[hsl(15,75%,55%)]' },
];

const paymentsBills: FeatureItem[] = [
  { label: 'Bills', description: 'Pay utility & service bills', icon: Receipt, path: 'bills', color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]', borderColor: 'border-transparent', featureKey: 'bills' },
  { label: 'Invoices', description: 'Manage & pay invoices', icon: FileText, path: 'invoices', color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]', borderColor: 'border-transparent', featureKey: 'invoices' },
  { label: 'Split Bills', description: 'Share costs with friends', icon: Users, path: 'split-bills', color: 'bg-[hsl(340,60%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]', borderColor: 'border-transparent', featureKey: 'split_bills' },
  { label: 'Recurring', description: 'Auto-pay subscriptions', icon: RefreshCw, path: 'recurring', color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', borderColor: 'border-transparent', featureKey: 'recurring' },
];

const savingsGoals: FeatureItem[] = [
  { label: 'Piggy Bank', description: 'Explore bank savings & personal goals', icon: PiggyBank, path: 'piggybank', color: 'bg-[hsl(340,60%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]', borderColor: 'border-foreground', featureKey: 'piggy_bank' },
  { label: 'Njangi', description: 'Group savings circles', icon: CircleDollarSign, path: 'njangi', color: 'bg-[hsl(270,60%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]', borderColor: 'border-foreground', featureKey: 'njangi' },
  { label: 'Rewards', description: 'Earn & redeem points', icon: Gift, path: 'rewards', color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]', borderColor: 'border-foreground', featureKey: 'rewards' },
];

const financialHealth: FeatureItem[] = [
  { label: 'Budget', description: 'Smart spending limits & AI tips', icon: BarChart3, path: 'budget', color: 'bg-[hsl(190,60%,90%)]', iconColor: 'text-[hsl(200,70%,35%)]', borderColor: 'border-[hsl(200,70%,55%)]', featureKey: 'budget' },
  { label: 'Credit Score', description: 'Check', subtitle: 'Know your score today', icon: BarChart3, path: 'credit', color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]', borderColor: 'border-[hsl(150,40%,55%)]', featureKey: 'credit_score' },
  { label: 'Rent Report', description: 'Open', subtitle: 'Start a rent profile', icon: Home, path: 'rent-reporting', color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', borderColor: 'border-[hsl(210,60%,65%)]', featureKey: 'rent_reporting' },
];

const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
const staggerContainer = { animate: { transition: { staggerChildren: 0.06 } } };
const staggerItem = { initial: { opacity: 0, y: 12, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 } };

const txIconMap: Record<string, { icon: React.ElementType; color: string; iconColor: string }> = {
  transfer: { icon: ArrowUpRight, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  payment: { icon: ShoppingBag, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]' },
  deposit: { icon: ArrowDownLeft, color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]' },
  bill_payment: { icon: Receipt, color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]' },
  airtime: { icon: Smartphone, color: 'bg-[hsl(255,50%,92%)]', iconColor: 'text-[hsl(255,50%,45%)]' },
  reward: { icon: Gift, color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]' },
};

const acctIcons = [Wallet, PiggyBank, Smartphone];
const acctColors = ['bg-[hsl(225,50%,22%)]', 'bg-[hsl(150,35%,30%)]', 'bg-[hsl(25,60%,35%)]'];

const CustomerHome: React.FC = () => {
  const navigate = useNavigate();
  const tenant = useCustomerTenant();
  const { user } = useCustomerAuth();
  const { unreadCount } = useNotifications(undefined, false, true);
  // Balances default to MASKED on mount and auto re-mask after 8s of
  // visibility to reduce shoulder-surfing and casual screenshot risk.
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [period, setPeriod] = useState<'W' | 'M' | 'Y'>('M');
  const tr = useHarvestedT('customer');

  const isViewOnly = user?.isViewOnly ?? false;

  // Auto-release any pending inbound transfers held while the account was unverified
  React.useEffect(() => {
    if (!user?.id) return;
    import('@/integrations/supabase/client').then(({ supabase }) => {
      supabase.functions.invoke('release-pending-inbound', { body: {} }).catch(() => {});
    });
  }, [user?.id]);

  // ─── Live Data ───
  const { data: accounts = [], isLoading: acctLoading } = useCustomerAccounts(user?.id);
  const accountIds = accounts.map((a: any) => a.id);
  const { data: balances = [] } = useAccountBalances(accountIds);
  const { data: recentTxns = [], isLoading: txnLoading } = useCustomerTransactions(user?.id, undefined, 5);
  const { data: summary } = useSpendingSummary(user?.id, undefined, period);
  const { data: creditData } = useCustomerCreditScore(user?.id);

  // Build account cards from live data
  const accountCards = accounts.map((acct: any, i: number) => {
    const bal = balances.find((b: any) => b.account_id === acct.id);
    return {
      name: acct.nickname || acct.account_holder_name || `Account ${i + 1}`,
      balance: bal?.amount ?? 0,
      currency: acct.currency || 'XAF',
    };
  });

  const totalBalance = accountCards.reduce((s: number, a: any) => s + a.balance, 0);
  const earnings = summary?.earnings ?? 0;
  const spending = summary?.spending ?? 0;
  const animatedBalance = useAnimatedCounter(totalBalance);

  // Auto re-mask the balance after 8 s of being visible.
  React.useEffect(() => {
    if (!balanceVisible) return;
    const id = window.setTimeout(() => setBalanceVisible(false), 8000);
    return () => window.clearTimeout(id);
  }, [balanceVisible]);

  // Always re-mask when the tab loses focus or visibility.
  React.useEffect(() => {
    const onVis = () => { if (document.visibilityState !== 'visible') setBalanceVisible(false); };
    window.addEventListener('blur', () => setBalanceVisible(false));
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', () => setBalanceVisible(false));
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);


  const go = (path: string) => navigate(`/app/${path}`);

  // Detect active Daily Needs order for smart routing
  const ACTIVE_DN_STATUSES = ['received', 'accepted', 'preparing', 'ready', 'picked_up', 'on_the_way', 'arriving'] as const;
  const goDailyNeeds = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/app/daily-needs');
      const { data } = await supabase
        .from('daily_needs_orders')
        .select('id, status')
        .eq('user_id', user.id)
        .in('status', ACTIVE_DN_STATUSES)
        .limit(1);
      if (data && data.length > 0) navigate('/app/daily-needs/orders');
      else navigate('/app/daily-needs');
    } catch {
      navigate('/app/daily-needs');
    }
  };
  const isVisible = (f: FeatureItem) => !f.featureKey || tenant.features[f.featureKey as keyof typeof tenant.features] !== false;

  const visibleMoney = moneyMovement.filter(isVisible);
  const visiblePayments = paymentsBills.filter(isVisible);
  const visibleSavings = savingsGoals.filter(isVisible);
  const { data: vaultData } = useVaultBalance();
  const vaultBalance = vaultData?.balance ?? 0;
  const visibleHealth = financialHealth.filter(isVisible);

  // Quick action buttons for hero card
  const actionColors = tenant.heroActionColors;
  const heroActions = [
    { label: tr('Accounts'), icon: Building2, path: 'linked-accounts', featureKey: 'bank', iconColor: 'text-[hsl(225,75%,50%)]', bgColor: actionColors.accounts },
    { label: tr('Cash Out'), icon: Banknote, path: 'cash-out', featureKey: 'cash_out', iconColor: 'text-[hsl(45,85%,40%)]', bgColor: actionColors.cash_out },
    { label: tr('Request'), icon: ArrowDownLeft, path: 'request', featureKey: 'request', iconColor: 'text-[hsl(340,75%,50%)]', bgColor: actionColors.request },
    { label: tr('Pay Links'), icon: Link2, path: 'pay-links', featureKey: 'pay_links', iconColor: 'text-[hsl(180,65%,40%)]', bgColor: actionColors.pay_links },
  ].filter(a => !a.featureKey || tenant.features[a.featureKey as keyof typeof tenant.features] !== false);

  // Admin-configurable hero background
  const isHeroVideo = tenant.heroMediaType === 'video' || (tenant.heroBgImage ? /\.(mp4|webm|ogg)(\?|$)/i.test(tenant.heroBgImage) : false);
  const hasHeroImage = !!tenant.heroBgImage && !isHeroVideo;
  const heroBgStyle: React.CSSProperties = {
    ...(tenant.heroBgColor && !tenant.heroBgImage ? { backgroundColor: tenant.heroBgColor } : {}),
  };

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* ─── Hero Card Section ─── */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="relative overflow-hidden rounded-b-[28px] bg-primary shadow-[0_8px_32px_-8px_rgba(0,0,0,0.25)]"
          style={heroBgStyle}
        >
          {/* Image background — rendered as <img> for reliable GIF/image display */}
          {hasHeroImage && (
            <>
              <img
                src={tenant.heroBgImage!}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/20 to-black/35" />
            </>
          )}
          {/* Video background */}
          {isHeroVideo && tenant.heroBgImage && (
            <>
              <video
                src={tenant.heroBgImage}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                className="absolute inset-0 h-full w-full object-cover scale-105"
                style={{ minHeight: '100%', minWidth: '100%' }}
                onCanPlay={(e) => {
                  const vid = e.currentTarget;
                  if (vid.paused) vid.play().catch(() => {});
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/40" />
            </>
          )}
          {/* Decorative circles */}
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[hsl(0,0%,100%)]/[0.06]" />
          <div className="absolute -left-8 bottom-16 h-28 w-28 rounded-full bg-[hsl(0,0%,100%)]/[0.04]" />
          <div className="absolute right-12 bottom-32 h-16 w-16 rounded-full bg-[hsl(0,0%,100%)]/[0.05]" />

          <div className="relative px-5 pt-5 pb-6">
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {tenant.logoUrl ? (
                  <img src={tenant.logoUrl} alt={tenant.name} className="h-10 w-10 rounded-full object-contain ring-2 ring-[hsl(0,0%,100%)]/20" />
                ) : (
                  <img src={kangLogo} alt={tr('Kang')} className="h-10 w-10 rounded-full object-contain ring-2 ring-[hsl(0,0%,100%)]/20 bg-[hsl(0,0%,100%)]/15 p-1" />
                )}
                <div>
                  <p className="text-[10px] font-medium text-primary-foreground/50">{tr('Welcome back')}</p>
                  <h2 className="text-base font-bold text-primary-foreground">{user?.fullName || tenant.name}</h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setBalanceVisible(!balanceVisible)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(0,0%,100%)]/10 backdrop-blur-sm"
                >
                  {balanceVisible ? <Eye className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} /> : <EyeOff className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => go('alerts')}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(0,0%,100%)]/10 backdrop-blur-sm"
                >
                  <Bell className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  )}
                </motion.button>
              </div>
            </div>

            {/* View-Only Banner */}
            {isViewOnly && (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="relative flex items-center gap-3 rounded-2xl border border-[hsl(0,0%,100%)]/20 bg-[hsl(0,0%,100%)]/10 backdrop-blur-sm p-3 mb-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(0,0%,100%)]/15">
                  <Lock className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-primary-foreground">{tr('View-Only Mode')}</p>
                  <p className="text-[11px] text-primary-foreground/60">{tr('Link an account to unlock transactions')}</p>
                </div>
                <button onClick={() => go('onboarding')} className="rounded-xl bg-primary-foreground px-3.5 py-1.5 text-xs font-bold text-primary">{tr('Link')}</button>
              </motion.div>
            )}

            {/* Main Balance */}
            <div className="text-center mb-2">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary-foreground/50 mb-1.5"
              >
                {tr('Total Balance')}
              </motion.p>
              {acctLoading ? (
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-foreground/50" />
              ) : (
                <SecureField
                  field="total_balance"
                  revealed={balanceVisible && !isViewOnly}
                  mask={
                    <motion.p
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3, duration: 0.4 }}
                      className="text-[42px] font-extrabold leading-none text-primary-foreground tracking-tight"
                      data-testid="balance-masked"
                    >
                      {'• • • • •'}
                    </motion.p>
                  }
                >
                  <motion.p
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="text-[42px] font-extrabold leading-none text-primary-foreground tracking-tight"
                    data-testid="balance-value"
                  >
                    {`XAF ${animatedBalance.toLocaleString()}`}
                  </motion.p>
                </SecureField>
              )}
            </div>

            {/* Financial Health subtitle */}
            {!isViewOnly && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-center gap-4 mt-3 mb-5"
              >
                <div className="flex items-center gap-1.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(150,50%,45%)]/20">
                    <TrendingUp className="h-3 w-3 text-[hsl(150,60%,55%)]" strokeWidth={2.5} />
                  </div>
                  <span className="text-[11px] font-semibold text-primary-foreground/70">{earnings.toLocaleString()}</span>
                </div>
                <div className="h-3 w-px bg-primary-foreground/20" />
                <div className="flex items-center gap-1.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[hsl(0,50%,55%)]/20">
                    <TrendingDown className="h-3 w-3 text-[hsl(0,60%,65%)]" strokeWidth={2.5} />
                  </div>
                  <span className="text-[11px] font-semibold text-primary-foreground/70">{spending.toLocaleString()}</span>
                </div>
              </motion.div>
            )}

            {/* Period Toggle */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex justify-center mb-6"
            >
              <div className="flex rounded-full bg-[hsl(0,0%,100%)]/10 p-1 backdrop-blur-sm">
                {(['W', 'M', 'Y'] as const).map((p) => (
                  <motion.button
                    key={p}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setPeriod(p)}
                    className={`rounded-full px-5 py-1.5 text-xs font-bold transition-all ${
                      period === p
                        ? 'bg-primary-foreground text-primary shadow-md'
                        : 'text-primary-foreground/60'
                    }`}
                  >
                    {p === 'W' ? tr('Week') : p === 'M' ? tr('Month') : tr('Year')}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Quick Action Circles */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-center justify-around"
            >
              {heroActions.map((action) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    key={action.path}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => go(action.path)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full shadow-md" style={{ backgroundColor: action.bgColor || '#ffffff', opacity: tenant.heroActionOpacity ?? 0.8 }}>
                      <Icon className={`h-6 w-6 ${action.iconColor}`} strokeWidth={2} />
                    </div>
                    <span className="text-[10px] font-semibold text-primary-foreground/80">{action.label}</span>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ─── Padded content ─── */}
      <div className="flex flex-col gap-5 px-5">

      {/* ─── Money Movement ─── */}
      {visibleMoney.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.03 }}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{tr('Money Movement')}</p>
          <motion.div className="grid grid-cols-2 gap-3" variants={staggerContainer} initial="initial" animate="animate">
            {visibleMoney.slice(0, 2).map((item) => {
              const solidBg = item.borderColor.replace('border-', 'bg-');
              return (
                <motion.button
                  key={item.path}
                  variants={staggerItem}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => go(item.path)}
                  className={`flex flex-col items-start gap-3 rounded-3xl ${solidBg} p-5 text-left min-h-[140px] shadow-md transition-shadow active:shadow-sm`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(0,0%,100%)]/20">
                    <item.icon className="h-6 w-6 text-[hsl(0,0%,100%)]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[hsl(0,0%,100%)]">{tr(item.label)}</p>
                    <p className="mt-0.5 text-[11px] text-[hsl(0,0%,100%)]/70 leading-snug">{tr(item.description || '')}</p>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>
      )}

      {/* ─── Payments & Bills ─── */}
      {visiblePayments.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.06 }}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{tr('Payments & Bills')}</p>
          <div className="flex items-center justify-around">
            {visiblePayments.map((item) => (
              <motion.button
                key={item.path}
                whileTap={{ scale: 0.9 }}
                onClick={() => go(item.path)}
                className="flex flex-col items-center gap-1.5"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-full ${item.color} shadow-sm`}>
                  <item.icon className={`h-6 w-6 ${item.iconColor}`} strokeWidth={2} />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground">{tr(item.label)}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}


      {/* ─── Savings & Goals (Saving Vault + horizontal carousel) ─── */}
      {visibleSavings.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.09 }}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{tr('Savings & Goals')}</p>

          {/* Saving Vault — Featured Rectangle Card (above carousel) */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => go('savings-vault')}
            className="relative mb-3 flex w-full items-center gap-4 overflow-hidden rounded-3xl border-2 border-foreground bg-[hsl(180,40%,92%)] p-5 text-left shadow-sm"
            aria-label="Open Saving Vault"
          >
            <motion.img
              src={vaultIcon}
              alt=""
              className="h-16 w-16 shrink-0 select-none"
              draggable={false}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(180,60%,30%)]">
                {tr('Saving Vault')}
              </p>
              <p className="mt-0.5 text-base font-bold text-foreground">
                {vaultBalance.toLocaleString()} <span className="text-[11px] font-semibold text-muted-foreground">XAF</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                {tr('Round-up spare change · Free withdrawals to wallet or bank')}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-foreground shrink-0" strokeWidth={2} />
          </motion.button>

          <motion.div
            className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-none"
            style={{ scrollbarWidth: 'none' }}
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {visibleSavings.map((item) => {
              const ItemIcon = item.icon;
              return (
                <motion.button
                  key={item.path}
                  variants={staggerItem}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => go(item.path)}
                  className={`flex-shrink-0 w-[calc(50%-6px)] snap-start flex flex-col items-start gap-3 rounded-3xl ${item.color} p-5 text-left border-2 ${item.borderColor} shadow-sm`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/60">
                    <ItemIcon className={`h-6 w-6 ${item.iconColor}`} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">{tr(item.label)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{tr(item.description || '')}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                    {tr('Open')} <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>
      )}


      {/* ─── Financial Health ─── */}
      {visibleHealth.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.12 }}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{tr('Financial Health')}</p>
          <div className="grid grid-cols-2 gap-3">
            {/* Credit Score Card with Doughnut */}
            {visibleHealth.find(i => i.featureKey === 'credit_score') && (() => {
              const item = visibleHealth.find(i => i.featureKey === 'credit_score')!;
              const scoreVal = creditData?.score ?? 0;
              const maxVal = 850;
              const pct = maxVal > 0 ? scoreVal / maxVal : 0;
              const r = 40;
              const circ = 2 * Math.PI * r;
              const offset = circ * (1 - pct);
              return (
                <button key={item.path} onClick={() => go(item.path)}
                  className="flex flex-col items-center gap-3 rounded-3xl bg-[hsl(150,40%,90%)] p-4 text-left">
                  <div className="relative flex h-24 w-24 items-center justify-center">
                    <svg width={100} height={100} className="-rotate-90">
                      <circle cx={50} cy={50} r={r} stroke="hsl(150,40%,80%)" strokeWidth={10} fill="none" />
                      <motion.circle
                        cx={50} cy={50} r={r}
                        stroke="hsl(150,40%,35%)"
                        strokeWidth={10}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        initial={{ strokeDashoffset: circ }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 1.5, ease: 'easeOut' }}
                      />
                    </svg>
                    <span className="absolute text-lg font-black text-[hsl(150,40%,35%)]">{scoreVal || '—'}</span>
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(150,40%,35%)]">{tr(item.label)}</p>
                  <span className="rounded-full bg-[hsl(150,40%,35%)] px-4 py-1.5 text-[11px] font-bold text-white">{tr('Check Now')}</span>
                </button>
              );
            })()}

            {/* Rent Report Card with Image */}
            {visibleHealth.find(i => i.featureKey === 'rent_reporting') && (() => {
              const item = visibleHealth.find(i => i.featureKey === 'rent_reporting')!;
              return (
                <button key={item.path} onClick={() => go(item.path)}
                  className="flex flex-col items-center gap-3 rounded-3xl bg-[hsl(210,80%,93%)] p-4 text-left">
                  <img src={rentKobImage} alt={tr('Rent Report')} className="h-24 w-24 object-contain" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(210,60%,45%)]">{tr(item.label)}</p>
                  <span className="rounded-full bg-[hsl(210,60%,45%)] px-4 py-1.5 text-[11px] font-bold text-white">{tr(item.description || 'Open')}</span>
                </button>
              );
            })()}
          </div>
        </motion.div>
      )}

      {/* ─── Transport & Tourism + Daily Needs (swipeable slides) ─── */}
      <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.14 }}>
        {(() => {
          const tc = tenant.travelCardConfig;
          const dn = tenant.dailyNeedsCardConfig;
          const travelBg = tc.bg_image || travelCardBg;
          const dnBg = dn.bg_image || travelCardBg;

          const renderTravel = () => (
            <motion.button
              key="travel"
              whileTap={{ scale: 0.97 }}
              onClick={() => go('travel')}
              className="group relative w-[88%] sm:w-[90%] flex-shrink-0 snap-center min-h-[280px] overflow-hidden rounded-3xl text-left shadow-lg"
            >
              <img src={travelBg} alt={tr('Travel')} className="absolute inset-0 h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = travelCardBg; }} />
              <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${tc.overlay_opacity})` }} />
              <div className="relative z-10 p-6">
                <div className="absolute top-4 right-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(48,90%,52%)]">
                  <Globe className="h-6 w-6 text-[hsl(220,25%,14%)]" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">{tr('Transport & Tourism')}</p>
                <h3 className="mt-2 text-xl font-extrabold leading-tight text-white">{tr('Travel & Tourism')}</h3>
                <div className="mt-3 space-y-3 pr-16">
                  <p className="text-xs leading-relaxed text-white/60">
                    {tr('Book buses, tours & more — all from your wallet.')}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      { icon: Bus, label: 'Bus', color: 'hsl(48,90%,52%)' },
                      { icon: Compass, label: 'Tours', color: 'hsl(187,100%,42%)' },
                      { icon: Plane, label: 'Flights', color: 'hsl(0,65%,51%)' },
                      { icon: Train, label: 'Trains', color: 'hsl(0,0%,60%)' },
                    ].map((c) => {
                      const Icon = c.icon;
                      return (
                        <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
                          <Icon className="h-3 w-3" style={{ color: c.color }} strokeWidth={2} />
                          <span className="text-[10px] font-semibold text-white/80">{tr(c.label)}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-5 inline-block">
                  <div
                    className="flex items-center gap-4 rounded-2xl px-3 py-2 text-xs backdrop-blur-sm transition-colors"
                    style={{ backgroundColor: tc.button_bg_color || 'rgba(255,255,255,0.1)' }}
                  >
                    <span className="font-bold text-white">{tc.button_text}</span>
                    <ChevronRight className="h-4 w-4 text-white/60 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            </motion.button>
          );

          const renderDailyNeeds = () => (
            <motion.button
              key="daily-needs"
              whileTap={{ scale: 0.97 }}
              onClick={() => go('daily-needs')}
              className="group relative w-[88%] sm:w-[90%] flex-shrink-0 snap-center min-h-[280px] overflow-hidden rounded-3xl text-left shadow-lg"
            >
              <img src={dnBg} alt={tr('Daily Needs')} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${dn.overlay_opacity})` }} />
              <div className="relative z-10 p-6">
                <div className="absolute top-4 right-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(160,60%,55%)]">
                  <UtensilsCrossed className="h-6 w-6 text-[hsl(220,25%,14%)]" strokeWidth={1.5} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">{tr('Food & Essentials')}</p>
                <h3 className="mt-2 text-xl font-extrabold leading-tight text-white">{tr('Daily Needs')}</h3>
                <div className="mt-3 space-y-3 pr-16">
                  <p className="text-xs leading-relaxed text-white/60">
                    {tr('Order food, pharmacy & groceries — delivered fast.')}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      { icon: UtensilsCrossed, label: 'Food', color: 'hsl(25,90%,55%)' },
                      { icon: ShoppingBag, label: 'Grocery', color: 'hsl(160,60%,55%)' },
                      { icon: Receipt, label: 'Pharmacy', color: 'hsl(190,80%,55%)' },
                    ].map((c) => {
                      const Icon = c.icon;
                      return (
                        <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
                          <Icon className="h-3 w-3" style={{ color: c.color }} strokeWidth={2} />
                          <span className="text-[10px] font-semibold text-white/80">{tr(c.label)}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-5 inline-block">
                  <div
                    className="flex items-center gap-4 rounded-2xl px-3 py-2 text-xs backdrop-blur-sm transition-colors"
                    style={{ backgroundColor: dn.button_bg_color || 'rgba(255,255,255,0.1)' }}
                  >
                    <span className="font-bold text-white">{dn.button_text}</span>
                    <ChevronRight className="h-4 w-4 text-white/60 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            </motion.button>
          );

          return (
            <div className="-mx-5 px-5 flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth">
              {renderTravel()}
              {renderDailyNeeds()}
            </div>
          );
        })()}
      </motion.div>


      {/* Earnings & Spending cards hidden — data shown in hero section */}

      {/* ─── Media Banner ─── */}
      {tenant.mediaSections && tenant.mediaSections.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.17 }}>
          <MediaBanner items={tenant.mediaSections} cardSize="medium" />
        </motion.div>
      )}

      {/* ─── Recent Activities (Live) ─── */}
      <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.18 }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{tr('Recent Activities')}</p>
          <button onClick={() => go('activity')} className="flex items-center gap-0.5 text-xs font-semibold text-primary">
            {tr('See All')} <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
        {isViewOnly ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-border bg-muted/30 p-10">
            <Lock className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-muted-foreground">{tr('No transactions yet')}</p>
            <p className="text-xs text-muted-foreground">{tr('Link an account to see activity')}</p>
          </div>
        ) : txnLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : recentTxns.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-border bg-muted/30 p-10">
            <p className="text-sm font-semibold text-muted-foreground">{tr('No transactions yet')}</p>
          </div>
        ) : (
          <motion.div className="space-y-2" variants={staggerContainer} initial="initial" animate="animate">
            {recentTxns.map((tx: any) => {
              const isCredit = tx.credit_debit_indicator === 'Credit';
              const amount = tx.amount || 0;
              const txType = tx.transaction_type?.toLowerCase() || 'payment';
              const iconInfo = txIconMap[txType] || txIconMap.payment;
              const TxIcon = iconInfo.icon;
              const timeAgo = tx.booking_datetime ? formatDistanceToNow(new Date(tx.booking_datetime), { addSuffix: true }) : '';
              return (
                <motion.div
                  key={tx.id}
                  variants={staggerItem}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconInfo.color}`}>
                    <TxIcon className={`h-5 w-5 ${iconInfo.iconColor}`} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{tx.transaction_information || tx.transaction_type}</p>
                    <p className="text-[11px] text-muted-foreground">{tx.transaction_type} · {timeAgo}</p>
                  </div>
                  <p className={`text-sm font-bold tabular-nums ${isCredit ? 'text-[hsl(150,60%,40%)]' : 'text-foreground'}`}>
                    {isCredit ? '+' : '-'}{Math.abs(amount).toLocaleString()} <span className="text-[10px] font-medium text-muted-foreground">{tx.currency}</span>
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
      </div>
    </div>
  );
};

export default CustomerHome;
