# Bank Connector Kit — File-Based Integration Guide

## Overview

The Bank Connector Kit enables financial institutions to integrate with the KOB platform using file-based data exchange. This is ideal for banks that do not have real-time API capabilities but can export and import CSV files.

## Supported File Types

| Type | Purpose | Key Fields |
|---|---|---|
| **Accounts** | Customer account records | account_number, holder_name, type, currency, status |
| **Balances** | Account balance snapshots | account_number, balance_type, amount, currency, date |
| **Transactions** | Transaction history | account_number, tx_id, amount, credit_debit, date, reference |
| **Beneficiaries** | Registered payees | account_number, name, bank_code, reference |

## Workflow

### Inbound (Bank → KOB)
1. **Download template** from Templates & Guides page
2. **Create mapping profile** if your CSV columns differ from canonical names
3. **Upload CSV** via the Uploads & Imports page
4. **Review results** — check for errors, duplicates, and invalid rows
5. **Re-upload** corrected files as needed

### Outbound (KOB → Bank)
1. **Create batch payment** with payment items
2. **Generate instruction file** (CSV or ISO 20022 pain.001)
3. **Download** and send to your core banking system
4. **Upload status file** with execution results
5. **Review reconciliation** to confirm all payments matched

## File Format Requirements
- UTF-8 encoding
- Comma-separated values (CSV)
- First row must be header
- Date format: ISO 8601 (YYYY-MM-DD)
- Amount: numeric, no currency symbols, period as decimal separator
- Currency: ISO 4217 code (default XAF)

## Security
- All files are SHA-256 hashed for deduplication
- Files are stored in encrypted storage
- Access is scoped to your institution only via RLS policies
- All actions are logged in the Audit Log
