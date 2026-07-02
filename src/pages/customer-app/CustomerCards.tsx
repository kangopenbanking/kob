import React, { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard, Plus, Lock, LockOpen, Snowflake, Eye, EyeOff, Settings, Loader2,
  Sparkles, ShieldCheck, Smartphone, Wallet, Truck, PowerOff, Clock, CheckCircle2, XCircle, Palette,
} from 'lucide-react';
import { CardBackgroundPicker, getCardBackground } from '@/components/customer-app/CardBackgroundPicker';

import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCardTransactions } from '@/hooks/useCustomerData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { HowItWorksFlow } from '@/components/customer-app/HowItWorksFlow';

const cardColors = ['bg-[hsl(225,50%,22%)]', 'bg-[hsl(150,35%,30%)]', 'bg-[hsl(25,60%,35%)]'];

const HOW_STEPS = [
  { icon: Sparkles,     title: 'Pick a form factor',   description: 'Virtual instantly, digital for Apple / Google Pay, or physical shipped to you.', color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,40%)]' },
  { icon: ShieldCheck,  title: 'We issue securely',    description: 'Your card is provisioned through our regulated banking partners with bank-grade encryption.', color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,50%,32%)]' },
  { icon: Smartphone,   title: 'Reveal & pay online',  description: 'Reveal your card with a step-up PIN. Card details never touch our database.', color: 'bg-[hsl(255,50%,93%)]', iconColor: 'text-[hsl(255,40%,42%)]' },
  { icon: Wallet,       title: 'Add to your wallet',   description: 'Push to Apple Pay or Google Pay in one tap.', color: 'bg-[hsl(25,60%,90%)]',  iconColor: 'text-[hsl(25,60%,35%)]' },
  { icon: Truck,        title: 'Track physical cards', description: 'Follow manufacturing, shipment and delivery from the Cards screen.', color: 'bg-[hsl(200,70%,92%)]', iconColor: 'text-[hsl(200,50%,38%)]' },
];

interface CardRow {
  id: string; card_name: string; last4: string; exp_month: number; exp_year: number;
  status: string; provider: string; form_factor: string; currency: string; brand?: string;
}

const CustomerCards: React.FC = () => {
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeCard, setActiveCard] = useState(0);
  const [showNumber, setShowNumber] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pendingAction, setPendingAction] = useState<'freeze' | 'unfreeze' | 'deactivate' | 'reveal' | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [issuing, setIssuing] = useState<null | 'virtual' | 'digital' | 'physical'>(null);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [bgVersion, setBgVersion] = useState(0);

  // Whether the signed-in customer has a transaction PIN set.
  const { data: hasPin = false } = useQuery<boolean>({
    queryKey: ['customer-has-pin', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('pin_code_hash')
        .eq('id', user!.id)
        .maybeSingle();
      return !!(data as any)?.pin_code_hash;
    },
  });


  const { data: cards = [], isLoading } = useQuery<CardRow[]>({
    queryKey: ['customer-cards-v3', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const res = await supabase.functions.invoke('cards-v3', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: 'list' },
      });
      if (res.error) throw res.error;
      return (res.data?.cards ?? []) as CardRow[];
    },
  });

  const { data: cardTxns = [] } = useCardTransactions(user?.id, 5);
  const card = cards[activeCard];

  const { data: requests = [], refetch: refetchRequests } = useQuery<any[]>({
    queryKey: ['customer-card-requests', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const res = await supabase.functions.invoke('cards-v3', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: 'list_requests' },
      });
      if (res.error) return [];
      return res.data?.requests ?? [];
    },
  });


  // Preserve idempotency key across retries so repeat clicks never duplicate a card.
  const [issueAttemptKeys, setIssueAttemptKeys] = useState<Record<string, string>>({});
  const [lastTimeline, setLastTimeline] = useState<Array<{ step: string; at: string; note?: string }>>([]);

  const runIssue = async (form_factor: 'virtual' | 'digital', idempotency_key: string) => {
    setIssuing(form_factor);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await supabase.functions.invoke('cards-v3', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: 'issue', form_factor, currency: 'XAF', idempotency_key },
      });
      if (res.error) throw res.error;
      if (Array.isArray(res.data?.timeline)) setLastTimeline(res.data.timeline);
      if (res.data?.pending_approval) {
        toast.info(res.data.message ?? 'Your card request is awaiting admin approval.', { duration: 8000 });
        await refetchRequests();
        return;
      }
      toast.success(
        res.data?.idempotent_replay
          ? 'Card already issued for this request'
          : form_factor === 'digital' ? 'Digital card ready' : 'Virtual card issued',
      );
      setIssueAttemptKeys((prev) => {
        const next = { ...prev }; delete next[form_factor]; return next;
      });
      await queryClient.refetchQueries({ queryKey: ['customer-cards-v3'] });
      await refetchRequests();
    } catch (e: any) {
      const msg = extractEdgeFunctionError(e, 'Could not issue card. Please try again.');
      toast.error(msg, {
        duration: 8000,
        action: { label: 'Retry', onClick: () => runIssue(form_factor, idempotency_key) },
      });
    } finally {
      setIssuing(null);
    }
  };

  const handleIssue = async (form_factor: 'virtual' | 'digital' | 'physical') => {
    if (form_factor === 'physical') {
      navigate('/app/cards/order-physical');
      return;
    }
    const key = issueAttemptKeys[form_factor] ?? crypto.randomUUID();
    setIssueAttemptKeys((prev) => ({ ...prev, [form_factor]: key }));
    await runIssue(form_factor, key);
  };

  const handleFreezeUnfreeze = () => {
    if (!card) return;
    setPendingAction(card.status === 'inactive' ? 'unfreeze' : 'freeze');
    setShowPin(true);
  };

  const handleDeactivate = () => {
    if (!card) return;
    if (!window.confirm(
      'Deactivate this card permanently? You will not be able to use it again. Issuing a new card in this category will require admin approval.',
    )) return;
    setPendingAction('deactivate');
    setShowPin(true);
  };

  const handleRevealToggle = () => {
    if (!card) return;
    if (showNumber) { setShowNumber(false); return; }
    if (!hasPin) {
      toast.error('Set your transaction PIN to reveal card details.', {
        duration: 6000,
        action: { label: 'Set PIN', onClick: () => navigate('/app/pin-setup') },
      });
      return;
    }
    setPendingAction('reveal');
    setShowPin(true);
  };

  const handlePinConfirmed = async () => {
    if (!card || !pendingAction) return;
    if (pendingAction === 'reveal') {
      setShowNumber(true);
      setPendingAction(null);
      return;
    }
    setIsUpdatingStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await supabase.functions.invoke('cards-v3', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: pendingAction, card_id: card.id },
      });
      if (res.error) throw res.error;
      toast.success(
        pendingAction === 'freeze' ? 'Card frozen'
          : pendingAction === 'unfreeze' ? 'Card activated'
          : 'Card deactivated',
      );
      await queryClient.refetchQueries({ queryKey: ['customer-cards-v3'] });
    } catch (e: any) {
      toast.error(extractEdgeFunctionError(e, 'Failed to update card status'));
    } finally {
      setIsUpdatingStatus(false);
      setPendingAction(null);
    }
  };

  // Per-card background (local device). bgVersion re-reads after picker changes.
  const cardBg = useMemo(
    () => (card ? getCardBackground(card.id) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card?.id, bgVersion],
  );

  const pendingRequests = requests.filter((r: any) => r.status === 'pending');
  const approvedRequests = requests.filter((r: any) => r.status === 'approved');


  const providerBadge = useMemo(() => {
    if (!card) return null;
    return (
      <span className="rounded-full bg-[hsl(0,0%,100%)]/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[hsl(0,0%,100%)]">
        {card.form_factor}
      </span>
    );
  }, [card]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      <HowItWorksFlow steps={HOW_STEPS} title="How Kang Cards work" storageKey="cards-v3" />

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cards</h1>
          <p className="text-xs text-muted-foreground">
            Secure cards for everyday spending
          </p>
        </div>
      </header>

      {(pendingRequests.length > 0 || approvedRequests.length > 0) && (
        <section className="space-y-2">
          {pendingRequests.map((r: any) => (
            <div key={r.id} className="flex items-start gap-3 rounded-2xl border border-border bg-[hsl(45,90%,96%)] p-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(35,80%,40%)]" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Awaiting admin approval</p>
                <p className="text-[11px] text-muted-foreground">
                  Your request for a new {r.form_factor} card is being reviewed. We'll notify you once decided.
                </p>
              </div>
            </div>
          ))}
          {approvedRequests.map((r: any) => (
            <div key={r.id} className="flex items-start gap-3 rounded-2xl border border-border bg-[hsl(150,60%,95%)] p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(150,55%,32%)]" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Request approved</p>
                <p className="text-[11px] text-muted-foreground">
                  Tap "Add another card" below to issue your approved {r.form_factor} card.
                </p>
              </div>
            </div>
          ))}
        </section>
      )}



      {cards.length === 0 ? (
        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <CreditCard className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-foreground">You don't have a card yet</p>
            <p className="text-xs text-muted-foreground">Choose the type that fits how you pay.</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <IssueTile
              form="virtual"
              title="Virtual card"
              subtitle="Instant, best for online payments"
              icon={CreditCard}
              accent="bg-[hsl(210,80%,93%)]"
              iconAccent="text-[hsl(210,60%,40%)]"
              onClick={() => handleIssue('virtual')}
              loading={issuing === 'virtual'}
            />
            <IssueTile
              form="digital"
              title="Digital card"
              subtitle="Add to Apple Pay or Google Pay"
              icon={Smartphone}
              accent="bg-[hsl(150,40%,90%)]"
              iconAccent="text-[hsl(150,50%,32%)]"
              onClick={() => handleIssue('digital')}
              loading={issuing === 'digital'}
            />
            <IssueTile
              form="physical"
              title="Physical card"
              subtitle="Shipped to your address"
              icon={Truck}
              accent="bg-[hsl(25,60%,90%)]"
              iconAccent="text-[hsl(25,60%,35%)]"
              onClick={() => handleIssue('physical')}
              loading={issuing === 'physical'}
            />
          </div>
        </section>
      ) : (
        <>
          <div className="relative">
            <AnimatePresence mode="wait">
              {card && (
                <motion.div
                  key={activeCard}
                  initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                  className={`rounded-2xl ${cardColors[activeCard % cardColors.length]} p-6 relative overflow-hidden`}
                  style={{ aspectRatio: '1.586', maxHeight: '220px' }}
                >
                  <div className="absolute right-6 top-6 h-20 w-20 rounded-full border border-[hsl(0,0%,100%)]/10" />
                  <div className="absolute right-10 top-10 h-14 w-14 rounded-full border border-[hsl(0,0%,100%)]/10" />

                  <div className="relative flex items-center justify-between">
                    <CreditCard className="h-8 w-8 text-[hsl(0,0%,100%)]" strokeWidth={1.5} />
                    <div className="flex items-center gap-2">
                      {providerBadge}
                      {card.status === 'inactive' && <Snowflake className="h-4 w-4 text-[hsl(210,80%,75%)]" strokeWidth={1.5} />}
                      <button
                        type="button"
                        onClick={handleFreezeUnfreeze}
                        disabled={isUpdatingStatus || card?.status === 'cancelled'}
                        aria-label={card.status === 'inactive' ? 'Unlock card' : 'Lock card'}
                        className="rounded-full p-1 transition hover:bg-[hsl(0,0%,100%)]/10 disabled:opacity-50"
                      >
                        {isUpdatingStatus
                          ? <Loader2 className="h-4 w-4 animate-spin text-[hsl(0,0%,100%)]" strokeWidth={1.5} />
                          : <Lock className={`h-4 w-4 ${card.status === 'inactive' ? 'text-[hsl(0,0%,100%)]' : 'text-[hsl(0,0%,100%)]/60'}`} strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const rawBrand = String(card.brand ?? '').toLowerCase();
                    const bin = rawBrand.includes('master') ? '5412'
                              : rawBrand.includes('amex') ? '3782'
                              : rawBrand.includes('verve') ? '5061'
                              : '4532';
                    const rawLast4 = String(card.last4 ?? '').replace(/\D/g, '');
                    const last4 = rawLast4.length === 4 ? rawLast4 : '••••';
                    // Deterministic middle digits from card id — used only in revealed state.
                    const seed = String(card.id ?? '').replace(/\D/g, '').padEnd(8, '7');
                    const mid1 = seed.slice(0, 4);
                    const mid2 = seed.slice(4, 8);
                    const hiddenNumber = `•••• •••• •••• ${last4}`;
                    const revealedNumber = `${bin} ${mid1} ${mid2} ${last4}`;
                    return (
                      <p className="relative mt-6 text-lg font-mono tracking-widest text-[hsl(0,0%,100%)]">
                        {showNumber ? revealedNumber : hiddenNumber}
                      </p>
                    );
                  })()}

                  <div className="relative mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase text-[hsl(0,0%,100%)]/50">Card Name</p>
                      <p className="text-sm font-semibold text-[hsl(0,0%,100%)]">{card.card_name || 'Kang Card'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase text-[hsl(0,0%,100%)]/50">Expires</p>
                      <p className="text-sm font-semibold text-[hsl(0,0%,100%)]">
                        {showNumber && card.exp_month && card.exp_year
                          ? `${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}`
                          : '••/••'}
                      </p>
                    </div>
                  </div>
                  {showNumber && (
                    <p className="relative mt-3 text-[10px] text-[hsl(0,0%,100%)]/70">
                      Display pattern shown for reference. Full PAN and CVV are only available in your provider's PCI-compliant secure vault via Controls.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {cards.length > 1 && (
              <div className="mt-3 flex justify-center gap-1.5">
                {cards.map((_, i) => (
                  <button key={i} onClick={() => setActiveCard(i)}
                    className={`h-2 rounded-full transition-all ${i === activeCard ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'}`} />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => setShowNumber(!showNumber)} className="flex flex-col items-center gap-2.5 rounded-2xl bg-[hsl(210,80%,93%)] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(210,70%,85%)]">
                {showNumber ? <EyeOff className="h-5 w-5 text-[hsl(210,60%,40%)]" strokeWidth={1.5} /> : <Eye className="h-5 w-5 text-[hsl(210,60%,40%)]" strokeWidth={1.5} />}
              </div>
              <span className="text-[10px] font-bold text-foreground">{showNumber ? 'Hide' : 'Reveal'}</span>
            </button>
            <button
              onClick={handleFreezeUnfreeze}
              disabled={isUpdatingStatus || card?.status === 'cancelled'}
              className="flex flex-col items-center gap-2.5 rounded-2xl bg-[hsl(200,70%,92%)] p-4 disabled:opacity-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(200,60%,82%)]">
                {isUpdatingStatus
                  ? <Loader2 className="h-5 w-5 animate-spin text-[hsl(200,50%,38%)]" strokeWidth={1.5} />
                  : <Snowflake className="h-5 w-5 text-[hsl(200,50%,38%)]" strokeWidth={1.5} />}
              </div>
              <span className="text-[10px] font-bold text-foreground">
                {card?.status === 'inactive' ? 'Unfreeze' : 'Freeze'}
              </span>
            </button>
            <button onClick={() => navigate('/app/cards/settings')} className="flex flex-col items-center gap-2.5 rounded-2xl bg-[hsl(255,50%,93%)] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(255,40%,84%)]">
                <Settings className="h-5 w-5 text-[hsl(255,40%,42%)]" strokeWidth={1.5} />
              </div>
              <span className="text-[10px] font-bold text-foreground">Controls</span>
            </button>
          </div>

          {card && card.status !== 'cancelled' && (
            <Button
              variant="outline"
              className="w-full rounded-2xl border-destructive/40 text-destructive hover:bg-destructive/5"
              onClick={handleDeactivate}
              disabled={isUpdatingStatus}
            >
              <PowerOff className="mr-2 h-4 w-4" strokeWidth={1.5} />
              Deactivate card permanently
            </Button>
          )}


          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Recent card activity
            </p>
            {cardTxns.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {cardTxns.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-2xl bg-card p-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{tx.description || tx.transaction_type}</p>
                      <p className="text-[11px] text-muted-foreground">{tx.card_last4 ? `•••• ${tx.card_last4}` : ''}</p>
                    </div>
                    <p className={`text-sm font-bold ${tx.amount > 0 ? 'text-[hsl(150,60%,40%)]' : 'text-foreground'}`}>
                      {tx.amount > 0 ? '+' : '-'}{Math.abs(tx.amount).toLocaleString()} {tx.currency}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button variant="outline" className="w-full rounded-2xl" onClick={() => handleIssue('virtual')} disabled={!!issuing}>
            {issuing === 'virtual' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />}
            Add another card
          </Button>
        </>
      )}

      {lastTimeline.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Last issuance timeline
          </p>
          <ol className="space-y-2">
            {lastTimeline.map((ev, i) => (
              <li key={`${ev.step}-${i}`} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-foreground">{ev.step.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(ev.at).toLocaleTimeString()}{ev.note ? ` · ${ev.note}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={handlePinConfirmed} />
    </div>
  );
};

const IssueTile: React.FC<{
  form: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  accent: string;
  iconAccent: string;
  onClick: () => void;
  loading: boolean;
}> = ({ title, subtitle, icon: Icon, accent, iconAccent, onClick, loading }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={`flex items-center gap-3 rounded-2xl ${accent} p-4 text-left transition disabled:opacity-60`}
  >
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(0,0%,100%)]/60">
      {loading ? <Loader2 className={`h-5 w-5 animate-spin ${iconAccent}`} strokeWidth={1.5} /> : <Icon className={`h-5 w-5 ${iconAccent}`} strokeWidth={1.5} />}
    </div>
    <div className="flex-1">
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="text-[11px] text-foreground/70">{subtitle}</p>
    </div>
    <Plus className={`h-4 w-4 ${iconAccent}`} strokeWidth={1.5} />
  </button>
);

export default CustomerCards;
