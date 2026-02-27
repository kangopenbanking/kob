import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle, Info, Bell, RefreshCw, Wallet, CreditCard, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';

interface AlertItem {
  id: string;
  type: 'success' | 'info' | 'warning';
  title: string;
  message: string;
  time: string;
  icon: 'wallet' | 'transfer' | 'kyc' | 'card' | 'default';
}

const iconMap = {
  success: CheckCircle2,
  info: Info,
  warning: AlertCircle,
};

const colorMap = {
  success: 'bg-primary/10 text-primary',
  info: 'bg-secondary/10 text-secondary',
  warning: 'bg-destructive/10 text-destructive',
};

const BankAlerts: React.FC = () => {
  const navigate = useNavigate();
  const { institutionId } = useParams();
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading, isRefetching } = useQuery({
    queryKey: ['bank-alerts', institutionId],
    queryFn: async (): Promise<AlertItem[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const results: AlertItem[] = [];

      // Fetch funding intents
      const { data: fundings } = await supabase
        .from('funding_intents')
        .select('id, amount, currency, method, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      (fundings || []).forEach(f => {
        const amt = `${Number(f.amount).toLocaleString()} ${f.currency || 'XAF'}`;
        if (f.status === 'successful') {
          results.push({ id: `f-${f.id}`, type: 'success', title: 'Funding Complete', message: `${amt} added via ${(f.method || '').replace(/_/g, ' ')}`, time: f.created_at || '', icon: 'wallet' });
        } else if (f.status === 'failed') {
          results.push({ id: `f-${f.id}`, type: 'warning', title: 'Funding Failed', message: `${amt} via ${(f.method || '').replace(/_/g, ' ')} failed`, time: f.created_at || '', icon: 'wallet' });
        } else if (f.status === 'pending') {
          results.push({ id: `f-${f.id}`, type: 'info', title: 'Funding Pending', message: `${amt} via ${(f.method || '').replace(/_/g, ' ')} is processing`, time: f.created_at || '', icon: 'wallet' });
        }
      });

      // Fetch KYC verifications
      const { data: kycs } = await supabase
        .from('kyc_verifications')
        .select('id, status, verification_type, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      (kycs || []).forEach(k => {
        if (k.status === 'approved' || k.status === 'verified') {
          results.push({ id: `k-${k.id}`, type: 'success', title: 'KYC Approved', message: `Your ${k.verification_type} verification is complete`, time: k.updated_at || k.created_at || '', icon: 'kyc' });
        } else if (k.status === 'rejected') {
          results.push({ id: `k-${k.id}`, type: 'warning', title: 'KYC Rejected', message: `Your ${k.verification_type} verification was rejected`, time: k.updated_at || k.created_at || '', icon: 'kyc' });
        } else if (k.status === 'pending') {
          results.push({ id: `k-${k.id}`, type: 'info', title: 'KYC Under Review', message: `Your ${k.verification_type} verification is being reviewed`, time: k.created_at || '', icon: 'kyc' });
        }
      });

      // Fetch recent transactions (via accounts scoped to institution)
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('institution_id', institutionId!);

      const accountIds = (accounts || []).map(a => a.id);
      if (accountIds.length > 0) {
        const { data: txns } = await supabase
          .from('transactions')
          .select('id, amount, currency, credit_debit_indicator, transaction_information, created_at')
          .in('account_id', accountIds)
          .order('created_at', { ascending: false })
          .limit(10);

        (txns || []).forEach((t: any) => {
          const amt = `${Number(t.amount).toLocaleString()} ${t.currency || 'XAF'}`;
          results.push({
            id: `t-${t.id}`,
            type: t.credit_debit_indicator === 'Credit' ? 'success' : 'info',
            title: t.credit_debit_indicator === 'Credit' ? 'Money Received' : 'Payment Sent',
            message: `${amt} — ${t.transaction_information || 'Transaction'}`,
            time: t.created_at || '',
            icon: 'transfer',
          });
        });
      }

      // Sort by time descending
      results.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return results.slice(0, 30);
    },
  });

  const formatTime = (time: string) => {
    try {
      return formatDistanceToNow(new Date(time), { addSuffix: true });
    } catch {
      return time;
    }
  };

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Back
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['bank-alerts', institutionId] })}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} strokeWidth={1.5} />
        </Button>
      </div>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Notifications</h1>
      <p className="mb-6 text-sm text-muted-foreground">Alerts & updates</p>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading notifications...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" strokeWidth={1} />
          <p className="text-sm font-medium text-foreground">No notifications yet</p>
          <p className="text-xs text-muted-foreground mt-1">Your transaction alerts and updates will appear here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {alerts.map((alert, i) => {
            const Icon = iconMap[alert.type];
            const colors = colorMap[alert.type];
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-start gap-3 rounded-xl border bg-card p-4"
              >
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colors}`}>
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/60">{formatTime(alert.time)}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BankAlerts;
