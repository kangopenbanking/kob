/**
 * useBalanceReconciliation.test.ts
 *
 * Locks the reconciliation contract: when Home / Transfer / Activity agree
 * the hook returns ok=true; when any source drifts beyond epsilon it returns
 * ok=false with a structured reason.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBalanceReconciliation } from '@/hooks/useBalanceReconciliation';

describe('useBalanceReconciliation', () => {
  it('returns ok when all sources agree', () => {
    const { result } = renderHook(() =>
      useBalanceReconciliation({
        homeBalances: [{ account_id: 'a', amount: 5000, currency: 'XAF' }],
        transferBalances: [{ account_id: 'a', amount: 5000, currency: 'XAF' }],
        recentTransactions: [],
        silent: true,
      }),
    );
    expect(result.current.ok).toBe(true);
    expect(result.current.reasons).toEqual([]);
  });

  it('flags drift between Home and Transfer beyond epsilon', () => {
    const { result } = renderHook(() =>
      useBalanceReconciliation({
        homeBalances: [{ account_id: 'a', amount: 5000, currency: 'XAF' }],
        transferBalances: [{ account_id: 'a', amount: 4500, currency: 'XAF' }],
        recentTransactions: [],
        silent: true,
      }),
    );
    expect(result.current.ok).toBe(false);
    expect(result.current.deltaHomeVsTransfer).toBe(500);
    expect(result.current.reasons[0]).toMatch(/Home.*Transfer/);
  });

  it('tolerates drift inside epsilon', () => {
    const { result } = renderHook(() =>
      useBalanceReconciliation({
        homeBalances: [{ account_id: 'a', amount: 5000, currency: 'XAF' }],
        transferBalances: [{ account_id: 'a', amount: 5001, currency: 'XAF' }],
        recentTransactions: [],
        epsilon: 1,
        silent: true,
      }),
    );
    expect(result.current.ok).toBe(true);
  });

  it('flags mixed-currency balance sources', () => {
    const { result } = renderHook(() =>
      useBalanceReconciliation({
        homeBalances: [{ account_id: 'a', amount: 5000, currency: 'XAF' }],
        transferBalances: [{ account_id: 'a', amount: 5000, currency: 'EUR' }],
        recentTransactions: [],
        silent: true,
      }),
    );
    expect(result.current.ok).toBe(false);
    expect(result.current.reasons.join(' ')).toMatch(/Mixed currencies/);
  });

  it('derives net from activity transactions, ignoring pending', () => {
    const { result } = renderHook(() =>
      useBalanceReconciliation({
        homeBalances: [{ account_id: 'a', amount: 1000, currency: 'XAF' }],
        transferBalances: [{ account_id: 'a', amount: 1000, currency: 'XAF' }],
        recentTransactions: [
          { amount: 2000, credit_debit_indicator: 'Credit', status: 'booked' },
          { amount: 500, credit_debit_indicator: 'Debit', status: 'booked' },
          { amount: 9999, credit_debit_indicator: 'Debit', status: 'pending' },
        ],
        silent: true,
      }),
    );
    expect(result.current.activityDerived).toBe(1500);
    expect(result.current.ok).toBe(true);
  });
});
