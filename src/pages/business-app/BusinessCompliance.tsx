import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Shield, FileCheck, AlertTriangle, CheckCircle2, Clock, Upload,
  ChevronRight, ExternalLink, Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PageGuide } from '@/components/business-app/PageGuide';

export default function BusinessCompliance() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { merchantId } = useMerchantContext();

  // KYB status
  const { data: merchant, isLoading: merchantLoading } = useQuery({
    queryKey: ['biz-compliance-merchant', merchantId],
    queryFn: async () => {
      if (!merchantId) return null;
      const { data } = await supabase.from('gateway_merchants').select('*').eq('id', merchantId).single();
      return data;
    },
    enabled: !!merchantId,
  });

  // Disputes
  const { data: disputes, isLoading: disputesLoading } = useQuery({
    queryKey: ['biz-disputes', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data } = await supabase.from('gateway_disputes').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!merchantId,
  });

  const meta = (merchant?.metadata as any) || {};
  const kybSubmission = meta.kyb_submission || {};
  const kybStatus = kybSubmission.status || meta.kyb_status || 'not_submitted';

  // Setup checklist
  const checklist = [
    { label: 'Business profile', done: !!merchant?.business_name },
    { label: 'Email verified', done: !!merchant?.business_email },
    { label: 'KYB submitted', done: kybStatus !== 'not_submitted' },
    { label: 'KYB approved', done: kybStatus === 'approved' },
    { label: 'Settlement account', done: false }, // Would need separate query
    { label: 'First transaction', done: false },
  ];
  const completedSteps = checklist.filter(c => c.done).length;
  const progress = Math.round((completedSteps / checklist.length) * 100);

  const kybStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
    not_submitted: { label: 'Not Submitted', variant: 'secondary', icon: Upload },
    pending: { label: 'Under Review', variant: 'outline', icon: Clock },
    approved: { label: 'Approved', variant: 'default', icon: CheckCircle2 },
    rejected: { label: 'Rejected', variant: 'destructive', icon: AlertTriangle },
  };

  const kybInfo = kybStatusConfig[kybStatus] || kybStatusConfig.not_submitted;
  const KybIcon = kybInfo.icon;

  const isLoading = merchantLoading || disputesLoading;

  const formatXAF = (n: number) =>
    new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      <PageGuide
        title="Compliance"
        summary="Track your KYB verification, open disputes, and the setup steps required to stay compliant."
        steps={[
          { title: 'Complete KYB verification', description: 'Submit business documents to unlock higher limits and full payout access.' },
          { title: 'Resolve open disputes', description: 'Address chargebacks quickly to protect your standing with payment networks.' },
          { title: 'Follow the setup checklist', description: 'Tick off remaining items (settlement account, webhooks, policies) for full readiness.' },
        ]}
        learnMoreHref="/developer/compliance"
      />
      <header className="pt-4 md:pt-0 mb-5">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Compliance</h1>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">KYB verification, disputes & setup checklist</p>
      </header>

      <div className={cn(isMobile ? 'space-y-5' : 'grid grid-cols-2 gap-5')}>
        {/* KYB Status Card */}
        <div className="rounded-2xl border border-border/40 bg-card p-5">
          <h2 className="text-[15px] font-bold text-foreground mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" strokeWidth={1.8} />
            KYB Verification
          </h2>

          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-2xl shrink-0',
              kybStatus === 'approved' ? 'bg-emerald-500/10' : kybStatus === 'rejected' ? 'bg-destructive/10' : 'bg-muted/60'
            )}>
              <KybIcon className={cn(
                'h-6 w-6',
                kybStatus === 'approved' ? 'text-emerald-600' : kybStatus === 'rejected' ? 'text-destructive' : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <Badge variant={kybInfo.variant} className="text-xs">{kybInfo.label}</Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {kybStatus === 'not_submitted' && 'Submit your business documents to get verified.'}
                {kybStatus === 'pending' && 'Your documents are being reviewed by our team.'}
                {kybStatus === 'approved' && 'Your business has been verified successfully.'}
                {kybStatus === 'rejected' && (kybSubmission.rejection_reason || 'Please resubmit with corrected documents.')}
              </p>
            </div>
          </div>

          {kybStatus === 'approved' && kybSubmission.registration_number && (
            <div className="rounded-xl bg-muted/40 p-3 space-y-1.5 text-xs mb-4">
              {kybSubmission.registration_number && (
                <div className="flex justify-between"><span className="text-muted-foreground">Reg. Number</span><span className="font-medium">{kybSubmission.registration_number}</span></div>
              )}
              {kybSubmission.tax_id && (
                <div className="flex justify-between"><span className="text-muted-foreground">Tax ID</span><span className="font-medium">{kybSubmission.tax_id}</span></div>
              )}
            </div>
          )}

          {kybStatus !== 'approved' && (
            <Button size="sm" className="rounded-xl gap-1.5 w-full" onClick={() => navigate('/biz/kyb')}>
              <FileCheck className="h-3.5 w-3.5" />
              {kybStatus === 'not_submitted' ? 'Start KYB Verification' : kybStatus === 'rejected' ? 'Resubmit Documents' : 'View Status'}
            </Button>
          )}
        </div>

        {/* Setup Checklist */}
        <div className="rounded-2xl border border-border/40 bg-card p-5">
          <h2 className="text-[15px] font-bold text-foreground mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" strokeWidth={1.8} />
            Setup Checklist
          </h2>

          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">{completedSteps} of {checklist.length} complete</span>
              <span className="font-bold text-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="space-y-2">
            {checklist.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 py-1.5"
              >
                <div className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full shrink-0 text-xs font-bold',
                  item.done ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted/60 text-muted-foreground'
                )}>
                  {item.done ? <CheckCircle2 className="h-4 w-4" /> : <span>{i + 1}</span>}
                </div>
                <span className={cn('text-sm', item.done ? 'text-foreground font-medium line-through decoration-muted-foreground/40' : 'text-muted-foreground')}>
                  {item.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Disputes */}
        <div className={cn(!isMobile && 'col-span-2', 'rounded-2xl border border-border/40 bg-card p-5')}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" strokeWidth={1.8} />
              Disputes
            </h2>
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => navigate('/biz/disputes')}>
              View All <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {!disputes?.length ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No disputes. Great job!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {disputes.slice(0, 5).map((d: any) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.reason || 'Dispute'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm font-bold">{formatXAF(d.amount || 0)}</p>
                    <Badge variant={d.status === 'resolved' ? 'default' : d.status === 'lost' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {d.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
