import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PiggyBank, Plus, Home, Calendar, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { usePiggyBankPlans, usePiggyBankPayments, useCreatePiggyBankPlan, usePiggyBankPay } from '@/hooks/usePiggyBankData';
import { format } from 'date-fns';
import { toast } from 'sonner';

const CREDIT_DISCLAIMER_SAVINGS = 'Your savings plan payments will be tracked for credit scoring. Consistent payments improve your CrediQ score. Missed payments will negatively impact your credit.';
const CREDIT_DISCLAIMER_RENT = '⚠️ Setting up rent reporting improves your credit score when you pay on time. However, missed or late payments WILL negatively impact your CrediQ score. Please only proceed if you are confident in making regular payments.';

const BankPiggyBank: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const { data: plans, isLoading } = usePiggyBankPlans();
  const [showCreate, setShowCreate] = useState(false);
  const [showSchedule, setShowSchedule] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [pendingPlanType, setPendingPlanType] = useState<'savings' | 'rent'>('savings');

  // Create form state
  const [formData, setFormData] = useState({
    plan_name: '', plan_type: 'savings' as 'savings' | 'rent', target_amount: '',
    schedule_frequency: 'monthly', installment_amount: '', start_date: '', end_date: '',
    landlord_user_id: '',
  });

  const createMutation = useCreatePiggyBankPlan();

  const handleCreateClick = (type: 'savings' | 'rent') => {
    setPendingPlanType(type);
    setShowDisclaimer(true);
  };

  const handleDisclaimerAccept = () => {
    setShowDisclaimer(false);
    setFormData(prev => ({ ...prev, plan_type: pendingPlanType }));
    setShowCreate(true);
  };

  const handleSubmit = () => {
    if (!formData.plan_name || !formData.installment_amount || !formData.start_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    createMutation.mutate({
      ...formData,
      target_amount: Number(formData.target_amount) || 0,
      installment_amount: Number(formData.installment_amount),
      institution_id: institutionId,
    }, {
      onSuccess: (data) => {
        toast.success(`Plan created! ${data.rent_reference ? `Rent ID: ${data.rent_reference}` : ''}`);
        setShowCreate(false);
        setFormData({ plan_name: '', plan_type: 'savings', target_amount: '', schedule_frequency: 'monthly', installment_amount: '', start_date: '', end_date: '', landlord_user_id: '' });
      },
    });
  };

  const statusIcon = (status: string) => {
    if (status === 'paid') return <CheckCircle2 className="h-4 w-4 text-[hsl(var(--bank-mint))]" />;
    if (status === 'missed') return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === 'late') return <AlertTriangle className="h-4 w-4 text-[hsl(var(--bank-amber))]" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Piggy Bank</h1>
          <p className="text-sm text-muted-foreground">Savings & rent plans</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => handleCreateClick('savings')}>
            <Plus className="mr-1 h-4 w-4" /> Savings
          </Button>
          <Button size="sm" onClick={() => handleCreateClick('rent')}>
            <Home className="mr-1 h-4 w-4" /> Rent
          </Button>
        </div>
      </div>

      {/* Plans list */}
      {(!plans || plans.length === 0) ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-muted-foreground/30 py-16">
          <PiggyBank className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">No plans yet</p>
          <p className="text-xs text-muted-foreground/70">Create a savings or rent plan to get started</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map((plan: any) => {
            const paidCount = plan.piggybank_payments?.filter((p: any) => p.status === 'paid' || p.status === 'late').length || 0;
            const totalCount = plan.piggybank_payments?.length || 1;
            const progress = (paidCount / totalCount) * 100;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border bg-card p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {plan.plan_type === 'rent' ? <Home className="h-5 w-5 text-[hsl(var(--bank-coral))]" /> : <PiggyBank className="h-5 w-5 text-[hsl(var(--bank-mint))]" />}
                    <div>
                      <p className="text-sm font-bold text-foreground">{plan.plan_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {plan.plan_type === 'rent' && plan.rent_reference ? <span className="font-mono font-bold text-primary">{plan.rent_reference}</span> : null}
                        {plan.plan_type === 'rent' && plan.rent_reference ? ' · ' : ''}
                        {plan.schedule_frequency} · {Number(plan.installment_amount).toLocaleString()} XAF
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${plan.status === 'active' ? 'bg-[hsl(var(--bank-mint))]/10 text-[hsl(var(--bank-mint))]' : 'bg-muted text-muted-foreground'}`}>
                    {plan.status}
                  </span>
                </div>
                <Progress value={progress} className="mb-2 h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{paidCount}/{totalCount} payments</span>
                  <span>Target: {Number(plan.target_amount).toLocaleString()} XAF</span>
                </div>
                <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => setShowSchedule(showSchedule === plan.id ? null : plan.id)}>
                  <Calendar className="mr-1 h-4 w-4" /> {showSchedule === plan.id ? 'Hide' : 'View'} Schedule
                </Button>

                {showSchedule === plan.id && (
                  <ScheduleView planId={plan.id} payments={plan.piggybank_payments || []} />
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Credit Disclaimer Dialog */}
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[hsl(var(--bank-amber))]" />
              Credit Score Impact
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {pendingPlanType === 'rent' ? CREDIT_DISCLAIMER_RENT : CREDIT_DISCLAIMER_SAVINGS}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDisclaimer(false)}>Cancel</Button>
            <Button onClick={handleDisclaimerAccept}>I Understand, Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Plan Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formData.plan_type === 'rent' ? '🏠 New Rent Plan' : '🐷 New Savings Plan'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <Label>Plan Name</Label>
              <Input placeholder="e.g. House Rent" value={formData.plan_name} onChange={e => setFormData(prev => ({ ...prev, plan_name: e.target.value }))} />
            </div>
            <div>
              <Label>Target Amount (XAF)</Label>
              <Input type="number" placeholder="500000" value={formData.target_amount} onChange={e => setFormData(prev => ({ ...prev, target_amount: e.target.value }))} />
            </div>
            <div>
              <Label>Installment Amount (XAF)</Label>
              <Input type="number" placeholder="50000" value={formData.installment_amount} onChange={e => setFormData(prev => ({ ...prev, installment_amount: e.target.value }))} />
            </div>
            <div>
              <Label>Frequency</Label>
              <Select value={formData.schedule_frequency} onValueChange={v => setFormData(prev => ({ ...prev, schedule_frequency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Start Date</Label><Input type="date" value={formData.start_date} onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))} /></div>
              <div><Label>End Date</Label><Input type="date" value={formData.end_date} onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))} /></div>
            </div>
            {formData.plan_type === 'rent' && (
              <div>
                <Label>Landlord User ID (optional)</Label>
                <Input placeholder="UUID of landlord" value={formData.landlord_user_id} onChange={e => setFormData(prev => ({ ...prev, landlord_user_id: e.target.value }))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Schedule sub-component
const ScheduleView: React.FC<{ planId: string; payments: any[] }> = ({ planId, payments }) => {
  const payMutation = usePiggyBankPay();

  const handlePay = (paymentId: string) => {
    payMutation.mutate({ payment_id: paymentId }, {
      onSuccess: (data) => {
        const delta = data.score_delta;
        toast.success(`Payment recorded! ${delta !== 0 ? `Credit score ${delta > 0 ? '+' : ''}${delta}` : ''}`);
      },
    });
  };

  return (
    <div className="mt-3 flex flex-col gap-1.5 border-t pt-3">
      {payments.sort((a: any, b: any) => a.due_date.localeCompare(b.due_date)).map((p: any) => (
        <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            {p.status === 'paid' ? <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--bank-mint))]" /> :
             p.status === 'missed' ? <XCircle className="h-3.5 w-3.5 text-destructive" /> :
             p.status === 'late' ? <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--bank-amber))]" /> :
             <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="font-medium">{format(new Date(p.due_date), 'MMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold">{Number(p.amount).toLocaleString()}</span>
            {p.status === 'pending' && (
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => handlePay(p.id)} disabled={payMutation.isPending}>
                Pay
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BankPiggyBank;
