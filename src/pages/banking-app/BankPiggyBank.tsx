import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PiggyBank, Plus, Home, Calendar, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, TrendingUp, ChevronRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { usePiggyBankPlans, usePiggyBankPayments, useCreatePiggyBankPlan, usePiggyBankPay } from '@/hooks/usePiggyBankData';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { sounds } from '@/lib/sounds';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';

const CREDIT_DISCLAIMER_SAVINGS = 'Your savings plan payments will be tracked for credit scoring. Consistent payments improve your CrediQ score. Missed payments will negatively impact your credit.';
const CREDIT_DISCLAIMER_RENT = '⚠️ Setting up rent reporting improves your credit score when you pay on time. However, missed or late payments WILL negatively impact your CrediQ score. Please only proceed if you are confident in making regular payments.';

const cardGradients = {
  savings: 'from-emerald-500 to-teal-600',
  rent: 'from-rose-500 to-orange-600',
};

const BankPiggyBank: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const { data: plans, isLoading } = usePiggyBankPlans();
  const [showCreate, setShowCreate] = useState(false);
  const [showSchedule, setShowSchedule] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [pendingPlanType, setPendingPlanType] = useState<'savings' | 'rent'>('savings');
  const [formStep, setFormStep] = useState(0);

  const [formData, setFormData] = useState({
    plan_name: '', plan_type: 'savings' as 'savings' | 'rent', target_amount: '',
    schedule_frequency: 'monthly', installment_amount: '', start_date: '', end_date: '',
    landlord_user_id: '',
  });

  const createMutation = useCreatePiggyBankPlan();

  const handleCreateClick = (type: 'savings' | 'rent') => {
    sounds.tap();
    setPendingPlanType(type);
    setShowDisclaimer(true);
  };

  const handleDisclaimerAccept = () => {
    sounds.confirm();
    setShowDisclaimer(false);
    setFormData(prev => ({ ...prev, plan_type: pendingPlanType }));
    setFormStep(0);
    setShowCreate(true);
  };

  const handleSubmit = () => {
    if (!formData.plan_name || !formData.installment_amount || !formData.start_date) {
      sounds.error();
      toast.error('Please fill in all required fields');
      return;
    }
    sounds.tap();
    createMutation.mutate({
      ...formData,
      target_amount: Number(formData.target_amount) || 0,
      installment_amount: Number(formData.installment_amount),
      institution_id: institutionId,
    }, {
      onSuccess: (data) => {
        sounds.success();
        toast.success(`Plan created! ${data.rent_reference ? `Rent ID: ${data.rent_reference}` : ''}`);
        setShowCreate(false);
        setFormData({ plan_name: '', plan_type: 'savings', target_amount: '', schedule_frequency: 'monthly', installment_amount: '', start_date: '', end_date: '', landlord_user_id: '' });
      },
    });
  };

  const nextStep = () => { sounds.navigate(); setFormStep(s => Math.min(s + 1, formData.plan_type === 'rent' ? 2 : 1)); };
  const prevStep = () => { sounds.navigate(); setFormStep(s => Math.max(s - 1, 0)); };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col px-4 py-6">
      <button onClick={() => { sounds.navigate(); navigate(-1); }} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PiggyBank className="h-6 w-6" />
              <h1 className="text-xl font-bold">Piggy Bank</h1>
            </div>
            <p className="text-sm text-white/70">Savings & rent plans with credit impact</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold">
            <TrendingUp className="h-3.5 w-3.5" /> CrediQ
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="secondary" className="rounded-full bg-white/20 text-white border-0 hover:bg-white/30" onClick={() => handleCreateClick('savings')}>
            <Plus className="mr-1 h-4 w-4" /> Savings Plan
          </Button>
          <Button size="sm" variant="secondary" className="rounded-full bg-white/20 text-white border-0 hover:bg-white/30" onClick={() => handleCreateClick('rent')}>
            <Home className="mr-1 h-4 w-4" /> Rent Plan
          </Button>
        </div>
      </motion.div>

      {/* Plans list */}
      {(!plans || plans.length === 0) ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-muted-foreground/20 py-16 bg-muted/20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <PiggyBank className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">No plans yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Create a savings or rent plan to start building credit</p>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map((plan: any, i: number) => {
            const paidCount = plan.piggybank_payments?.filter((p: any) => p.status === 'paid' || p.status === 'late').length || 0;
            const totalCount = plan.piggybank_payments?.length || 1;
            const progress = (paidCount / totalCount) * 100;
            const isRent = plan.plan_type === 'rent';

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl border-0 overflow-hidden shadow-sm"
              >
                {/* Color header strip */}
                <div className={`h-1.5 bg-gradient-to-r ${isRent ? cardGradients.rent : cardGradients.savings}`} />
                <div className="bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${isRent ? cardGradients.rent : cardGradients.savings}`}>
                        {isRent ? <Home className="h-5 w-5 text-white" /> : <PiggyBank className="h-5 w-5 text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{plan.plan_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.rent_reference ? <span className="font-mono font-bold text-primary">{plan.rent_reference}</span> : null}
                          {plan.rent_reference ? ' · ' : ''}
                          {plan.schedule_frequency} · {Number(plan.installment_amount).toLocaleString()} XAF
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      plan.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 
                      plan.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {plan.status}
                    </span>
                  </div>

                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{paidCount}/{totalCount} payments</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Target: <span className="font-semibold text-foreground">{Number(plan.target_amount).toLocaleString()} XAF</span></span>
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs rounded-full" onClick={() => { sounds.tap(); setShowSchedule(showSchedule === plan.id ? null : plan.id); }}>
                      <Calendar className="h-3.5 w-3.5" /> Schedule <ChevronRight className={`h-3 w-3 transition-transform ${showSchedule === plan.id ? 'rotate-90' : ''}`} />
                    </Button>
                  </div>

                  <AnimatePresence>
                    {showSchedule === plan.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ScheduleView planId={plan.id} payments={plan.piggybank_payments || []} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Credit Disclaimer Dialog */}
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 mb-2">
              <AlertTriangle className="h-7 w-7 text-amber-500" />
            </div>
            <DialogTitle className="text-center">Credit Score Impact</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-center">
              {pendingPlanType === 'rent' ? CREDIT_DISCLAIMER_RENT : CREDIT_DISCLAIMER_SAVINGS}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-center">
            <Button variant="outline" className="rounded-full" onClick={() => setShowDisclaimer(false)}>Cancel</Button>
            <Button className="rounded-full" onClick={handleDisclaimerAccept}>
              <Sparkles className="mr-1 h-4 w-4" /> I Understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Plan Dialog — Multi-step */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">
              {formData.plan_type === 'rent' ? '🏠 New Rent Plan' : '🐷 New Savings Plan'}
            </DialogTitle>
            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2 pt-2">
              {[0, 1, ...(formData.plan_type === 'rent' ? [2] : [])].map(step => (
                <div key={step} className={`h-1.5 rounded-full transition-all ${step === formStep ? 'w-8 bg-primary' : step < formStep ? 'w-4 bg-primary/40' : 'w-4 bg-muted'}`} />
              ))}
            </div>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {formStep === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4 py-2">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan Name</Label>
                  <Input placeholder="e.g. House Rent" value={formData.plan_name} onChange={e => setFormData(prev => ({ ...prev, plan_name: e.target.value }))} className="mt-1.5 rounded-xl h-11" />
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Amount (XAF)</Label>
                  <Input type="number" placeholder="500,000" value={formData.target_amount} onChange={e => setFormData(prev => ({ ...prev, target_amount: e.target.value }))} className="mt-1.5 rounded-xl h-11" />
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Installment Amount (XAF)</Label>
                  <Input type="number" placeholder="50,000" value={formData.installment_amount} onChange={e => setFormData(prev => ({ ...prev, installment_amount: e.target.value }))} className="mt-1.5 rounded-xl h-11" />
                </div>
              </motion.div>
            )}

            {formStep === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4 py-2">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frequency</Label>
                  <Select value={formData.schedule_frequency} onValueChange={v => setFormData(prev => ({ ...prev, schedule_frequency: v }))}>
                    <SelectTrigger className="mt-1.5 rounded-xl h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start Date</Label>
                    <Input type="date" value={formData.start_date} onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))} className="mt-1.5 rounded-xl h-11" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">End Date</Label>
                    <Input type="date" value={formData.end_date} onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))} className="mt-1.5 rounded-xl h-11" />
                  </div>
                </div>
              </motion.div>
            )}

            {formStep === 2 && formData.plan_type === 'rent' && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4 py-2">
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Your unique rent reference will be:</p>
                  <p className="text-lg font-mono font-bold text-primary">KRENTS****</p>
                  <p className="text-xs text-muted-foreground mt-1">Generated automatically upon creation</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Landlord User ID (optional)</Label>
                  <Input placeholder="UUID of landlord" value={formData.landlord_user_id} onChange={e => setFormData(prev => ({ ...prev, landlord_user_id: e.target.value }))} className="mt-1.5 rounded-xl h-11" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <DialogFooter className="flex gap-2 pt-2">
            {formStep > 0 && <Button variant="outline" className="rounded-full" onClick={prevStep}>Back</Button>}
            {formStep < (formData.plan_type === 'rent' ? 2 : 1) ? (
              <Button className="rounded-full flex-1" onClick={nextStep}>Continue</Button>
            ) : (
              <Button className="rounded-full flex-1" onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                Create Plan
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Schedule sub-component
const ScheduleView: React.FC<{ planId: string; payments: any[] }> = ({ planId, payments }) => {
  const payMutation = usePiggyBankPay();
  const [showPin, setShowPin] = useState(false);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);

  const handlePay = (paymentId: string) => {
    sounds.tap();
    setPendingPaymentId(paymentId);
    setShowPin(true);
  };

  const executePay = () => {
    if (!pendingPaymentId) return;
    payMutation.mutate({ payment_id: pendingPaymentId }, {
      onSuccess: (data) => {
        sounds.success();
        const delta = data.score_delta;
        toast.success(`Payment recorded! ${delta !== 0 ? `Credit score ${delta > 0 ? '+' : ''}${delta}` : ''}`);
      },
    });
  };

  return (
    <>
      <div className="mt-3 flex flex-col gap-1.5 border-t pt-3">
        {payments.sort((a: any, b: any) => a.due_date.localeCompare(b.due_date)).map((p: any, i: number) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5 text-xs"
          >
            <div className="flex items-center gap-2">
              {p.status === 'paid' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
               p.status === 'missed' ? <XCircle className="h-4 w-4 text-destructive" /> :
               p.status === 'late' ? <AlertTriangle className="h-4 w-4 text-amber-500" /> :
               <Clock className="h-4 w-4 text-muted-foreground" />}
              <span className="font-medium">{format(new Date(p.due_date), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">{Number(p.amount).toLocaleString()}</span>
              {p.status === 'pending' && (
                <Button size="sm" className="h-7 px-3 text-xs rounded-full bg-primary" onClick={() => handlePay(p.id)} disabled={payMutation.isPending}>
                  Pay
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={executePay} />
    </>
  );
};

export default BankPiggyBank;
