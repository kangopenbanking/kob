import React, { useState } from 'react';
import { Crown, CheckCircle, ArrowRight, Lock, Loader2, Sparkles, Shield, Zap, Wallet, AlertTriangle, CreditCard, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

interface EnterpriseUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: any;
  plans?: any[];
  currency: string;
  subscribing: boolean;
  onConfirm: (planId?: string) => void;
  walletBalance?: number;
  onFundWallet?: () => void;
}

const COMPARISON = [
  { feature: 'Store listing on marketplace', tiers: [true, true, true] },
  { feature: 'QR code payments', tiers: [true, true, true] },
  { feature: 'Up to 50 products', tiers: [true, false, false] },
  { feature: 'Unlimited products', tiers: [false, true, true] },
  { feature: 'Sales analytics', tiers: [false, true, true] },
  { feature: 'Multi-cashier support', tiers: [false, true, true] },
  { feature: 'WooCommerce sync', tiers: [false, true, true] },
  { feature: 'Priority support', tiers: [false, true, true] },
  { feature: 'Custom branding', tiers: [false, false, true] },
  { feature: 'API access', tiers: [false, false, true] },
  { feature: 'Multi-location inventory', tiers: [false, false, true] },
  { feature: 'Dedicated account manager', tiers: [false, false, true] },
  { feature: 'SLA guarantee (99.9%)', tiers: [false, false, true] },
];

const TIER_COLORS = [
  { icon: Shield, color: 'hsl(var(--fi-blue))', bg: 'hsl(var(--fi-blue))' },
  { icon: Zap, color: 'hsl(var(--fi-green))', bg: 'hsl(var(--fi-green))' },
  { icon: Crown, color: 'hsl(var(--fi-purple))', bg: 'hsl(var(--fi-purple))' },
];

function getTierMeta(_plan: any, idx: number) {
  const tierIdx = Math.min(idx, TIER_COLORS.length - 1);
  return TIER_COLORS[tierIdx];
}

export function EnterpriseUpgradeModal({
  open, onOpenChange, plan, plans = [], currency, subscribing, onConfirm,
  walletBalance = 0, onFundWallet,
}: EnterpriseUpgradeModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const allPlans = plans.length > 0 ? plans : (plan ? [plan] : []);
  const sortedPlans = [...allPlans].sort((a, b) => (a.price || 0) - (b.price || 0));

  const selectedPlan = sortedPlans.find(p => p.id === selectedPlanId);
  const selectedPrice = selectedPlan?.price || 0;
  const hasSufficientBalance = walletBalance >= selectedPrice;
  const shortfall = selectedPrice - walletBalance;

  const handleSubscribe = (p: any) => {
    setSubscribingPlanId(p.id);
    onConfirm(p.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="text-center p-6 pb-4">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--fi-purple))]/10 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-7 h-7 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
          </div>
          <DialogTitle className="text-xl font-bold">Choose Your Plan</DialogTitle>
          <DialogDescription className="text-sm">
            Select the plan that best fits your business needs
          </DialogDescription>
        </DialogHeader>

        {/* Wallet Balance Banner */}
        <div className="mx-6 mb-3 rounded-xl border border-border/50 bg-muted/30 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-primary" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium">Wallet Balance</p>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {walletBalance.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{currency}</span>
              </p>
            </div>
          </div>
          {onFundWallet && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl h-8 text-xs gap-1.5"
              onClick={onFundWallet}
            >
              <Wallet className="w-3.5 h-3.5" /> Fund Wallet
            </Button>
          )}
        </div>

        {/* Plan cards */}
        <div className="px-6 pb-2">
          <div className={`grid gap-4 ${sortedPlans.length >= 3 ? 'sm:grid-cols-3' : sortedPlans.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
            {sortedPlans.map((p, idx) => {
              const meta = getTierMeta(p, idx);
              const Icon = meta.icon;
              const isSelected = selectedPlanId === p.id;
              const isFree = (p.price || 0) === 0;
              const isSubscribing = subscribing && subscribingPlanId === p.id;
              const canAfford = walletBalance >= (p.price || 0);

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`relative rounded-2xl border-2 p-5 cursor-pointer transition-all duration-200 hover:shadow-md ${
                    isSelected ? 'shadow-md ring-1' : 'border-border/40 hover:border-border'
                  }`}
                  style={isSelected ? { borderColor: meta.color, boxShadow: `0 0 0 1px ${meta.color}20` } : {}}
                >
                  {/* Tier badge */}
                  {idx === sortedPlans.length - 1 && sortedPlans.length > 1 && (
                    <Badge className="absolute -top-2.5 right-4 text-[10px] font-bold" style={{ backgroundColor: meta.bg, color: 'white' }}>
                      Most Popular
                    </Badge>
                  )}

                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${meta.bg}15` }}>
                      <Icon className="w-4.5 h-4.5" style={{ color: meta.color }} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.duration_days} days</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <span className="text-2xl font-extrabold text-foreground">
                      {isFree ? 'Free' : `${(p.price || 0).toLocaleString()}`}
                    </span>
                    {!isFree && <span className="text-xs text-muted-foreground ml-1">{currency}</span>}
                  </div>

                  {/* Affordability indicator */}
                  {!isFree && (
                    <div className={`flex items-center gap-1.5 mb-3 text-[10px] font-medium rounded-lg px-2 py-1 ${
                      canAfford
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {canAfford ? (
                        <><CheckCircle className="w-3 h-3" /> Sufficient balance</>
                      ) : (
                        <><AlertTriangle className="w-3 h-3" /> Need {((p.price || 0) - walletBalance).toLocaleString()} more</>
                      )}
                    </div>
                  )}

                  {/* Features */}
                  <div className="space-y-1.5 mb-4">
                    {(Array.isArray(p.features_json) ? p.features_json.slice(0, 4) : []).map((f: string, j: number) => (
                      <div key={j} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                        <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: meta.color }} strokeWidth={1.5} />
                        <span>{f}</span>
                      </div>
                    ))}
                    {Array.isArray(p.features_json) && p.features_json.length > 4 && (
                      <p className="text-[10px] text-muted-foreground pl-5.5">+{p.features_json.length - 4} more features</p>
                    )}
                  </div>

                  <Button
                    className="w-full rounded-xl h-10 text-xs font-bold gap-2 transition-all"
                    style={
                      isSelected || idx === sortedPlans.length - 1
                        ? { backgroundColor: meta.bg, color: 'white' }
                        : {}
                    }
                    variant={isSelected || idx === sortedPlans.length - 1 ? 'default' : 'outline'}
                    disabled={subscribing}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isFree && !canAfford) {
                        setSelectedPlanId(p.id);
                        return;
                      }
                      handleSubscribe(p);
                    }}
                  >
                    {isSubscribing ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                      </span>
                    ) : isFree ? (
                      <>Activate Free Plan <ArrowRight className="w-3.5 h-3.5" /></>
                    ) : canAfford ? (
                      <>Pay with Wallet <ArrowRight className="w-3.5 h-3.5" /></>
                    ) : (
                      <>Select Plan <ArrowRight className="w-3.5 h-3.5" /></>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Insufficient Balance Payment Options */}
        {selectedPlanId && selectedPrice > 0 && !hasSufficientBalance && (
          <div className="mx-6 mb-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" strokeWidth={1.8} />
              <div>
                <p className="text-sm font-bold text-foreground">Insufficient Balance</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You need <span className="font-semibold text-foreground">{shortfall.toLocaleString()} {currency}</span> more to subscribe to {selectedPlan?.name}.
                </p>
              </div>
            </div>

            <p className="text-[11px] font-semibold text-muted-foreground mb-2.5 uppercase tracking-wider">Fund your wallet via</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { icon: Smartphone, label: 'Mobile Money', desc: 'MTN / Orange' },
                { icon: CreditCard, label: 'Bank Card', desc: 'Visa / MC' },
                { icon: Wallet, label: 'Bank Transfer', desc: 'Direct deposit' },
                { icon: ArrowRight, label: 'Go to Wallet', desc: 'All methods', primary: true },
              ].map((method, i) => (
                <button
                  key={i}
                  onClick={() => onFundWallet?.()}
                  className={`rounded-xl border p-3 text-left transition-all hover:shadow-sm active:scale-[0.97] ${
                    method.primary
                      ? 'border-primary/30 bg-primary/5 hover:bg-primary/10'
                      : 'border-border/50 bg-card hover:bg-muted/40'
                  }`}
                >
                  <method.icon className={`w-4 h-4 mb-1.5 ${method.primary ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.8} />
                  <p className={`text-[11px] font-bold ${method.primary ? 'text-primary' : 'text-foreground'}`}>{method.label}</p>
                  <p className="text-[10px] text-muted-foreground">{method.desc}</p>
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
              <div className="text-[11px]">
                <span className="text-muted-foreground">Current: </span>
                <span className="font-bold text-foreground tabular-nums">{walletBalance.toLocaleString()} {currency}</span>
              </div>
              <div className="text-[11px]">
                <span className="text-muted-foreground">Required: </span>
                <span className="font-bold text-foreground tabular-nums">{selectedPrice.toLocaleString()} {currency}</span>
              </div>
              <div className="text-[11px]">
                <span className="text-muted-foreground">Shortfall: </span>
                <span className="font-bold text-amber-600 tabular-nums">{shortfall.toLocaleString()} {currency}</span>
              </div>
            </div>
          </div>
        )}

        {/* Toggle comparison */}
        <div className="px-6 pb-2">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            {showComparison ? 'Hide' : 'View'} Full Feature Comparison
            <ArrowRight className={`w-3 h-3 transition-transform ${showComparison ? 'rotate-90' : ''}`} />
          </button>
        </div>

        {/* Comparison table */}
        {showComparison && (
          <div className="px-6 pb-6 pt-1">
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-3 font-semibold text-foreground">Feature</th>
                    {sortedPlans.map((p, idx) => {
                      const isLast = idx === sortedPlans.length - 1 && sortedPlans.length > 1;
                      return (
                        <th key={p.id} className="text-center p-3 font-semibold text-foreground w-24">
                          <span className="flex items-center justify-center gap-1">
                            {isLast && <Crown className="w-3 h-3 text-[hsl(var(--fi-purple))]" />}
                            {p.name}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => {
                    const isExclusive = row.tiers.filter(Boolean).length === 1 && row.tiers[row.tiers.length - 1];
                    return (
                      <tr key={i} className={`border-b last:border-0 ${isExclusive ? 'bg-[hsl(var(--fi-purple))]/[0.03]' : ''}`}>
                        <td className="p-3 text-foreground">{row.feature}</td>
                        {sortedPlans.map((p, idx) => {
                          const tierIdx = Math.min(idx, row.tiers.length - 1);
                          const included = row.tiers[tierIdx];
                          const isEnterpriseTier = idx === sortedPlans.length - 1 && sortedPlans.length > 1;
                          return (
                            <td key={p.id} className="text-center p-3">
                              {included
                                ? <CheckCircle className={`w-4 h-4 mx-auto ${isEnterpriseTier ? 'text-[hsl(var(--fi-purple))]' : 'text-[hsl(var(--fi-green))]'}`} strokeWidth={1.5} />
                                : <Lock className="w-3.5 h-3.5 text-muted-foreground/30 mx-auto" strokeWidth={1.5} />
                              }
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
