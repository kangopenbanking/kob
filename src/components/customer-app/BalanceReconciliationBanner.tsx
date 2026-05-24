/**
 * BalanceReconciliationBanner.tsx
 *
 * Surfaces drift between Home / Transfer / Activity when the reconciliation
 * hook reports a mismatch. Hidden when balances agree (the normal case).
 *
 * Placed inside CustomerActivity so users see the same banner the support
 * team would see if a refund/charge didn't settle the way the ledger thinks.
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ReconciliationMismatch } from '@/hooks/useBalanceReconciliation';

interface Props {
  mismatch: ReconciliationMismatch;
}

const BalanceReconciliationBanner: React.FC<Props> = ({ mismatch }) => {
  if (mismatch.ok) return null;
  return (
    <div
      role="alert"
      className="mx-4 mt-3 mb-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.8} />
        <div className="space-y-1">
          <p className="font-semibold">Balance check</p>
          <p className="text-[11px] leading-snug opacity-90">
            Your activity totals don't match your wallet balance. We've logged
            this for review — refresh in a few minutes or contact support if it
            persists.
          </p>
          <p className="text-[10px] font-mono opacity-70">
            home={mismatch.homeTotal} · transfer={mismatch.transferTotal} ·
            Δ={mismatch.deltaHomeVsTransfer} {mismatch.currency}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BalanceReconciliationBanner;
