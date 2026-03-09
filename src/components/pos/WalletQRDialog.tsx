import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, X, Wallet } from 'lucide-react';
import type { WalletQRData } from '@/hooks/usePOSTill';

const fmt = (n: number) => new Intl.NumberFormat('fr-CM', { minimumFractionDigits: 0 }).format(n);

interface WalletQRDialogProps {
  qrData: WalletQRData | null;
  onClose: () => void;
  onCheckPayment: () => Promise<boolean | undefined>;
}

export const WalletQRDialog: React.FC<WalletQRDialogProps> = ({ qrData, onClose, onCheckPayment }) => {
  const [polling, setPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!qrData) return;
    setPolling(true);
    intervalRef.current = setInterval(async () => {
      const paid = await onCheckPayment();
      if (paid) {
        setPolling(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [qrData, onCheckPayment]);

  if (!qrData) return null;

  return (
    <Dialog open={!!qrData} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Scan to Pay — {fmt(qrData.amount)} XAF
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-3xl border-2 border-border bg-white p-5">
            <QRCodeSVG value={qrData.qr_payload} size={220} level="M" />
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">
              Customer scans this QR code with the <strong>Kang App</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Order #{qrData.order_number}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {polling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Waiting for payment…</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Payment received!</span>
              </>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={onClose} className="mt-2">
            <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
