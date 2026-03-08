import React from 'react';
import { Crown, CheckCircle, X, ArrowRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

interface EnterpriseUpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: any;
  currency: string;
  subscribing: boolean;
  onConfirm: () => void;
}

const COMPARISON = [
  { feature: 'Store listing on marketplace', starter: true, pro: true, enterprise: true },
  { feature: 'QR code payments', starter: true, pro: true, enterprise: true },
  { feature: 'Up to 50 products', starter: true, pro: false, enterprise: false },
  { feature: 'Unlimited products', starter: false, pro: true, enterprise: true },
  { feature: 'Sales analytics', starter: false, pro: true, enterprise: true },
  { feature: 'Multi-cashier support', starter: false, pro: true, enterprise: true },
  { feature: 'WooCommerce sync', starter: false, pro: true, enterprise: true },
  { feature: 'Priority support', starter: false, pro: true, enterprise: true },
  { feature: 'Custom branding', starter: false, pro: false, enterprise: true },
  { feature: 'API access', starter: false, pro: false, enterprise: true },
  { feature: 'Multi-location inventory', starter: false, pro: false, enterprise: true },
  { feature: 'Dedicated account manager', starter: false, pro: false, enterprise: true },
  { feature: 'SLA guarantee (99.9%)', starter: false, pro: false, enterprise: true },
];

export function EnterpriseUpgradeModal({ open, onOpenChange, plan, currency, subscribing, onConfirm }: EnterpriseUpgradeModalProps) {
  const isEnterprise = (plan?.tier === 'enterprise') || (plan?.name || '').toLowerCase().includes('enterprise');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="text-center pb-2">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--fi-purple))]/10 flex items-center justify-center mx-auto mb-3">
            <Crown className="w-7 h-7 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
          </div>
          <DialogTitle className="text-xl font-bold">
            {isEnterprise ? 'Confirm Enterprise Subscription' : `Subscribe to ${plan?.name || 'Plan'}`}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isEnterprise
              ? 'Unlock all five Enterprise-exclusive features with this plan.'
              : 'Review the feature comparison below before subscribing.'}
          </DialogDescription>
        </DialogHeader>

        {/* Plan summary */}
        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30 my-2">
          <div>
            <p className="text-sm font-bold text-foreground">{plan?.name}</p>
            <p className="text-xs text-muted-foreground">{plan?.duration_days} days</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-extrabold text-foreground">{plan?.price?.toLocaleString()} {currency}</p>
          </div>
        </div>

        {/* Feature comparison table */}
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left p-3 font-semibold text-foreground">Feature</th>
                <th className="text-center p-3 font-semibold text-foreground w-20">Starter</th>
                <th className="text-center p-3 font-semibold text-foreground w-20">Pro</th>
                <th className="text-center p-3 font-semibold text-foreground w-24">
                  <span className="flex items-center justify-center gap-1">
                    <Crown className="w-3 h-3 text-[hsl(var(--fi-purple))]" /> Enterprise
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={i} className={`border-b last:border-0 ${!row.starter && !row.pro && row.enterprise ? 'bg-[hsl(var(--fi-purple))]/[0.03]' : ''}`}>
                  <td className="p-3 text-foreground">{row.feature}</td>
                  <td className="text-center p-3">
                    {row.starter ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" strokeWidth={1.5} /> : <Lock className="w-3.5 h-3.5 text-muted-foreground/30 mx-auto" strokeWidth={1.5} />}
                  </td>
                  <td className="text-center p-3">
                    {row.pro ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" strokeWidth={1.5} /> : <Lock className="w-3.5 h-3.5 text-muted-foreground/30 mx-auto" strokeWidth={1.5} />}
                  </td>
                  <td className="text-center p-3">
                    {row.enterprise ? (
                      <CheckCircle className="w-4 h-4 text-[hsl(var(--fi-purple))] mx-auto" strokeWidth={1.5} />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-muted-foreground/30 mx-auto" strokeWidth={1.5} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isEnterprise && (
          <div className="p-3 rounded-xl border border-[hsl(var(--fi-purple))]/20 bg-[hsl(var(--fi-purple))]/5 text-xs text-[hsl(var(--fi-purple))]">
            <strong>Enterprise exclusive:</strong> Custom branding, API access, multi-location inventory, dedicated account manager, and 99.9% SLA guarantee.
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={subscribing}
            className="bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white rounded-xl gap-2"
          >
            {subscribing ? (
              <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Subscribing...</span>
            ) : (
              <>Confirm & Subscribe <ArrowRight className="w-4 h-4" /></>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
