import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, CalendarDays, Landmark, CreditCard, Banknote, ShieldCheck, X, Loader2, Info, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Step = 'select-loan' | 'options' | 'amount' | 'method' | 'date' | 'review' | 'success' | 'list';

interface LoanAcct {
  id: string;
  loan_account_number: string;
  outstanding_balance: number;
  next_payment_amount: number | null;
  next_payment_date: string | null;
  penalty_charges: number | null;
  currency?: string;
  loan_product_id?: string;
}

interface FeePolicy {
  ptp_missed_fee_enabled: boolean;
  ptp_missed_fee_type: 'fixed' | 'percentage';
  ptp_missed_fee_value: number;
  ptp_missed_fee_cap: number | null;
}

interface Promise {
  id: string;
  loan_account_id: string;
  promised_amount: number;
  promised_date: string;
  status: string;
  payment_method: string;
  currency: string;
  kept_amount: number;
  missed_fee_amount?: number | null;
  missed_fee_currency?: string | null;
  missed_fee_type?: string | null;
  missed_fee_reference?: string | null;
}

const fade = { initial: { opacity: 0, x: 12 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -12 } };

const statusTone: Record<string, string> = {
  scheduled: 'border-primary/40 text-primary',
  kept: 'border-emerald-500/50 text-emerald-500',
  partially_kept: 'border-amber-500/50 text-amber-500',
  broken: 'border-destructive/60 text-destructive',
  cancelled: 'border-muted-foreground/40 text-muted-foreground',
  rescheduled: 'border-muted-foreground/40 text-muted-foreground',
};

const PromiseToPay: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('list');
  const [loans, setLoans] = useState<LoanAcct[]>([]);
  const [promises, setPromises] = useState<Promise[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [loan, setLoan] = useState<LoanAcct | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'pay_by_bank' | 'debit_card' | 'bank_transfer'>('pay_by_bank');
  const [date, setDate] = useState<string>(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [showCantKeep, setShowCantKeep] = useState<Promise | null>(null);
  const [feePolicy, setFeePolicy] = useState<FeePolicy | null>(null);

  const currency = loan?.currency || 'XAF';
  const fmtLocale = currency === 'GBP' ? 'en-GB' : currency === 'EUR' ? 'fr-FR' : 'fr-CM';
  const fmt = (n: number) => {
    try { return new Intl.NumberFormat(fmtLocale, { style: 'currency', currency, maximumFractionDigits: currency === 'XAF' || currency === 'XOF' ? 0 : 2 }).format(n); }
    catch { return `${Number(n).toLocaleString()} ${currency}`; }
  };

  // Load fee policy for the selected loan's product
  useEffect(() => {
    if (!loan?.loan_product_id) { setFeePolicy(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('loan_products')
        .select('ptp_missed_fee_enabled, ptp_missed_fee_type, ptp_missed_fee_value, ptp_missed_fee_cap')
        .eq('id', loan.loan_product_id!)
        .maybeSingle();
      if (!cancelled) setFeePolicy((data as any) ?? null);
    })();
    return () => { cancelled = true; };
  }, [loan?.loan_product_id]);

  const projectedFee = useMemo(() => {
    if (!feePolicy?.ptp_missed_fee_enabled) return 0;
    const amt = Number(amount) || 0;
    if (amt <= 0) return 0;
    let raw = feePolicy.ptp_missed_fee_type === 'percentage'
      ? (amt * Number(feePolicy.ptp_missed_fee_value)) / 100
      : Number(feePolicy.ptp_missed_fee_value);
    if (feePolicy.ptp_missed_fee_cap && raw > Number(feePolicy.ptp_missed_fee_cap)) raw = Number(feePolicy.ptp_missed_fee_cap);
    return Math.round(raw * 100) / 100;
  }, [feePolicy, amount]);

  const refresh = async () => {
    setLoadingLoans(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: la }, ptp] = await Promise.all([
      supabase.from('loan_accounts').select('*').eq('user_id', u.user.id).in('status', ['active', 'disbursed']),
      supabase.functions.invoke('ptp-ops', { body: { action: 'list' } }),
    ]);
    setLoans((la as any) || []);
    setPromises(((ptp.data as any)?.promises) || []);
    setLoadingLoans(false);
  };

  useEffect(() => { refresh(); }, []);

  const due = useMemo(() => {
    if (!loan) return { dueNow: 0, returnToLimit: 0, statement: 0 };
    return {
      dueNow: Number(loan.next_payment_amount || 0),
      returnToLimit: Number(loan.penalty_charges || 0),
      statement: Number(loan.outstanding_balance || 0),
    };
  }, [loan]);

  const createPromise = async () => {
    if (!loan) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('ptp-ops', {
        body: {
          action: 'create',
          loan_account_id: loan.id,
          promised_amount: Number(amount),
          promised_date: date,
          payment_method: method,
          currency,
          idempotency_key: crypto.randomUUID(),
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success('Promise created');
      setStep('success');
      refresh();
    } catch (e: any) {
      toast.error(e.message || 'Could not create promise');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelPromise = async (id: string) => {
    const { error } = await supabase.functions.invoke('ptp-ops', { body: { action: 'cancel', promise_id: id } });
    if (error) return toast.error('Could not cancel');
    toast.success('Promise cancelled'); refresh();
  };

  const reschedule = async (p: Promise, newDate: string) => {
    const { error } = await supabase.functions.invoke('ptp-ops', {
      body: { action: 'reschedule', promise_id: p.id, promised_date: newDate, reason: 'customer_request' },
    });
    if (error) return toast.error('Could not reschedule');
    toast.success('Promise rescheduled'); setShowCantKeep(null); refresh();
  };

  // ---------- screens ----------

  const Header = ({ title, onBack, onClose }: { title: string; onBack?: () => void; onClose?: () => void }) => (
    <div className="flex items-center justify-between py-4">
      {onBack ? (
        <button aria-label="Back" onClick={onBack} className="p-2 -ml-2 text-primary"><ArrowLeft className="w-5 h-5" /></button>
      ) : <div className="w-9" />}
      <h1 className="text-base font-semibold">{title}</h1>
      {onClose ? (
        <button aria-label="Close" onClick={onClose} className="p-2 -mr-2 text-primary"><X className="w-5 h-5" /></button>
      ) : <div className="w-9" />}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground px-5 pb-32 max-w-md mx-auto">
      <Header
        title="Make a payment"
        onBack={() => (step === 'list' ? navigate(-1) : setStep(step === 'options' ? 'list' : 'options'))}
        onClose={step !== 'list' ? () => setStep('list') : undefined}
      />

      <AnimatePresence mode="wait">
        {step === 'list' && (
          <motion.div key="list" {...fade} className="space-y-4">
            <Card className="p-4 border-l-4 border-l-primary/70 bg-card">
              <p className="text-sm font-semibold mb-1">Keep in mind</p>
              <p className="text-sm text-muted-foreground">
                Setting a Promise to Pay helps protect your credit. Keeping promises gradually improves your score;
                missing them can harm it.
              </p>
            </Card>

            {loadingLoans ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : loans.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">No active loans found.</Card>
            ) : (
              <div className="space-y-3">
                {loans.map((l) => (
                  <Card
                    key={l.id}
                    onClick={() => { setLoan(l); setStep('options'); }}
                    className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{l.loan_account_number}</p>
                        <p className="text-lg font-semibold">{fmt(Number(l.outstanding_balance || 0))}</p>
                        <p className="text-xs text-muted-foreground">outstanding</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-primary" />
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <div className="pt-6">
              <p className="text-sm font-semibold mb-3">My promises</p>
              {promises.length === 0 ? (
                <p className="text-sm text-muted-foreground">No promises yet.</p>
              ) : (
                <div className="space-y-2">
                  {promises.map((p) => (
                    <Card key={p.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {new Intl.NumberFormat('en-GB', { style: 'currency', currency: p.currency }).format(Number(p.promised_amount))}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            by {new Date(p.promised_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                          </p>
                        </div>
                        <Badge variant="outline" className={statusTone[p.status] || ''}>{p.status.replace('_', ' ')}</Badge>
                      </div>
                      {p.status === 'scheduled' && (
                        <div className="flex gap-2 mt-3">
                          <Button variant="outline" size="sm" onClick={() => setShowCantKeep(p)}>I can't keep this</Button>
                          <Button variant="ghost" size="sm" onClick={() => cancelPromise(p.id)}>Cancel</Button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step === 'options' && loan && (
          <motion.div key="options" {...fade} className="space-y-3">
            <Card className="p-4 border-l-4 border-l-sky-500/70">
              <p className="text-sm font-semibold mb-1">Keep in mind</p>
              <p className="text-sm text-muted-foreground">
                These amounts don't take into account any payments pending or scheduled to be made.
              </p>
            </Card>

            {due.dueNow > 0 && (
              <Card onClick={() => { setAmount(String(due.dueNow)); setStep('method'); }} className="p-4 cursor-pointer hover:border-primary/50">
                <Badge className="mb-2 bg-emerald-500/20 text-emerald-500 border-0">Get back in control</Badge>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">All due amounts</p>
                    <p className="text-2xl font-bold">{fmt(due.dueNow)}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-primary" />
                </div>
              </Card>
            )}

            {due.returnToLimit > 0 && (
              <Card onClick={() => { setAmount(String(due.returnToLimit)); setStep('method'); }} className="p-4 cursor-pointer hover:border-primary/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Return to your credit limit</p>
                    <p className="text-2xl font-bold">{fmt(due.returnToLimit)}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-primary" />
                </div>
              </Card>
            )}

            <Card onClick={() => { setAmount(String(due.statement)); setStep('method'); }} className="p-4 cursor-pointer hover:border-primary/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Outstanding balance</p>
                  <p className="text-2xl font-bold">{fmt(due.statement)}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Pays your loan in full</p>
            </Card>

            <Card onClick={() => { setAmount(''); setStep('amount'); }} className="p-4 cursor-pointer hover:border-primary/50">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">You decide the amount</p>
                <ArrowRight className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Pay what you can afford now</p>
            </Card>
          </motion.div>
        )}

        {step === 'amount' && (
          <motion.div key="amount" {...fade} className="space-y-4">
            <h2 className="text-2xl font-bold">Enter other amount</h2>
            <div className="flex items-center border border-primary/40 rounded-xl px-4 py-3">
              <span className="text-muted-foreground mr-3">{currency === 'GBP' ? '£' : currency}</span>
              <Input
                type="number" inputMode="decimal" autoFocus value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="border-0 bg-transparent text-xl focus-visible:ring-0 p-0"
              />
            </div>
            <Button disabled={!amount || Number(amount) <= 0} className="w-full" onClick={() => setStep('method')}>
              Continue
            </Button>
          </motion.div>
        )}

        {step === 'method' && (
          <motion.div key="method" {...fade} className="space-y-4">
            <Card className="p-5 text-center">
              <Landmark className="w-10 h-10 mx-auto text-primary mb-3" />
              <h2 className="text-xl font-bold">Pay by Bank</h2>
              <p className="text-sm font-semibold mt-1">Fast, easy and secure</p>
              <p className="text-sm text-muted-foreground mt-2">
                Make a one-off payment straight from your bank — no card details needed.
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-sm font-semibold mb-3">How it works</p>
              <ol className="space-y-3 text-sm">
                {['Select your bank from the list', "Authorise the payment in your bank's app", 'Your balance updates within 2 hours', 'Statement updates within 2 working days'].map((t, i) => (
                  <li key={i} className="flex gap-3"><span className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">{i + 1}</span><span className="pt-1">{t}</span></li>
                ))}
              </ol>
            </Card>

            <div className="grid grid-cols-3 gap-2">
              {([
                ['pay_by_bank', 'Pay by Bank', Landmark],
                ['debit_card', 'Debit card', CreditCard],
                ['bank_transfer', 'Transfer', Banknote],
              ] as const).map(([k, label, Icon]) => (
                <button
                  key={k}
                  onClick={() => setMethod(k)}
                  className={`p-3 rounded-xl border text-xs flex flex-col items-center gap-1 transition-colors ${method === k ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>

            <Button className="w-full" onClick={() => setStep('date')}>Continue</Button>
          </motion.div>
        )}

        {step === 'date' && (
          <motion.div key="date" {...fade} className="space-y-4">
            <h2 className="text-2xl font-bold">When will you pay?</h2>
            <p className="text-sm text-muted-foreground">Choose a date you're confident you can keep to.</p>
            <div className="space-y-2">
              <Label>Promised date</Label>
              <Input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Card className="p-4 border-l-4 border-l-amber-500/70">
              <div className="flex gap-3"><ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm">Keeping this promise can improve your credit. Missing it can harm it.</p>
              </div>
            </Card>
            <Button className="w-full" onClick={() => setStep('review')}>Review</Button>
          </motion.div>
        )}

        {step === 'review' && loan && (
          <motion.div key="review" {...fade} className="space-y-4">
            <h2 className="text-2xl font-bold">Review your promise</h2>
            <Card className="p-4 space-y-2 text-sm">
              <Row label="Loan" value={loan.loan_account_number} />
              <Row label="Amount" value={fmt(Number(amount))} />
              <Row label="By" value={new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
              <Row label="Method" value={method.replace('_', ' ')} />
            </Card>
            {feePolicy?.ptp_missed_fee_enabled && projectedFee > 0 && (
              <Card className="p-4 border-l-4 border-l-amber-500/70 text-sm">
                <p className="font-semibold mb-1">Missed-payment fee</p>
                <p className="text-muted-foreground">
                  If this promise is not kept, a fee of{' '}
                  <span className="font-semibold text-foreground">{fmt(projectedFee)}</span>{' '}
                  ({feePolicy.ptp_missed_fee_type === 'percentage'
                    ? `${feePolicy.ptp_missed_fee_value}% of the amount`
                    : 'fixed'}) will be added to your loan balance.
                </p>
              </Card>
            )}
            <Button disabled={submitting} className="w-full" onClick={createPromise}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm promise'}
            </Button>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" {...fade} className="text-center pt-10 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold">Promise set</h2>
            <p className="text-sm text-muted-foreground">
              We'll remind you before {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.
            </p>
            <Button className="w-full" onClick={() => { setStep('list'); }}>Back to payments</Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={!!showCantKeep} onOpenChange={(o) => !o && setShowCantKeep(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>I can't keep to my promise</SheetTitle></SheetHeader>
          {showCantKeep && (
            <div className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Has something changed? Don't worry. If you can't make your promised payment of{' '}
                <span className="font-semibold text-foreground">
                  {new Intl.NumberFormat('en-GB', { style: 'currency', currency: showCantKeep.currency }).format(Number(showCantKeep.promised_amount))}
                </span>{' '}
                on {new Date(showCantKeep.promised_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, let's work it out together.
              </p>
              <div className="space-y-2">
                <Label>Move to a better date</Label>
                <Input
                  type="date"
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  defaultValue={new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)}
                  onBlur={(e) => (showCantKeep as any)._newDate = e.target.value}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => reschedule(showCantKeep, (showCantKeep as any)._newDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))}
              >
                Reschedule
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowCantKeep(null)}>Close</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>
);

export default PromiseToPay;
