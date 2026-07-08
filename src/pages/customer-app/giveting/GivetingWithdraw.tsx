import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Wallet, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { giveting, formatMoney, newIdempotencyKey, toMinor } from '@/lib/giveting';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { toast } from 'sonner';

export const GivetingWithdraw: React.FC = () => {
  const { slug } = useParams();
  const nav = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [pinOpen, setPinOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [closePromptOpen, setClosePromptOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  const load = async () => {
    const res: any = await giveting('get', { slug });
    setCampaign(res.campaign);
    try {
      const w: any = await giveting('list-withdrawals', { campaign_id: res.campaign.id });
      setWithdrawals(w.withdrawals ?? []);
    } catch {}
  };
  useEffect(() => { load().catch((e) => toast.error(e.message ?? 'Load failed')); }, [slug]);

  if (!campaign) return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;

  const alreadyOut = withdrawals.filter((w) => ['pending', 'processing', 'settled'].includes(w.status)).reduce((s, w) => s + Number(w.net_minor) + Number(w.fee_minor), 0);
  const available = Number(campaign.total_raised_minor) - alreadyOut;

  const amountMinor = amount ? toMinor(amount, campaign.currency) : 0;
  const feePct = Math.round(amountMinor * 0.029);
  const fixedFee = campaign.currency === 'XAF' ? 10000 : Math.round(10000 / 655.957 * (campaign.currency === 'EUR' ? 1 : campaign.currency === 'USD' ? 1.08 : campaign.currency === 'GBP' ? 0.87 : 1));
  const totalFee = feePct + fixedFee;
  const net = amountMinor - totalFee;

  const submit = async () => {
    setLoading(true);
    try {
      await giveting('withdraw', {
        campaign_id: campaign.id,
        amount_minor: amountMinor,
        destination_type: 'wallet',
        idempotency_key: newIdempotencyKey(),
      });
      toast.success('Withdrawal sent to your wallet');
      await load();
      setAmount('');
      // Offer to close the fundraiser once funds are out.
      if (campaign.status !== 'completed' && campaign.status !== 'archived') {
        setClosePromptOpen(true);
      } else {
        nav(`/app/giveting/c/${slug}/manage`);
      }
    } catch (e: any) {
      const m = e.message ?? '';
      if (m === 'exceeds_available') toast.error('Amount exceeds available balance');
      else if (m === 'amount_below_fee') toast.error('Amount is too small — fees exceed the transfer');
      else toast.error(m || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const closeCampaign = async () => {
    const reason = closeReason.trim();
    if (reason.length < 3) {
      toast.error('Please provide a reason for closing (at least 3 characters).');
      return;
    }
    setClosing(true);
    try {
      const res: any = await giveting('set-status', { id: campaign.id, status: 'completed', reason });
      if (res?.error) {
        const map: Record<string, string> = {
          withdrawals_in_flight: 'Wait for pending withdrawals to settle before closing.',
          unwithdrawn_balance: 'Withdraw the remaining balance before closing this fundraiser.',
          forbidden: 'Only the fundraiser owner can close it.',
          invalid_transition: 'This fundraiser cannot be closed from its current state.',
          reason_required: 'Please provide a reason for closing this fundraiser.',
        };
        toast.error(map[res.error] ?? res.message ?? res.error);
        return;
      }
      toast.success('Fundraiser closed');
      setClosePromptOpen(false);
      nav('/app/giveting');
    } catch (e: any) {
      toast.error(e.message ?? 'Could not close fundraiser');
    } finally {
      setClosing(false);
    }
  };


  return (
    <div className="pb-32">
      <header className="flex items-center gap-3 px-5 pt-6">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="h-9 w-9 rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Set up transfers</h1>
      </header>

      <div className="px-5 pt-6">
        <Card className="rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Available to withdraw</p>
          <p className="mt-1 text-3xl font-bold">{formatMoney(available, campaign.currency)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Total raised: {formatMoney(campaign.total_raised_minor, campaign.currency)}</p>
          {alreadyOut > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">Already withdrawn (incl. fees): {formatMoney(alreadyOut, campaign.currency)}</p>
          )}
        </Card>

        <div className="mt-6">
          <Label>Amount to withdraw</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 h-14 rounded-2xl text-2xl font-semibold"
            placeholder="0"
          />
        </div>

        <Card className="mt-6 flex items-center gap-3 rounded-2xl p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="h-5 w-5" strokeWidth={1.7} />
          </div>
          <div>
            <p className="font-semibold">Kang Wallet</p>
            <p className="text-xs text-muted-foreground">Funds settle instantly.</p>
          </div>
        </Card>

        {amountMinor > 0 && (
          <Card className="mt-4 space-y-2 rounded-2xl p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span>{formatMoney(amountMinor, campaign.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform fee (2.9% + fixed)</span>
              <span>-{formatMoney(totalFee, campaign.currency)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
              <span>You receive</span>
              <span>{formatMoney(Math.max(0, net), campaign.currency)}</span>
            </div>
          </Card>
        )}

        {withdrawals.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold">Recent transfers</h2>
            <div className="space-y-2">
              {withdrawals.map((w) => {
                const gross = Number(w.net_minor) + Number(w.fee_minor);
                return (
                  <div key={w.id} className="flex items-center justify-between rounded-2xl border p-3 text-sm">
                    <div>
                      <p className="font-medium">{formatMoney(gross, w.currency)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(w.created_at).toLocaleDateString()} · {w.status} · net {formatMoney(w.net_minor, w.currency)} · fee {formatMoney(w.fee_minor, w.currency)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">{w.destination_type}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-lg border-t bg-background px-5 py-3">
        <Button
          onClick={() => setPinOpen(true)}
          disabled={!amountMinor || amountMinor > available || net <= 0 || loading}
          className="h-14 w-full rounded-full text-base font-semibold"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Transfer to my wallet
        </Button>
      </footer>

      <PinConfirmDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        onConfirmed={() => { setPinOpen(false); submit(); }}
        title="Confirm withdrawal"
        description="Enter your 6-digit PIN to authorise this withdrawal."
      />

      <AlertDialog open={closePromptOpen} onOpenChange={setClosePromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" strokeWidth={1.7} />
              Close this fundraiser?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your withdrawal has been sent. Closing the fundraiser marks it as
              completed and inactive — no new donations can be received and it
              will show as closed on your Giveting home. This action can be
              reversed by an admin if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="close-reason" className="text-sm">
              Reason for closing <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="close-reason"
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              maxLength={500}
              disabled={closing}
              placeholder="e.g. Goal reached and funds withdrawn. Thank you to all donors."
              className="min-h-[96px]"
            />
            <p className="text-xs text-muted-foreground">
              Recorded on the audit trail with your name and the time of closure.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closing} onClick={() => { setCloseReason(''); nav(`/app/giveting/c/${slug}/manage`); }}>
              Keep active
            </AlertDialogCancel>
            <AlertDialogAction disabled={closing || closeReason.trim().length < 3} onClick={closeCampaign}>
              {closing ? 'Closing…' : 'Close fundraiser'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GivetingWithdraw;
