import React, { useEffect, useMemo, useState } from 'react';
import { useQRScanner } from '@/hooks/useQRScanner';
import { parseEmvQR, isSupportedQR, EmvDecoded, EmvParseError } from '@/lib/emvco-qr';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Camera, AlertCircle, CheckCircle2, Store, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface QRPayScannerProps {
  cards: Array<{ id: string; card_name?: string | null; last4?: string | null; balance_usd?: number | null; status?: string }>;
  onPaid?: () => void;
  onClose?: () => void;
}

type Stage = 'scan' | 'confirm' | 'pin' | 'submitting' | 'success' | 'error';

/** UUID v4 generator using crypto */
function uuidv4(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return (crypto as any).randomUUID();
  // RFC4122 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const QRPayScanner: React.FC<QRPayScannerProps> = ({ cards, onPaid, onClose }) => {
  const activeCards = useMemo(() => cards.filter(c => c.status === 'active'), [cards]);
  const [stage, setStage] = useState<Stage>('scan');
  const [decoded, setDecoded] = useState<EmvDecoded | null>(null);
  const [rawPayload, setRawPayload] = useState<string>('');
  const [overrideAmount, setOverrideAmount] = useState<string>('');
  const [selectedCardId, setSelectedCardId] = useState<string>(activeCards[0]?.id ?? '');
  const [pinOpen, setPinOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(uuidv4());
  const [result, setResult] = useState<any>(null);
  const [errMsg, setErrMsg] = useState<string>('');

  const handleScan = (raw: string) => {
    try {
      const d = parseEmvQR(raw);
      const sup = isSupportedQR(d);
      if (!sup.ok) {
        toast.error(`QR not supported: ${(sup as { reason: string }).reason}`);
        scanner.resetProcessed();
        return;
      }
      setDecoded(d);
      setRawPayload(raw);
      setOverrideAmount(d.amount ?? '');
      setStage('confirm');
      scanner.stopCamera();
    } catch (e) {
      const code = e instanceof EmvParseError ? e.code : 'unknown';
      toast.error(`Invalid QR (${code})`);
      scanner.resetProcessed();
    }
  };

  const scanner = useQRScanner({
    onScan: handleScan,
    enabled: stage === 'scan',
    containerId: 'qr-pay-scanner-region',
  });

  useEffect(() => {
    if (activeCards.length && !selectedCardId) setSelectedCardId(activeCards[0].id);
  }, [activeCards, selectedCardId]);

  const submitPayment = async (pin: string) => {
    if (!decoded || !selectedCardId) return;
    setStage('submitting');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qr-initiate-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            qr_payload: rawPayload,
            virtual_card_id: selectedCardId,
            amount_override: decoded.qrType === 'static' ? overrideAmount : undefined,
            pin_token: pin,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setErrMsg(json?.detail || json?.error_code || 'Payment failed');
        setStage('error');
        return;
      }
      setResult(json);
      setStage('success');
      onPaid?.();
    } catch (e) {
      setErrMsg(extractEdgeFunctionError(e, 'Payment failed'));
      setStage('error');
    }
  };

  const reset = () => {
    setStage('scan');
    setDecoded(null);
    setRawPayload('');
    setOverrideAmount('');
    setIdempotencyKey(uuidv4());
    setResult(null);
    setErrMsg('');
  };

  // ----- SCAN -----
  if (stage === 'scan') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Camera className="h-4 w-4" strokeWidth={1.5} />
          Point your camera at a merchant QR code
        </div>
        <div
          id="qr-pay-scanner-region"
          className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted"
        >
          {scanner.scannerType === 'native' && (
            <video ref={scanner.videoRef} className="h-full w-full object-cover" muted playsInline />
          )}
        </div>
        {scanner.cameraError && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5" strokeWidth={1.5} />
            <span>{scanner.cameraError}</span>
          </div>
        )}
        {onClose && <Button variant="outline" className="w-full" onClick={onClose}>Cancel</Button>}
      </div>
    );
  }

  // ----- CONFIRM -----
  if (stage === 'confirm' && decoded) {
    const card = activeCards.find(c => c.id === selectedCardId);
    const insufficient = card && (card.balance_usd ?? 0) < Number(overrideAmount || decoded.amount || 0) * 0.002; // rough
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <h3 className="font-semibold">{decoded.merchantName || 'Merchant'}</h3>
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {decoded.qrType.toUpperCase()}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            {decoded.merchantCity && <div>City: <span className="text-foreground">{decoded.merchantCity}</span></div>}
            {decoded.countryCode && <div>Country: <span className="text-foreground">{decoded.countryCode}</span></div>}
            {decoded.merchantCategoryCode && <div>MCC: <span className="text-foreground">{decoded.merchantCategoryCode}</span></div>}
            <div>Currency: <span className="text-foreground">{decoded.currency}</span></div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount ({decoded.currency})</Label>
          <Input
            id="amount"
            type="number"
            min={1}
            value={overrideAmount}
            onChange={(e) => setOverrideAmount(e.target.value)}
            disabled={decoded.qrType === 'dynamic'}
            placeholder={decoded.qrType === 'static' ? 'Enter amount' : ''}
          />
        </div>

        <div className="space-y-2">
          <Label>Pay with virtual card</Label>
          <select
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={selectedCardId}
            onChange={(e) => setSelectedCardId(e.target.value)}
          >
            {activeCards.map(c => (
              <option key={c.id} value={c.id}>
                {c.card_name || 'Virtual Card'} •••• {c.last4 || '----'} — ${(c.balance_usd ?? 0).toFixed(2)} USD
              </option>
            ))}
          </select>
          {!activeCards.length && (
            <p className="text-xs text-destructive">No active virtual cards. Create or top up first.</p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={reset}>Back</Button>
          <Button
            className="flex-1"
            disabled={!selectedCardId || !overrideAmount || Number(overrideAmount) <= 0}
            onClick={() => setPinOpen(true)}
          >
            Authorize Payment
          </Button>
        </div>

        <PinConfirmDialog
          open={pinOpen}
          onOpenChange={setPinOpen}
          onConfirmed={(pin) => submitPayment(pin)}
          title="Authorize QR Payment"
          description={`Pay ${overrideAmount} ${decoded.currency} to ${decoded.merchantName || 'merchant'}`}
        />
      </div>
    );
  }

  // ----- SUBMITTING -----
  if (stage === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Processing payment...</p>
      </div>
    );
  }

  // ----- SUCCESS -----
  if (stage === 'success' && result) {
    return (
      <div className="flex flex-col items-center text-center py-6 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-9 w-9 text-primary" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Payment {result.status === 'completed' ? 'Successful' : 'Submitted'}</h3>
          <p className="text-sm text-muted-foreground">Show this confirmation to the merchant.</p>
        </div>
        <div className="w-full rounded-2xl border p-4 text-left space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Merchant</span><span className="font-medium">{result.merchant?.name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium">{result.amount} {result.currency}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono text-xs">{result.reference || result.id}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={result.status === 'completed' ? 'default' : 'secondary'}>{result.status}</Badge></div>
        </div>
        <div className="flex gap-2 w-full">
          <Button variant="outline" className="flex-1" onClick={reset}><Receipt className="h-4 w-4 mr-1" strokeWidth={1.5} />Pay Another</Button>
          {onClose && <Button className="flex-1" onClick={onClose}>Done</Button>}
        </div>
      </div>
    );
  }

  // ----- ERROR -----
  return (
    <div className="flex flex-col items-center text-center py-6 gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-9 w-9 text-destructive" strokeWidth={1.5} />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Payment Failed</h3>
        <p className="text-sm text-muted-foreground">{errMsg}</p>
      </div>
      <div className="flex gap-2 w-full">
        <Button variant="outline" className="flex-1" onClick={reset}>Retry</Button>
        {onClose && <Button className="flex-1" onClick={onClose}>Close</Button>}
      </div>
    </div>
  );
};
