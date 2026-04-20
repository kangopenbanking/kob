import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, X, ChevronRight, Calendar, TrendingUp, Shield, CheckCircle2, Building2, Lock, Target, Wallet, Percent, Search, SlidersHorizontal, ArrowUpDown, BarChart3, Zap, Clock, AlertCircle, CreditCard, ArrowDownCircle, CircleDollarSign, Trash2, AlertTriangle, StopCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { usePiggyBankPlans, useCreatePiggyBankPlan, usePiggyBankPay, useUserAccounts, useCancelPiggyBankPlan, useDeletePiggyBankPlan } from '@/hooks/usePiggyBankData';
import { CreateSavingsForm } from '@/components/savings/CreateSavingsForm';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import BankSavingImg from '@/assets/Bank_Saving.png';
import PersonalSavingImg from '@/assets/Personal_Savings.png';

type SavingsCategory = 'bank' | 'personal' | null;
type ViewMode = 'home' | 'list' | 'create' | 'explore';
type GroupBy = 'institution' | 'type' | 'rate';
type SavingsTypeFilter = 'all' | 'fixed_deposit' | 'goal_savings' | 'high_yield' | 'kids_savings';

const WELCOME_KEY = 'piggybank_welcome_seen';

function useSavingsProducts() {
  return useQuery({
    queryKey: ['savings-products-explore'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('savings_products') as any)
        .select('*, institutions(id, institution_name, institution_type, logo_url)')
        .eq('is_active', true)
        .order('base_interest_rate', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(amount);

const CustomerPiggyBank: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCustomerAuth();
  const { data: plans = [], isLoading } = usePiggyBankPlans();
  const { data: userAccounts = [] } = useUserAccounts();
  const createPlan = useCreatePiggyBankPlan();
  const payMutation = usePiggyBankPay();
  const cancelPlan = useCancelPiggyBankPlan();
  const deletePlan = useDeletePiggyBankPlan();
  const [showPin, setShowPin] = useState(false);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<{ planId: string; planName: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ planId: string; planName: string; isCancelled: boolean } | null>(null);

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
  const [autoFundEnabled, setAutoFundEnabled] = useState(false);
  const [autoFundAccountId, setAutoFundAccountId] = useState('');

  useEffect(() => {
    const seen = localStorage.getItem(WELCOME_KEY);
    if (!seen) setShowWelcome(true);
  }, []);

  const dismissWelcome = () => { localStorage.setItem(WELCOME_KEY, 'true'); setShowWelcome(false); };

  const bankPlans = plans.filter((p: any) => p.institution_id);
  const personalPlans = plans.filter((p: any) => !p.institution_id);
  const displayPlans = selectedCategory === 'bank' ? bankPlans : personalPlans;

  const totalSaved = (list: any[]) =>
    list.reduce((sum: number, p: any) => {
      const paid = (p.piggybank_payments || []).filter((pay: any) => pay.status === 'paid');
      return sum + paid.reduce((s: number, pay: any) => s + (pay.amount || 0), 0);
    }, 0);

  const totalTarget = (list: any[]) =>
    list.reduce((sum: number, p: any) => sum + (p.target_amount || 0), 0);

  const handleCreate = async () => {
    if (!planName.trim() || !installmentAmount) {
      toast.error('Fill in all required fields');
      return;
    }
    if (autoFundEnabled && !autoFundAccountId) {
      toast.error('Select a wallet for auto-funding');
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
        auto_fund_enabled: autoFundEnabled,
        auto_fund_account_id: autoFundEnabled ? autoFundAccountId : null,
      });
      setPlanName(''); setTargetAmount(''); setInstallmentAmount('');
      setAutoFundEnabled(false); setAutoFundAccountId('');
      setView('list');
    } catch { /* handled by hook */ }
  };

  const handlePayRequest = (paymentId: string, accountId?: string) => {
    setPendingPaymentId(paymentId);
    setPendingAccountId(accountId || null);
    setShowPin(true);
  };

  const handlePayConfirmed = async () => {
    if (!pendingPaymentId) return;
    try {
      await payMutation.mutateAsync({
        payment_id: pendingPaymentId,
        fund_from_wallet: !!pendingAccountId,
        account_id: pendingAccountId || undefined,
      });
    } catch { /* handled by hook */ } finally {
      setPendingPaymentId(null);
      setPendingAccountId(null);
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
      <WelcomeDialog open={showWelcome} onClose={dismissWelcome} />
      {selectedProduct && (
        <CreateSavingsForm
          products={[selectedProduct]}
          onSuccess={() => { setSelectedProduct(null); setView('home'); }}
          onCancel={() => setSelectedProduct(null)}
        />
      )}
      <Header onBack={handleBack} title={getHeaderTitle()} />

      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.div key="home" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-col gap-5">
            {/* Summary Banner */}
            <div className="rounded-3xl bg-primary p-5 text-primary-foreground">
              <p className="text-xs font-medium opacity-80">Total Savings</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(totalSaved(plans))}</p>
              <div className="flex items-center gap-4 mt-3">
                <div>
                  <p className="text-[10px] opacity-70">Plans</p>
                  <p className="text-sm font-bold">{plans.length}</p>
                </div>
                <div className="h-6 w-px bg-primary-foreground/20" />
                <div>
                  <p className="text-[10px] opacity-70">Target</p>
                  <p className="text-sm font-bold">{formatCurrency(totalTarget(plans))}</p>
                </div>
                <div className="h-6 w-px bg-primary-foreground/20" />
                <div>
                  <p className="text-[10px] opacity-70">Auto-Fund</p>
                  <p className="text-sm font-bold">{plans.filter((p: any) => p.auto_fund_enabled).length} active</p>
                </div>
              </div>
            </div>

            {/* Category Cards */}
            <div className="grid grid-cols-2 gap-4">
              <CategoryCard
                image={BankSavingImg}
                title="Bank Savings"
                subtitle={`${bankPlans.length} plan${bankPlans.length !== 1 ? 's' : ''}`}
                saved={totalSaved(bankPlans)}
                accentColor="hsl(var(--primary))"
                bgClass="bg-primary/10"
                buttonLabel="Explore"
                onClick={() => { setSelectedCategory('bank'); setView('explore'); }}
              />
              <CategoryCard
                image={PersonalSavingImg}
                title="Personal Savings"
                subtitle={`${personalPlans.length} plan${personalPlans.length !== 1 ? 's' : ''}`}
                saved={totalSaved(personalPlans)}
                accentColor="hsl(var(--accent))"
                bgClass="bg-accent/20"
                buttonLabel="Start"
                onClick={() => { setSelectedCategory('personal'); setView('list'); }}
              />
            </div>

            {/* Recent Plans Preview */}
            {plans.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Plans</p>
                <div className="space-y-2">
                  {plans.slice(0, 3).map((plan: any, i: number) => (
                    <MiniPlanRow key={plan.id} plan={plan} index={i} />
                  ))}
                </div>
              </div>
            )}
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
            <div className="rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Saved</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalSaved(displayPlans))}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Target</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalTarget(displayPlans))}</p>
                </div>
              </div>
              {totalTarget(displayPlans) > 0 && (
                <Progress value={Math.min(100, (totalSaved(displayPlans) / totalTarget(displayPlans)) * 100)} className="mt-3 h-2" />
              )}
            </div>

            {displayPlans.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Target className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">No savings plans yet</p>
                <p className="text-xs text-muted-foreground text-center max-w-[220px]">
                  Start saving and build your credit score at the same time
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayPlans.map((plan: any, i: number) => (
                  <PlanCard key={plan.id} plan={plan} index={i} onPay={handlePayRequest} isBank={selectedCategory === 'bank'} userAccounts={userAccounts} onCancel={(id, name) => setCancelConfirm({ planId: id, planName: name })} onDelete={selectedCategory === 'personal' ? (id, name, isCancelled) => setDeleteConfirm({ planId: id, planName: name, isCancelled }) : undefined} />
                ))}
              </div>
            )}

            <Button className="w-full rounded-2xl h-12" onClick={() => setView('create>
              Create New Plan
            </Button>
          </motion.div>
        )}

        {view === 'create' && (
          <motion.div key="create" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Plan Name</label>
                <Input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="e.g. New Phone, Vacation" className="rounded-xl h-11" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Target (XAF)</label>
                  <Input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="Optional" className="rounded-xl h-11" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Per Payment (XAF) *</label>
                  <Input type="number" value={installmentAmount} onChange={e => setInstallmentAmount(e.target.value)} placeholder="Amount" className="rounded-xl h-11" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Frequency</label>
                  <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Start Date</label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl h-11" />
                </div>
              </div>
            </div>

            {/* Auto-Fund Section */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Auto-Fund</p>
                    <p className="text-[10px] text-muted-foreground">Automatically debit your wallet</p>
                  </div>
                </div>
                <Switch checked={autoFundEnabled} onCheckedChange={setAutoFundEnabled} />
              </div>

              {autoFundEnabled && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Select Wallet</label>
                  <Select value={autoFundAccountId} onValueChange={setAutoFundAccountId}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Choose a wallet" />
                    </SelectTrigger>
                    <SelectContent>
                      {userAccounts.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.nickname || a.account_holder_name} — {formatCurrency(a.available_balance)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" strokeWidth={1.5} />
                    Funds will be debited on each due date automatically
                  </p>
                </motion.div>
              )}
            </div>

            {/* Credit Impact Notice */}
            <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4 flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-xs text-foreground/80">
                Every on-time payment is reported to CrediQ and improves your credit score automatically.
              </p>
            </div>

            {/* Cancellation Warning */}
            <div className="rounded-2xl bg-destructive/5 border border-destructive/15 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-destructive">Cancellation Warning</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Stopping or deleting this plan after creation will result in a <span className="font-bold text-destructive">-5 point</span> impact to your CrediQ credit score. Only create a plan you intend to complete.
                </p>
              </div>
            </div>

            <Button onClick={handleCreate} disabled={createPlan.isPending} className="w-full rounded-2xl h-12">
              {createPlan.isPending ? 'Creating...' : 'Create Plan'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={handlePayConfirmed} />

      {/* Cancel Plan Confirmation */}
      <AlertDialog open={!!cancelConfirm} onOpenChange={(open) => !open && setCancelConfirm(null)}>
        <AlertDialogContent className="rounded-3xl max-w-sm">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" strokeWidth={1.5} />
              </div>
              <div>
                <AlertDialogTitle className="text-base">Cancel Savings Plan?</AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  You are about to cancel <span className="font-semibold text-foreground">"{cancelConfirm?.planName}"</span>.
                </p>
                <div className="rounded-2xl bg-destructive/5 border border-destructive/15 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-destructive shrink-0" strokeWidth={1.5} />
                    <p className="text-xs font-semibold text-destructive">Credit Score Impact: -5 points</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Cancelling a savings plan is reported to CrediQ and will reduce your credit score by 5 points. This action cannot be undone.
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-3">
                  <p className="text-[11px] text-muted-foreground">
                    All pending payments will be cancelled. Payments already made will remain on your record.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-2">
            <AlertDialogCancel className="rounded-xl">Keep Plan</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelPlan.isPending}
              onClick={() => {
                if (cancelConfirm) {
                  cancelPlan.mutate({ plan_id: cancelConfirm.planId }, {
                    onSettled: () => setCancelConfirm(null),
                  });
                }
              }}
            >
              {cancelPlan.isPending ? 'Cancelling...' : 'Cancel Plan (-5 pts)'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Personal Plan Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="rounded-3xl max-w-sm">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-destructive" strokeWidth={1.5} />
              </div>
              <AlertDialogTitle className="text-base">Delete Personal Savings?</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Permanently remove <span className="font-semibold text-foreground">"{deleteConfirm?.planName}"</span> from your records.
                </p>
                <div className="rounded-2xl bg-muted/50 p-3 space-y-1">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {deleteConfirm?.isCancelled
                      ? 'This plan is already cancelled. Deleting it will remove it from your history. No further credit impact.'
                      : 'This personal plan will be deleted. If it has paid contributions, please cancel it first.'}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-2">
            <AlertDialogCancel className="rounded-xl">Keep</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePlan.isPending}
              onClick={() => {
                if (deleteConfirm) {
                  deletePlan.mutate({ plan_id: deleteConfirm.planId }, {
                    onSettled: () => setDeleteConfirm(null),
                  });
                }
              }}
            >
              {deletePlan.isPending ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ─── Sub-components ───

function Header({ onBack, title = 'Piggy Bank' }: { onBack: () => void; title?: string }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onBack} className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors">
        <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={1.5} />
      </button>
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
    </div>
  );
}

function CategoryCard({ image, title, subtitle, saved, bgClass, buttonLabel, onClick }: {
  image: string; title: string; subtitle: string; saved: number; bgClass: string; accentColor: string; buttonLabel: string; onClick: () => void;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      className="flex flex-col gap-2 cursor-pointer"
      onClick={onClick}
    >
      <div className={`relative rounded-3xl ${bgClass} p-4 text-left overflow-hidden aspect-[3/4] flex flex-col justify-between border border-border`}>
        <div className="relative z-10">
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="relative z-10">
          <p className="text-[10px] text-muted-foreground">Saved</p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(saved)}</p>
        </div>
        <img src={image} alt={title} className="absolute bottom-2 right-2 h-20 w-20 object-contain opacity-80" />
      </div>
      <Button className="w-full rounded-2xl h-10 text-xs font-semibold" size="sm">{buttonLabel}</Button>
    </motion.div>
  );
}

function MiniPlanRow({ plan, index }: { plan: any; index: number }) {
  const payments = plan.piggybank_payments || [];
  const paidPayments = payments.filter((p: any) => p.status === 'paid');
  const totalPaid = paidPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const target = plan.target_amount || 0;
  const pct = target > 0 ? Math.min(100, Math.round((totalPaid / target) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
    >
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        {plan.auto_fund_enabled ? (
          <Zap className="h-5 w-5 text-primary" strokeWidth={1.5} />
        ) : (
          <Target className="h-5 w-5 text-primary" strokeWidth={1.5} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-foreground truncate">{plan.plan_name}</p>
          {plan.auto_fund_enabled && (
            <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 shrink-0">AUTO</Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {paidPayments.length}/{payments.length} payments
          {target > 0 && ` · ${pct}%`}
        </p>
      </div>
      <p className="text-sm font-bold text-foreground shrink-0">{formatCurrency(totalPaid)}</p>
    </motion.div>
  );
}

function PlanCard({ plan, index, onPay, isBank, userAccounts, onCancel, onDelete }: { plan: any; index: number; onPay: (id: string, accountId?: string) => void; isBank: boolean; userAccounts: any[]; onCancel: (planId: string, planName: string) => void; onDelete?: (planId: string, planName: string, isCancelled: boolean) => void }) {
  const payments = plan.piggybank_payments || [];
  const paidPayments = payments.filter((p: any) => p.status === 'paid');
  const missedPayments = payments.filter((p: any) => p.status === 'missed' || p.status === 'late');
  const nextPayment = payments.find((p: any) => p.status === 'pending');
  const totalPaid = paidPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const target = plan.target_amount || 0;
  const pct = target > 0 ? Math.min(100, Math.round((totalPaid / target) * 100)) : 0;
  const isCancelled = plan.status === 'cancelled';

  const streakCount = (() => {
    let count = 0;
    const sorted = [...payments].filter((p: any) => p.status === 'paid').sort((a: any, b: any) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
    for (const p of sorted) { count++; }
    return count;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-3xl border bg-card p-5 ${isCancelled ? 'border-destructive/20 opacity-60' : 'border-border'}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${isCancelled ? 'bg-destructive/10' : isBank ? 'bg-primary/10' : 'bg-accent/20'}`}>
            {isCancelled ? (
              <StopCircle className="h-5 w-5 text-destructive" strokeWidth={1.5} />
            ) : plan.auto_fund_enabled ? (
              <Zap className={`h-5 w-5 ${isBank ? 'text-primary' : 'text-accent-foreground'}`} strokeWidth={1.5} />
            ) : (
              <Target className={`h-5 w-5 ${isBank ? 'text-primary' : 'text-accent-foreground'}`} strokeWidth={1.5} />
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{plan.plan_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 capitalize">{plan.schedule_frequency}</Badge>
              {plan.auto_fund_enabled && !isCancelled && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">Auto-Fund</Badge>
              )}
              {isCancelled && (
                <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">Cancelled</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isCancelled && plan.status === 'active' && (
            <button
              onClick={() => onCancel(plan.id, plan.plan_name)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Cancel plan"
            >
              <StopCircle className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
          {onDelete && !isBank && (
            <button
              onClick={() => onDelete(plan.id, plan.plan_name, isCancelled)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete plan"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {target > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">{formatCurrency(totalPaid)}</span>
            <span className="text-xs font-bold text-foreground">{formatCurrency(target)}</span>
          </div>
          <Progress value={pct} className="h-2.5" />
          <p className="text-[10px] text-muted-foreground mt-1">{pct}% of target reached</p>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl bg-muted/50 p-2.5 text-center">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Paid</p>
          <p className="text-sm font-bold text-foreground">{paidPayments.length}</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-2.5 text-center">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Streak</p>
          <p className="text-sm font-bold text-foreground">{streakCount}</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-2.5 text-center">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Missed</p>
          <p className="text-sm font-bold text-destructive">{missedPayments.length}</p>
        </div>
      </div>

      {/* Next Payment */}
      {!isCancelled && nextPayment && (
        <div className="flex items-center justify-between rounded-2xl bg-primary/5 border border-primary/10 p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <div>
              <p className="text-[10px] text-muted-foreground">Next payment</p>
              <p className="text-xs font-bold text-foreground">{formatCurrency(nextPayment.amount)} · {new Date(nextPayment.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            </div>
          </div>
          <Button
            size="sm"
            className="h-8 rounded-xl text-xs"
            onClick={() => onPay(nextPayment.id, plan.auto_fund_account_id)}
          >
            {plan.auto_fund_enabled ? 'Auto-Pay' : 'Pay Now'}
          </Button>
        </div>
      )}

      {!isCancelled && !nextPayment && payments.length > 0 && (
        <div className="flex items-center gap-2 rounded-2xl bg-primary/5 border border-primary/10 p-3">
          <CheckCircle2 className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <p className="text-xs font-semibold text-foreground">All payments completed</p>
        </div>
      )}
    </motion.div>
  );
}

// ─── Explore View ───

const INSTITUTION_COLORS = [
  { bg: 'bg-primary/5', accent: 'bg-primary', border: 'border-primary/15', badge: 'bg-primary/10', rate: 'text-primary' },
  { bg: 'bg-accent/10', accent: 'bg-accent', border: 'border-accent/20', badge: 'bg-accent/15', rate: 'text-accent-foreground' },
  { bg: 'bg-muted', accent: 'bg-foreground', border: 'border-border', badge: 'bg-muted', rate: 'text-foreground' },
  { bg: 'bg-destructive/5', accent: 'bg-destructive', border: 'border-destructive/15', badge: 'bg-destructive/10', rate: 'text-destructive' },
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

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'fixed_deposit': return <Lock className="h-4 w-4" strokeWidth={1.5} />;
    case 'goal_savings': return <Target className="h-4 w-4" strokeWidth={1.5} />;
    case 'high_yield': return <TrendingUp className="h-4 w-4" strokeWidth={1.5} />;
    default: return <CircleDollarSign className="h-4 w-4" strokeWidth={1.5} />;
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

  const allProducts = products as any[];

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
    const sorted = [...filtered].sort((a, b) => (b.base_interest_rate || 0) - (a.base_interest_rate || 0));
    return [{ key: 'all', label: 'Best Rates First', items: sorted, colorIdx: 0 }];
  };

  const groups = buildGroups();

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
      <div className="rounded-3xl bg-primary/5 border border-primary/10 p-5">
        <p className="text-sm font-bold text-foreground">Explore Savings Products</p>
        <p className="text-xs text-muted-foreground mt-1">
          Compare savings accounts from top financial institutions and apply directly.
        </p>
        {bankPlansCount > 0 && (
          <Button variant="link" size="sm" className="px-0 mt-2 h-auto text-xs text-primary" onClick={onViewPlans}>
            View my {bankPlansCount} existing plan{bankPlansCount !== 1 ? 's' : ''}
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by product or institution..." className="rounded-2xl pl-9 h-11 text-xs" />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['all', 'fixed_deposit', 'goal_savings', 'high_yield', 'kids_savings'] as SavingsTypeFilter[]).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors border ${
              typeFilter === t
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:border-primary/30'
            }`}
          >
            {t === 'all' ? 'All Types' : getTypeLabel(t)}
          </button>
        ))}
      </div>

      {/* Group by */}
      <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1">
        {([
          { value: 'institution' as GroupBy, icon: Building2, label: 'Bank' },
          { value: 'type' as GroupBy, icon: SlidersHorizontal, label: 'Type' },
          { value: 'rate' as GroupBy, icon: ArrowUpDown, label: 'Rate' },
        ]).map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => setGroupBy(value)}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-[10px] font-semibold transition-colors ${
              groupBy === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Icon className="h-3 w-3" strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-[10px] font-semibold text-muted-foreground">
        {filtered.length} product{filtered.length !== 1 ? 's' : ''} found
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
                    <Building2 className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{group.label}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">{group.items.length} product{group.items.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Products */}
                <div className="grid grid-cols-2 gap-3">
                  {group.items.map((product: any, pIdx: number) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.06 + pIdx * 0.03 }}
                      className="rounded-2xl border border-border bg-card p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                          <span className="text-primary">{getTypeIcon(product.savings_type)}</span>
                        </div>
                        <p className="text-xs font-bold text-foreground leading-tight line-clamp-2">{product.product_name}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          {groupBy !== 'institution' ? (product.institutions?.institution_name || '') : getTypeLabel(product.savings_type)}
                        </p>
                      </div>

                      <div className="mt-3">
                        <p className="text-2xl font-bold text-primary">{product.base_interest_rate}%</p>
                        <p className="text-[9px] text-muted-foreground">per annum</p>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                          <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Min. Opening</p>
                          <p className="text-[11px] font-semibold text-foreground">{formatCurrency(product.min_opening_balance)}</p>
                        </div>
                        {product.lock_in_period_months && (
                          <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                            <p className="text-[8px] text-muted-foreground uppercase tracking-wider">Lock-in</p>
                            <p className="text-[11px] font-semibold text-foreground">{product.lock_in_period_months} months</p>
                          </div>
                        )}
                      </div>

                      <Button className="w-full rounded-xl h-9 text-[11px] font-semibold mt-3" onClick={() => onApply(product)}>
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

function WelcomeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const steps = [
    { icon: <Calendar className="h-7 w-7 text-primary" strokeWidth={1.5} />, title: 'Set Your Goal', desc: 'Choose a savings target. Pick your schedule — daily, weekly, or monthly.' },
    { icon: <Zap className="h-7 w-7 text-primary" strokeWidth={1.5} />, title: 'Auto-Fund from Wallet', desc: 'Enable auto-funding and your wallet is debited automatically on each due date.' },
    { icon: <TrendingUp className="h-7 w-7 text-primary" strokeWidth={1.5} />, title: 'Build Credit', desc: 'Every on-time payment is reported to CrediQ. Your score improves automatically.' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl p-6">
        <div className="flex flex-col items-center text-center gap-2 mb-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Target className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold text-foreground">Welcome to Piggy Bank</h2>
          <p className="text-xs text-muted-foreground">Save money, build credit — automatically.</p>
        </div>

        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center">{step.icon}</div>
              <div>
                <p className="text-sm font-bold text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={onClose} className="w-full rounded-2xl h-11 mt-4">Get Started</Button>
      </DialogContent>
    </Dialog>
  );
}

export default CustomerPiggyBank;
