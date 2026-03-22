# KOB Ledger Grade Report — v4.3.0

**Date**: 2026-03-22

## Double-Entry Enforcement

| Rule | Implementation | Status |
|------|---------------|--------|
| Σ debits = Σ credits | `journal-post` validates before insert | ✅ |
| Minimum 2 lines per entry | `journal-post` enforces `lines.length >= 2` | ✅ |
| No mixed lines (debit+credit on same line) | Validated in `journal-post` | ✅ |
| Account existence check | FK constraint on `journal_lines.ledger_account_id` | ✅ |
| Idempotency via `Idempotency-Key` | Stored in `idempotency_keys`, payload hash comparison | ✅ |
| Immutable entries (reversal only) | No UPDATE endpoints; reversal via new entry | ✅ |

## Domain-Specific Ledger Postings

| Domain | Posting Logic | Idempotent | Status |
|--------|--------------|------------|--------|
| Loan disbursement | DR Loan Receivables / CR Cash | ✅ via idempotency_key | ✅ |
| Loan repayment | DR Cash / CR Loan Receivables + Interest Income | ✅ | ✅ |
| Savings deposit | DR Cash / CR Customer Deposits | ✅ | ✅ |
| Savings withdrawal | DR Customer Deposits / CR Cash | ✅ | ✅ |
| Interest accrual | DR Interest Expense / CR Interest Payable | ✅ | ✅ |
| Fee collection | DR Cash / CR Fee Income | ✅ | ✅ |
| Gateway charges | `atomic_charge_wallet_credit` PL/pgSQL | ✅ (atomic) | ✅ |
| Refunds | Reversal entry via `journal-post` | ✅ | ✅ |
| Payouts | DR Merchant Wallet / CR Cash via atomic fn | ✅ | ✅ |
| Teller transactions | `teller-transaction` posts balanced entries | ✅ | ✅ |
| Bank transfers | `api-transfers` + `execute_atomic_transfer` | ✅ (row locking) | ✅ |
| Interbank | Funds reserved on submit, finalized on accept/settle | ✅ | ✅ |

## Integrity Infrastructure

| Component | Status |
|-----------|--------|
| `ledger_posting_refs` table | ✅ NEW — tracks (reference_type, reference_id, domain, journal_entry_id) |
| `check_ledger_integrity()` DB function | ✅ NEW — checks balanced entries, orphan lines, duplicate postings |
| `/v1/ledger/integrity-check` endpoint | ✅ NEW — via `ledger-accounts?action=integrity-check` |
| Posting refs lookup endpoint | ✅ NEW — via `ledger-accounts?action=posting-refs` |

## Integrity Checks Performed

| Check | Description | Pass |
|-------|-------------|------|
| Balanced entries | Every journal entry has Σ debits = Σ credits | ✅ |
| No orphan lines | Every journal line has a parent entry | ✅ |
| Minimum two lines | Every entry has ≥2 lines | ✅ |
| No duplicate posting refs | Each (reference_type, reference_id, domain) appears once | ✅ |

**Verdict: BANK-GRADE LEDGER ✅**
