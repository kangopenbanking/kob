import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { giveting, formatMoney, toMinor, newIdempotencyKey } from '@/lib/giveting';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { toast } from 'sonner';

export const GivetingDonate: React.FC = () => {
  const { slug } = useParams();
  const nav = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [tip, setTip] = useState('0');
  const [comment, setComment] = useState('');
  const [anon, setAnon] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const res: any = await giveting('get', { slug });
      setCampaign(res.campaign);
    })().catch((e) => toast.error(e.message ?? 'Load failed'));
  }, [slug]);

  const submit = async () => {
    if (!campaign) return;
    setLoading(true);
    try {
      const key = newIdempotencyKey();
      await giveting('donate', {
        campaign_id: campaign.id,
        amount_minor: toMinor(amount, campaign.currency),
        tip_minor: toMinor(tip || '0', campaign.currency),
        currency: campaign.currency,
        comment: comment || undefined,
        is_anonymous: anon,
        idempotency_key: key,
      });
      toast.success('Thank you for your donation!');
      nav(`/app/giveting/c/${slug}`);
    } catch (e: any) {
      const m = e.message ?? '';
      if (m === 'insufficient_funds') toast.error('Not enough balance in your wallet.');
      else toast.error(m || 'Donation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!campaign) return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;
  if (campaign.status !== 'active') {
    return (
      <div className="px-5 pt-10 text-center">
        <p className="text-sm text-muted-foreground">This fundraiser is no longer accepting donations.</p>
        <Button variant="outline" className="mt-4 rounded-full" onClick={() => nav(`/app/giveting/c/${slug}`)}>
          Back to fundraiser
        </Button>
      </div>
    );
  }


  const preset = campaign.currency === 'XAF' || campaign.currency === 'XOF' ? [1000, 5000, 10000, 25000] : [5, 10, 25, 50];

  return (
    <div className="pb-32">
      <header className="flex items-center gap-3 px-5 pt-6">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="h-9 w-9 rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-xs text-muted-foreground">Donating to</p>
          <p className="text-sm font-semibold line-clamp-1">{campaign.title}</p>
        </div>
      </header>

      <div className="px-5 pt-8">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Amount ({campaign.currency})</Label>
        <Input
          type="number"
          inputMode="decimal"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-16 rounded-2xl text-3xl font-bold"
          placeholder="0"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {preset.map((p) => (
            <Button key={p} variant="outline" size="sm" onClick={() => setAmount(String(p))} className="h-9 rounded-full">
              {formatMoney(p * 100, campaign.currency)}
            </Button>
          ))}
        </div>

        <div className="mt-6">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tip Giveting (optional)</Label>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            className="mt-1 h-12 rounded-2xl"
            placeholder="0"
          />
        </div>

        <div className="mt-6">
          <Label>Message (optional)</Label>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} className="mt-1 min-h-[100px] rounded-2xl" placeholder="Leave a supportive message" />
        </div>

        <div className="mt-6 flex items-center justify-between rounded-2xl border p-4">
          <div>
            <p className="text-sm font-medium">Donate anonymously</p>
            <p className="text-xs text-muted-foreground">Hide your name from the public donor list.</p>
          </div>
          <Switch checked={anon} onCheckedChange={setAnon} />
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-lg border-t bg-background px-5 py-3">
        <Button
          onClick={() => setPinOpen(true)}
          disabled={!amount || Number(amount) <= 0 || loading}
          className="h-14 w-full rounded-full text-base font-semibold"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Donate {amount ? formatMoney(toMinor(amount, campaign.currency), campaign.currency) : ''}
        </Button>
      </footer>

      <PinConfirmDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        onConfirmed={() => { setPinOpen(false); submit(); }}
        title="Confirm your donation"
        description="Enter your 6-digit PIN to authorise this donation from your wallet."
      />
    </div>
  );
};

export default GivetingDonate;
