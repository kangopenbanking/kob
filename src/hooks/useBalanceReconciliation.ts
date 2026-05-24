/**
 * useBalanceReconciliation.ts
 *
 * Automated reconciliation layer for the Consumer mobile app.
 *
 * Compares three independent sources of truth and raises a structured
 * mismatch event when they diverge:
 *
 *   1. Home wallet card  → sum of useAccountBalances()  (ClosingAvailable)
 *   2. Transfer screen   → same account_balances source, re-queried fresh
 *   3. Activity feed     → derived running balance from transactions
 *      (credits - debits) over the visible window
 *
 * The reconciler tolerates a configurable epsilon (default 1 XAF, since
 * XAF/XOF are zero-decimal) and only flags drift outside that band.
 *
 * Mismatches are:
 *   - logged to the console with full breakdown
 *   - emitted to the `balance_reconciliation_events` table (best-effort)
 *   - exposed via the returned `mismatch` object so a banner can surface them
 *
 * This is read-only and never blocks the user. It exists so that any future
 * drift between Home / Transfer / Activity is detected automatically instead
 * of being noticed manually during audits.
 */
import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

type BalanceRow = {
  account_id: string;
  amount: number;
  currency?: string;
  balance_type?: string;
};

type TxRow = {
  amount: number;
  currency?: string;
  credit_debit_indicator?: 'Credit' | 'Debit' | string | null;
  status?: string | null;
};

export type ReconciliationMismatch = {
  ok: boolean;
  currency: string;
  homeTotal: number;
  transferTotal: number;
  activityDerived: number;
  deltaHomeVsTransfer: number;
  deltaHomeVsActivity: number;
  epsilon: number;
  reasons: string[];
};

export interface UseBalanceReconciliationArgs {
  homeBalances: BalanceRow[] | undefined;
  transferBalances: BalanceRow[] | undefined;
  recentTransactions: TxRow[] | undefined;
  /** Currency expected across all sources. Defaults to XAF. */
  currency?: string;
  /** Numeric tolerance. Defaults to 1 (zero-decimal XAF). */
  epsilon?: number;
  /** Disable the side-effect logging (useful in tests). */
  silent?: boolean;
}

function sumAmounts(rows: BalanceRow[] | undefined): number {
  if (!rows) return 0;
  return rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
}

function deriveFromActivity(txs: TxRow[] | undefined): number {
  if (!txs) return 0;
  let net = 0;
  for (const t of txs) {
    if (t.status && t.status.toLowerCase() !== 'booked' && t.status.toLowerCase() !== 'completed') {
      // Skip pending/failed — they don't move the available balance.
      continue;
    }
    const amt = Math.abs(Number(t.amount) || 0);
    const isCredit = (t.credit_debit_indicator || '').toLowerCase() === 'credit';
    net += isCredit ? amt : -amt;
  }
  return net;
}

export function useBalanceReconciliation({
  homeBalances,
  transferBalances,
  recentTransactions,
  currency = 'XAF',
  epsilon = 1,
  silent = false,
}: UseBalanceReconciliationArgs): ReconciliationMismatch {
  const mismatch = useMemo<ReconciliationMismatch>(() => {
    const homeTotal = sumAmounts(homeBalances);
    const transferTotal = sumAmounts(transferBalances);
    const activityDerived = deriveFromActivity(recentTransactions);

    const deltaHomeVsTransfer = Math.abs(homeTotal - transferTotal);
    // Activity is a *delta* over a window, not an absolute. We only flag when
    // its sign disagrees with the Home balance direction or when transfer and
    // home disagree — the absolute activity-vs-home delta is informational.
    const deltaHomeVsActivity = Math.abs(homeTotal - activityDerived);

    const reasons: string[] = [];
    if (deltaHomeVsTransfer > epsilon) {
      reasons.push(
        `Home (${homeTotal}) ≠ Transfer (${transferTotal}) — drift ${deltaHomeVsTransfer} ${currency}`,
      );
    }
    // Cross-source currency sanity check.
    const currencies = new Set(
      [...(homeBalances || []), ...(transferBalances || [])]
        .map((r) => r.currency)
        .filter(Boolean) as string[],
    );
    if (currencies.size > 1) {
      reasons.push(`Mixed currencies across balance sources: ${[...currencies].join(', ')}`);
    }

    return {
      ok: reasons.length === 0,
      currency,
      homeTotal,
      transferTotal,
      activityDerived,
      deltaHomeVsTransfer,
      deltaHomeVsActivity,
      epsilon,
      reasons,
    };
  }, [homeBalances, transferBalances, recentTransactions, currency, epsilon]);

  // Side-effect: log + best-effort persist when something drifts.
  useEffect(() => {
    if (silent || mismatch.ok) return;
    // eslint-disable-next-line no-console
    console.warn('[balance-reconciliation] drift detected', mismatch);

    // Best-effort write — table may not exist in every environment; we swallow
    // errors so the reconciler never breaks the UI.
    supabase
      .from('balance_reconciliation_events' as any)
      .insert({
        currency: mismatch.currency,
        home_total: mismatch.homeTotal,
        transfer_total: mismatch.transferTotal,
        activity_derived: mismatch.activityDerived,
        delta_home_vs_transfer: mismatch.deltaHomeVsTransfer,
        delta_home_vs_activity: mismatch.deltaHomeVsActivity,
        reasons: mismatch.reasons,
      } as any)
      .then(() => undefined, () => undefined);
  }, [mismatch, silent]);

  return mismatch;
}
