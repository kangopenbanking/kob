import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, TrendingUp, CheckCircle2, Loader2, Plus, Calendar, Banknote, Info, Shield, BadgeCheck, Flame, Clock, CreditCard, ChevronRight, XCircle, AlertTriangle } from 'lucide-react';
import { HowItWorksFlow, type FlowStep } from '@/components/customer-app/HowItWorksFlow';
import { motion, AnimatePresence } from 'framer-motion';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerTransactions, useCustomerCreditScore } from '@/hooks/useCustomerData';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

const CustomerRentReporting: React.FC = () => {
  const tr = useHarvestedT('customer');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCustomerAuth();
  const [showSetup, setShowSetup] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);

  const [rentAmount, setRentAmount] = useState('');
  const [landlordName, setLandlordName] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [submitting, setSubmitting] = useState(false);

  const { data: allTxns = [], isLoading } = useCustomerTransactions(user?.id, undefined, 50);
  const { data: creditScore } = useCustomerCreditScore(user?.id);

  // Fetch rent plans
  const { data: rentPlans = [], refetch: refetchPlans } = useQuery({
    queryKey: ['rent-plans', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('piggybank_plans')
        .select('id, plan_name, plan_type, target_amount, installment_amount, schedule_frequency, status, rent_reference, created_at, piggybank_payments(id, amount, status, paid_at, due_date, credit_event_id)')
        .eq('user_id', user!.id)
        .eq('plan_type', 'rent')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Filter rent payments from transactions
  const rentPayments = allTxns.filter((tx: any) =>
    tx.transaction_type === 'rent_payment' ||
    (tx.transaction_information || '').toLowerCase().includes('rent')
  );

  // Combine rent plan payments
  const planPayments = rentPlans.flatMap((p: any) =>
    (p.piggybank_payments || []).map((pay: any) => ({
      ...pay,
      plan_name: p.plan_name,
      rent_reference: p.rent_reference,
    }))
  );

  const totalPaid = planPayments.filter((p: any) => p.status === 'paid' || p.status === 'late').length;
  const totalPending = planPayments.filter((p: any) => p.status === 'pending').length;
  const totalReported = rentPayments.length + totalPaid;
  const scoreImpact = creditScore?.score ?? 0;

  // Calculate streak
  const sortedPaid = planPayments
    .filter((p: any) => p.status === 'paid')
    .sort((a: any, b: any) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
  const streak = sortedPaid.length;

  const handleSetupRentPlan = async () => {
    const amount = parseFloat(rentAmount);
    if (!amount || amount < 1000) { toast.error('Enter rent amount (min 1,000 XAF)'); return; }
    if (!landlordName.trim()) { toast.error('Enter landlord/property name'); return; }

    setSubmitting(true);
    try {
      // Use the piggybank edge function so the payment schedule is generated and the
      // KRENTS reference is uniqueness-checked server-side.
      const { data, error } = await supabase.functions.invoke('piggybank', {
        body: {
          action: 'create',
          plan_name: landlordName.trim(),
          plan_type: 'rent',
          target_amount: amount * 12,
          installment_amount: amount,
          schedule_frequency: frequency,
          start_date: new Date().toISOString().split('T')[0],
          payment_method: 'manual',
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);

      const refCode = (data as any)?.rent_reference;
      toast.success(refCode ? `Rent plan created! Reference: ${refCode}` : 'Rent plan created');
      setShowSetup(false);
      setRentAmount('');
      setLandlordName('');
      refetchPlans();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to create rent plan'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayRequest = (paymentId: string) => {
    setPendingPaymentId(paymentId);
    setShowPin(true);
  };

  const handleRecordPaymentConfirmed = async () => {
    if (!pendingPaymentId) return;
    setPayingId(pendingPaymentId);
    try {
      const idempotencyKey = `rent_pay_${pendingPaymentId}_${Date.now()}`;
      const { data, error } = await supabase.functions.invoke('piggybank', {
        body: { action: 'pay', payment_id: pendingPaymentId, idempotency_key: idempotencyKey },
      });
      if (error) throw error;
      toast.success(
        data?.credit_event_type?.includes('ON_TIME')
          ? `Payment recorded! +${data?.score_delta || 0} credit points 🎉`
          : `Payment recorded (late). Score impact: ${data?.score_delta || 0}`
      );
      refetchPlans();
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['customer-credit-score'] }),
        queryClient.refetchQueries({ queryKey: ['customer-accounts'] }),
        queryClient.refetchQueries({ queryKey: ['account-balances'] }),
      ]);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to record payment'));
    } finally {
      setPayingId(null);
      setPendingPaymentId(null);
    }
  };

  const activePlans = rentPlans.filter((p: any) => p.status === 'active');
  const inactivePlans = rentPlans.filter((p: any) => p.status !== 'active');

  return (
    <div className="flex flex-col gap-4 p-5 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card border border-border active:scale-95 transition-transform">
            <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={1.5} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{tr('Rent Reporting')}</h1>
            <p className="text-[10px] text-muted-foreground">{tr('Build credit with every payment')}</p>
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
          <Home className="h-5 w-5 text-primary" strokeWidth={1.5} />
        </div>
      </div>

      {/* How It Works */}
      <HowItWorksFlow
        title={tr('How Rent Reporting Works')}
        steps={[
          { icon: Plus, title: 'Create Plan', description: 'Enter landlord, amount & frequency. Get a unique KRENTS code.', color: 'hsl(210,80%,93%)', iconColor: 'hsl(210,60%,45%)' },
          { icon: Banknote, title: 'Record Payments', description: 'Each time you pay rent, record it here to log a timestamped credit event.', color: 'hsl(150,40%,90%)', iconColor: 'hsl(150,40%,35%)' },
          { icon: Shield, title: 'Build Credit', description: 'On-time = +5–10 pts. Late = -10–25. Missed = -30. Consistency is key.', color: 'hsl(270,60%,92%)', iconColor: 'hsl(270,50%,45%)' },
          { icon: BadgeCheck, title: 'KRENTS Code', description: 'Your unique reference ties all payments for credit bureau reporting.', color: 'hsl(45,70%,90%)', iconColor: 'hsl(45,60%,35%)' },
        ] as FlowStep[]}
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Stats Dashboard */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 p-3 text-center">
              <div className="flex h-8 w-8 mx-auto items-center justify-center rounded-xl bg-primary/10 mb-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" strokeWidth={1.5} />
              </div>
              <p className="text-lg font-bold text-foreground">{totalReported}</p>
              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{tr('Reported')}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-[hsl(45,70%,90%)]/60 to-[hsl(45,70%,95%)]/30 border border-[hsl(45,60%,80%)] p-3 text-center">
              <div className="flex h-8 w-8 mx-auto items-center justify-center rounded-xl bg-[hsl(45,70%,90%)] mb-1.5">
                <Clock className="h-4 w-4 text-[hsl(45,60%,35%)]" strokeWidth={1.5} />
              </div>
              <p className="text-lg font-bold text-foreground">{totalPending}</p>
              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{tr('Pending')}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-[hsl(15,80%,92%)]/60 to-[hsl(15,80%,96%)]/30 border border-[hsl(15,70%,82%)] p-3 text-center">
              <div className="flex h-8 w-8 mx-auto items-center justify-center rounded-xl bg-[hsl(15,80%,92%)] mb-1.5">
                <Flame className="h-4 w-4 text-[hsl(15,70%,45%)]" strokeWidth={1.5} />
              </div>
              <p className="text-lg font-bold text-foreground">{streak}</p>
              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{tr('Streak')}</p>
            </div>
          </motion.div>

          {/* Credit Impact Banner */}
          {scoreImpact > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/15 p-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-foreground">{tr('CrediQ Score')}</p>
                <p className="text-[10px] text-muted-foreground">{tr('Your current credit score from all activities')}</p>
              </div>
              <p className="text-xl font-bold text-primary">{scoreImpact}</p>
            </motion.div>
          )}

          {/* Tip */}
          <div className="flex items-start gap-2.5 rounded-2xl bg-accent/40 border border-accent/60 p-3">
            <Info className="h-4 w-4 text-accent-foreground mt-0.5 shrink-0" strokeWidth={1.5} />
            <p className="text-[11px] text-accent-foreground leading-relaxed">
              <span className="font-semibold">{tr('Pro tip:')}</span> {tr('On-time payments earn')} <span className="font-bold text-[hsl(150,60%,35%)]">{tr('+5–10 pts')}</span>. 
              Late payments cost <span className="font-bold text-destructive">{tr('-10–25 pts')}</span>. 
              Missed payments are <span className="font-bold text-destructive">{tr('-30 pts')}</span>.
            </p>
          </div>

          {/* Active Rent Plans */}
          {activePlans.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{tr('Active Plans')}</p>
              <div className="space-y-3">
                {activePlans.map((plan: any) => {
                  const payments = plan.piggybank_payments || [];
                  const paidCount = payments.filter((p: any) => p.status === 'paid' || p.status === 'late').length;
                  const pendingPayments = payments.filter((p: any) => p.status === 'pending');
                  const overduePayments = pendingPayments.filter((p: any) => p.due_date && new Date(p.due_date) < new Date());
                  const creditLinked = payments.some((p: any) => p.credit_event_id);
                  const nextDue = pendingPayments.sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

                  return (
                    <motion.div key={plan.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-3xl bg-card border border-border overflow-hidden">
                      {/* Plan Header */}
                      <div className="p-4 pb-3">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                              <Home className="h-5 w-5 text-primary" strokeWidth={1.5} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{plan.plan_name}</p>
                              <p className="text-[11px] font-mono text-primary font-bold">{plan.rent_reference}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                            Active
                          </span>
                        </div>

                        {/* Plan Stats */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-xl bg-muted/50 p-2">
                            <p className="text-sm font-bold text-foreground">{Number(plan.installment_amount || 0).toLocaleString()}</p>
                            <p className="text-[9px] text-muted-foreground">XAF / {plan.schedule_frequency}</p>
                          </div>
                          <div className="rounded-xl bg-muted/50 p-2">
                            <p className="text-sm font-bold text-foreground">{paidCount}</p>
                            <p className="text-[9px] text-muted-foreground">{tr('Paid')}</p>
                          </div>
                          <div className="rounded-xl bg-muted/50 p-2">
                            <p className="text-sm font-bold text-foreground">{pendingPayments.length}</p>
                            <p className="text-[9px] text-muted-foreground">{tr('Upcoming')}</p>
                          </div>
                        </div>

                        {creditLinked && (
                          <div className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-[hsl(150,40%,90%)]/50 px-2.5 py-1.5">
                            <Shield className="h-3 w-3 text-[hsl(150,40%,35%)]" />
                            <span className="text-[10px] font-medium text-[hsl(150,40%,35%)]">{tr('Credit events recorded')}</span>
                          </div>
                        )}

                        {overduePayments.length > 0 && (
                          <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-destructive/10 px-2.5 py-1.5">
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                            <span className="text-[10px] font-medium text-destructive">{overduePayments.length} overdue payment{overduePayments.length > 1 ? 's' : ''} — record now to minimize penalty</span>
                          </div>
                        )}
                      </div>

                      {/* Pending Payments - Record Action */}
                      {pendingPayments.length > 0 && (
                        <div className="border-t border-border px-4 py-3 space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('Record a Payment')}</p>
                          {pendingPayments.slice(0, 3).map((payment: any) => {
                            const isOverdue = payment.due_date && new Date(payment.due_date) < new Date();
                            const isPaying = payingId === payment.id;
                            return (
                              <div key={payment.id}
                                className={`flex items-center gap-3 rounded-2xl p-3 border ${isOverdue ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30 border-border'}`}>
                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isOverdue ? 'bg-destructive/10' : 'bg-[hsl(45,70%,90%)]'}`}>
                                  {isOverdue
                                    ? <AlertTriangle className="h-4 w-4 text-destructive" strokeWidth={1.5} />
                                    : <Calendar className="h-4 w-4 text-[hsl(45,60%,35%)]" strokeWidth={1.5} />
                                  }
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold text-foreground">
                                    {Number(payment.amount || 0).toLocaleString()} XAF
                                  </p>
                                  <p className={`text-[10px] ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                    {payment.due_date ? `Due ${format(new Date(payment.due_date), 'MMM d, yyyy')}` : 'No due date'}
                                    {isOverdue && ' • OVERDUE'}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handlePayRequest(payment.id)}
                                  disabled={isPaying}
                                  className="rounded-xl h-8 text-[11px] px-3"
                                  variant={isOverdue ? 'destructive' : 'default'}
                                >
                                  {isPaying ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Record'}
                                </Button>
                              </div>
                            );
                          })}
                          {pendingPayments.length > 3 && (
                            <p className="text-[10px] text-muted-foreground text-center">+ {pendingPayments.length - 3} more upcoming</p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Setup Form / Button */}
          <AnimatePresence>
            {showSetup ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="rounded-3xl border border-border bg-card overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 to-transparent p-4 pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    <p className="text-sm font-bold text-foreground">{tr('Set Up Rent Reporting')}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{tr('You\'ll receive a unique KRENTS reference code')}</p>
                </div>
                <div className="p-4 space-y-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold">{tr('Landlord / Property Name')}</Label>
                    <Input value={landlordName} onChange={e => setLandlordName(e.target.value)} placeholder={tr('e.g. My Apartment')} className="rounded-xl h-11" maxLength={80} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold">{tr('Monthly Rent (XAF)')}</Label>
                    <Input type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} placeholder={tr('e.g. 75000')} className="rounded-xl h-11" min={1000} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold">{tr('Payment Frequency')}</Label>
                    <Select value={frequency} onValueChange={setFrequency}>
                      <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">{tr('Monthly')}</SelectItem>
                        <SelectItem value="quarterly">{tr('Quarterly')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleSetupRentPlan} disabled={submitting} className="flex-1 rounded-2xl h-11">
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Create Rent Plan
                    </Button>
                    <Button variant="outline" onClick={() => setShowSetup(false)} className="rounded-2xl h-11">{tr('Cancel')}</Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button variant="outline" className="w-full rounded-2xl h-12 gap-2 border-dashed border-2" onClick={() => setShowSetup(true)}>
                  <Plus className="h-4 w-4" /> {activePlans.length > 0 ? 'Add Another Rent Plan' : 'Set Up Rent Reporting'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Payment History */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{tr('Payment History')}</p>
            {rentPayments.length === 0 && planPayments.filter((p: any) => p.status !== 'pending').length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 rounded-3xl border border-dashed border-border">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <Home className="h-7 w-7 text-muted-foreground" strokeWidth={1} />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">{tr('No rent payments yet')}</p>
                <p className="text-xs text-muted-foreground text-center max-w-[200px]">{tr('Create a plan and record your first payment to start building credit')}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {planPayments
                  .filter((p: any) => p.status !== 'pending')
                  .sort((a: any, b: any) => new Date(b.paid_at || 0).getTime() - new Date(a.paid_at || 0).getTime())
                  .map((p: any, i: number) => {
                    const isOnTime = p.status === 'paid';
                    const isLate = p.status === 'late';
                    return (
                      <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isOnTime ? 'bg-[hsl(150,40%,90%)]' : 'bg-[hsl(0,60%,95%)]'}`}>
                          {isOnTime
                            ? <CheckCircle2 className="h-4 w-4 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
                            : <XCircle className="h-4 w-4 text-destructive" strokeWidth={1.5} />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-foreground">{p.plan_name}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground font-mono">{p.rent_reference}</span>
                            {p.paid_at && (
                              <span className="text-[10px] text-muted-foreground">• {format(new Date(p.paid_at), 'MMM d, yyyy')}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-foreground">{Math.abs(p.amount || 0).toLocaleString()}</p>
                          <p className={`text-[9px] font-bold ${isOnTime ? 'text-[hsl(150,60%,35%)]' : 'text-destructive'}`}>
                            {isOnTime ? '+5–10 pts' : isLate ? '-10–25 pts' : ''}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                {rentPayments.map((r: any, i: number) => (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(210,80%,93%)]">
                      <Banknote className="h-4 w-4 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-foreground">{r.transaction_information || 'Rent Payment'}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {r.booking_datetime ? format(new Date(r.booking_datetime), 'MMM d, yyyy') : ''}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-foreground">{Math.abs(r.amount || 0).toLocaleString()}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Inactive Plans */}
          {inactivePlans.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{tr('Inactive Plans')}</p>
              {inactivePlans.map((plan: any) => (
                <div key={plan.id} className="flex items-center gap-3 rounded-2xl bg-muted/30 border border-border p-3 opacity-60">
                  <Home className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold text-foreground">{plan.plan_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{plan.rent_reference}</p>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground">{plan.status}</span>
                </div>
              ))}
            </motion.div>
          )}
        </>
      )}

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={handleRecordPaymentConfirmed} />
    </div>
  );
};

export default CustomerRentReporting;
