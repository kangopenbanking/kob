# Fee Management System - Complete Guide

## Table of Contents
1. [Admin Guide](#admin-guide)
2. [Institution Guide](#institution-guide)
3. [API Integration Guide](#api-integration-guide)
4. [Database Schema Reference](#database-schema-reference)
5. [Examples & Use Cases](#examples--use-cases)

---

## Admin Guide

### Overview
The Fee Management System allows administrators to configure fee structures, manage waivers, generate invoices, and monitor transaction fees across all institutions.

### Accessing the Admin Panel
1. Navigate to `/fee-management` (requires admin role)
2. You'll see 4 main tabs:
   - **Fee Structures**: Create and manage fee configurations
   - **Transaction Fees**: View all recorded fees
   - **Invoices**: Generate and manage billing
   - **Waivers**: Create promotional discounts

### Creating Fee Structures

#### Fee Models

**1. Fixed Fee**
- Charges a flat amount regardless of transaction value
- Best for: Small transactions, administrative fees
- Example: 500 XAF per transfer

```json
{
  "fee_model": "fixed",
  "fixed_amount": 500,
  "transaction_type": "domestic_transfer"
}
```

**2. Percentage Fee**
- Charges a percentage of the transaction amount
- Best for: Large transactions, payment processing
- Example: 2% of transaction value

```json
{
  "fee_model": "percentage",
  "percentage_rate": 2.0,
  "min_fee_amount": 100,
  "max_fee_amount": 5000,
  "transaction_type": "bill_payment"
}
```

**3. Hybrid Fee**
- Combines fixed and percentage components
- Best for: Balanced cost recovery
- Example: 200 XAF + 1.5%

```json
{
  "fee_model": "hybrid",
  "fixed_amount": 200,
  "percentage_rate": 1.5,
  "max_fee_amount": 10000,
  "transaction_type": "mobile_money_transfer"
}
```

**4. Tiered Fee**
- Different rates based on transaction ranges
- Best for: Volume-based pricing
- Example: Graduated rates

```json
{
  "fee_model": "tiered",
  "tiered_rates": [
    {"min": 0, "max": 10000, "fixed": 100, "percentage": 2.0},
    {"min": 10000, "max": 100000, "fixed": 200, "percentage": 1.5},
    {"min": 100000, "max": null, "fixed": 500, "percentage": 1.0}
  ],
  "transaction_type": "domestic_payment"
}
```

### Transaction Types

The system supports the following transaction types:
- `domestic_transfer` - Bank-to-bank transfers within Cameroon
- `domestic_payment` - PISP payment initiation
- `bill_payment` - Utility and service bill payments
- `mobile_money_transfer` - Mobile money send
- `mobile_money_charge` - Mobile money collection

### Managing Fee Waivers

#### Waiver Types

**1. Percentage Discount**
- Reduces fee by a percentage
- Example: 50% off all fees for promotional period

**2. Fixed Discount**
- Reduces fee by a fixed amount
- Example: 200 XAF discount per transaction

**3. Full Waiver**
- Completely removes fees
- Example: Free transactions for launch promotion

**4. Promotional**
- Time-limited special offers
- Example: Weekend promotions, holiday specials

#### Creating a Waiver

1. Go to **Waivers** tab
2. Click **Create Waiver**
3. Select waiver type and configure:
   - Institution (optional - applies to all if not specified)
   - Discount amount/percentage
   - Effective dates (start and end)
   - Max uses (optional usage limit)
   - Applicable transaction types (optional - applies to all if not specified)

### Generating Invoices

#### Manual Invoice Generation

1. Go to **Invoices** tab
2. Click **Generate Invoice**
3. Select:
   - Institution
   - Billing cycle (monthly or quarterly)
   - Period dates
4. System automatically:
   - Aggregates all pending transaction fees
   - Applies any waivers
   - Creates invoice record
   - Sends email to institution

#### Invoice Details

Each invoice includes:
- Invoice number (auto-generated)
- Billing period
- Total transactions count
- Subtotal (before waivers)
- Total waivers applied
- Final amount
- Due date (30 days from period end)
- Payment status

### Viewing Transaction Fees

The **Transaction Fees** tab shows:
- All fees recorded across all institutions
- Filters: Date range, institution, transaction type, billing status
- Details: Transaction amount, calculated fee, waived amount, final fee
- Billing status: pending, invoiced, paid
- Fee breakdown (shows calculation details)

---

## Institution Guide

### Viewing Your Fees

As a financial institution, you can view your fee information in the **FI Portal**:

1. Log in and navigate to **FI Portal**
2. Click on **Fees & Billing** tab
3. You'll see:
   - **Fees This Month**: Total fees charged in current month
   - **Total Transactions**: Count of transactions with fees
   - **Your Fee Structures**: Active fee configurations
   - **Recent Transaction Fees**: Last 20 fees with details

### Understanding Your Fee Structure

Each fee structure shows:
- **Transaction Type**: Which operations incur this fee
- **Fee Model**: How the fee is calculated
  - Fixed: Flat rate per transaction
  - Percentage: % of transaction amount
  - Hybrid: Fixed + percentage
  - Tiered: Different rates by amount
- **Effective Date**: When this structure became active

### Reading Transaction Fees

Each transaction fee record shows:
- **Transaction Reference**: Unique identifier
- **Transaction Type**: Operation performed
- **Date**: When the transaction occurred
- **Final Fee**: Amount charged (after any waivers)
- **Billing Status**:
  - **Pending**: Not yet invoiced
  - **Invoiced**: Included in an invoice
  - **Paid**: Invoice has been paid

### Billing Cycle

- **Monthly Billing**: Invoices generated on the last day of each month
- **Quarterly Billing**: Invoices generated on the last day of each quarter (Mar 31, Jun 30, Sep 30, Dec 31)
- **Due Date**: 30 days after invoice date
- **Automatic Email**: Invoice sent to registered email address

---

## API Integration Guide

### How Fees Are Recorded

Transaction fees are automatically recorded by edge functions after successful transactions. No manual intervention required.

### Edge Functions Recording Fees

1. **api-transfers** → `domestic_transfer`
   - Records fees for bank-to-bank transfers
   - Includes institution_id from account lookup

2. **pisp-payment-submission** → `domestic_payment`
   - Records fees for PISP payment submissions
   - Links to payment_id and consent_id

3. **api-bills** → `bill_payment`
   - Records fees for bill payments
   - Includes biller information in metadata

4. **mobile-money-transfer** → `mobile_money_transfer`
   - Records fees for mobile money disbursements
   - Includes provider and reference details

5. **mobile-money-charge** → `mobile_money_charge`
   - Records fees for mobile money collections
   - Includes Flutterwave transaction references

### Fee Calculation Flow

```
1. Transaction completes successfully
   ↓
2. Edge function calls record_transaction_fee()
   ↓
3. System calls calculate_transaction_fee()
   ↓
4. Fee structure lookup (institution + transaction type + date)
   ↓
5. Fee calculation based on model (fixed/percentage/hybrid/tiered)
   ↓
6. Apply min/max limits if configured
   ↓
7. Check for active waivers
   ↓
8. Apply waiver discount if applicable
   ↓
9. Record final fee in transaction_fees table
   ↓
10. Return fee_id to calling function
```

### Database Functions

**calculate_transaction_fee()**
```sql
SELECT * FROM calculate_transaction_fee(
  _institution_id := 'uuid-here',
  _transaction_type := 'domestic_transfer',
  _transaction_amount := 50000,
  _transaction_date := CURRENT_DATE
);
```

Returns JSONB with fee breakdown:
```json
{
  "fee_structure_id": "uuid",
  "fee_model": "hybrid",
  "calculated_fee": 950.0,
  "waiver_id": "uuid",
  "waived_amount": 100.0,
  "final_fee": 850.0
}
```

**record_transaction_fee()**
```sql
SELECT record_transaction_fee(
  _institution_id := 'uuid-here',
  _transaction_type := 'bill_payment',
  _transaction_ref := 'TXN-12345',
  _transaction_amount := 25000,
  _transaction_id := 'uuid-here',
  _metadata := '{"biller": "ENEO"}'::jsonb
);
```

Returns: `fee_id` (UUID)

### Waiver Application Rules

Waivers are automatically applied if:
1. Waiver is active (`is_active = true`)
2. Current date is within waiver period
3. Max uses not exceeded (if configured)
4. Transaction type matches (if specified)
5. Institution matches (if specified)

Only one waiver is applied per transaction (most recent matching waiver).

---

## Database Schema Reference

### Tables

#### fee_structures
- Stores fee configuration for institutions
- Supports 4 fee models: fixed, percentage, hybrid, tiered
- Has effective date ranges
- Can have min/max fee limits

#### transaction_fees
- Records every fee charged
- Links to fee_structure used
- Stores calculated fee, waived amount, final fee
- Tracks billing status (pending/invoiced/paid)
- Contains fee breakdown in JSONB

#### institution_invoices
- Monthly/quarterly invoices
- Aggregates transaction fees for a period
- Tracks payment status
- Links to transaction_fees via invoice_id

#### fee_waivers
- Promotional discounts and fee reductions
- Can apply to specific institutions or all
- Can apply to specific transaction types or all
- Has usage limits and date ranges

### RLS Policies

**Admin Access**
- Admins can view/manage all records

**Institution Access**
- Institutions can only view their own records
- Read-only access (no modifications)

### Key Functions

1. `calculate_transaction_fee()` - Calculates fee amount
2. `record_transaction_fee()` - Logs fee to database
3. `generate_institution_invoice()` - Creates invoices

---

## Examples & Use Cases

### Example 1: Standard Bank Transfer Fees

**Scenario**: Bank wants to charge 0.5% on transfers with min 100 XAF and max 2000 XAF

**Configuration**:
```json
{
  "institution_id": "uuid",
  "transaction_type": "domestic_transfer",
  "fee_model": "percentage",
  "percentage_rate": 0.5,
  "min_fee_amount": 100,
  "max_fee_amount": 2000,
  "effective_from": "2025-01-01"
}
```

**Results**:
- Transfer of 10,000 XAF → Fee: 100 XAF (min applies)
- Transfer of 100,000 XAF → Fee: 500 XAF
- Transfer of 1,000,000 XAF → Fee: 2,000 XAF (max applies)

### Example 2: Promotional Launch Offer

**Scenario**: Waive 100% of fees for first 1000 transactions

**Configuration**:
```json
{
  "institution_id": "uuid",
  "waiver_type": "full_waiver",
  "effective_from": "2025-01-01",
  "effective_until": "2025-03-31",
  "max_uses": 1000,
  "reason": "Launch promotion"
}
```

### Example 3: Volume-Based Pricing

**Scenario**: Lower fees for higher transaction amounts

**Configuration**:
```json
{
  "fee_model": "tiered",
  "tiered_rates": [
    {"min": 0, "max": 50000, "fixed": 200, "percentage": 1.5},
    {"min": 50000, "max": 500000, "fixed": 500, "percentage": 1.0},
    {"min": 500000, "max": null, "fixed": 1000, "percentage": 0.5}
  ]
}
```

**Results**:
- 25,000 XAF → 200 + (25,000 × 1.5%) = 575 XAF
- 100,000 XAF → 500 + (100,000 × 1.0%) = 1,500 XAF
- 2,000,000 XAF → 1,000 + (2,000,000 × 0.5%) = 11,000 XAF

### Example 4: Weekend Promotion

**Scenario**: 50% off all mobile money fees on weekends

**Configuration**:
```json
{
  "waiver_type": "percentage_discount",
  "discount_percentage": 50,
  "applies_to_transaction_types": ["mobile_money_transfer", "mobile_money_charge"],
  "effective_from": "2025-01-04", // Saturday
  "effective_until": "2025-01-05", // Sunday
  "reason": "Weekend special"
}
```

---

## Troubleshooting

### Common Issues

**1. Fee not recorded**
- Check that fee structure exists for institution + transaction type
- Verify effective dates overlap with transaction date
- Check edge function logs for errors

**2. Wrong fee amount**
- Review fee structure configuration
- Check if waiver was applied
- Verify transaction amount is correct

**3. Invoice not generated**
- Confirm cron job is running
- Check if institution is approved
- Verify transaction fees have billing_status = 'pending'

**4. Waiver not applied**
- Check waiver effective dates
- Verify max_uses not exceeded
- Confirm transaction type matches (if specified)

### Support

For issues or questions:
1. Check edge function logs in backend
2. Review transaction_fees table for fee_breakdown
3. Contact system administrator

---

## Version History

- **v1.0** (2025-01-23): Initial release
  - All 4 fee models implemented
  - Automated billing via cron
  - Admin UI complete
  - Institution portal integration
