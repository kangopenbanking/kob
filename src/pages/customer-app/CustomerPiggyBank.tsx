import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, X, ChevronRight, Calendar, TrendingUp, Shield, CheckCircle2, Building2, Lock, Target, PiggyBank, Percent, Search, SlidersHorizontal, ArrowUpDown, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { usePiggyBankPlans, useCreatePiggyBankPlan, usePiggyBankPay } from '@/hooks/usePiggyBankData';
import { CreateSavingsForm } from '@/components/savings/CreateSavingsForm';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import BankSavingImg from '@/assets/Bank_Saving.png';
import PersonalSavingImg from '@/assets/Personal_Savings.png';

type SavingsCategory = 'bank' | 'personal' | null;
type ViewMode = 'home' | 'list' | 'create' | 'explore';
type GroupBy = 'institution' | 'type' | 'rate';
type SavingsTypeFilter = 'all' | 'fixed_deposit' | 'goal_savings' | 'high_yield' | 'kids_savings';

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
  const queryClient = useQueryClient();
  const { user } = useCustomerAuth();
  const { data: plans = [], isLoading } = usePiggyBankPlans();
  const createPlan = useCreatePiggyBankPlan();
  const payMutation = usePiggyBankPay();
  const [showPin, setShowPin] = useState(false);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);

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

  const handlePayRequest = (paymentId: string) => {
    setPendingPaymentId(paymentId);
    setShowPin(true);
  };

  const handlePayConfirmed = async () => {
    if (!pendingPaymentId) return;
    try {
      await payMutation.mutateAsync({ payment_id: pendingPaymentId });
      toast.success('Payment recorded!');
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['customer-accounts'] }),
        queryClient.refetchQueries({ queryKey: ['account-balances'] }),
      ]);
    } catch { /* error handled by hook */ } finally {
      setPendingPaymentId(null);
    }
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
                  <PlanCard key={plan.id} plan={plan} index={i} onPay={handlePayRequest} isBank={selectedCategory === 'bank'} />
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

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={handlePayConfirmed} />
    </div>
  );
};

// ─── Explore View ───

// Rotating institution color palettes (flat, no gradients, premium aesthetic)
const INSTITUTION_COLORS = [
  { bg: 'bg-[hsl(225,50%,93%)]', accent: 'bg-[hsl(225,50%,22%)]', icon: 'text-[hsl(225,50%,22%)]', border: 'border-[hsl(225,50%,80%)]', badge: 'bg-[hsl(225,50%,88%)]', rate: 'text-[hsl(225,50%,30%)]' },
  { bg: 'bg-[hsl(150,35%,92%)]', accent: 'bg-[hsl(150,35%,30%)]', icon: 'text-[hsl(150,35%,30%)]', border: 'border-[hsl(150,35%,78%)]', badge: 'bg-[hsl(150,35%,86%)]', rate: 'text-[hsl(150,35%,28%)]' },
  { bg: 'bg-[hsl(25,60%,92%)]',  accent: 'bg-[hsl(25,60%,35%)]',  icon: 'text-[hsl(25,60%,35%)]',  border: 'border-[hsl(25,60%,80%)]',  badge: 'bg-[hsl(25,60%,87%)]',  rate: 'text-[hsl(25,60%,30%)]' },
  { bg: 'bg-[hsl(260,40%,93%)]', accent: 'bg-[hsl(260,40%,40%)]', icon: 'text-[hsl(260,40%,40%)]', border: 'border-[hsl(260,40%,82%)]', badge: 'bg-[hsl(260,40%,88%)]', rate: 'text-[hsl(260,40%,35%)]' },
  { bg: 'bg-[hsl(340,50%,93%)]', accent: 'bg-[hsl(340,50%,40%)]', icon: 'text-[hsl(340,50%,40%)]', border: 'border-[hsl(340,50%,82%)]', badge: 'bg-[hsl(340,50%,88%)]', rate: 'text-[hsl(340,50%,35%)]' },
  { bg: 'bg-[hsl(45,60%,90%)]',  accent: 'bg-[hsl(45,60%,30%)]',  icon: 'text-[hsl(45,60%,30%)]',  border: 'border-[hsl(45,60%,78%)]',  badge: 'bg-[hsl(45,60%,84%)]',  rate: 'text-[hsl(45,60%,28%)]' },
];

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'fixed_deposit': return 'Fixed Deposit';
    case 'goal_savings': return 'Goal Savings';
    case 'high_yield': return 'High Yield';
    case 'kids_savings': return 'Kids Savings';
    default: return 'Savings';
  }
};

function ExploreView({ onApply, onViewPlans, bankPlansCount }: {
  onApply: (product: any) => void;
  onViewPlans: () => void;
  bankPlansCount: number;
}) {
  const { data: products = [], isLoading } = useSavingsProducts();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<SavingsTypeFilter>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('institution');
  const [showCompare, setShowCompare] = useState(false);

  const allProducts = products as any[];

  // Filter
  const filtered = allProducts.filter((p: any) => {
    if (typeFilter !== 'all' && p.savings_type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (p.product_name || '').toLowerCase();
      const inst = (p.institutions?.institution_name || '').toLowerCase();
      if (!name.includes(q) && !inst.includes(q)) return false;
    }
    return true;
  });

  // Group
  const buildGroups = (): { key: string; label: string; items: any[]; colorIdx: number }[] => {
    if (groupBy === 'institution') {
      const map: Record<string, { inst: any; items: any[] }> = {};
      filtered.forEach((p: any) => {
        const id = p.institutions?.id || 'unknown';
        if (!map[id]) map[id] = { inst: p.institutions, items: [] };
        map[id].items.push(p);
      });
      return Object.entries(map).map(([id, { inst, items }], i) => ({
        key: id, label: inst?.institution_name || 'Unknown', items, colorIdx: i,
      }));
    }
    if (groupBy === 'type') {
      const map: Record<string, any[]> = {};
      filtered.forEach((p: any) => {
        const t = p.savings_type || 'other';
        if (!map[t]) map[t] = [];
        map[t].push(p);
      });
      return Object.entries(map).map(([type, items], i) => ({
        key: type, label: getTypeLabel(type), items, colorIdx: i,
      }));
    }
    // rate — sort all by rate descending, single group
    const sorted = [...filtered].sort((a, b) => (b.base_interest_rate || 0) - (a.base_interest_rate || 0));
    return [{ key: 'all', label: 'Best Rates First', items: sorted, colorIdx: 0 }];
  };

  const groups = buildGroups();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(amount);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'fixed_deposit': return <Lock className="h-4 w-4" strokeWidth={1.5} />;
      case 'goal_savings': return <Target className="h-4 w-4" strokeWidth={1.5} />;
      default: return <PiggyBank className="h-4 w-4" strokeWidth={1.5} />;
    }
  };

  // Rate comparison stats
  const rateStats = allProducts.length > 0 ? {
    highest: Math.max(...allProducts.map((p: any) => p.base_interest_rate || 0)),
    lowest: Math.min(...allProducts.map((p: any) => p.base_interest_rate || 0)),
    avg: (allProducts.reduce((s: number, p: any) => s + (p.base_interest_rate || 0), 0) / allProducts.length).toFixed(1),
  } : null;

  if (isLoading) {
    return (
      <motion.div key="explore" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </motion.div>
    );
  }

  return (
    <motion.div key="explore" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-col gap-4">
      {/* Intro banner */}
      <div className="rounded-3xl bg-[hsl(225,50%,93%)] p-5 border-2 border-foreground">
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by product or institution..."
          className="rounded-2xl pl-9 h-11 text-xs"
        />
      </div>

      {/* Filter chips row */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['all', 'fixed_deposit', 'goal_savings', 'high_yield', 'kids_savings'] as SavingsTypeFilter[]).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors border ${
              typeFilter === t
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-muted-foreground border-border hover:border-foreground/30'
            }`}
          >
            {t === 'all' ? 'All Types' : getTypeLabel(t)}
          </button>
        ))}
      </div>

      {/* Group by + Compare toggle */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 flex-1 rounded-2xl border border-border bg-card p-1">
          {([
            { value: 'institution' as GroupBy, icon: Building2, label: 'Bank' },
            { value: 'type' as GroupBy, icon: SlidersHorizontal, label: 'Type' },
            { value: 'rate' as GroupBy, icon: ArrowUpDown, label: 'Rate' },
          ]).map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setGroupBy(value)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-semibold transition-colors ${
                groupBy === value ? 'bg-foreground text-background' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-3 w-3" strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCompare(!showCompare)}
          className={`shrink-0 h-9 w-9 rounded-xl flex items-center justify-center border transition-colors ${
            showCompare ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border'
          }`}
        >
          <BarChart3 className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Rate Comparison Panel */}
      <AnimatePresence>
        {showCompare && rateStats && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-3xl border-2 border-foreground bg-card p-4">
              <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" strokeWidth={1.5} />
                Rate Comparison
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-[hsl(150,35%,92%)] p-3 text-center">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Highest</p>
                  <p className="text-xl font-bold text-[hsl(150,35%,28%)]">{rateStats.highest}%</p>
                </div>
                <div className="rounded-2xl bg-[hsl(225,50%,93%)] p-3 text-center">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Average</p>
                  <p className="text-xl font-bold text-[hsl(225,50%,30%)]">{rateStats.avg}%</p>
                </div>
                <div className="rounded-2xl bg-[hsl(25,60%,92%)] p-3 text-center">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Lowest</p>
                  <p className="text-xl font-bold text-[hsl(25,60%,30%)]">{rateStats.lowest}%</p>
                </div>
              </div>

              {/* Top rates table */}
              <div className="mt-3 space-y-1.5">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Top Rates</p>
                {[...allProducts]
                  .sort((a, b) => (b.base_interest_rate || 0) - (a.base_interest_rate || 0))
                  .slice(0, 5)
                  .map((p: any, i: number) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2">
                      <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground truncate">{p.product_name}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{p.institutions?.institution_name}</p>
                      </div>
                      <p className="text-sm font-bold text-primary shrink-0">{p.base_interest_rate}%</p>
                      <Button size="sm" className="h-6 text-[9px] rounded-lg px-2 shrink-0" onClick={() => onApply(p)}>
                        Apply
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <p className="text-[10px] font-semibold text-muted-foreground">
        {filtered.length} product{filtered.length !== 1 ? 's' : ''} found
        {typeFilter !== 'all' && ` · ${getTypeLabel(typeFilter)}`}
        {searchQuery.trim() && ` · "${searchQuery}"`}
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <Search className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-muted-foreground">No products match your filters</p>
          <Button variant="secondary" size="sm" className="rounded-2xl text-xs" onClick={() => { setSearchQuery(''); setTypeFilter('all'); }}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group, idx) => {
            const palette = INSTITUTION_COLORS[group.colorIdx % INSTITUTION_COLORS.length];
            return (
              <motion.div
                key={group.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
              >
                {/* Group Header */}
                <div className={`flex items-center gap-3 mb-3 rounded-2xl ${palette.bg} p-3 border ${palette.border}`}>
                  <div className={`h-10 w-10 rounded-xl ${palette.accent} flex items-center justify-center shrink-0`}>
                    {groupBy === 'institution' ? (
                      <Building2 className="h-5 w-5 text-white" strokeWidth={1.5} />
                    ) : groupBy === 'type' ? (
                      <span className="text-white">{getTypeIcon(group.key)}</span>
                    ) : (
                      <ArrowUpDown className="h-5 w-5 text-white" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{group.label}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">{group.items.length} product{group.items.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {group.items.map((product: any, pIdx: number) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.06 + pIdx * 0.03 }}
                      className={`rounded-3xl ${palette.bg} border ${palette.border} p-4 flex flex-col justify-between`}
                    >
                      {/* Icon + Type */}
                      <div>
                        <div className={`h-9 w-9 rounded-xl ${palette.accent} flex items-center justify-center mb-3`}>
                          <span className="text-white">{getTypeIcon(product.savings_type)}</span>
                        </div>
                        <p className="text-xs font-bold text-foreground leading-tight line-clamp-2">{product.product_name}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          {groupBy !== 'institution' ? (product.institutions?.institution_name || '') : getTypeLabel(product.savings_type)}
                        </p>
                      </div>

                      {/* Rate */}
                      <div className="mt-3">
                        <p className={`text-2xl font-bold ${palette.rate}`}>{product.base_interest_rate}%</p>
                        <p className="text-[9px] text-muted-foreground">per annum</p>
                      </div>

                      {/* Details */}
                      <div className="mt-3 space-y-1.5">
                        <div className={`rounded-lg ${palette.badge} px-2 py-1.5`}>
                          <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Min. Opening</p>
                          <p className="text-[11px] font-semibold text-foreground">{formatCurrency(product.min_opening_balance)}</p>
                        </div>
                        {product.lock_in_period_months && (
                          <div className={`rounded-lg ${palette.badge} px-2 py-1.5`}>
                            <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Lock-in</p>
                            <p className="text-[11px] font-semibold text-foreground">{product.lock_in_period_months} months</p>
                          </div>
                        )}
                        <div className={`rounded-lg ${palette.badge} px-2 py-1.5`}>
                          <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Interest</p>
                          <p className="text-[11px] font-semibold text-foreground capitalize">{product.interest_payment_frequency}</p>
                        </div>
                      </div>

                      {/* Apply */}
                      <Button
                        className="w-full rounded-2xl h-9 text-[11px] font-semibold mt-3"
                        onClick={() => onApply(product)}
                      >
                        Apply Now
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            );
          })}
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
