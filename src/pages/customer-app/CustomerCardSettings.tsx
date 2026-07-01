import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, CalendarClock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface CardRow {
  id: string;
  card_name: string;
  last4: string;
  currency: string;
  status: string;
  provider: string;
  form_factor: string;
  spending_controls: {
    daily_limit?: number | null;
    monthly_limit?: number | null;
  } | null;
}

const CustomerCardSettings: React.FC = () => {
  const { user } = useCustomerAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [daily, setDaily] = useState<string>('');
  const [monthly, setMonthly] = useState<string>('');
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const selected = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? cards[0] ?? null,
    [cards, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setDaily(selected.spending_controls?.daily_limit?.toString() ?? '');
    setMonthly(selected.spending_controls?.monthly_limit?.toString() ?? '');
  }, [selected?.id]);

  const handleSave = () => {
    if (!selected) return;
    setShowPin(true);
  };

  const handlePinConfirmed = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await supabase.functions.invoke('cards-v3', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          action: 'update_limits',
          card_id: selected.id,
          daily_limit: daily === '' ? null : Number(daily),
          monthly_limit: monthly === '' ? null : Number(monthly),
        },
      });
      if (res.error) throw res.error;
      toast.success('Spending limits updated');
      await queryClient.refetchQueries({ queryKey: ['customer-cards-v3'] });
    } catch (e) {
      toast.error(extractEdgeFunctionError(e, 'Could not update limits'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate('/app/cards')}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card"
          aria-label="Back to cards"
        >
          <ArrowLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Card controls</h1>
          <p className="text-xs text-muted-foreground">
            Set daily and monthly spending limits per card.
          </p>
        </div>
      </header>

      {cards.length === 0 ? (
        <section className="rounded-3xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            You don't have any cards yet. Issue one from the Cards screen to configure controls.
          </p>
          <Button variant="outline" className="mt-4 rounded-2xl" onClick={() => navigate('/app/cards')}>
            Go to Cards
          </Button>
        </section>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cards.map((c) => {
              const active = (selected?.id ?? cards[0]?.id) === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`shrink-0 rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card'
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {c.form_factor} · {c.currency}
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    {c.card_name}
                  </p>
                  <p className="text-xs text-muted-foreground">•••• {c.last4}</p>
                </button>
              );
            })}
          </div>

          {selected && (
            <section className="rounded-3xl border border-border bg-card p-5 space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <ShieldCheck className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Spending limits</p>
                  <p className="text-xs text-muted-foreground">
                    Amounts are enforced by the issuer in {selected.currency}. Leave blank for no limit.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="daily-limit" className="text-xs font-semibold text-foreground">
                  Daily limit ({selected.currency})
                </Label>
                <Input
                  id="daily-limit"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="e.g. 500000"
                  value={daily}
                  onChange={(e) => setDaily(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthly-limit" className="text-xs font-semibold text-foreground">
                  Monthly limit ({selected.currency})
                </Label>
                <Input
                  id="monthly-limit"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="e.g. 5000000"
                  value={monthly}
                  onChange={(e) => setMonthly(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 rounded-2xl bg-muted p-3">
                <CalendarClock className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <p className="text-[11px] text-muted-foreground">
                  Changes take effect on the next authorisation. A PIN is required to confirm.
                </p>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-2xl"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.5} />
                    Saving…
                  </>
                ) : (
                  'Save limits'
                )}
              </Button>
            </section>
          )}
        </>
      )}

      <PinConfirmDialog
        open={showPin}
        onOpenChange={setShowPin}
        onConfirmed={handlePinConfirmed}
      />
    </div>
  );
};

export default CustomerCardSettings;
