import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFeeEstimate } from '@/hooks/useFeeEstimate';
import { Lock, Unlock, FileText, CheckCircle2, Loader2, ShieldCheck, BarChart3, Scale, Wallet, AlertCircle } from 'lucide-react';
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

  // Fetch user's wallet balance
  const { data: walletBalance } = useQuery({
    queryKey: ['wallet-balance-for-report'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { data: account } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (!account) return 0;
      const { data: balance } = await supabase
        .from('account_balances')
        .select('amount')
        .eq('account_id', account.id)
        .eq('balance_type', 'ClosingAvailable')
        .eq('credit_debit_indicator', 'Credit')
        .maybeSingle();
      return balance?.amount || 0;
    },
  });

  const hasSufficientFunds = (walletBalance || 0) >= reportFee;

  const handlePurchase = async () => {
    if (!hasSufficientFunds) {
      toast.error('Insufficient funds. Please add money to your wallet first.');
      navigate('/wallet');
      return;
    }

    setIsPurchasing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user's account
      const { data: account } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (!account) throw new Error('No wallet account found');

      // Get current balance
      const { data: balanceRow } = await supabase
        .from('account_balances')
        .select('id, amount')
        .eq('account_id', account.id)
        .eq('balance_type', 'ClosingAvailable')
        .eq('credit_debit_indicator', 'Credit')
        .maybeSingle();

      if (!balanceRow || balanceRow.amount < reportFee) {
        toast.error('Insufficient funds. Please add money to your wallet.');
        navigate('/wallet');
        return;
      }

      // Deduct from wallet balance
      const { error: balanceError } = await supabase
        .from('account_balances')
        .update({
          amount: balanceRow.amount - reportFee,
          balance_datetime: new Date().toISOString(),
        })
        .eq('id', balanceRow.id);

      if (balanceError) throw balanceError;

      // Record the debit transaction
      await supabase.from('transactions').insert([{
        account_id: account.id,
        amount: reportFee,
        currency: 'XAF',
        credit_debit_indicator: 'Debit',
        status: 'Booked',
        booking_datetime: new Date().toISOString(),
        value_datetime: new Date().toISOString(),
        transaction_type: 'purchase',
        transaction_information: 'Full Credit Report Purchase',
        user_id: user.id,
        metadata: { type: 'credit_report_purchase' },
      }]);

      // Record the purchase
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
      queryClient.invalidateQueries({ queryKey: ['wallet-balance-for-report'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      toast.success('Full Credit Report unlocked! Funds deducted from your wallet.');
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
    <div className="rounded-2xl bg-muted/40 overflow-hidden">
      <div className="relative">
        <div className="p-6 relative z-20">
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
              <span
                onClick={() => navigate('/credit-report')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 cursor-pointer transition-colors"
              >
                <FileText className="h-4 w-4" />
                View Full Report
              </span>
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

              <div className="space-y-2">
                {reportSections.map((section, i) => {
                  const Icon = section.icon;
                  return (
                    <motion.div
                      key={section.label}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="flex items-center gap-3 rounded-xl bg-background/60 p-3"
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

              {/* Price and wallet info */}
              <div className="text-center space-y-3 pt-2">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-black text-foreground">
                    {feeLoading ? '...' : reportFee.toLocaleString()}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">XAF</span>
                </div>
                <p className="text-xs text-muted-foreground">Valid for 30 days after purchase</p>

                {/* Wallet balance notice */}
                {!hasSufficientFunds && walletBalance !== undefined && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-left"
                  >
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-destructive">Insufficient wallet balance</p>
                      <p className="text-[11px] text-muted-foreground">
                        Current balance: {(walletBalance || 0).toLocaleString()} XAF.{' '}
                        <span
                          onClick={() => navigate('/wallet')}
                          className="text-primary font-semibold cursor-pointer hover:underline"
                        >
                          Add funds →
                        </span>
                      </p>
                    </div>
                  </motion.div>
                )}

                {hasSufficientFunds && walletBalance !== undefined && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" />
                    <span>Wallet balance: {(walletBalance || 0).toLocaleString()} XAF</span>
                  </div>
                )}

                <span
                  onClick={handlePurchase}
                  className={`inline-flex items-center justify-center gap-2 text-base font-semibold cursor-pointer transition-colors ${
                    isPurchasing || feeLoading || purchaseLoading
                      ? 'text-muted-foreground pointer-events-none'
                      : hasSufficientFunds
                        ? 'text-primary hover:text-primary/80'
                        : 'text-primary hover:text-primary/80'
                  }`}
                >
                  {isPurchasing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  {hasSufficientFunds ? 'Pay & Unlock Report' : 'Add Funds & Unlock'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
