import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFeeEstimate } from '@/hooks/useFeeEstimate';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Unlock, FileText, CheckCircle2, Loader2, ShieldCheck, BarChart3, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function FullReportPaywall() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPurchasing, setIsPurchasing] = useState(false);

  const { fee, isLoading: feeLoading } = useFeeEstimate({
    channel: 'credit_report_purchase',
    amount: 1,
    scope: 'platform',
  });

  const reportFee = fee.fixedFee || 2500;

  const { data: activePurchase, isLoading: purchaseLoading } = useQuery({
    queryKey: ['credit-report-purchase'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('credit_report_purchases')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('expires_at', new Date().toISOString())
        .order('purchased_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('credit_report_purchases').insert({
        user_id: user.id,
        amount: reportFee,
        currency: 'XAF',
        status: 'completed',
        payment_method: 'wallet',
        report_type: 'full',
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['credit-report-purchase'] });
      toast.success('Full Credit Report unlocked!');
      navigate('/credit-report');
    } catch (err: any) {
      toast.error(err.message || 'Purchase failed');
    } finally {
      setIsPurchasing(false);
    }
  };

  const hasAccess = !!activePurchase;

  const reportSections = [
    { icon: BarChart3, label: 'Detailed Score Analysis' },
    { icon: Scale, label: 'Loan Eligibility Assessment' },
    { icon: ShieldCheck, label: 'Full Credit History' },
    { icon: FileText, label: 'Downloadable PDF Report' },
  ];

  return (
    <Card className="overflow-hidden border-primary/20">
      <div className="relative">
        {/* Blurred preview background */}
        {!hasAccess && (
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/60 to-card z-10" />
        )}

        <CardContent className="p-6 relative z-20">
          {hasAccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                <Unlock className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Full Report Unlocked</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Valid until {new Date(activePurchase.expires_at).toLocaleDateString()}
                </p>
              </div>
              <Button onClick={() => navigate('/credit-report')} className="rounded-full gap-2 w-full">
                <FileText className="h-4 w-4" />
                View Full Report
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-5">
              <div className="text-center">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Lock className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Unlock Full Credit Report</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Get detailed insights, loan eligibility, and a downloadable report
                </p>
              </div>

              {/* Preview sections with blur overlay */}
              <div className="space-y-2">
                {reportSections.map((section, i) => {
                  const Icon = section.icon;
                  return (
                    <motion.div
                      key={section.label}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"
                    >
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{section.label}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Price and CTA */}
              <div className="text-center space-y-3 pt-2">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-black text-foreground">
                    {feeLoading ? '...' : reportFee.toLocaleString()}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">XAF</span>
                </div>
                <p className="text-xs text-muted-foreground">Valid for 30 days after purchase</p>
                <Button
                  onClick={handlePurchase}
                  disabled={isPurchasing || feeLoading || purchaseLoading}
                  className="rounded-full gap-2 w-full text-base h-12"
                  size="lg"
                >
                  {isPurchasing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  Pay & Unlock Report
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
