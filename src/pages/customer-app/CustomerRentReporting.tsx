import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, TrendingUp, CheckCircle2, Loader2, Plus, Calendar, Banknote, AlertCircle, HelpCircle, Info, Shield, Clock, Star, FileText, BadgeCheck } from 'lucide-react';
import { HowItWorksFlow, type FlowStep } from '@/components/customer-app/HowItWorksFlow';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerTransactions, useCustomerCreditScore } from '@/hooks/useCustomerData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

const CustomerRentReporting: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [showSetup, setShowSetup] = useState(false);
  
  const [rentAmount, setRentAmount] = useState('');
  const [landlordName, setLandlordName] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [submitting, setSubmitting] = useState(false);

  const { data: allTxns = [], isLoading } = useCustomerTransactions(user?.id, undefined, 50);
  const { data: creditScore } = useCustomerCreditScore(user?.id);

  // Fetch rent plans using correct column: plan_type (not category)
  const { data: rentPlans = [], refetch: refetchPlans } = useQuery({
    queryKey: ['rent-plans', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('piggybank_plans')
        .select('id, plan_name, plan_type, target_amount, installment_amount, schedule_frequency, status, rent_reference, created_at, piggybank_payments(id, amount, status, paid_at, credit_event_id)')
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

  const totalPaid = planPayments.filter((p: any) => p.status === 'paid').length;
  const totalReported = rentPayments.length + totalPaid;
  const scoreImpact = creditScore?.score ?? 0;

  const handleSetupRentPlan = async () => {
    const amount = parseFloat(rentAmount);
    if (!amount || amount < 1000) { toast.error('Enter rent amount (min 1,000 XAF)'); return; }
    if (!landlordName.trim()) { toast.error('Enter landlord/property name'); return; }

    setSubmitting(true);
    try {
      const refCode = 'KRENTS' + Math.floor(1000 + Math.random() * 9000);
      const { error } = await (supabase as any).from('piggybank_plans').insert({
        user_id: user!.id,
        institution_id: null,
        plan_name: landlordName.trim(),
        plan_type: 'rent',
        target_amount: amount * 12,
        installment_amount: amount,
        schedule_frequency: frequency,
        status: 'active',
        rent_reference: refCode,
        payment_method: 'manual',
        start_date: new Date().toISOString().split('T')[0],
      });
      if (error) throw error;
      toast.success(`Rent plan created! Reference: ${refCode}`);
      setShowSetup(false);
      setRentAmount('');
      setLandlordName('');
      refetchPlans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create rent plan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Rent Reporting</h1>
        </div>
      </div>

      {/* How It Works Flow Guide */}
      <HowItWorksFlow
        title="How Rent Reporting Works"
        steps={[
          { icon: Plus, title: 'Create a Rent Plan', description: 'Enter your landlord name, monthly rent amount, and payment frequency. You\'ll get a unique KRENTS reference code.', color: 'hsl(210,80%,93%)', iconColor: 'hsl(210,60%,45%)' },
          { icon: Banknote, title: 'Make Payments', description: 'Pay rent and record it against your plan using your unique KRENTS code. Each payment is tracked and timestamped.', color: 'hsl(150,40%,90%)', iconColor: 'hsl(150,40%,35%)' },
          { icon: Shield, title: 'Build Your Credit', description: 'Each on-time payment earns +5 to +10 credit score points. Late payments may reduce your score. Consistency is key.', color: 'hsl(270,60%,92%)', iconColor: 'hsl(270,50%,45%)' },
          { icon: BadgeCheck, title: 'Your KRENTS Code', description: 'Your unique reference (e.g. KRENTS4821) ties all payments together for credit bureau reporting and score calculation.', color: 'hsl(45,70%,90%)', iconColor: 'hsl(45,60%,35%)' },
        ] as FlowStep[]}
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Score Impact Card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-primary/10 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/60">
                <TrendingUp className="h-6 w-6 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Credit Impact</p>
                <p className="text-[11px] text-muted-foreground">
                  {totalReported > 0 ? `${totalReported} rent payment${totalReported > 1 ? 's' : ''} reported` : 'No rent payments reported yet'}
                </p>
              </div>
            </div>
            {totalReported > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-background/60 p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{totalReported}</p>
                  <p className="text-[10px] text-muted-foreground">Payments</p>
                </div>
                {scoreImpact > 0 && (
                  <div className="rounded-2xl bg-background/60 p-3 text-center">
                    <p className="text-lg font-bold text-primary">{scoreImpact}</p>
                    <p className="text-[10px] text-muted-foreground">Credit Score</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* Tip Banner */}
          <div className="rounded-2xl bg-accent/50 p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-accent-foreground mt-0.5 shrink-0" strokeWidth={1.5} />
            <p className="text-[11px] text-accent-foreground">
              On-time rent payments improve your credit score (+5–10 pts each). Late payments may reduce it. Your unique KRENTS code links all payments for reporting.
            </p>
          </div>

          {/* Active Rent Plans */}
          {rentPlans.length > 0 && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Active Rent Plans</p>
              {rentPlans.map((plan: any) => {
                const paidCount = (plan.piggybank_payments || []).filter((p: any) => p.status === 'paid').length;
                const creditLinked = (plan.piggybank_payments || []).some((p: any) => p.credit_event_id);
                return (
                  <motion.div key={plan.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl bg-card border border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-bold text-foreground">{plan.plan_name}</p>
                        <p className="text-[10px] font-mono text-primary font-bold">{plan.rent_reference}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${plan.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {plan.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1"><Banknote className="h-3 w-3" /> {Number(plan.installment_amount || 0).toLocaleString()} XAF</div>
                      <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {plan.schedule_frequency}</div>
                      <div className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {paidCount} paid</div>
                    </div>
                    {creditLinked && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-primary/5 px-2.5 py-1.5">
                        <Shield className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-medium text-primary">Credit events recorded</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </>
          )}

          {/* Setup Form */}
          <AnimatePresence>
            {showSetup ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="rounded-3xl border border-border bg-card p-5 space-y-4 overflow-hidden">
                <p className="text-sm font-bold text-foreground">Set Up Rent Reporting</p>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Landlord / Property Name</Label>
                  <Input value={landlordName} onChange={e => setLandlordName(e.target.value)} placeholder="e.g. My Apartment" className="rounded-xl" maxLength={80} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Monthly Rent (XAF)</Label>
                  <Input type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} placeholder="e.g. 75000" className="rounded-xl" min={1000} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Payment Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSetupRentPlan} disabled={submitting} className="flex-1 rounded-2xl h-11">
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Rent Plan
                  </Button>
                  <Button variant="outline" onClick={() => setShowSetup(false)} className="rounded-2xl h-11">Cancel</Button>
                </div>
              </motion.div>
            ) : (
              <Button variant="outline" className="w-full rounded-2xl h-12 gap-2" onClick={() => setShowSetup(true)}>
                <Plus className="h-4 w-4" /> Set Up Rent Reporting
              </Button>
            )}
          </AnimatePresence>

          {/* Payment History */}
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Payment History</p>
          {rentPayments.length === 0 && planPayments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Home className="h-12 w-12 text-muted-foreground" strokeWidth={1} />
              <p className="text-sm font-semibold text-muted-foreground">No rent payments yet</p>
              <p className="text-xs text-muted-foreground text-center">Set up rent reporting to start building credit</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rentPayments.map((r: any, i: number) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }} className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-foreground">{r.transaction_information || 'Rent Payment'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.booking_datetime ? format(new Date(r.booking_datetime), 'MMM d, yyyy') : ''}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-foreground">{Math.abs(r.amount || 0).toLocaleString()}</p>
                </motion.div>
              ))}
              {planPayments.filter((p: any) => p.status === 'paid').map((p: any, i: number) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (rentPayments.length + i) * 0.04 }} className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                  <div className="relative">
                    <CheckCircle2 className="h-5 w-5 text-primary" strokeWidth={1.5} />
                    {p.credit_event_id && <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-foreground">{p.plan_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{p.rent_reference}</p>
                  </div>
                  <p className="text-sm font-bold text-foreground">{Math.abs(p.amount || 0).toLocaleString()}</p>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CustomerRentReporting;
