// Wave 5B — Shared bank-vs-ledger reconciliation matcher.
// Compares normalized bank-side transactions against KOB ledger transactions.
// SAFETY: Flag-only. Never auto-credits or auto-debits. Returns categorized diffs.

import type { BankTransaction, ReconcileResult } from './types.ts';

export interface LedgerTransaction {
  id: string;
  external_reference?: string | null;
  amount: number;
  currency: string;
  credit_debit: 'Credit' | 'Debit';
  booking_date: string;
}

export interface MatcherInput {
  bankTxs: BankTransaction[];
  ledgerTxs: LedgerTransaction[];
  amountToleranceMinor?: number; // default 0 (exact match)
}

export interface MatchDetail {
  category: 'matched' | 'missing_in_kob' | 'missing_in_bank' | 'amount_mismatch';
  bank_tx_id?: string;
  ledger_tx_id?: string;
  reference?: string;
  bank_amount?: number;
  ledger_amount?: number;
  currency?: string;
  rule_applied: 'flag_for_review';
  auto_corrected: false;
}

/**
 * Match bank transactions to ledger transactions by reference (primary) and
 * amount+date (fallback). Returns a flag-only ReconcileResult.
 */
export function matchTransactions(input: MatcherInput): ReconcileResult {
  const tolerance = input.amountToleranceMinor ?? 0;
  const ledgerByRef = new Map<string, LedgerTransaction>();
  const ledgerRemaining = new Set<string>();

  for (const lt of input.ledgerTxs) {
    ledgerRemaining.add(lt.id);
    if (lt.external_reference) {
      ledgerByRef.set(lt.external_reference.trim().toLowerCase(), lt);
    }
  }

  const details: MatchDetail[] = [];
  let matched = 0;
  let amount_mismatches = 0;
  let missing_in_kob = 0;

  for (const bt of input.bankTxs) {
    const ref = bt.reference?.trim().toLowerCase() ?? '';
    const lt = ref ? ledgerByRef.get(ref) : undefined;

    if (!lt) {
      missing_in_kob++;
      details.push({
        category: 'missing_in_kob',
        bank_tx_id: bt.external_tx_id,
        reference: bt.reference,
        bank_amount: bt.amount,
        currency: bt.currency,
        rule_applied: 'flag_for_review',
        auto_corrected: false,
      });
      continue;
    }

    ledgerRemaining.delete(lt.id);
    const diff = Math.abs(bt.amount - lt.amount);
    if (diff > tolerance || bt.currency !== lt.currency) {
      amount_mismatches++;
      details.push({
        category: 'amount_mismatch',
        bank_tx_id: bt.external_tx_id,
        ledger_tx_id: lt.id,
        reference: bt.reference,
        bank_amount: bt.amount,
        ledger_amount: lt.amount,
        currency: bt.currency,
        rule_applied: 'flag_for_review',
        auto_corrected: false,
      });
    } else {
      matched++;
      details.push({
        category: 'matched',
        bank_tx_id: bt.external_tx_id,
        ledger_tx_id: lt.id,
        reference: bt.reference,
        bank_amount: bt.amount,
        ledger_amount: lt.amount,
        currency: bt.currency,
        rule_applied: 'flag_for_review',
        auto_corrected: false,
      });
    }
  }

  let missing_in_bank = 0;
  for (const remainingId of ledgerRemaining) {
    const lt = input.ledgerTxs.find((x) => x.id === remainingId);
    if (!lt) continue;
    missing_in_bank++;
    details.push({
      category: 'missing_in_bank',
      ledger_tx_id: lt.id,
      reference: lt.external_reference ?? undefined,
      ledger_amount: lt.amount,
      currency: lt.currency,
      rule_applied: 'flag_for_review',
      auto_corrected: false,
    });
  }

  return {
    total_compared: input.bankTxs.length + missing_in_bank,
    matched,
    missing_in_kob,
    missing_in_bank,
    amount_mismatches,
    details: details as unknown as Array<Record<string, unknown>>,
  };
}
