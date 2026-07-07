import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { giveting } from '@/lib/giveting';
import { Loader2, Save, RefreshCcw } from 'lucide-react';

type FeeConfig = { pct_bps: number; fixed_minor_xaf: number };

const DEFAULTS: FeeConfig = { pct_bps: 290, fixed_minor_xaf: 10000 };

/**
 * Admin: configure Giveting withdrawal fees.
 * - pct_bps stored as basis points (100 bps = 1%).
 * - fixed_minor_xaf stored in XAF minor units (100 XAF = 10 000).
 * The edge function converts the fixed fee to campaign currency at payout.
 */
export default function AdminGivetingFees() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<FeeConfig>(DEFAULTS);
  const [pctInput, setPctInput] = useState('2.90');
  const [fixedInput, setFixedInput] = useState('100');
  const [sampleAmount, setSampleAmount] = useState('50000'); // XAF

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await giveting('get-fee-config');
      const cfg: FeeConfig = res?.config ?? DEFAULTS;
      setConfig(cfg);
      setPctInput((cfg.pct_bps / 100).toFixed(2));
      setFixedInput((cfg.fixed_minor_xaf / 100).toFixed(0));
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not load fee configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const pctBps = useMemo(() => Math.round(Number(pctInput || '0') * 100), [pctInput]);
  const fixedMinor = useMemo(() => Math.round(Number(fixedInput || '0') * 100), [fixedInput]);
  const preview = useMemo(() => {
    const amount = Math.max(0, Math.round(Number(sampleAmount || '0'))); // XAF whole
    const amountMinor = amount * 100;
    const feePct = Math.round((amountMinor * pctBps) / 10000);
    const fee = feePct + fixedMinor;
    const net = Math.max(0, amountMinor - fee);
    return {
      amount,
      feeXAF: (fee / 100).toLocaleString(),
      netXAF: (net / 100).toLocaleString(),
    };
  }, [sampleAmount, pctBps, fixedMinor]);

  const save = async () => {
    if (!Number.isFinite(pctBps) || pctBps < 0 || pctBps > 5000) {
      toast.error('Percentage must be between 0 and 50%');
      return;
    }
    if (!Number.isFinite(fixedMinor) || fixedMinor < 0) {
      toast.error('Fixed fee must be zero or greater');
      return;
    }
    setSaving(true);
    try {
      const res: any = await giveting('admin-set-fee-config', {
        pct_bps: pctBps,
        fixed_minor_xaf: fixedMinor,
      });
      setConfig(res.config);
      toast.success('Withdrawal fees updated');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save fee configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fundraising Withdrawal Fees</h1>
        <p className="text-sm text-muted-foreground mt-1">
          These values apply to every Giveting fundraiser withdrawal, in every supported currency.
          The fixed fee is denominated in XAF and converted to the campaign currency at payout time.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fee configuration</CardTitle>
          <CardDescription>
            Current: {(config.pct_bps / 100).toFixed(2)}% + {(config.fixed_minor_xaf / 100).toLocaleString()} XAF
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading configuration…
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pct">Percentage fee (%)</Label>
                  <Input
                    id="pct"
                    type="number"
                    min="0"
                    max="50"
                    step="0.01"
                    value={pctInput}
                    onChange={(e) => setPctInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Stored as basis points ({pctBps} bps).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fixed">Fixed fee (XAF)</Label>
                  <Input
                    id="fixed"
                    type="number"
                    min="0"
                    step="1"
                    value={fixedInput}
                    onChange={(e) => setFixedInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Stored as minor XAF ({fixedMinor} minor units).
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm">Preview a withdrawal</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="sample" className="text-xs text-muted-foreground">Amount (XAF)</Label>
                    <Input
                      id="sample"
                      type="number"
                      min="0"
                      value={sampleAmount}
                      onChange={(e) => setSampleAmount(e.target.value)}
                    />
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">Fee</div>
                    <div className="font-medium">{preview.feeXAF} XAF</div>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">Net to organiser</div>
                    <div className="font-medium">{preview.netXAF} XAF</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={load} disabled={saving}>
                  <RefreshCcw className="h-4 w-4 mr-2" /> Reload
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Save className="h-4 w-4 mr-2" />}
                  Save changes
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
