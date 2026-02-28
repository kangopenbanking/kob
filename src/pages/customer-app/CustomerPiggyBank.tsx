import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, X, ChevronRight, Calendar, TrendingUp, Shield, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { usePiggyBankPlans, useCreatePiggyBankPlan, usePiggyBankPay } from '@/hooks/usePiggyBankData';
import BankSavingImg from '@/assets/Bank_Saving.png';
import PersonalSavingImg from '@/assets/Personal_Savings.png';

type SavingsCategory = 'bank' | 'personal' | null;
type ViewMode = 'home' | 'list' | 'create';

const WELCOME_KEY = 'piggybank_welcome_seen';

const CustomerPiggyBank: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { data: plans = [], isLoading } = usePiggyBankPlans();
  const createPlan = useCreatePiggyBankPlan();
  const payMutation = usePiggyBankPay();

  const [showWelcome, setShowWelcome] = useState(false);
  const [view, setView] = useState<ViewMode>('home');
  const [selectedCategory, setSelectedCategory] = useState<SavingsCategory>(null);

  // Create form state
  const [planName, setPlanName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const seen = localStorage.getItem(WELCOME_KEY);
    if (!seen) setShowWelcome(true);
  }, []);

  const dismissWelcome = () => {
    localStorage.setItem(WELCOME_KEY, 'true');
    setShowWelcome(false);
  };

  // Filter plans by category
  const bankPlans = plans.filter((p: any) => p.institution_id);
  const personalPlans = plans.filter((p: any) => !p.institution_id);
  const displayPlans = selectedCategory === 'bank' ? bankPlans : personalPlans;

  const totalSaved = (list: any[]) =>
    list.reduce((sum: number, p: any) => {
      const paid = (p.piggybank_payments || []).filter((pay: any) => pay.status === 'paid');
      return sum + paid.reduce((s: number, pay: any) => s + (pay.amount || 0), 0);
    }, 0);

  const handleCreate = async () => {
    if (!planName.trim() || !installmentAmount) {
      toast.error('Fill in all required fields');
      return;
    }
    try {
      await createPlan.mutateAsync({
        plan_name: planName,
        plan_type: 'savings',
        target_amount: Number(targetAmount) || 0,
        installment_amount: Number(installmentAmount),
        schedule_frequency: frequency,
        start_date: startDate,
        institution_id: selectedCategory === 'bank' ? undefined : null,
      });
      toast.success('Savings plan created!');
      setPlanName('');
      setTargetAmount('');
      setInstallmentAmount('');
      setView('list');
    } catch { /* error handled by hook */ }
  };

  const handlePay = async (paymentId: string) => {
    try {
      await payMutation.mutateAsync({ payment_id: paymentId });
      toast.success('Payment recorded!');
    } catch { /* error handled by hook */ }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 p-5">
        <Header onBack={() => navigate(-1)} />
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-5 pb-24">
      {/* Welcome Popup */}
      <WelcomeDialog open={showWelcome} onClose={dismissWelcome} />

      <Header onBack={() => {
        if (view === 'create') setView('list');
        else if (view === 'list') { setView('home'); setSelectedCategory(null); }
        else navigate(-1);
      }} title={
        view === 'home' ? 'Piggy Bank' :
        view === 'list' ? (selectedCategory === 'bank' ? 'Bank Savings' : 'Personal Savings') :
        'New Savings Plan'
      } />

      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.div key="home" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-col gap-5">
            {/* Two Category Cards */}
            <div className="grid grid-cols-2 gap-4">
              <CategoryCard
                image={BankSavingImg}
                title="Bank Savings"
                subtitle={`${bankPlans.length} plan${bankPlans.length !== 1 ? 's' : ''}`}
                saved={totalSaved(bankPlans)}
                bgClass="bg-[hsl(260,40%,65%)]"
                onClick={() => { setSelectedCategory('bank'); setView('list'); }}
              />
              <CategoryCard
                image={PersonalSavingImg}
                title="Personal Savings"
                subtitle={`${personalPlans.length} plan${personalPlans.length !== 1 ? 's' : ''}`}
                saved={totalSaved(personalPlans)}
                bgClass="bg-[hsl(45,70%,82%)]"
                onClick={() => { setSelectedCategory('personal'); setView('list'); }}
              />
            </div>

            {/* Quick Stats */}
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total Plans</p>
                <p className="text-2xl font-bold text-foreground">{plans.length}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total Saved</p>
                <p className="text-2xl font-bold text-foreground">{totalSaved(plans).toLocaleString()} <span className="text-xs font-medium text-muted-foreground">XAF</span></p>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'list' && selectedCategory && (
          <motion.div key="list" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-col gap-4">
            {/* Summary */}
            <div className={`rounded-3xl p-5 ${selectedCategory === 'bank' ? 'bg-[hsl(260,40%,92%)]' : 'bg-[hsl(45,70%,90%)]'}`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total Saved</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {totalSaved(displayPlans).toLocaleString()} <span className="text-sm font-medium text-muted-foreground">XAF</span>
              </p>
            </div>

            {/* Plans List */}
            {displayPlans.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <img
                  src={selectedCategory === 'bank' ? BankSavingImg : PersonalSavingImg}
                  alt="No plans"
                  className="h-24 w-24 object-contain opacity-50"
                />
                <p className="text-sm font-semibold text-muted-foreground">No savings plans yet</p>
                <p className="text-xs text-muted-foreground text-center max-w-[200px]">
                  Start saving and build your credit score at the same time
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayPlans.map((plan: any, i: number) => (
                  <PlanCard key={plan.id} plan={plan} index={i} onPay={handlePay} isBank={selectedCategory === 'bank'} />
                ))}
              </div>
            )}

            <Button
              className="w-full rounded-2xl h-12"
              onClick={() => setView('create')}
            >
              Create New Plan
            </Button>
          </motion.div>
        )}

        {view === 'create' && (
          <motion.div key="create" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Plan Name</label>
                <Input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="e.g. New Phone, Vacation" className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Target Amount (XAF)</label>
                <Input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="0 = no target" className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Installment Amount (XAF) *</label>
                <Input type="number" value={installmentAmount} onChange={e => setInstallmentAmount(e.target.value)} placeholder="How much per payment" className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Frequency</label>
                <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Start Date</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl" />
              </div>
            </div>

            {/* Credit Impact Notice */}
            <div className="rounded-2xl bg-[hsl(150,40%,92%)] p-4 flex items-start gap-3">
              <Shield className="h-5 w-5 text-[hsl(150,40%,35%)] shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80">
                Every on-time payment is reported to CrediQ and improves your credit score automatically.
              </p>
            </div>

            <Button onClick={handleCreate} disabled={createPlan.isPending} className="w-full rounded-2xl h-12">
              {createPlan.isPending ? 'Creating...' : 'Create Plan'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Sub-components ───

function Header({ onBack, title = 'Piggy Bank' }: { onBack: () => void; title?: string }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onBack}>
        <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
      </button>
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
    </div>
  );
}

function CategoryCard({ image, title, subtitle, saved, bgClass, onClick }: {
  image: string; title: string; subtitle: string; saved: number; bgClass: string; onClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative rounded-3xl ${bgClass} p-4 text-left overflow-hidden aspect-[3/4] flex flex-col justify-between`}
      >
        <div className="relative z-10">
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-[10px] text-foreground/60 mt-0.5">{subtitle}</p>
        </div>
        <div className="relative z-10">
          <p className="text-[10px] text-foreground/60">Saved</p>
          <p className="text-lg font-bold text-foreground">{saved.toLocaleString()} <span className="text-[10px] font-medium">XAF</span></p>
        </div>
        <img
          src={image}
          alt={title}
          className="absolute bottom-2 right-2 h-20 w-20 object-contain"
        />
      </div>
      <Button
        onClick={onClick}
        className="w-full rounded-2xl h-10 text-xs font-semibold"
        size="sm"
      >
        Start Saving
      </Button>
    </div>
  );
}

function PlanCard({ plan, index, onPay, isBank }: { plan: any; index: number; onPay: (id: string) => void; isBank: boolean }) {
  const payments = plan.piggybank_payments || [];
  const paidPayments = payments.filter((p: any) => p.status === 'paid');
  const nextPayment = payments.find((p: any) => p.status === 'pending');
  const totalPaid = paidPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const target = plan.target_amount || 0;
  const pct = target > 0 ? Math.min(100, Math.round((totalPaid / target) * 100)) : 0;

  const colors = isBank
    ? ['bg-[hsl(260,40%,92%)]', 'bg-[hsl(260,40%,55%)]']
    : ['bg-[hsl(45,70%,90%)]', 'bg-[hsl(45,60%,45%)]'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-3xl ${colors[0]} p-4`}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-bold text-foreground">{plan.plan_name}</p>
        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-background/50 text-muted-foreground">
          {plan.schedule_frequency}
        </span>
      </div>

      {target > 0 && (
        <>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">{totalPaid.toLocaleString()} / {target.toLocaleString()} XAF</span>
            <span className="text-xs font-bold text-foreground">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-background/50 overflow-hidden mb-2">
            <div className={`h-full rounded-full ${colors[1]} transition-all`} style={{ width: `${pct}%` }} />
          </div>
        </>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          {paidPayments.length}/{payments.length} payments made
        </p>
        {nextPayment && (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 rounded-lg text-xs"
            onClick={() => onPay(nextPayment.id)}
          >
            Pay {nextPayment.amount?.toLocaleString()} XAF
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function WelcomeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const steps = [
    {
      icon: <Calendar className="h-8 w-8 text-primary" />,
      title: 'Set Your Goal',
      desc: 'Choose a savings target or set up rent payments. Pick your schedule — daily, weekly, or monthly.',
    },
    {
      icon: <CheckCircle2 className="h-8 w-8 text-[hsl(150,50%,40%)]" />,
      title: 'Auto-Pilot Payments',
      desc: 'The app tracks your payment schedule. Make payments on time and watch your credit improve.',
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-[hsl(260,50%,55%)]" />,
      title: 'Build Credit',
      desc: 'Every on-time payment is reported to CrediQ. Your score improves automatically over time.',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl p-6">
        <div className="flex flex-col items-center text-center gap-2 mb-4">
          <span className="text-3xl">🐷</span>
          <h2 className="text-lg font-bold text-foreground">Welcome to Piggy Bank</h2>
          <p className="text-xs text-muted-foreground">Save money, build credit — automatically.</p>
        </div>

        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">{step.icon}</div>
              <div>
                <p className="text-sm font-bold text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={onClose} className="w-full rounded-2xl h-11 mt-4">
          Get Started
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default CustomerPiggyBank;
