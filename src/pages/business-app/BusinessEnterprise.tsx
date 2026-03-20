import React, { useState } from 'react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useNavigate } from 'react-router-dom';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Palette, Key, MapPin, Users, ScanLine, BarChart3, Clock, CreditCard,
  ChevronRight, Crown, Lock, CheckCircle2, Shield, ArrowRight, Wallet, Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { EnterpriseUpgradeModal } from '@/components/storefront/EnterpriseUpgradeModal';

const enterpriseFeatures = [
  { icon: Palette, label: 'Custom Branding', subtitle: 'White-label your app with custom colors, logos & domain', path: '/biz/storefront', gated: true },
  { icon: Key, label: 'API Key Management', subtitle: 'Create, rotate & manage API credentials', path: '/biz/api-keys', gated: true },
  { icon: MapPin, label: 'Multi-Location', subtitle: 'Manage inventory & staff across locations', path: '/biz/inventory', gated: true },
  { icon: Users, label: 'Subaccounts', subtitle: 'Create & manage merchant subaccounts', path: '/biz/subaccounts', gated: true },
  { icon: ScanLine, label: 'Barcode Scanner', subtitle: 'Camera-based SKU & barcode scanning for POS', path: '/biz/till', gated: true },
  { icon: Clock, label: 'Shift Management', subtitle: 'Staff shifts, cash drawer tracking & end-of-day', path: '/biz/till', gated: true },
  { icon: CreditCard, label: 'Additional Payout Methods', subtitle: 'PayPal, Visa Direct, RTGS & more beyond the 2 free accounts', path: '/biz/wallet', gated: true },
  { icon: BarChart3, label: 'Advanced Analytics', subtitle: 'Detailed reports, exports & custom dashboards', path: '/biz/advanced-analytics', gated: true },
];

export default function BusinessEnterprise() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { merchantId } = useMerchantContext();

  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [subscribing, setSubscribing] = useState(false);

  const { data: merchant } = useQuery({
    queryKey: ['biz-enterprise-merchant', merchantId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      if (merchantId) {
        const { data } = await supabase.from('gateway_merchants').select('id, plan_tier').eq('id', merchantId).maybeSingle();
        return data;
      }
      const { data } = await supabase.from('gateway_merchants').select('id, plan_tier').eq('user_id', user.id).maybeSingle();
      return data;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ['biz-enterprise-plans'],
    queryFn: async () => {
      const { data } = await supabase.from('pos_subscription_plans').select('*').eq('is_active', true).order('price');
      return data || [];
    },
  });

  const { data: walletBalance } = useQuery({
    queryKey: ['biz-enterprise-wallet', merchant?.id],
    enabled: !!merchant?.id,
    queryFn: async () => {
      const { data } = await supabase.from('gateway_merchant_wallets').select('available_balance, currency').eq('merchant_id', merchant!.id);
      return data || [];
    },
  });

  const { isAdmin } = useIsAdmin();
  const isEnterprise = merchant?.plan_tier === 'enterprise' || isAdmin;
  const enterprisePlan = plans?.find((p: any) => p.tier === 'enterprise');

  const handleUpgradeClick = () => {
    if (enterprisePlan) {
      setSelectedPlan(enterprisePlan);
      setUpgradeModalOpen(true);
    } else {
      toast.info('No enterprise plan is currently available. Please contact support.');
    }
  };

  const handleSubscribe = async (planId?: string) => {
    if (!merchant?.id) return;
    const targetPlan = planId ? plans?.find((p: any) => p.id === planId) : selectedPlan;
    if (!targetPlan) return;
    setSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('pos-store-subscription', {
        body: { merchant_id: merchant.id, plan_id: targetPlan.id },
      });

      let responseBody = data;
      if (error) {
        try {
          const bodyText = typeof error?.context?.body === 'string'
            ? error.context.body
            : JSON.stringify(error?.context?.body || {});
          responseBody = JSON.parse(bodyText);
        } catch {
          throw error;
        }
      }

      if (responseBody?.error === 'insufficient_balance') {
        toast.error('Insufficient wallet balance', {
          description: `You need ${responseBody.required_amount?.toLocaleString()} ${responseBody.currency} but only have ${responseBody.available_balance?.toLocaleString()} ${responseBody.currency}. Add funds first.`,
          duration: 6000,
          action: { label: 'Fund Wallet', onClick: () => navigate('/biz/wallet') },
        });
        setUpgradeModalOpen(false);
        return;
      }

      if (responseBody?.error === 'already_subscribed') {
        toast.info('You already have an active subscription.');
        setUpgradeModalOpen(false);
        return;
      }

      if (responseBody?.error === 'not_authorized') {
        toast.error('You are not authorized to upgrade this merchant account.');
        setUpgradeModalOpen(false);
        return;
      }

      if (responseBody?.error && !responseBody?.subscription) {
        throw new Error(responseBody.message || responseBody.error);
      }

      toast.success(`${targetPlan.name} subscription activated! 🎉`, {
        description: `All ${targetPlan.name} features are now unlocked.`,
      });
      setUpgradeModalOpen(false);
      window.location.reload();
    } catch (err: any) {
      console.error('Subscription error:', err);
      toast.error(err.message || 'Subscription failed. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  const handleFeatureClick = (feature: typeof enterpriseFeatures[0]) => {
    if (!isEnterprise && feature.gated) {
      handleUpgradeClick();
      return;
    }
    navigate(feature.path);
  };

  // Find wallet balance for enterprise plan currency
  const planCurrency = enterprisePlan?.currency || 'XAF';
  const walletEntry = walletBalance?.find((w: any) => w.currency === planCurrency);
  const currentBalance = walletEntry?.available_balance || 0;

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      <header className="pt-4 md:pt-0 mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Enterprise</h1>
          {isEnterprise ? (
            <Badge className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3" /> Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-600">
              <Crown className="h-3 w-3" /> PRO
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">Advanced tools for growing businesses</p>
      </header>

      {/* Hero Banner */}
      {!isEnterprise ? (
        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-card to-amber-500/5 p-5 mb-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 shrink-0">
              <Crown className="h-6 w-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-[15px] font-bold text-foreground">Upgrade to Enterprise</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Unlock custom branding, multi-location management,
                API integrations, shift tracking, and advanced analytics.
              </p>
              {enterprisePlan && (
                <p className="text-xs font-semibold text-amber-700 mt-1.5">
                  {enterprisePlan.price?.toLocaleString()} {planCurrency} / {enterprisePlan.duration_days} days
                </p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl gap-1.5 h-8 text-xs"
                  onClick={handleUpgradeClick}
                >
                  <Crown className="h-3.5 w-3.5" /> Upgrade Now <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                {enterprisePlan && enterprisePlan.price > 0 && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> Balance: {currentBalance.toLocaleString()} {planCurrency}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-emerald-500/5 p-5 mb-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 shrink-0">
              <Shield className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-foreground">Enterprise Active</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                All advanced features are unlocked. Manage your enterprise tools below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Features Grid */}
      <div className={cn('gap-3', isMobile ? 'space-y-2' : 'grid grid-cols-2 gap-3')}>
        {enterpriseFeatures.map((feature, i) => {
          const Icon = feature.icon;
          const locked = !isEnterprise && feature.gated;
          return (
            <motion.button
              key={feature.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                'w-full rounded-2xl border p-4 flex items-center gap-3.5 text-left transition-colors',
                locked
                  ? 'border-border/30 bg-muted/30 opacity-70'
                  : 'border-border/40 bg-card hover:bg-muted/40 active:bg-muted/60'
              )}
              onClick={() => handleFeatureClick(feature)}
            >
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl shrink-0',
                locked ? 'bg-muted' : 'bg-primary/10',
              )}>
                <Icon className={cn('h-5 w-5', locked ? 'text-muted-foreground' : 'text-primary')} strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn('text-[13px] font-semibold', locked ? 'text-muted-foreground' : 'text-foreground')}>{feature.label}</p>
                  {locked && (
                    <Badge variant="outline" className="text-[9px] gap-0.5 border-amber-500/30 text-amber-600 py-0 px-1.5">
                      <Lock className="h-2.5 w-2.5" /> PRO
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{feature.subtitle}</p>
              </div>
              {!locked && (
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" strokeWidth={2} />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Upgrade Modal */}
      <EnterpriseUpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        plan={selectedPlan}
        currency={planCurrency}
        subscribing={subscribing}
        onConfirm={handleSubscribe}
      />
    </div>
  );
}
