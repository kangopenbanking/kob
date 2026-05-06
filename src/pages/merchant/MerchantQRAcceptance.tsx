import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, QrCode, Download, RefreshCw, Store } from 'lucide-react';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useMerchantQR } from '@/hooks/useMerchantQR';
import { useMerchantDirectory } from '@/hooks/useMerchantDirectory';

/**
 * Merchant Portal — QR Acceptance
 *
 * Surfaces this merchant's auto-published EMVCo QR (static + dynamic),
 * confirms presence in the public directory consumed by virtual-card
 * apps, and offers a one-click PNG poster download.
 */
const MerchantQRAcceptance: React.FC = () => {
  const { merchantId, isLoading: ctxLoading } = useMerchantContext();
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const dynamicEnabled = amount.trim().length > 0;

  const staticQR = useMerchantQR(merchantId);
  const dynamicQR = useMerchantQR(merchantId, {
    amount: dynamicEnabled ? amount : undefined,
    ref: reference || undefined,
    enabled: dynamicEnabled,
  });

  const { merchants, isFetching, refetch, lastSyncedAt } = useMerchantDirectory();
  const directoryEntry = useMemo(
    () => merchants.find((m) => m.merchant_id === merchantId) ?? null,
    [merchants, merchantId]
  );

  if (ctxLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!merchantId) {
    return (
      <div className="p-6">
        <Card className="p-6 text-sm text-muted-foreground">
          We could not resolve a merchant account for the signed-in user.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">QR Acceptance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your storefront QR is automatically published to the KOB merchant directory and is
          discoverable by every KOB app and partner virtual-card issuer.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Directory presence */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                Directory Status
              </h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} />}
              Refresh
            </Button>
          </div>

          {directoryEntry ? (
            <dl className="space-y-2 text-sm">
              <Row label="Listed name" value={directoryEntry.name} />
              <Row label="Status" value={directoryEntry.status} />
              <Row label="Country" value={directoryEntry.country ?? '—'} />
              <Row label="MCC" value={directoryEntry.mcc ?? '—'} />
              <Row label="Verified" value={directoryEntry.verified ? 'Yes' : 'No'} />
              <Row label="Last sync" value={lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : '—'} />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your merchant account is not yet in the public directory. This usually means KYB is not approved
              or your status is inactive.
            </p>
          )}
        </Card>

        {/* Static QR */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <QrCode className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              Static QR (Storefront poster)
            </h2>
          </div>
          {staticQR.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : staticQR.data ? (
            <QRBlock emvco={staticQR.data.emvco} filename={`kob-merchant-${merchantId}-static.txt`} />
          ) : (
            <p className="text-sm text-muted-foreground">QR payload unavailable.</p>
          )}
        </Card>
      </div>

      {/* Dynamic QR */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <QrCode className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            Dynamic QR (Per-order)
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Amount (XAF)</label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="2500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Reference (optional)</label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="order-123" />
          </div>
        </div>

        <div className="mt-4">
          {!dynamicEnabled ? (
            <p className="text-sm text-muted-foreground">Enter an amount to generate a one-time payable QR.</p>
          ) : dynamicQR.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : dynamicQR.data ? (
            <QRBlock emvco={dynamicQR.data.emvco} filename={`kob-merchant-${merchantId}-dynamic.txt`} />
          ) : (
            <p className="text-sm text-muted-foreground">Could not generate dynamic QR.</p>
          )}
        </div>
      </Card>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between border-b border-border pb-2 last:border-b-0 last:pb-0">
    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="text-sm font-medium text-foreground">{value}</dd>
  </div>
);

const QRBlock: React.FC<{ emvco: string; filename: string }> = ({ emvco, filename }) => {
  const onDownload = () => {
    const blob = new Blob([emvco], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3">
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 text-[11px] text-foreground">
        {emvco}
      </pre>
      <Button variant="outline" size="sm" onClick={onDownload}>
        <Download className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} /> Download payload
      </Button>
    </div>
  );
};

export default MerchantQRAcceptance;
