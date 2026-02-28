import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, X, ChevronRight, Calendar, TrendingUp, Shield, CheckCircle2, Building2, Lock, Target, PiggyBank, Percent } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { usePiggyBankPlans, useCreatePiggyBankPlan, usePiggyBankPay } from '@/hooks/usePiggyBankData';
import { CreateSavingsForm } from '@/components/savings/CreateSavingsForm';
import BankSavingImg from '@/assets/Bank_Saving.png';
import PersonalSavingImg from '@/assets/Personal_Savings.png';

type SavingsCategory = 'bank' | 'personal' | null;
type ViewMode = 'home' | 'list' | 'create' | 'explore';

const WELCOME_KEY = 'piggybank_welcome_seen';

// Hook to fetch savings products grouped by institution
function useSavingsProducts() {
  return useQuery({
    queryKey: ['savings-products-explore'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('savings_products') as any)
        .select('*, institutions(id, institution_name, institution_type, logo_url)')
        .eq('is_active', true)
        .order('base_interest_rate', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

const CustomerPiggyBank: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { data: plans = [], isLoading } = usePiggyBankPlans();
  const createPlan = useCreatePiggyBankPlan();
  const payMutation = usePiggyBankPay();

  const [showWelcome, setShowWelcome] = useState(false);
  const [view, setView] = useState<ViewMode>('home');
  const [selectedCategory, setSelectedCategory] = useState<SavingsCategory>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

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

  const getHeaderTitle = () => {
    if (view === 'home') return 'Piggy Bank';
    if (view === 'explore') return 'Explore Savings';
    if (view === 'list') return selectedCategory === 'bank' ? 'Bank Savings' : 'Personal Savings';
    return 'New Savings Plan';
  };

  const handleBack = () => {
    if (view === 'create') setView('list');
    else if (view === 'list') { setView('home'); setSelectedCategory(null); }
    else if (view === 'explore') { setView('home'); setSelectedCategory(null); }
    else navigate(-1);
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

      {/* Savings Form Dialog */}
      {selectedProduct && (
        <CreateSavingsForm
          products={[selectedProduct]}
          onSuccess={() => {
            setSelectedProduct(null);
            setView('home');
            toast.success('Savings account opened!');
          }}
          onCancel={() => setSelectedProduct(null)}
        />
      )}

      <Header onBack={handleBack} title={getHeaderTitle()} />

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
                buttonLabel="Explore Now"
                onClick={() => { setSelectedCategory('bank'); setView('explore'); }}
              />
              <CategoryCard
                image={PersonalSavingImg}
                title="Personal Savings"
                subtitle={`${personalPlans.length} plan${personalPlans.length !== 1 ? 's' : ''}`}
                saved={totalSaved(personalPlans)}
                bgClass="bg-[hsl(45,70%,82%)]"
                buttonLabel="Start Saving"
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

        {view === 'explore' && (
          <ExploreView
            key="explore"
            onApply={(product: any) => setSelectedProduct(product)}
            onViewPlans={() => { setSelectedCategory('bank'); setView('list'); }}
            bankPlansCount={bankPlans.length}
          />
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

// ─── Explore View ───

function ExploreView({ onApply, onViewPlans, bankPlansCount }: {
  onApply: (product: any) => void;
  onViewPlans: () => void;
  bankPlansCount: number;
}) {
  const { data: products = [], isLoading } = useSavingsProducts();

  // Group products by institution
  const grouped = (products as any[]).reduce((acc: Record<string, { institution: any; products: any[] }>, product: any) => {
    const inst = product.institutions;
    const instId = inst?.id || 'unknown';
    if (!acc[instId]) {
      acc[instId] = { institution: inst, products: [] };
    }
    acc[instId].products.push(product);
    return acc;
  }, {} as Record<string, { institution: any; products: any[] }>);

  const institutions = Object.values(grouped);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(amount);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'fixed_deposit': return <Lock className="h-4 w-4" />;
      case 'goal_savings': return <Target className="h-4 w-4" />;
      default: return <PiggyBank className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'fixed_deposit': return 'Fixed Deposit';
      case 'goal_savings': return 'Goal Savings';
      case 'high_yield': return 'High Yield';
      case 'kids_savings': return 'Kids Savings';
      default: return 'Savings';
    }
  };

  if (isLoading) {
    return (
      <motion.div key="explore" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </motion.div>
    );
  }

  return (
    <motion.div key="explore" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-col gap-5">
      {/* Intro banner */}
      <div className="rounded-3xl bg-gradient-to-br from-[hsl(260,40%,92%)] to-[hsl(260,50%,85%)] p-5">
        <p className="text-sm font-bold text-foreground">Explore Savings Products</p>
        <p className="text-xs text-muted-foreground mt-1">
          Compare savings accounts from top financial institutions and apply directly.
        </p>
        {bankPlansCount > 0 && (
          <Button variant="link" size="sm" className="px-0 mt-2 h-auto text-xs text-primary" onClick={onViewPlans}>
            View my {bankPlansCount} existing plan{bankPlansCount !== 1 ? 's' : ''} →
          </Button>
        )}
      </div>

      {institutions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <Building2 className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-muted-foreground">No savings products available</p>
          <p className="text-xs text-muted-foreground text-center max-w-[220px]">
            Financial institutions haven't published savings products yet. Check back soon!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {institutions.map(({ institution, products: instProducts }, idx) => (
            <motion.div
              key={institution?.id || idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
            >
              {/* Institution Header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  {institution?.logo_url ? (
                    <img src={institution.logo_url} alt={institution.institution_name} className="h-6 w-6 rounded object-contain" />
                  ) : (
                    <Building2 className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{institution?.institution_name || 'Institution'}</p>
                  {institution?.institution_type && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 mt-0.5">
                      {institution.institution_type.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Products */}
              <div className="space-y-3">
                {instProducts.map((product: any) => (
                  <div
                    key={product.id}
                    className="rounded-2xl border border-border bg-card p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          {getTypeIcon(product.savings_type)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{product.product_name}</p>
                          <p className="text-[10px] text-muted-foreground">{getTypeLabel(product.savings_type)}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-lg font-bold text-primary">{product.base_interest_rate}%</p>
                        <p className="text-[9px] text-muted-foreground">p.a.</p>
                      </div>
                    </div>

                    {product.description && (
                      <p className="text-[11px] text-muted-foreground mb-3 line-clamp-2">{product.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="rounded-xl bg-muted/50 px-3 py-2">
                        <p className="text-[9px] text-muted-foreground">Min. Opening</p>
                        <p className="text-xs font-semibold text-foreground">{formatCurrency(product.min_opening_balance)}</p>
                      </div>
                      <div className="rounded-xl bg-muted/50 px-3 py-2">
                        <p className="text-[9px] text-muted-foreground">Interest Paid</p>
                        <p className="text-xs font-semibold text-foreground capitalize">{product.interest_payment_frequency}</p>
                      </div>
                      {product.lock_in_period_months && (
                        <div className="rounded-xl bg-muted/50 px-3 py-2">
                          <p className="text-[9px] text-muted-foreground">Lock-in</p>
                          <p className="text-xs font-semibold text-foreground">{product.lock_in_period_months} months</p>
                        </div>
                      )}
                      {product.max_withdrawals_per_month && (
                        <div className="rounded-xl bg-muted/50 px-3 py-2">
                          <p className="text-[9px] text-muted-foreground">Withdrawals/Mo</p>
                          <p className="text-xs font-semibold text-foreground">{product.max_withdrawals_per_month}</p>
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full rounded-xl h-10 text-xs font-semibold"
                      onClick={() => onApply(product)}
                    >
                      Apply Now
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

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

function CategoryCard({ image, title, subtitle, saved, bgClass, buttonLabel, onClick }: {
  image: string; title: string; subtitle: string; saved: number; bgClass: string; buttonLabel: string; onClick: () => void;
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
        {buttonLabel}
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
