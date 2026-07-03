import { useEffect, useState } from 'react';
import { Loader2, Wallet, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: any | null;
  onFunded?: () => void;
}

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(n)));
const PRESETS = [5000, 10000, 25000, 50000];

/**
 * Manual card top-up + per-card auto-sync preference editor.
 * Uses the cards-v3 `fund` and `set_auto_sync` actions.
 */
export function AddFundsDialog({ open, onOpenChange, card, onFunded }: Props) {
  const [amount, setAmount] = useState('');
  const [funding, setFunding] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoTarget, setAutoTarget] = useState('');
  const [savingAuto, setSavingAuto] = useState(false);

  const cfg = card?.metadata?.auto_sync ?? {};
  useEffect(() => {
    if (!open || !card) return;
    setAmount('');
    setAutoEnabled(!!cfg.enabled);
    setAutoTarget(cfg.top_up_to ? String(cfg.top_up_to) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card?.id]);

  const invoke = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const res = await supabase.functions.invoke('cards-v3', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body,
    });
    if (res.error) throw res.error;
    return res.data;
  };

  const handleFund = async () => {
    const amt = Number(amount);
    if (!card || !Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setFunding(true);
    try {
      await invoke({
        action: 'fund',
        card_id: card.id,
        amount: amt,
        idempotency_key: `manual:${card.id}:${Date.now()}`,
      });
      toast.success(`Added ${fmt(amt)} XAF to your card`);
      setAmount('');
      onFunded?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(extractEdgeFunctionError(e, 'Could not add funds. Please try again.'));
    } finally {
      setFunding(false);
    }
  };

  const handleSaveAuto = async () => {
    if (!card) return;
    const target = Number(autoTarget);
    if (autoEnabled && (!Number.isFinite(target) || target <= 0)) {
      toast.error('Enter a valid top-up target');
      return;
    }
    setSavingAuto(true);
    try {
      await invoke({
        action: 'set_auto_sync',
        card_id: card.id,
        enabled: autoEnabled,
        top_up_to: autoEnabled ? target : 0,
        threshold: autoEnabled ? target : 0,
      });
      toast.success(autoEnabled ? 'Auto-sync from wallet enabled' : 'Auto-sync disabled');
      onFunded?.();
    } catch (e: any) {
      toast.error(extractEdgeFunctionError(e, 'Could not save auto-sync setting.'));
    } finally {
      setSavingAuto(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add funds to card</DialogTitle>
          <DialogDescription>
            Move money from your wallet to <span className="font-semibold">{card?.card_name || 'this card'}</span>{' '}
            (•••• {card?.last4 ?? '••••'}).
          </DialogDescription>
        </DialogHeader>

        {/* Current card balance */}
        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Card balance</p>
          <p className="text-2xl font-bold text-foreground">
            {fmt(Number(card?.balance_usd ?? 0))} <span className="text-sm font-medium text-muted-foreground">XAF</span>
          </p>
        </div>

        {/* Manual add */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-semibold">
            <Wallet className="h-4 w-4" strokeWidth={1.5} /> Add manually
          </Label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="Amount in XAF"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11"
          />
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
              >
                {fmt(p)}
              </button>
            ))}
          </div>
          <Button onClick={handleFund} disabled={funding} className="w-full rounded-2xl">
            {funding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
            Add from wallet
          </Button>
        </div>

        {/* Auto-sync */}
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Zap className="h-4 w-4" strokeWidth={1.5} /> Auto-sync from wallet
              </Label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Automatically top your card up to a set balance whenever it drops below.
              </p>
            </div>
            <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
          </div>
          {autoEnabled && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Keep card balance at (XAF)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="e.g. 25000"
                value={autoTarget}
                onChange={(e) => setAutoTarget(e.target.value)}
              />
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleSaveAuto}
            disabled={savingAuto}
            className="w-full rounded-2xl"
          >
            {savingAuto && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save auto-sync setting
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Fees may apply per top-up based on the admin fee policy. You will see the exact amount debited from your wallet.
        </p>
      </DialogContent>
    </Dialog>
  );
}
