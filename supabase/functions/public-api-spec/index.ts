import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { corsHeaders } from "../_shared/cors.ts";

// ─── Reusable Schema Components ────────────────────────────────────────────
const schemas = {
  Error: {
    type: 'object',
    required: ['error', 'error_code', 'message', 'error_id', 'timestamp'],
    properties: {
      error: { type: 'string', description: 'Machine-readable error code', example: 'invalid_request' },
      error_code: { type: 'string', description: 'Domain-prefixed error code', example: 'AUTH_001' },
      message: { type: 'string', description: 'Human-readable description', example: 'The request is missing a required parameter.' },
      details: { type: 'object', description: 'Additional context', additionalProperties: true },
      error_id: { type: 'string', description: 'Unique error trace ID', example: 'err_a1b2c3d4' },
      timestamp: { type: 'string', format: 'date-time' },
    },
  },
  Pagination: {
    type: 'object',
    properties: {
      total: { type: 'integer', example: 142 },
      limit: { type: 'integer', example: 25 },
      offset: { type: 'integer', example: 0 },
      has_more: { type: 'boolean', example: true },
    },
  },
  Account: {
    type: 'object',
    properties: {
      account_id: { type: 'string', format: 'uuid' },
      account_number: { type: 'string', example: 'CM21 10003 00100 0123456789 023' },
      account_type: { type: 'string', enum: ['checking', 'savings', 'loan', 'business'] },
      account_subtype: { type: 'string', enum: ['personal_current', 'business_current', 'fixed_deposit', 'savings_regular'] },
      identification_scheme: { type: 'string', enum: ['LOCAL_BANK', 'MOMO', 'IBAN', 'DOMESTIC_RIB'], description: 'Account identifier scheme' },
      identification_value: { type: 'string', description: 'Raw account identifier value' },
      currency: { type: 'string', default: 'XAF', example: 'XAF' },
      balance: { type: 'number', example: 1500000 },
      account_holder_name: { type: 'string', example: 'Jean-Pierre Kamga' },
      status: { type: 'string', enum: ['active', 'inactive', 'frozen', 'closed'] },
      opened_date: { type: 'string', format: 'date', example: '2025-03-15' },
      rib_bank_code: { type: 'string', maxLength: 5, example: '10005', description: 'First 5 digits of RIB (bank code)' },
      rib_branch_code: { type: 'string', maxLength: 5, example: '00100', description: 'Digits 6-10 of RIB (branch code)' },
      rib_account_number: { type: 'string', maxLength: 11, example: '01234567890', description: 'Digits 11-21 of RIB (account number)' },
      rib_key: { type: 'string', maxLength: 2, example: '23', description: 'Digits 22-23 of RIB (MOD-97 key)' },
      swift_bic: { type: 'string', maxLength: 11, example: 'AFRIACMCXXX', description: 'SWIFT/BIC code (8 or 11 chars)' },
      account_country: { type: 'string', maxLength: 2, example: 'CM', description: 'ISO 3166-1 alpha-2 country code' },
    },
  },
  Balance: {
    type: 'object',
    properties: {
      balance_type: { type: 'string', enum: ['ClosingAvailable', 'ClosingBooked', 'Expected', 'ForwardAvailable'] },
      amount: { type: 'number', example: 1500000 },
      currency: { type: 'string', example: 'XAF' },
      credit_debit_indicator: { type: 'string', enum: ['Credit', 'Debit'] },
      date_time: { type: 'string', format: 'date-time' },
    },
  },
  Transaction: {
    type: 'object',
    properties: {
      transaction_id: { type: 'string', format: 'uuid' },
      amount: { type: 'number', example: 25000 },
      currency: { type: 'string', example: 'XAF' },
      type: { type: 'string', enum: ['debit', 'credit'] },
      description: { type: 'string', example: 'Mobile Money transfer from 237650000000' },
      balance_after: { type: 'number', example: 1475000 },
      booking_date: { type: 'string', format: 'date' },
      value_date: { type: 'string', format: 'date' },
      timestamp: { type: 'string', format: 'date-time' },
    },
  },
  Payment: {
    type: 'object',
    properties: {
      payment_id: { type: 'string', format: 'uuid' },
      amount: { type: 'number', example: 50000 },
      currency: { type: 'string', default: 'XAF' },
      status: { type: 'string', enum: ['pending', 'authorized', 'submitted', 'completed', 'failed', 'cancelled'] },
      debtor_account: { type: 'string', example: 'CM21 10003 00100 0123456789 023' },
      creditor_account: { type: 'string', example: 'CM21 10003 00200 9876543210 045' },
      reference: { type: 'string', example: 'Invoice-2026-001' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  Consent: {
    type: 'object',
    properties: {
      consent_id: { type: 'string' },
      status: { type: 'string', enum: ['AwaitingAuthorisation', 'Authorised', 'Rejected', 'Consumed', 'Expired', 'Revoked'] },
      permissions: { type: 'array', items: { type: 'string' } },
      expiration_date: { type: 'string', format: 'date-time' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  Bank: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      legal_name: { type: 'string', example: 'Afriland First Bank' },
      display_name: { type: 'string' },
      short_code: { type: 'string', example: 'AFB' },
      country: { type: 'string', default: 'CM' },
      swift_bic: { type: 'string', example: 'AFRIACMCXXX' },
      bank_code: { type: 'string' },
      status: { type: 'string', enum: ['draft', 'submitted', 'active', 'suspended'] },
      integration_mode: { type: 'string', enum: ['connector_push', 'connector_pull', 'file_feed', 'hybrid'] },
      contact_email: { type: 'string' },
      support_phone: { type: 'string' },
    },
  },
  InterbankPayment: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      external_reference: { type: 'string' },
      debtor_participant_id: { type: 'string', format: 'uuid' },
      creditor_participant_id: { type: 'string', format: 'uuid' },
      amount: { type: 'number', example: 500000 },
      currency: { type: 'string', default: 'XAF' },
      status: { type: 'string', enum: ['created', 'validated', 'submitted', 'accepted', 'rejected', 'in_process', 'settled', 'failed', 'reversed', 'expired'] },
      correlation_id: { type: 'string' },
      requested_at: { type: 'string', format: 'date-time' },
      settled_at: { type: 'string', format: 'date-time' },
    },
  },
  Certificate: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      thumbprint: { type: 'string' },
      fingerprint: { type: 'string' },
      subject_dn: { type: 'string' },
      issuer_dn: { type: 'string' },
      serial_number: { type: 'string' },
      valid_from: { type: 'string', format: 'date-time' },
      valid_until: { type: 'string', format: 'date-time' },
      is_revoked: { type: 'boolean' },
    },
  },
  CreditScore: {
    type: 'object',
    properties: {
      score: { type: 'integer', minimum: 300, maximum: 850, example: 680 },
      grade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'] },
      score_range: { type: 'string', enum: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'] },
      calculated_at: { type: 'string', format: 'date-time' },
    },
  },
  LoanApplication: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      product_id: { type: 'string', format: 'uuid' },
      amount: { type: 'number', example: 1000000 },
      currency: { type: 'string', example: 'XAF' },
      term_months: { type: 'integer', example: 12 },
      interest_rate: { type: 'number', example: 15.0 },
      status: { type: 'string', enum: ['applied', 'under_review', 'approved', 'rejected', 'disbursed', 'active', 'completed', 'defaulted', 'written_off'] },
      purpose: { type: 'string', example: 'Business expansion' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  LoanScheduleItem: {
    type: 'object',
    properties: {
      installment_number: { type: 'integer', example: 1 },
      due_date: { type: 'string', format: 'date', example: '2026-03-16' },
      // Deprecated number-typed monetary fields — kept for backward compatibility (Standing Order 1: The Lock).
      principal: { type: 'number', example: 80000, deprecated: true, description: 'Deprecated. Use principal_amount (string, minor units). Removed in v5.0.0.' },
      interest: { type: 'number', example: 12500, deprecated: true, description: 'Deprecated. Use interest_amount (string, minor units). Removed in v5.0.0.' },
      fees: { type: 'number', example: 0, deprecated: true, description: 'Deprecated. Use fees_amount (string, minor units). Removed in v5.0.0.' },
      total_due: { type: 'number', example: 92500, deprecated: true, description: 'Deprecated. Use total_due_amount (string, minor units). Removed in v5.0.0.' },
      // Canonical string-typed monetary fields per RFC 8259 / FAPI 1.0 Adv §5.2.2.
      principal_amount: { type: 'string', pattern: '^[0-9]{1,15}$', example: '80000', description: 'Principal portion as a string integer in minor units.' },
      interest_amount: { type: 'string', pattern: '^[0-9]{1,15}$', example: '12500', description: 'Interest portion as a string integer in minor units.' },
      fees_amount: { type: 'string', pattern: '^[0-9]{1,15}$', example: '0', description: 'Fees portion as a string integer in minor units.' },
      total_due_amount: { type: 'string', pattern: '^[0-9]{1,15}$', example: '92500', description: 'Total due as a string integer in minor units.' },
      outstanding_balance: { type: 'string', pattern: '^[0-9]{1,15}$', example: '920000', description: 'Outstanding balance as a string integer in minor units.' },
      status: { type: 'string', enum: ['pending', 'paid', 'partial', 'overdue'] },
    },
  },
  SavingsAccount: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      product_id: { type: 'string', format: 'uuid' },
      account_number: { type: 'string' },
      balance: { type: 'number', example: 500000 },
      currency: { type: 'string', example: 'XAF' },
      interest_rate: { type: 'number', example: 4.5 },
      status: { type: 'string', enum: ['active', 'frozen', 'closed'] },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  LedgerAccount: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      code: { type: 'string', example: '1000' },
      name: { type: 'string', example: 'Cash and Cash Equivalents' },
      account_type: { type: 'string', enum: ['asset', 'liability', 'equity', 'revenue', 'expense'] },
      currency: { type: 'string', example: 'XAF' },
      balance: { type: 'number', example: 25000000 },
      is_active: { type: 'boolean' },
    },
  },
  JournalEntry: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      entry_date: { type: 'string', format: 'date' },
      description: { type: 'string', example: 'Loan disbursement - APP-2026-001' },
      reference_type: { type: 'string', enum: ['payment', 'loan', 'savings', 'fee', 'interest', 'manual'] },
      reference_id: { type: 'string', format: 'uuid' },
      lines: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ledger_account_id: { type: 'string', format: 'uuid' },
            debit: { type: 'number', example: 1000000 },
            credit: { type: 'number', example: 0 },
          },
        },
      },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  MobileMoneyCharge: {
    type: 'object',
    properties: {
      transaction_id: { type: 'string' },
      phone_number: { type: 'string', example: '237650000000' },
      amount: { type: 'number', example: 5000 },
      currency: { type: 'string', default: 'XAF' },
      provider: { type: 'string', enum: ['MTN', 'Orange'] },
      status: { type: 'string', enum: ['pending', 'completed', 'failed'] },
    },
  },
  VirtualCard: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      card_number_masked: { type: 'string', example: '**** **** **** 1234' },
      balance_usd: { type: 'number', example: 100.00, deprecated: true, description: 'Deprecated. Floating-point USD balance. Use `balance` (string, minor units) and `currency`. Removed in v5.0.0.' },
      balance: { type: 'string', pattern: '^[0-9]{1,15}$', example: '10000', description: 'Card balance as a string integer in the currency\'s minor unit.' },
      currency: { type: 'string', enum: ['USD', 'XAF', 'EUR', 'GBP'], default: 'USD', example: 'USD', description: 'ISO 4217 currency code for the balance.' },
      status: { type: 'string', enum: ['active', 'frozen', 'cancelled'] },
      expiry_month: { type: 'integer' },
      expiry_year: { type: 'integer' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  WebhookEventType: {
    type: 'string',
    enum: [
      'charge.created', 'charge.processing', 'charge.successful', 'charge.failed',
      'charge.cancelled', 'charge.voided', 'charge.captured', 'charge.refunded',
      'payout.created', 'payout.processing', 'payout.completed', 'payout.failed',
      'refund.created', 'refund.completed', 'refund.failed',
      'dispute.created', 'dispute.won', 'dispute.lost',
      'settlement.paid',
      'consent.created', 'consent.authorised', 'consent.revoked', 'consent.expired',
      'account.updated',
    ],
    description: 'All 24 supported webhook event types across charge, payout, refund, dispute, settlement, consent, and account domains.',
  },
  Webhook: {
    type: 'object',
    properties: {
      webhook_id: { type: 'string', format: 'uuid' },
      url: { type: 'string', format: 'uri' },
      events: { type: 'array', items: { $ref: '#/components/schemas/WebhookEventType' } },
      is_active: { type: 'boolean' },
      secret: { type: 'string', description: 'HMAC signing secret (shown only once)' },
    },
  },
  HealthStatus: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
      version: { type: 'string', example: '1.0.0' },
      timestamp: { type: 'string', format: 'date-time' },
      services: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            latency_ms: { type: 'integer' },
          },
        },
      },
    },
  },
  // ─── Payment Gateway Schemas ──────────────────────────────────────
  GatewayCharge: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      merchant_id: { type: 'string', format: 'uuid' },
      amount: { type: 'number', example: 5000 },
      currency: { type: 'string', example: 'XAF' },
      channel: { type: 'string', enum: ['mobile_money', 'card', 'bank_transfer', 'apple_pay', 'google_pay', 'ussd', 'paypal'] },
      status: { type: 'string', enum: ['pending', 'processing', 'successful', 'failed', 'cancelled', 'authorized', 'voided'] },
      provider: { type: 'string', enum: ['flutterwave', 'stripe', 'paypal'] },
      provider_ref: { type: 'string' },
      fee_amount: { type: 'number', example: 200 },
      net_amount: { type: 'number', example: 4800 },
      tx_ref: { type: 'string' },
      customer_phone: { type: 'string' },
      customer_email: { type: 'string' },
      capture_mode: { type: 'string', enum: ['auto', 'manual'], default: 'auto' },
      captured_amount: { type: 'number', example: 0 },
      fee_bearer: { type: 'string', enum: ['merchant', 'customer'], default: 'merchant' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewayPayout: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      merchant_id: { type: 'string', format: 'uuid' },
      amount: { type: 'number', example: 10000 },
      currency: { type: 'string', example: 'XAF' },
      channel: { type: 'string', enum: ['mobile_money', 'bank_transfer', 'paypal'] },
      status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
      beneficiary_name: { type: 'string' },
      beneficiary_phone: { type: 'string' },
      tx_ref: { type: 'string' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewayRefund: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      charge_id: { type: 'string', format: 'uuid' },
      amount: { type: 'number', example: 5000 },
      currency: { type: 'string', example: 'XAF' },
      status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
      provider: { type: 'string' },
      reason: { type: 'string' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewayDispute: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      charge_id: { type: 'string', format: 'uuid' },
      amount: { type: 'number', example: 5000 },
      currency: { type: 'string', example: 'XAF' },
      status: { type: 'string', enum: ['open', 'under_review', 'won', 'lost', 'closed'] },
      reason: { type: 'string' },
      evidence_due_by: { type: 'string', format: 'date-time' },
      provider: { type: 'string' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewaySettlement: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      merchant_id: { type: 'string', format: 'uuid' },
      amount: { type: 'number', example: 450000 },
      currency: { type: 'string', example: 'XAF' },
      status: { type: 'string', enum: ['pending', 'processing', 'paid'] },
      period_start: { type: 'string', format: 'date' },
      period_end: { type: 'string', format: 'date' },
      charges_count: { type: 'integer' },
      fees_total: { type: 'number' },
      net_amount: { type: 'number' },
      settled_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewayBeneficiary: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      merchant_id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      channel: { type: 'string', enum: ['mobile_money', 'bank_transfer'] },
      phone: { type: 'string' },
      bank_account: { type: 'string' },
      bank_code: { type: 'string' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewayFeeEstimate: {
    type: 'object',
    properties: {
      amount: { type: 'number', example: 5000 },
      currency: { type: 'string', example: 'XAF' },
      channel: { type: 'string' },
      fee_amount: { type: 'number', example: 200 },
      net_amount: { type: 'number', example: 4800 },
      fee_percentage: { type: 'string', example: '3%' },
      fixed_fee: { type: 'number', example: 50 },
    },
  },
  GatewayVirtualAccount: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      merchant_id: { type: 'string', format: 'uuid' },
      account_number: { type: 'string', example: '7825000123' },
      bank_name: { type: 'string', example: 'Wema Bank' },
      currency: { type: 'string', example: 'NGN' },
      status: { type: 'string', enum: ['active', 'closed'] },
      email: { type: 'string' },
      expiry: { type: 'string', format: 'date-time' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewayMerchantWallet: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      merchant_id: { type: 'string', format: 'uuid' },
      currency: { type: 'string', example: 'XAF' },
      available_balance: { type: 'number', example: 500000 },
      pending_balance: { type: 'number', example: 25000 },
      ledger_balance: { type: 'number', example: 525000 },
      updated_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewayBankVerification: {
    type: 'object',
    properties: {
      account_name: { type: 'string', example: 'John Doe' },
      account_number: { type: 'string', example: '1234567890' },
    },
  },
  GatewayBvnResolution: {
    type: 'object',
    properties: {
      bvn: { type: 'string' },
      first_name: { type: 'string' },
      last_name: { type: 'string' },
      middle_name: { type: 'string' },
      date_of_birth: { type: 'string' },
      phone_number: { type: 'string' },
    },
  },
  // ─── New Schemas (v2.6.0) ──────────────────────────────────────
  GatewayPaymentLink: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      merchant_id: { type: 'string', format: 'uuid' },
      name: { type: 'string', example: 'Product Payment' },
      slug: { type: 'string', example: 'product-payment-abc123' },
      amount: { type: 'number', example: 5000 },
      currency: { type: 'string', example: 'XAF' },
      status: { type: 'string', enum: ['active', 'inactive', 'expired'] },
      redirect_url: { type: 'string' },
      max_uses: { type: 'integer' },
      use_count: { type: 'integer' },
      expires_at: { type: 'string', format: 'date-time' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewayPaymentPlan: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      merchant_id: { type: 'string', format: 'uuid' },
      name: { type: 'string', example: 'Monthly Pro Plan' },
      amount: { type: 'number', example: 10000 },
      currency: { type: 'string', example: 'XAF' },
      interval: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] },
      duration: { type: 'integer', description: 'Number of billing cycles (0 = unlimited)' },
      status: { type: 'string', enum: ['active', 'cancelled', 'completed'] },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewaySubscription: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      plan_id: { type: 'string', format: 'uuid' },
      customer_email: { type: 'string' },
      customer_phone: { type: 'string' },
      status: { type: 'string', enum: ['active', 'paused', 'cancelled', 'completed', 'past_due'] },
      current_period_start: { type: 'string', format: 'date-time' },
      current_period_end: { type: 'string', format: 'date-time' },
      next_charge_date: { type: 'string', format: 'date-time' },
      charges_count: { type: 'integer' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewaySubaccount: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      merchant_id: { type: 'string', format: 'uuid' },
      business_name: { type: 'string' },
      settlement_bank: { type: 'string' },
      account_number: { type: 'string' },
      split_type: { type: 'string', enum: ['percentage', 'flat'] },
      split_value: { type: 'number' },
      country: { type: 'string', example: 'CM' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewayCustomer: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      merchant_id: { type: 'string', format: 'uuid' },
      email: { type: 'string' },
      phone: { type: 'string' },
      name: { type: 'string' },
      metadata: { type: 'object' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewayCustomerToken: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      customer_id: { type: 'string', format: 'uuid' },
      channel: { type: 'string', enum: ['mobile_money', 'card'] },
      token_ref: { type: 'string' },
      last4: { type: 'string', example: '1234' },
      provider: { type: 'string' },
      is_active: { type: 'boolean' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewayChargeEvent: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      charge_id: { type: 'string', format: 'uuid' },
      event_type: { type: 'string', enum: ['charge.created', 'charge.processing', 'charge.successful', 'charge.failed', 'charge.cancelled', 'charge.voided', 'charge.captured', 'charge.refunded'], example: 'charge.created' },
      data: { type: 'object' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewayReconciliationRun: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      merchant_id: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed'] },
      matched_count: { type: 'integer' },
      mismatched_count: { type: 'integer' },
      period_start: { type: 'string', format: 'date' },
      period_end: { type: 'string', format: 'date' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
  GatewayMerchant: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      user_id: { type: 'string', format: 'uuid' },
      business_name: { type: 'string' },
      business_type: { type: 'string' },
      contact_email: { type: 'string' },
      contact_phone: { type: 'string' },
      country: { type: 'string', example: 'CM' },
      status: { type: 'string', enum: ['pending', 'active', 'suspended', 'deactivated'] },
      kyb_status: { type: 'string', enum: ['not_submitted', 'pending', 'approved', 'rejected'] },
      logo_url: { type: 'string' },
      created_at: { type: 'string', format: 'date-time' },
    },
  },
};

// ─── Reusable Parameters ───────────────────────────────────────────────────
const paginationParams = [
  { name: 'limit', in: 'query', schema: { type: 'integer', default: 25, maximum: 100 }, description: 'Items per page' },
  { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 }, description: 'Items to skip' },
  { name: 'sort_by', in: 'query', schema: { type: 'string', default: 'created_at' }, description: 'Sort field' },
  { name: 'sort_order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, description: 'Sort direction' },
];

const idempotencyHeader = {
  name: 'Idempotency-Key',
  in: 'header',
  required: true,
  schema: { type: 'string', format: 'uuid' },
  description: 'Required on all POST/PUT endpoints. Unique key for idempotent request processing (UUID v4 recommended). Keys expire after 24 hours.',
};

const errorResponses = {
  '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  '409': { description: 'Conflict (idempotency mismatch)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  '429': { description: 'Rate limit exceeded', headers: { 'Retry-After': { schema: { type: 'integer' }, description: 'Number of seconds to wait before retrying' } }, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
};

// WooCommerce Schemas
schemas.WooCommerceMerchant = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    store_name: { type: 'string' },
    store_url: { type: 'string', format: 'uri' },
    admin_email: { type: 'string', format: 'email' },
    api_key: { type: 'string', description: 'Generated API key for the merchant' },
    client_secret: { type: 'string', description: 'Generated client secret (shown once)' },
    webhook_secret: { type: 'string', description: 'Webhook signing secret' },
    status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
    plugin_version: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
  },
};

schemas.WooCommerceTransaction = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    transaction_ref: { type: 'string' },
    woocommerce_order_id: { type: 'integer' },
    amount: { type: 'number' },
    currency: { type: 'string' },
    status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] },
    payment_method: { type: 'string' },
    customer_email: { type: 'string' },
    fee_amount: { type: 'number' },
    net_amount: { type: 'number' },
    created_at: { type: 'string', format: 'date-time' },
    completed_at: { type: 'string', format: 'date-time' },
  },
};

// ─── Path Definitions ──────────────────────────────────────────────────────

// Helper for standard list response
const listResponse = (itemRef: string, desc: string) => ({
  '200': {
    description: desc,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: `#/components/schemas/${itemRef}` } },
            pagination: { $ref: '#/components/schemas/Pagination' },
          },
        },
      },
    },
  },
  ...errorResponses,
});

const paths: Record<string, any> = {};

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH & READINESS
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/health'] = {
  get: {
    tags: ['Monitoring'],
    summary: 'API health check',
    operationId: 'apiHealth',
    security: [],
    responses: {
      '200': { description: 'API is healthy', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthStatus' } } } },
      '503': { description: 'API is unhealthy' },
    },
  },
};

paths['/v1/ready'] = {
  get: {
    tags: ['Monitoring'],
    summary: 'Readiness probe',
    description: 'Returns 200 when the API is ready to accept traffic. Checks database connectivity.',
    operationId: 'apiReady',
    security: [],
    responses: {
      '200': { description: 'Ready', content: { 'application/json': { schema: { type: 'object', properties: { ready: { type: 'boolean' }, db: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' } } } } } },
      '503': { description: 'Not ready' },
    },
  },
};

paths['/v1/system-health'] = {
  get: {
    tags: ['Monitoring'],
    summary: 'Detailed system health',
    operationId: 'systemHealth',
    security: [{ bearerAuth: [] }],
    responses: {
      '200': { description: 'System health details', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthStatus' } } } },
      ...errorResponses,
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// OAUTH & AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/oauth/authorize'] = {
  get: {
    tags: ['OAuth'],
    summary: 'Authorize OAuth request',
    description: 'Initiate OAuth 2.0 authorization flow with PKCE (FAPI 1.0 Advanced)',
    operationId: 'oauthAuthorize',
    security: [],
    parameters: [
      { name: 'response_type', in: 'query', required: true, schema: { type: 'string', enum: ['code'] } },
      { name: 'client_id', in: 'query', required: true, schema: { type: 'string' } },
      { name: 'redirect_uri', in: 'query', required: true, schema: { type: 'string' } },
      { name: 'scope', in: 'query', required: true, schema: { type: 'string' }, example: 'openid accounts payments' },
      { name: 'state', in: 'query', required: true, schema: { type: 'string' } },
      { name: 'code_challenge', in: 'query', schema: { type: 'string' } },
      { name: 'code_challenge_method', in: 'query', schema: { type: 'string', enum: ['S256'] } },
    ],
    responses: { '302': { description: 'Redirect to authorization page' }, ...errorResponses },
  },
};

paths['/v1/oauth/token'] = {
  post: {
    tags: ['OAuth'],
    summary: 'Exchange authorization code for token',
    operationId: 'oauthToken',
    security: [],
    requestBody: {
      required: true,
      content: {
        'application/x-www-form-urlencoded': {
          schema: {
            type: 'object',
            required: ['grant_type', 'client_id'],
            properties: {
              grant_type: { type: 'string', enum: ['authorization_code', 'refresh_token', 'client_credentials'], description: 'OAuth 2.0 grant type' },
              code: { type: 'string', description: 'Authorization code (required for authorization_code grant)' },
              client_id: { type: 'string' },
              client_secret: { type: 'string', description: 'Client secret (required for client_credentials and refresh_token grants)' },
              redirect_uri: { type: 'string' },
              code_verifier: { type: 'string', description: 'PKCE code verifier (required when code_challenge was used)' },
              refresh_token: { type: 'string', description: 'Refresh token (required for refresh_token grant)' },
              scope: { type: 'string', description: 'Space-delimited list of scopes (e.g. "accounts payments")', example: 'accounts payments' },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Token issued',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                access_token: { type: 'string' },
                token_type: { type: 'string', example: 'Bearer' },
                expires_in: { type: 'integer', example: 3600 },
                refresh_token: { type: 'string' },
                scope: { type: 'string', example: 'openid accounts' },
              },
            },
            example: {
              access_token: 'eyJ...token',
              token_type: 'Bearer',
              expires_in: 3600,
              refresh_token: 'rf_abc123',
              scope: 'openid accounts',
            },
          },
        },
      },
      ...errorResponses,
    },
  },
};

paths['/v1/oauth/introspect'] = {
  post: {
    tags: ['OAuth'],
    summary: 'Introspect access token',
    operationId: 'oauthIntrospect',
    security: [{ bearerAuth: [] }],
    requestBody: { required: true, content: { 'application/x-www-form-urlencoded': { schema: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } } } } },
    responses: { '200': { description: 'Token introspection result', content: { 'application/json': { schema: { type: 'object', properties: { active: { type: 'boolean' }, scope: { type: 'string' }, client_id: { type: 'string' }, exp: { type: 'integer' }, sub: { type: 'string' } } } } } }, ...errorResponses },
  },
};

paths['/v1/oauth/par'] = {
  post: {
    tags: ['OAuth'],
    summary: 'Pushed Authorization Request',
    operationId: 'parEndpoint',
    security: [{ mtls: [] }],
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/x-www-form-urlencoded': { schema: { type: 'object', required: ['client_id', 'response_type', 'redirect_uri', 'scope'], properties: { client_id: { type: 'string' }, response_type: { type: 'string' }, redirect_uri: { type: 'string' }, scope: { type: 'string' }, state: { type: 'string' }, code_challenge: { type: 'string' }, code_challenge_method: { type: 'string' } } } } } },
    responses: { '201': { description: 'PAR created', content: { 'application/json': { schema: { type: 'object', properties: { request_uri: { type: 'string' }, expires_in: { type: 'integer', example: 600 } } } } } }, ...errorResponses },
  },
};

paths['/v1/dcr/register'] = {
  post: {
    tags: ['OAuth'],
    summary: 'Dynamic Client Registration',
    operationId: 'dcrRegister',
    security: [{ mtls: [] }],
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['client_name', 'redirect_uris'], properties: { client_name: { type: 'string', example: 'FinTech App Cameroun' }, redirect_uris: { type: 'array', items: { type: 'string' } }, token_endpoint_auth_method: { type: 'string' }, grant_types: { type: 'array', items: { type: 'string' } }, scope: { type: 'string' } } } } } },
    responses: { '201': { description: 'Client registered', content: { 'application/json': { schema: { type: 'object', properties: { client_id: { type: 'string' }, client_secret: { type: 'string' }, client_id_issued_at: { type: 'integer' } } } } } }, ...errorResponses },
  },
};

paths['/v1/oidc/.well-known/openid-configuration'] = {
  get: { tags: ['OAuth'], summary: 'OIDC discovery', operationId: 'oidcConfig', security: [], responses: { '200': { description: 'OIDC configuration document', content: { 'application/json': { schema: { type: 'object', properties: { issuer: { type: 'string' }, authorization_endpoint: { type: 'string' }, token_endpoint: { type: 'string' }, jwks_uri: { type: 'string' }, response_types_supported: { type: 'array', items: { type: 'string' } }, subject_types_supported: { type: 'array', items: { type: 'string' } }, id_token_signing_alg_values_supported: { type: 'array', items: { type: 'string' } } } } } } }, ...errorResponses } },
};

paths['/v1/jwks'] = {
  get: { tags: ['OAuth'], summary: 'JSON Web Key Set', operationId: 'jwksEndpoint', security: [], responses: { '200': { description: 'Public keys for token verification', content: { 'application/json': { schema: { type: 'object', properties: { keys: { type: 'array', items: { type: 'object', properties: { kty: { type: 'string' }, kid: { type: 'string' }, use: { type: 'string' }, n: { type: 'string' }, e: { type: 'string' } } } } } } } } }, ...errorResponses } },
};

// Phone Auth
const successResult = (desc: string) => ({ description: desc, content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' } } } } } });
const tokenResponse = { description: 'Authentication successful', content: { 'application/json': { schema: { type: 'object', properties: { access_token: { type: 'string' }, token_type: { type: 'string', example: 'Bearer' }, expires_in: { type: 'integer', example: 3600 }, refresh_token: { type: 'string' }, user_id: { type: 'string', format: 'uuid' } } } } } };

paths['/v1/auth/phone/send-otp'] = {
  post: { tags: ['Authentication'], summary: 'Send OTP to phone', operationId: 'phoneAuthSendOtp', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['phone_number'], properties: { phone_number: { type: 'string', example: '+237670000000' } } } } } }, responses: { '200': successResult('OTP sent'), ...errorResponses } },
};

paths['/v1/auth/phone/verify-otp'] = {
  post: { tags: ['Authentication'], summary: 'Verify OTP', operationId: 'phoneAuthVerifyOtp', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['phone_number', 'otp_code'], properties: { phone_number: { type: 'string' }, otp_code: { type: 'string' } } } } } }, responses: { '200': tokenResponse, ...errorResponses } },
};

paths['/v1/auth/phone/pin-login'] = {
  post: { tags: ['Authentication'], summary: 'Login with PIN', operationId: 'phoneAuthPinLogin', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['phone_number', 'pin'], properties: { phone_number: { type: 'string' }, pin: { type: 'string', minLength: 4, maxLength: 6 } } } } } }, responses: { '200': tokenResponse, ...errorResponses } },
};

paths['/v1/auth/pin/set'] = {
  post: { tags: ['Authentication'], summary: 'Set PIN code', operationId: 'pinCodeSet', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['pin'], properties: { pin: { type: 'string' } } } } } }, responses: { '200': successResult('PIN set'), ...errorResponses } },
};

paths['/v1/auth/pin/verify'] = {
  post: { tags: ['Authentication'], summary: 'Verify PIN code', operationId: 'pinCodeVerify', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['pin'], properties: { pin: { type: 'string' } } } } } }, responses: { '200': successResult('PIN verified'), ...errorResponses } },
};

paths['/v1/auth/password/reset-with-pin'] = {
  post: { tags: ['Authentication'], summary: 'Reset password with PIN', operationId: 'passwordResetWithPin', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['phone_number', 'pin', 'new_password'], properties: { phone_number: { type: 'string' }, pin: { type: 'string' }, new_password: { type: 'string' } } } } } }, responses: { '200': successResult('Password reset'), ...errorResponses } },
};

// Security
paths['/v1/security/captcha/generate'] = {
  post: { tags: ['Security'], summary: 'Generate CAPTCHA', operationId: 'captchaGenerate', security: [], responses: { '200': { description: 'CAPTCHA challenge', content: { 'application/json': { schema: { type: 'object', properties: { challenge_id: { type: 'string', format: 'uuid' }, image_base64: { type: 'string' }, question: { type: 'string' }, expires_at: { type: 'string', format: 'date-time' } } } } } }, ...errorResponses } },
};

paths['/v1/security/captcha/verify'] = {
  post: { tags: ['Security'], summary: 'Verify CAPTCHA', operationId: 'captchaVerify', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['challenge_id', 'response'], properties: { challenge_id: { type: 'string' }, response: { type: 'string' } } } } } }, responses: { '200': successResult('CAPTCHA verified'), ...errorResponses } },
};

paths['/v1/security/sca/initiate'] = {
  post: { tags: ['Security'], summary: 'Initiate SCA', operationId: 'scaInitiate', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['action_type'], properties: { action_type: { type: 'string', enum: ['payment', 'consent', 'account_update'] } } } } } }, responses: { '200': { description: 'SCA challenge issued', content: { 'application/json': { schema: { type: 'object', properties: { challenge_id: { type: 'string', format: 'uuid' }, challenge_type: { type: 'string', enum: ['otp', 'biometric', 'pin'] }, expires_at: { type: 'string', format: 'date-time' } } } } } }, ...errorResponses } },
};

paths['/v1/security/sca/verify'] = {
  post: { tags: ['Security'], summary: 'Verify SCA', operationId: 'scaVerify', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['challenge_id', 'response'], properties: { challenge_id: { type: 'string' }, response: { type: 'string' } } } } } }, responses: { '200': successResult('SCA verified'), ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// CERTIFICATES
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/certificates'] = {
  post: {
    tags: ['Certificates'], summary: 'Upload certificate', operationId: 'certificateUpload', security: [{ bearerAuth: [] }],
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['certificate_pem'], properties: { certificate_pem: { type: 'string' }, tpp_registration_id: { type: 'string' } } } } } },
    responses: { '201': { description: 'Certificate uploaded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Certificate' } } } }, ...errorResponses },
  },
  get: {
    tags: ['Certificates'], summary: 'List certificates', operationId: 'certificateList', security: [{ bearerAuth: [] }],
    parameters: [{ name: 'tpp_registration_id', in: 'query', schema: { type: 'string' } }],
    responses: { '200': { description: 'Certificates list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Certificate' } } } } } } }, ...errorResponses },
  },
};

paths['/v1/certificates/revoke'] = {
  post: {
    tags: ['Certificates'], summary: 'Revoke certificate', operationId: 'certificateRevoke', security: [{ bearerAuth: [] }],
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['certificate_id', 'reason'], properties: { certificate_id: { type: 'string' }, reason: { type: 'string', enum: ['key_compromise', 'ca_compromise', 'affiliation_changed', 'superseded', 'cessation_of_operation'] } } } } } },
    responses: { '200': successResult('Certificate revoked'), ...errorResponses },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// AISP — Account Information
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/aisp/consents'] = {
  post: {
    tags: ['AISP'], summary: 'Create AISP consent', operationId: 'aispCreateConsent', security: [{ bearerAuth: [] }],
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['permissions', 'expiration_date'], properties: { permissions: { type: 'array', items: { type: 'string', enum: ['ReadAccountsDetail', 'ReadBalances', 'ReadTransactionsDetail', 'ReadBeneficiariesDetail', 'ReadStandingOrdersDetail', 'ReadDirectDebitsDetail'] }, example: ['ReadAccountsDetail', 'ReadBalances', 'ReadTransactionsDetail'] }, expiration_date: { type: 'string', format: 'date-time' }, transaction_from_date: { type: 'string', format: 'date' }, transaction_to_date: { type: 'string', format: 'date' } } } } } },
    responses: { '201': { description: 'Consent created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Consent' } } } }, ...errorResponses },
  },
};

const xConsentIdHeader = {
  name: 'x-consent-id',
  in: 'header',
  required: true,
  schema: { type: 'string' },
  description: 'Authorised AISP consent ID. Required for all account information endpoints.',
};

paths['/v1/aisp/accounts'] = {
  get: {
    tags: ['AISP'], summary: 'List accounts', operationId: 'aispAccounts', security: [{ bearerAuth: [] }],
    parameters: [xConsentIdHeader, ...paginationParams],
    responses: listResponse('Account', 'Accounts list'),
  },
};

paths['/v1/aisp/accounts/{accountId}'] = {
  get: {
    tags: ['AISP'], summary: 'Get account details', operationId: 'aispAccountDetail', security: [{ bearerAuth: [] }],
    parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }, xConsentIdHeader],
    responses: { '200': { description: 'Account details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Account' } } } }, ...errorResponses },
  },
};

paths['/v1/aisp/accounts/{accountId}/balances'] = {
  get: {
    tags: ['AISP'], summary: 'Get account balances', operationId: 'aispBalances', security: [{ bearerAuth: [] }],
    parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }, xConsentIdHeader],
    responses: { '200': { description: 'Account balances', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Balance' } } } } } } }, ...errorResponses },
  },
};

paths['/v1/aisp/accounts/{accountId}/transactions'] = {
  get: {
    tags: ['AISP'], summary: 'List transactions', operationId: 'aispTransactions', security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'accountId', in: 'path', required: true, schema: { type: 'string' } },
      xConsentIdHeader,
      { name: 'from_date', in: 'query', schema: { type: 'string', format: 'date' } },
      { name: 'to_date', in: 'query', schema: { type: 'string', format: 'date' } },
      ...paginationParams,
    ],
    responses: listResponse('Transaction', 'Transactions list'),
  },
};

paths['/v1/aisp/accounts/{accountId}/beneficiaries'] = {
  get: { tags: ['AISP'], summary: 'List beneficiaries', operationId: 'aispBeneficiaries', security: [{ bearerAuth: [] }], parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }, xConsentIdHeader], responses: { '200': { description: 'Beneficiaries list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/GatewayBeneficiary' } } } } } } }, ...errorResponses } },
};

paths['/v1/aisp/accounts/{accountId}/standing-orders'] = {
  get: { tags: ['AISP'], summary: 'List standing orders', operationId: 'aispStandingOrders', security: [{ bearerAuth: [] }], parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }, xConsentIdHeader], responses: { '200': { description: 'Standing orders list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' }, frequency: { type: 'string' }, next_date: { type: 'string', format: 'date' } } } } } } } } }, ...errorResponses } },
};

paths['/v1/aisp/accounts/{accountId}/direct-debits'] = {
  get: { tags: ['AISP'], summary: 'List direct debits', operationId: 'aispDirectDebits', security: [{ bearerAuth: [] }], parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }, xConsentIdHeader], responses: { '200': { description: 'Direct debits list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, amount: { type: 'number' }, status: { type: 'string' } } } } } } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// PISP — Payment Initiation
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/pisp/consents'] = {
  post: {
    tags: ['PISP'], summary: 'Create payment consent', operationId: 'pispCreateConsent', security: [{ bearerAuth: [] }],
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount', 'currency', 'creditor_account'], properties: { amount: { type: 'number', example: 50000 }, currency: { type: 'string', example: 'XAF' }, debtor_account: { type: 'string' }, creditor_account: { type: 'string' }, reference: { type: 'string', example: 'Invoice-2026-001' } } }, example: { amount: 50000, currency: 'XAF', creditor_account: 'CM21 10003 00200 9876543210 045', reference: 'Invoice-2026-001' } } } },
    responses: { '201': { description: 'Payment consent created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Consent' } } } }, ...errorResponses },
  },
};

paths['/v1/pisp/domestic-payment'] = {
  post: {
    tags: ['PISP'], summary: 'Submit domestic payment', operationId: 'pispDomesticPayment', security: [{ bearerAuth: [] }],
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['consent_id', 'amount', 'currency'], properties: { consent_id: { type: 'string' }, amount: { type: 'number', example: 50000 }, currency: { type: 'string', example: 'XAF' }, debtor_account: { type: 'string' }, creditor_account: { type: 'string' }, reference: { type: 'string' } } } } } },
    responses: { '201': { description: 'Payment submitted', content: { 'application/json': { schema: { $ref: '#/components/schemas/Payment' } } } }, ...errorResponses },
  },
};

paths['/v1/pisp/payment-submission'] = {
  post: {
    tags: ['PISP'], summary: 'Confirm payment submission', operationId: 'pispPaymentSubmission', security: [{ bearerAuth: [] }],
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['payment_id'], properties: { payment_id: { type: 'string' } } } } } },
    responses: { '200': { description: 'Payment submission confirmed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Payment' } } } }, ...errorResponses },
  },
};

paths['/v1/pisp/payments/{paymentId}'] = {
  get: {
    tags: ['PISP'], summary: 'Get payment details', operationId: 'pispPaymentDetails', security: [{ bearerAuth: [] }],
    parameters: [{ name: 'paymentId', in: 'path', required: true, schema: { type: 'string' } }],
    responses: { '200': { description: 'Payment details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Payment' } } } }, ...errorResponses },
  },
};

// Consent management
paths['/v1/consents/{consentId}/authorize'] = {
  post: { tags: ['Consent Management'], summary: 'Authorize consent', operationId: 'consentAuthorize', security: [{ bearerAuth: [] }], parameters: [{ name: 'consentId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], responses: { '200': { description: 'Consent authorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Consent' } } } }, ...errorResponses } },
};

paths['/v1/consents/{consentId}/revoke'] = {
  post: { tags: ['Consent Management'], summary: 'Revoke consent', operationId: 'consentRevoke', security: [{ bearerAuth: [] }], parameters: [{ name: 'consentId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string' } } } } } }, responses: { '200': { description: 'Consent revoked', content: { 'application/json': { schema: { $ref: '#/components/schemas/Consent' } } } }, ...errorResponses } },
};

paths['/v1/consents'] = {
  get: { tags: ['Consent Management'], summary: 'List consents', operationId: 'consentsList', security: [{ bearerAuth: [] }], parameters: [...paginationParams], responses: listResponse('Consent', 'Consents list') },
};

// ═══════════════════════════════════════════════════════════════════════════
// CREDIT SCORING
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/credit/score'] = {
  get: { tags: ['Credit Scoring'], summary: 'Get credit score', operationId: 'creditScoreFetch', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Credit score', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreditScore' } } } }, ...errorResponses } },
  post: { tags: ['Credit Scoring'], summary: 'Calculate credit score', operationId: 'creditScoreCalculate', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Score calculated', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreditScore' } } } }, ...errorResponses } },
};

paths['/v1/credit/simulate'] = {
  post: { tags: ['Credit Scoring'], summary: 'Simulate score impact', operationId: 'creditScoreSimulate', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { action_type: { type: 'string', enum: ['pay_off_debt', 'new_credit', 'late_payment'] }, amount: { type: 'number', example: 100000 } } } } } }, responses: { '200': { description: 'Simulation result', content: { 'application/json': { schema: { type: 'object', properties: { current_score: { type: 'integer' }, simulated_score: { type: 'integer' }, impact: { type: 'integer' }, grade_change: { type: 'string' } } } } } }, ...errorResponses } },
};

paths['/v1/credit/tips'] = {
  get: { tags: ['Credit Scoring'], summary: 'Get improvement tips', operationId: 'creditScoreTips', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Tips list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, impact: { type: 'string', enum: ['high', 'medium', 'low'] } } } } } } } } }, ...errorResponses } },
};

paths['/v1/credit/report'] = {
  post: { tags: ['Credit Scoring'], summary: 'Generate credit report', operationId: 'creditReportGenerate', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Report generated', content: { 'application/json': { schema: { type: 'object', properties: { report_id: { type: 'string', format: 'uuid' }, score: { $ref: '#/components/schemas/CreditScore' }, generated_at: { type: 'string', format: 'date-time' } } } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// LOANS
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/loans/products'] = {
  get: { tags: ['Loans'], summary: 'List loan products', operationId: 'loanProducts', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Loan products', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, min_amount: { type: 'number' }, max_amount: { type: 'number' }, interest_rate: { type: 'number' }, term_months_min: { type: 'integer' }, term_months_max: { type: 'integer' }, currency: { type: 'string', example: 'XAF' } } } } } } } } }, ...errorResponses } },
};

paths['/v1/loans/apply'] = {
  post: {
    tags: ['Loans'], summary: 'Apply for loan', operationId: 'loanApply', security: [{ bearerAuth: [] }],
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['product_id', 'amount', 'term_months'], properties: { product_id: { type: 'string' }, amount: { type: 'number', example: 1000000 }, term_months: { type: 'integer', example: 12 }, purpose: { type: 'string', example: 'Business expansion' } } }, example: { product_id: 'prod_abc123', amount: 1000000, term_months: 12, purpose: 'Business expansion' } } } },
    responses: { '201': { description: 'Loan application submitted', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoanApplication' } } } }, ...errorResponses },
  },
};

paths['/v1/loans/calculate'] = {
  post: {
    tags: ['Loans'], summary: 'Calculate loan terms', operationId: 'loanCalculate', security: [],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount', 'term_months', 'interest_rate'], properties: { amount: { type: 'number', example: 1000000 }, term_months: { type: 'integer', example: 12 }, interest_rate: { type: 'number', example: 15.0 } } } } } },
    responses: { '200': { description: 'Loan calculation', content: { 'application/json': { schema: { type: 'object', properties: { monthly_payment: { type: 'number', example: 92500 }, total_interest: { type: 'number', example: 110000 }, total_repayment: { type: 'number', example: 1110000 } } } } } }, ...errorResponses },
  },
};

paths['/v1/loans/{loanId}/approve'] = {
  post: {
    tags: ['Loans'], summary: 'Approve loan application', operationId: 'loanApprove', security: [{ bearerAuth: [] }],
    parameters: [{ name: 'loanId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader],
    requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { approved_amount: { type: 'number' }, approved_rate: { type: 'number' }, conditions: { type: 'string' } } } } } },
    responses: { '200': { description: 'Loan approved', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoanApplication' } } } }, ...errorResponses },
  },
};

paths['/v1/loans/{loanId}/disburse'] = {
  post: {
    tags: ['Loans'], summary: 'Disburse loan', operationId: 'loanDisburse', security: [{ bearerAuth: [] }],
    parameters: [{ name: 'loanId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader],
    requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { disbursement_account: { type: 'string' }, disbursement_method: { type: 'string', enum: ['bank_transfer', 'mobile_money'] } } } } } },
    responses: { '200': { description: 'Loan disbursed with ledger posting', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoanApplication' } } } }, ...errorResponses },
  },
};

paths['/v1/loans/{loanId}/schedule'] = {
  get: {
    tags: ['Loans'], summary: 'Get repayment schedule', operationId: 'loanSchedule', security: [{ bearerAuth: [] }],
    parameters: [{ name: 'loanId', in: 'path', required: true, schema: { type: 'string' } }],
    responses: { '200': { description: 'Repayment schedule', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/LoanScheduleItem' } } } } } } }, ...errorResponses },
  },
  post: {
    tags: ['Loans'], summary: 'Generate repayment schedule', operationId: 'loanGenerateSchedule', security: [{ bearerAuth: [] }],
    parameters: [{ name: 'loanId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader],
    responses: { '201': successResult('Schedule generated'), ...errorResponses },
  },
};

paths['/v1/loans/{loanId}/repay'] = {
  post: {
    tags: ['Loans'], summary: 'Make loan repayment', operationId: 'loanRepay', security: [{ bearerAuth: [] }],
    parameters: [{ name: 'loanId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount'], properties: { amount: { type: 'number', example: 92500 }, payment_method: { type: 'string', enum: ['bank_transfer', 'mobile_money', 'savings_debit'] } } } } } },
    responses: { '200': { description: 'Repayment recorded with schedule/ledger update', content: { 'application/json': { schema: { type: 'object', properties: { repayment_id: { type: 'string', format: 'uuid' }, amount_applied: { type: 'number' }, remaining_balance: { type: 'number' }, next_installment: { $ref: '#/components/schemas/LoanScheduleItem' } } } } } }, ...errorResponses },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SAVINGS
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/savings/products'] = {
  get: { tags: ['Savings'], summary: 'List savings products', operationId: 'savingsProducts', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Savings products', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, interest_rate: { type: 'number' }, min_deposit: { type: 'number' }, currency: { type: 'string', example: 'XAF' } } } } } } } } }, ...errorResponses } },
};

paths['/v1/savings/accounts'] = {
  post: {
    tags: ['Savings'], summary: 'Create savings account', operationId: 'savingsCreate', security: [{ bearerAuth: [] }],
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['product_id'], properties: { product_id: { type: 'string' }, initial_deposit: { type: 'number', example: 50000 }, currency: { type: 'string', example: 'XAF' } } } } } },
    responses: { '201': { description: 'Savings account created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SavingsAccount' } } } }, ...errorResponses },
  },
};

paths['/v1/savings/accounts/{accountId}/deposit'] = {
  post: {
    tags: ['Savings'], summary: 'Deposit to savings', operationId: 'savingsDeposit', security: [{ bearerAuth: [] }],
    parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount'], properties: { amount: { type: 'number', example: 50000 }, source: { type: 'string', enum: ['bank_transfer', 'mobile_money'] } } } } } },
    responses: { '200': successResult('Deposit recorded'), ...errorResponses },
  },
};

paths['/v1/savings/accounts/{accountId}/withdraw'] = {
  post: {
    tags: ['Savings'], summary: 'Withdraw from savings', operationId: 'savingsWithdraw', security: [{ bearerAuth: [] }],
    parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount'], properties: { amount: { type: 'number', example: 25000 }, destination: { type: 'string' } } } } } },
    responses: { '200': successResult('Withdrawal recorded'), ...errorResponses },
  },
};

paths['/v1/savings/accrue-interest'] = {
  post: {
    tags: ['Savings'], summary: 'Accrue interest (cron)', description: 'Trigger interest accrual across all eligible savings accounts. Designed for scheduled (cron) invocation.',
    operationId: 'savingsAccrueInterest', security: [{ bearerAuth: [] }],
    parameters: [idempotencyHeader],
    requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { accrual_date: { type: 'string', format: 'date' } } } } } },
    responses: { '200': { description: 'Interest accrued', content: { 'application/json': { schema: { type: 'object', properties: { accounts_processed: { type: 'integer' }, total_interest: { type: 'number' }, accrual_date: { type: 'string', format: 'date' } } } } } }, ...errorResponses },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// LEDGER (Double-Entry)
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/ledger/accounts'] = {
  get: { tags: ['Ledger'], summary: 'List ledger accounts', operationId: 'ledgerAccounts', security: [{ bearerAuth: [] }], parameters: [...paginationParams], responses: listResponse('LedgerAccount', 'Ledger accounts (chart of accounts)') },
  post: {
    tags: ['Ledger'], summary: 'Create ledger account', operationId: 'ledgerAccountCreate', security: [{ bearerAuth: [] }],
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['code', 'name', 'account_type'], properties: { code: { type: 'string', example: '1000' }, name: { type: 'string', example: 'Cash and Cash Equivalents' }, account_type: { type: 'string', enum: ['asset', 'liability', 'equity', 'revenue', 'expense'] }, currency: { type: 'string', example: 'XAF' }, parent_id: { type: 'string', format: 'uuid' } } } } } },
    responses: { '201': { description: 'Ledger account created', content: { 'application/json': { schema: { $ref: '#/components/schemas/LedgerAccount' } } } }, ...errorResponses },
  },
};

paths['/v1/ledger/accounts/{accountId}/balance'] = {
  get: {
    tags: ['Ledger'], summary: 'Get ledger account balance', operationId: 'ledgerBalance', security: [{ bearerAuth: [] }],
    parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'as_of', in: 'query', schema: { type: 'string', format: 'date' } }],
    responses: { '200': { description: 'Ledger balance', content: { 'application/json': { schema: { $ref: '#/components/schemas/LedgerAccount' } } } }, ...errorResponses },
  },
};

paths['/v1/ledger/journal'] = {
  post: {
    tags: ['Ledger'], summary: 'Post journal entry', description: 'Post a balanced double-entry journal entry. Sum of debits must equal sum of credits.',
    operationId: 'journalPost', security: [{ bearerAuth: [] }],
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/JournalEntry' }, example: { entry_date: '2026-02-16', description: 'Loan disbursement - 1,000,000 XAF', reference_type: 'loan', reference_id: 'loan_abc123', lines: [{ ledger_account_id: 'acc_loans_receivable', debit: 1000000, credit: 0 }, { ledger_account_id: 'acc_cash', debit: 0, credit: 1000000 }] } } } },
    responses: { '201': { description: 'Journal entry posted', content: { 'application/json': { schema: { $ref: '#/components/schemas/JournalEntry' } } } }, ...errorResponses },
  },
  get: { tags: ['Ledger'], summary: 'List journal entries', operationId: 'journalList', security: [{ bearerAuth: [] }], parameters: [...paginationParams, { name: 'reference_type', in: 'query', schema: { type: 'string' } }], responses: listResponse('JournalEntry', 'Journal entries') },
};

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE MONEY
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/mobile-money/charge'] = {
  post: {
    tags: ['Mobile Money'], summary: 'Charge mobile money', operationId: 'mobileMoneyCharge', security: [{ bearerAuth: [] }], deprecated: true,
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['phone_number', 'amount'], properties: { phone_number: { type: 'string', example: '237650000000' }, amount: { type: 'number', example: 5000 }, currency: { type: 'string', example: 'XAF' }, provider: { type: 'string', enum: ['MTN', 'Orange'] } } }, example: { phone_number: '237650000000', amount: 5000, currency: 'XAF', provider: 'MTN' } } } },
    responses: { '200': { description: 'Charge initiated', content: { 'application/json': { schema: { $ref: '#/components/schemas/MobileMoneyCharge' } } } }, ...errorResponses },
  },
};

paths['/v1/mobile-money/transfer'] = {
  post: {
    tags: ['Mobile Money'], summary: 'Transfer to mobile money', operationId: 'mobileMoneyTransfer', security: [{ bearerAuth: [] }], deprecated: true,
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['phone_number', 'amount'], properties: { phone_number: { type: 'string' }, amount: { type: 'number', example: 10000 }, currency: { type: 'string', example: 'XAF' } } } } } },
    responses: { '200': { description: 'Transfer initiated', content: { 'application/json': { schema: { $ref: '#/components/schemas/MobileMoneyCharge' } } } }, ...errorResponses },
  },
};

paths['/v1/mobile-money/verify'] = {
  post: { tags: ['Mobile Money'], summary: 'Verify mobile money transaction', operationId: 'mobileMoneyVerify', security: [{ bearerAuth: [] }], deprecated: true, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['transaction_ref'], properties: { transaction_ref: { type: 'string' } } } } } }, responses: { '200': { description: 'Transaction status', content: { 'application/json': { schema: { $ref: '#/components/schemas/MobileMoneyCharge' } } } }, ...errorResponses } },
};

paths['/v1/mobile-money/to-bank'] = {
  post: {
    tags: ['Mobile Money'], summary: 'Mobile money to bank transfer', operationId: 'mobileMoneyToBank', security: [{ bearerAuth: [] }], deprecated: true,
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['phone_number', 'amount', 'bank_account'], properties: { phone_number: { type: 'string' }, amount: { type: 'number' }, bank_account: { type: 'string' }, bank_code: { type: 'string' } } } } } },
    responses: { '200': successResult('Transfer initiated'), ...errorResponses },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// FLUTTERWAVE / PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/flutterwave/bank-transfer'] = {
  post: {
    tags: ['Payments'], summary: 'Initiate bank transfer via Flutterwave', operationId: 'flutterwaveBankTransfer', security: [{ bearerAuth: [] }], deprecated: true,
    parameters: [idempotencyHeader],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['account_number', 'bank_code', 'amount'], properties: { account_number: { type: 'string' }, bank_code: { type: 'string' }, amount: { type: 'number', example: 100000 }, currency: { type: 'string', example: 'XAF' }, narration: { type: 'string' } } } } } },
    responses: { '200': successResult('Transfer initiated'), ...errorResponses },
  },
};

paths['/v1/flutterwave/banks'] = {
  get: { tags: ['Payments'], summary: 'List supported banks', operationId: 'flutterwaveListBanks', security: [{ bearerAuth: [] }], deprecated: true, parameters: [{ name: 'country', in: 'query', schema: { type: 'string', default: 'CM' } }], responses: { '200': { description: 'Banks list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { code: { type: 'string' }, name: { type: 'string' } } } } } } } } }, ...errorResponses } },
};

paths['/v1/flutterwave/verify-bank'] = {
  post: { tags: ['Payments'], summary: 'Verify bank account', operationId: 'flutterwaveVerifyBank', security: [{ bearerAuth: [] }], deprecated: true, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['account_number', 'bank_code'], properties: { account_number: { type: 'string' }, bank_code: { type: 'string' } } } } } }, responses: { '200': { description: 'Account details', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayBankVerification' } } } }, ...errorResponses } },
};

// Stripe
paths['/v1/stripe/payment-intent'] = {
  post: { tags: ['Payments'], summary: 'Create Stripe payment intent', operationId: 'stripePaymentIntent', security: [{ bearerAuth: [] }], deprecated: true, parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount', 'currency'], properties: { amount: { type: 'number' }, currency: { type: 'string', example: 'XAF' } } } } } }, responses: { '200': successResult('Payment intent created'), ...errorResponses } },
};

paths['/v1/stripe/confirm-payment'] = {
  post: { tags: ['Payments'], summary: 'Confirm Stripe payment', operationId: 'stripeConfirmPayment', security: [{ bearerAuth: [] }], deprecated: true, parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['payment_intent_id'], properties: { payment_intent_id: { type: 'string' } } } } } }, responses: { '200': successResult('Payment confirmed'), ...errorResponses } },
};

// Bulk transfers
paths['/v1/banking/bulk-transfers'] = {
  post: { tags: ['Banking Operations'], summary: 'Initiate bulk transfers', operationId: 'bulkTransfers', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['transfers'], properties: { transfers: { type: 'array', items: { type: 'object', properties: { account_number: { type: 'string' }, bank_code: { type: 'string' }, amount: { type: 'number' }, narration: { type: 'string' } } } } } } } } }, responses: { '200': successResult('Bulk transfer initiated'), ...errorResponses } },
};

paths['/v1/banking/exchange-rate'] = {
  get: { tags: ['Banking Operations'], summary: 'Get exchange rate', operationId: 'exchangeRate', security: [{ bearerAuth: [] }], parameters: [{ name: 'from', in: 'query', required: true, schema: { type: 'string', example: 'XAF' } }, { name: 'to', in: 'query', required: true, schema: { type: 'string', example: 'USD' } }], responses: { '200': { description: 'Exchange rate', content: { 'application/json': { schema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, rate: { type: 'number' }, timestamp: { type: 'string', format: 'date-time' } } } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// VIRTUAL CARDS
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/cards'] = {
  post: { tags: ['Virtual Cards'], summary: 'Create virtual card', operationId: 'virtualCardCreate', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { currency: { type: 'string', example: 'USD' }, label: { type: 'string' } } } } } }, responses: { '201': { description: 'Card created', content: { 'application/json': { schema: { $ref: '#/components/schemas/VirtualCard' } } } }, ...errorResponses } },
  get: { tags: ['Virtual Cards'], summary: 'List virtual cards', operationId: 'virtualCardList', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Cards list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/VirtualCard' } } } } } } }, ...errorResponses } },
};

paths['/v1/cards/{cardId}/topup'] = {
  post: { tags: ['Virtual Cards'], summary: 'Top up virtual card', operationId: 'virtualCardTopup', security: [{ bearerAuth: [] }], parameters: [{ name: 'cardId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount', 'source_currency'], properties: { amount: { type: 'number', example: 50000 }, source_currency: { type: 'string', example: 'XAF' } } } } } }, responses: { '200': successResult('Card topped up'), ...errorResponses } },
};

paths['/v1/cards/{cardId}/transactions'] = {
  get: { tags: ['Virtual Cards'], summary: 'Card transactions', operationId: 'virtualCardTransactions', security: [{ bearerAuth: [] }], parameters: [{ name: 'cardId', in: 'path', required: true, schema: { type: 'string' } }, ...paginationParams], responses: { '200': { description: 'Card transactions', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } } } } } } }, ...errorResponses } },
};

paths['/v1/cards/{cardId}/status'] = {
  put: { tags: ['Virtual Cards'], summary: 'Update card status', operationId: 'virtualCardUpdateStatus', security: [{ bearerAuth: [] }], parameters: [{ name: 'cardId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['active', 'frozen', 'cancelled'] } } } } } }, responses: { '200': successResult('Status updated'), ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// ISO 20022 & SWIFT
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/standards/iso20022/pain001/parse'] = { post: { tags: ['Standards'], summary: 'Parse pain.001', operationId: 'iso20022Pain001Parser', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/xml': { schema: { type: 'string' } } } }, responses: { '200': { description: 'Parsed payment initiation' }, ...errorResponses } } };
paths['/v1/standards/iso20022/camt053/parse'] = { post: { tags: ['Standards'], summary: 'Parse camt.053', operationId: 'iso20022Camt053Parser', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/xml': { schema: { type: 'string' } } } }, responses: { '200': { description: 'Parsed bank statement' }, ...errorResponses } } };
paths['/v1/standards/iso20022/pacs008/generate'] = { post: { tags: ['Standards'], summary: 'Generate pacs.008', operationId: 'iso20022Pacs008Generator', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Generated FI-to-FI payment' }, ...errorResponses } } };
paths['/v1/standards/iso20022/pacs002/generate'] = { post: { tags: ['Standards'], summary: 'Generate pacs.002', operationId: 'iso20022Pacs002Generator', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Generated payment status report' }, ...errorResponses } } };
paths['/v1/standards/swift/mt103/parse'] = { post: { tags: ['Standards'], summary: 'Parse MT103', operationId: 'swiftMt103Parser', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'text/plain': { schema: { type: 'string' } } } }, responses: { '200': { description: 'Parsed SWIFT transfer' }, ...errorResponses } } };
paths['/v1/standards/swift/mt940/parse'] = { post: { tags: ['Standards'], summary: 'Parse MT940', operationId: 'swiftMt940Parser', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'text/plain': { schema: { type: 'string' } } } }, responses: { '200': { description: 'Parsed statement' }, ...errorResponses } } };
paths['/v1/standards/swift/mt103/generate'] = { post: { tags: ['Standards'], summary: 'Generate MT103', operationId: 'swiftMt103Generator', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Generated MT103 message' }, ...errorResponses } } };
paths['/v1/standards/validate/iban'] = { post: { tags: ['Standards'], summary: 'Validate IBAN', operationId: 'validateIban', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['iban'], properties: { iban: { type: 'string', example: 'CM21 10003 00100 0123456789 023' } } } } } }, responses: { '200': { description: 'Validation result' }, ...errorResponses } } };
paths['/v1/standards/validate/bic'] = { post: { tags: ['Standards'], summary: 'Validate BIC/SWIFT code', operationId: 'validateBic', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['bic'], properties: { bic: { type: 'string' } } } } } }, responses: { '200': { description: 'Validation result' }, ...errorResponses } } };
paths['/v1/standards/validate/rib'] = { post: { tags: ['Standards'], summary: 'Validate Cameroon Domestic RIB', operationId: 'validateRib', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['rib'], properties: { rib: { type: 'string', example: '10005001000123456789023', description: '23-digit Cameroon domestic RIB/BBAN' }, country: { type: 'string', default: 'CM' } } } } } }, responses: { '200': { description: 'RIB validation result with structured fields (bank_code, branch_code, account_number, rib_key), derived IBAN, and bank lookup', content: { 'application/json': { schema: { type: 'object', properties: { valid: { type: 'boolean' }, bank_code: { type: 'string', example: '10005' }, branch_code: { type: 'string', example: '00100' }, account_number: { type: 'string', example: '01234567890' }, rib_key: { type: 'string', example: '23' }, bank_name: { type: 'string', example: 'Afriland First Bank' }, swift_bic: { type: 'string', example: 'AFRIACMCXXX' }, derived_iban: { type: 'string', example: 'CM21 1000 5001 0001 2345 6789 023' }, formatted_display: { type: 'string', example: '10005-00100-01234567890-23' }, errors: { type: 'array', items: { type: 'string' } } } } } } }, ...errorResponses } } };
paths['/v1/standards/validate/account-identifier'] = { post: { tags: ['Standards'], summary: 'Validate any account identifier (RIB, IBAN, LOCAL_BANK, MOMO)', operationId: 'validateAccountIdentifier', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['type', 'value'], properties: { type: { type: 'string', enum: ['DOMESTIC_RIB', 'IBAN', 'LOCAL_BANK', 'MOMO'] }, value: { type: 'string' }, country: { type: 'string', default: 'CM' } } } } } }, responses: { '200': { description: 'Unified validation result with rail determination', content: { 'application/json': { schema: { type: 'object', properties: { valid: { type: 'boolean' }, identifier_type: { type: 'string', enum: ['DOMESTIC_RIB', 'IBAN', 'LOCAL_BANK', 'MOMO'] }, rail: { type: 'string', enum: ['DOMESTIC', 'INTERNATIONAL', 'LOCAL'] }, normalized_value: { type: 'string' }, display: { type: 'string' }, country: { type: 'string' }, errors: { type: 'array', items: { type: 'string' } } } } } } }, ...errorResponses } } };
paths['/v1/directory/banks/cm'] = { get: { tags: ['Directory'], summary: 'List Cameroon banks with RIB structure and SWIFT codes', operationId: 'directoryBanksCm', security: [], responses: { '200': { description: 'Cameroon bank directory', content: { 'application/json': { schema: { type: 'object', properties: { country: { type: 'string' }, banks: { type: 'array', items: { type: 'object', properties: { bank_code: { type: 'string' }, bank_name: { type: 'string' }, swift_bic: { type: 'string' }, supports_rib: { type: 'boolean' } } } } } } } } }, ...errorResponses } } };

// ═══════════════════════════════════════════════════════════════════════════
// KYC & COMPLIANCE
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/kyc/submit'] = {
  post: { tags: ['KYC & Compliance'], summary: 'Submit KYC documents', operationId: 'kycSubmit', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['document_type', 'document_number'], properties: { document_type: { type: 'string', enum: ['national_id', 'passport', 'drivers_license'] }, document_number: { type: 'string' }, document_front_url: { type: 'string' }, document_back_url: { type: 'string' } } } } } }, responses: { '201': successResult('KYC submitted'), ...errorResponses } },
};

paths['/v1/kyc/sanctions-screen'] = {
  post: { tags: ['KYC & Compliance'], summary: 'Sanctions screening', operationId: 'sanctionsScreen', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['full_name'], properties: { full_name: { type: 'string' }, date_of_birth: { type: 'string', format: 'date' }, nationality: { type: 'string' } } } } } }, responses: { '200': { description: 'Screening result', content: { 'application/json': { schema: { type: 'object', properties: { match_found: { type: 'boolean' }, matches: { type: 'array', items: { type: 'object' } }, screened_at: { type: 'string', format: 'date-time' } } } } } }, ...errorResponses } },
};

paths['/v1/kyc/data-export'] = {
  get: { tags: ['KYC & Compliance'], summary: 'Export personal data (GDPR)', operationId: 'dataExport', security: [{ bearerAuth: [] }], responses: { '200': { description: 'User data export', content: { 'application/json': { schema: { type: 'object', properties: { user: { type: 'object' }, accounts: { type: 'array', items: { type: 'object' } }, transactions: { type: 'array', items: { type: 'object' } } } } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOKS
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/webhooks'] = {
  post: { tags: ['Webhooks'], summary: 'Register webhook', operationId: 'webhookRegister', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['url', 'events'], properties: { url: { type: 'string', format: 'uri' }, events: { type: 'array', items: { type: 'string' } }, secret: { type: 'string' } } } } } }, responses: { '201': { description: 'Webhook registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/Webhook' } } } }, ...errorResponses } },
  get: { tags: ['Webhooks'], summary: 'List webhooks', operationId: 'webhookList', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Webhooks list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Webhook' } } } } } } }, ...errorResponses } },
};

paths['/v1/webhooks/{webhookId}/deliveries'] = {
  get: { tags: ['Webhooks'], summary: 'List webhook deliveries', operationId: 'webhookDeliveries', security: [{ bearerAuth: [] }], parameters: [{ name: 'webhookId', in: 'path', required: true, schema: { type: 'string' } }, ...paginationParams], responses: { '200': { description: 'Delivery history', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, event_type: { type: 'string' }, status: { type: 'string' }, response_code: { type: 'integer' }, delivered_at: { type: 'string', format: 'date-time' } } } } } } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/admin/users'] = {
  post: { tags: ['Admin'], summary: 'Create user', operationId: 'adminCreateUser', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'role'], properties: { email: { type: 'string' }, role: { type: 'string', enum: ['admin', 'institution', 'tpp', 'personal'] }, full_name: { type: 'string' } } } } } }, responses: { '201': { description: 'User created' }, ...errorResponses } },
};

paths['/v1/admin/clients'] = {
  post: { tags: ['Admin'], summary: 'Create API client', operationId: 'adminCreateClient', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['client_name'], properties: { client_name: { type: 'string' }, scopes: { type: 'array', items: { type: 'string' } } } } } } }, responses: { '201': { description: 'Client created' }, ...errorResponses } },
};

paths['/v1/admin/metrics'] = {
  get: { tags: ['Admin'], summary: 'Platform metrics', operationId: 'adminMetrics', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Metrics dashboard data', content: { 'application/json': { schema: { type: 'object', properties: { total_users: { type: 'integer' }, total_transactions: { type: 'integer' }, total_volume: { type: 'number' } } } } } }, ...errorResponses } },
};

paths['/v1/admin/sandbox/accounts'] = {
  get: { tags: ['Admin'], summary: 'List sandbox accounts', operationId: 'adminSandboxAccounts', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Sandbox accounts', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Account' } } } } } } }, ...errorResponses } },
};

paths['/v1/admin/system-config'] = {
  get: { tags: ['Admin'], summary: 'Get system configuration', operationId: 'adminSystemConfig', security: [{ bearerAuth: [] }], responses: { '200': { description: 'System config', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, ...errorResponses } },
  put: { tags: ['Admin'], summary: 'Update system configuration', operationId: 'adminSystemConfigUpdate', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: { '200': { description: 'Config updated' }, ...errorResponses } },
};

paths['/v1/admin/webhooks'] = {
  get: { tags: ['Admin'], summary: 'List all webhooks (admin)', operationId: 'adminWebhooks', security: [{ bearerAuth: [] }], parameters: [...paginationParams], responses: { '200': { description: 'All webhooks', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Webhook' } } } } } } }, ...errorResponses } },
};

paths['/v1/admin/transactions/review'] = {
  get: { tags: ['Admin'], summary: 'Review transactions', operationId: 'adminTransactionReview', security: [{ bearerAuth: [] }], parameters: [...paginationParams, { name: 'status', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'Transactions for review', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } } } } } } }, ...errorResponses } },
};

paths['/v1/admin/loans'] = {
  get: { tags: ['Admin'], summary: 'List all loans (admin)', operationId: 'adminListLoans', security: [{ bearerAuth: [] }], parameters: [...paginationParams, { name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'user_id', in: 'query', schema: { type: 'string' } }, { name: 'product_id', in: 'query', schema: { type: 'string' } }], responses: listResponse('LoanApplication', 'Loan applications with accounts') },
};

paths['/v1/admin/savings'] = {
  get: { tags: ['Admin'], summary: 'List all savings accounts (admin)', operationId: 'adminListSavings', security: [{ bearerAuth: [] }], parameters: [...paginationParams, { name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'user_id', in: 'query', schema: { type: 'string' } }, { name: 'product_id', in: 'query', schema: { type: 'string' } }, { name: 'account_type', in: 'query', schema: { type: 'string' } }], responses: listResponse('SavingsAccount', 'Savings accounts with products') },
};

paths['/v1/admin/consents'] = {
  get: { tags: ['Admin'], summary: 'List all consents (admin)', operationId: 'adminListConsents', security: [{ bearerAuth: [] }], parameters: [...paginationParams, { name: 'type', in: 'query', schema: { type: 'string', enum: ['aisp', 'pisp'], default: 'aisp' } }, { name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'user_id', in: 'query', schema: { type: 'string' } }, { name: 'client_id', in: 'query', schema: { type: 'string' } }], responses: listResponse('Consent', 'AISP or PISP consents') },
};

paths['/v1/admin/staff/assign'] = {
  post: { tags: ['Admin'], summary: 'Assign staff to branch', operationId: 'adminAssignStaff', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['user_id', 'branch_id', 'role'], properties: { user_id: { type: 'string' }, branch_id: { type: 'string' }, role: { type: 'string' } } } } } }, responses: { '200': { description: 'Staff assigned' }, ...errorResponses } },
};

paths['/v1/admin/branches'] = {
  get: { tags: ['Admin'], summary: 'List branches', operationId: 'adminManageBranches', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Branches list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, city: { type: 'string' } } } } } } } } }, ...errorResponses } },
  post: { tags: ['Admin'], summary: 'Create branch', operationId: 'adminCreateBranch', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Branch created' }, ...errorResponses } },
};

// Communications
paths['/v1/communications/send'] = {
  post: { tags: ['Communications'], summary: 'Send communication', operationId: 'sendCommunication', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['type', 'recipient', 'body'], properties: { type: { type: 'string', enum: ['email', 'sms', 'push'] }, recipient: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } } } } } }, responses: { '200': { description: 'Communication sent' }, ...errorResponses } },
};

paths['/v1/communications/bulk'] = {
  post: { tags: ['Communications'], summary: 'Send bulk communication', operationId: 'sendBulkCommunication', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Bulk communication queued' }, ...errorResponses } },
};

// Settlement (detailed definitions under Payment Facilitation below)

paths['/v1/invoices/generate'] = {
  post: { tags: ['Settlement'], summary: 'Generate invoice', operationId: 'generateInvoice', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Invoice generated' }, ...errorResponses } },
};

// Institution
paths['/v1/institutions/register'] = {
  post: { tags: ['Institution'], summary: 'Register institution', operationId: 'institutionRegister', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Institution registered' }, ...errorResponses } },
};

paths['/v1/institutions/{institutionId}/clients'] = {
  post: { tags: ['Institution'], summary: 'Create institution API client', operationId: 'institutionCreateClient', security: [{ bearerAuth: [] }], parameters: [{ name: 'institutionId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Client created' }, ...errorResponses } },
};

paths['/v1/institutions/{institutionId}/kyb'] = {
  post: { tags: ['Institution'], summary: 'Submit business KYC', operationId: 'businessKycSubmit', security: [{ bearerAuth: [] }], parameters: [{ name: 'institutionId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'KYB submitted' }, ...errorResponses } },
};

// CrediQ
paths['/v1/crediq/health-check'] = { get: { tags: ['CrediQ'], summary: 'CrediQ health check', operationId: 'crediqHealthCheck', security: [{ bearerAuth: [] }], responses: { '200': successResult('Health status'), ...errorResponses } } };
paths['/v1/crediq/baseline-score'] = { post: { tags: ['CrediQ'], summary: 'Generate baseline score', operationId: 'crediqBaselineScore', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Baseline score', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreditScore' } } } }, ...errorResponses } } };
paths['/v1/crediq/health-metrics'] = { post: { tags: ['CrediQ'], summary: 'Calculate health metrics', operationId: 'crediqHealthMetrics', security: [{ bearerAuth: [] }], responses: { '200': successResult('Health metrics'), ...errorResponses } } };
paths['/v1/crediq/action-plan'] = { post: { tags: ['CrediQ'], summary: 'Generate action plan', operationId: 'crediqActionPlan', security: [{ bearerAuth: [] }], responses: { '200': successResult('Action plan'), ...errorResponses } } };

// PostiQ
paths['/v1/postiq/codes'] = {
  post: { tags: ['PostiQ'], summary: 'Create PostiQ code', operationId: 'postiqCreateCode', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Code created' }, ...errorResponses } },
};

paths['/v1/postiq/codes/{code}'] = {
  get: { tags: ['PostiQ'], summary: 'Lookup PostiQ code', operationId: 'postiqLookupCode', security: [], parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Address details', content: { 'application/json': { schema: { type: 'object', properties: { postiq_code: { type: 'string' }, full_address: { type: 'string' }, city: { type: 'string' }, country: { type: 'string' } } } } } }, ...errorResponses } },
};

// WooCommerce
paths['/v1/woocommerce/merchants'] = {
  post: { tags: ['WooCommerce'], summary: 'Register WooCommerce merchant', description: 'Register a WooCommerce store for Kang Open Banking payment processing. Returns API credentials.', operationId: 'woocommerceRegisterMerchant', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['store_name', 'store_url', 'admin_email'], properties: { store_name: { type: 'string', example: 'My Cameroon Store' }, store_url: { type: 'string', format: 'uri', example: 'https://mystore.cm' }, admin_email: { type: 'string', format: 'email' }, plugin_version: { type: 'string', example: '1.0.0' }, business_type: { type: 'string', enum: ['individual', 'company'] }, phone: { type: 'string' }, country: { type: 'string', default: 'CM' } } } } } }, responses: { '201': { description: 'Merchant registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/WooCommerceMerchant' } } } }, ...errorResponses } },
};

paths['/v1/woocommerce/validate-install'] = {
  post: { tags: ['WooCommerce'], summary: 'Validate WooCommerce plugin installation', description: 'Validates the plugin is correctly installed and API credentials are working.', operationId: 'woocommerceValidateInstall', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['api_key', 'store_url'], properties: { api_key: { type: 'string' }, plugin_version: { type: 'string' }, store_url: { type: 'string', format: 'uri' }, php_version: { type: 'string' }, wp_version: { type: 'string' }, wc_version: { type: 'string' } } } } } }, responses: { '200': { description: 'Validation result', content: { 'application/json': { schema: { type: 'object', properties: { valid: { type: 'boolean' }, merchant_id: { type: 'string' }, store_name: { type: 'string' }, status: { type: 'string', enum: ['active', 'inactive', 'suspended'] }, features: { type: 'array', items: { type: 'string' } } } } } } }, ...errorResponses } },
};

paths['/v1/woocommerce/plugin/download'] = {
  get: { tags: ['WooCommerce'], summary: 'Download WooCommerce plugin ZIP', description: 'Downloads the complete Woo for Kang WordPress plugin as a ZIP file ready for installation.', operationId: 'woocommerceDownloadPlugin', security: [], responses: { '200': { description: 'Plugin ZIP file', content: { 'application/zip': { schema: { type: 'string', format: 'binary' } } } }, ...errorResponses } },
};

paths['/v1/woocommerce/process-payment'] = {
  post: { tags: ['WooCommerce'], summary: 'Process WooCommerce payment', description: 'Initiates a payment for a WooCommerce order. Called by the WordPress plugin during checkout.', operationId: 'woocommerceProcessPayment', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount', 'currency', 'woocommerce_order_id', 'customer_email'], properties: { amount: { type: 'number', example: 25000 }, currency: { type: 'string', default: 'XAF' }, woocommerce_order_id: { type: 'integer', example: 1234 }, customer_email: { type: 'string', format: 'email' }, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, payment_methods: { type: 'array', items: { type: 'string', enum: ['mobile_money', 'card', 'bank_transfer'] } }, return_url: { type: 'string', format: 'uri' }, cancel_url: { type: 'string', format: 'uri' }, webhook_url: { type: 'string', format: 'uri' }, metadata: { type: 'object' } } } } } }, responses: { '200': { description: 'Payment initiated', content: { 'application/json': { schema: { type: 'object', properties: { transaction_ref: { type: 'string' }, payment_url: { type: 'string', format: 'uri' }, status: { type: 'string', enum: ['pending', 'processing'] }, expires_at: { type: 'string', format: 'date-time' } } } } } }, ...errorResponses } },
};

paths['/v1/woocommerce/transactions'] = {
  get: { tags: ['WooCommerce'], summary: 'Sync WooCommerce transactions', description: 'Retrieve transaction history for a WooCommerce merchant. Used by the plugin for transaction synchronization.', operationId: 'woocommerceListTransactions', security: [{ bearerAuth: [] }], parameters: [{ name: 'start_date', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] } }, { name: 'payment_method', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: { '200': { description: 'Transaction list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/WooCommerceTransaction' } }, total: { type: 'integer' }, limit: { type: 'integer' }, offset: { type: 'integer' } } } } } }, ...errorResponses } },
};

paths['/v1/woocommerce/webhook'] = {
  post: { tags: ['WooCommerce'], summary: 'WooCommerce payment webhook', description: 'Receives payment status updates and updates the corresponding WooCommerce order.', operationId: 'woocommercePaymentWebhook', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['event_type', 'transaction_ref', 'status'], properties: { event_type: { type: 'string', enum: ['payment.completed', 'payment.failed', 'payment.cancelled', 'payment.refunded'] }, transaction_ref: { type: 'string' }, woocommerce_order_id: { type: 'integer' }, status: { type: 'string', enum: ['completed', 'successful', 'failed', 'cancelled', 'refunded'] }, amount: { type: 'number' }, currency: { type: 'string' }, payment_method: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' } } } } } }, responses: { '200': { description: 'Webhook processed' }, ...errorResponses } },
};

// Sandbox
paths['/v1/sandbox/accounts'] = {
  post: { tags: ['Sandbox'], summary: 'Create sandbox account', operationId: 'sandboxCreateAccount', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], responses: { '201': successResult('Sandbox account created'), ...errorResponses } },
};

paths['/v1/sandbox/api-keys'] = {
  post: { tags: ['Sandbox'], summary: 'Create sandbox API key', operationId: 'sandboxCreateApiKey', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], responses: { '201': { description: 'API key created', content: { 'application/json': { schema: { type: 'object', properties: { api_key: { type: 'string' }, secret: { type: 'string' }, environment: { type: 'string' } } } } } }, ...errorResponses } },
};

paths['/v1/sandbox/data/generate'] = {
  post: { tags: ['Sandbox'], summary: 'Generate test data', operationId: 'sandboxGenerateData', security: [{ bearerAuth: [] }], responses: { '200': successResult('Test data generated'), ...errorResponses } },
};

paths['/v1/sandbox/webhooks'] = {
  post: { tags: ['Sandbox'], summary: 'Register sandbox webhook', operationId: 'sandboxRegisterWebhook', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['url', 'events'], properties: { url: { type: 'string' }, events: { type: 'array', items: { type: 'string' } } } } } } }, responses: { '201': { description: 'Webhook registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/Webhook' } } } }, ...errorResponses } },
};

// Developer
paths['/v1/developers/register'] = {
  post: { tags: ['Developer'], summary: 'Register developer app', operationId: 'developerRegisterApp', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['app_name', 'redirect_uris'], properties: { app_name: { type: 'string' }, redirect_uris: { type: 'array', items: { type: 'string' } }, use_case: { type: 'string' } } } } } }, responses: { '201': { description: 'App registered' }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT GATEWAY
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/gateway/charges'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create a charge', operationId: 'gatewayCreateCharge', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'amount', 'channel', 'tx_ref'], properties: { merchant_id: { type: 'string', format: 'uuid' }, amount: { type: 'number', example: 5000 }, currency: { type: 'string', default: 'XAF' }, channel: { type: 'string', enum: ['mobile_money', 'card', 'bank_transfer', 'apple_pay', 'google_pay', 'ussd', 'paypal'] }, customer_phone: { type: 'string' }, customer_email: { type: 'string' }, tx_ref: { type: 'string' }, metadata: { type: 'object' } } } } } }, responses: { '201': { description: 'Charge created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayCharge' } } } }, ...errorResponses } },
  get: { tags: ['Payment Gateway'], summary: 'List charges', operationId: 'gatewayListCharges', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'channel', in: 'query', schema: { type: 'string' } }, { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } }, ...paginationParams], responses: listResponse('GatewayCharge', 'Charges list') },
};

paths['/v1/gateway/charges/{chargeId}'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get charge', operationId: 'gatewayGetCharge', security: [{ bearerAuth: [] }], parameters: [{ name: 'chargeId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Charge details', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayCharge' } } } }, ...errorResponses } },
};

paths['/v1/gateway/charges/{chargeId}/verify'] = {
  post: { tags: ['Payment Gateway'], summary: 'Verify charge with provider', operationId: 'gatewayVerifyCharge', security: [{ bearerAuth: [] }], parameters: [{ name: 'chargeId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Verified charge status', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayCharge' } } } }, ...errorResponses } },
};

paths['/v1/gateway/charges/{chargeId}/cancel'] = {
  post: { tags: ['Payment Gateway'], summary: 'Cancel pending charge', operationId: 'gatewayCancelCharge', security: [{ bearerAuth: [] }], parameters: [{ name: 'chargeId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Charge cancelled', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayCharge' } } } }, ...errorResponses } },
};

paths['/v1/gateway/fee-estimate'] = {
  get: { tags: ['Payment Gateway'], summary: 'Estimate transaction fees', operationId: 'gatewayFeeEstimate', security: [{ bearerAuth: [] }], parameters: [{ name: 'amount', in: 'query', required: true, schema: { type: 'number' } }, { name: 'channel', in: 'query', required: true, schema: { type: 'string', enum: ['mobile_money', 'card', 'bank_transfer', 'apple_pay', 'google_pay', 'ussd', 'account_funding', 'paypal'] } }, { name: 'currency', in: 'query', schema: { type: 'string', default: 'XAF' } }], responses: { '200': { description: 'Fee estimate', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayFeeEstimate' } } } }, ...errorResponses } },
};

paths['/v1/gateway/refunds'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create refund', operationId: 'gatewayCreateRefund', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['charge_id'], properties: { charge_id: { type: 'string', format: 'uuid' }, amount: { type: 'number' }, reason: { type: 'string' } } } } } }, responses: { '201': { description: 'Refund created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayRefund' } } } }, ...errorResponses } },
  get: { tags: ['Payment Gateway'], summary: 'List refunds', operationId: 'gatewayListRefunds', security: [{ bearerAuth: [] }], parameters: [...paginationParams], responses: listResponse('GatewayRefund', 'Refunds list') },
};

paths['/v1/gateway/refunds/{refundId}'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get refund', operationId: 'gatewayGetRefund', security: [{ bearerAuth: [] }], parameters: [{ name: 'refundId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Refund details', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayRefund' } } } }, ...errorResponses } },
};

paths['/v1/gateway/payouts'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create payout', operationId: 'gatewayCreatePayout', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'amount', 'channel'], properties: { merchant_id: { type: 'string', format: 'uuid' }, amount: { type: 'number' }, currency: { type: 'string' }, channel: { type: 'string', enum: ['mobile_money', 'bank_transfer'] }, beneficiary_phone: { type: 'string' }, beneficiary_name: { type: 'string' }, beneficiary_account: { type: 'string' }, beneficiary_bank: { type: 'string' }, narration: { type: 'string' }, tx_ref: { type: 'string' } } } } } }, responses: { '201': { description: 'Payout created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayPayout' } } } }, ...errorResponses } },
  get: { tags: ['Payment Gateway'], summary: 'List payouts', operationId: 'gatewayListPayouts', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: listResponse('GatewayPayout', 'Payouts list') },
};

paths['/v1/gateway/payouts/{payoutId}'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get payout', operationId: 'gatewayGetPayout', security: [{ bearerAuth: [] }], parameters: [{ name: 'payoutId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Payout details', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayPayout' } } } }, ...errorResponses } },
};

paths['/v1/gateway/payout-batches'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create payout batch', operationId: 'gatewayCreatePayoutBatch', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'currency', 'items'], properties: { merchant_id: { type: 'string' }, currency: { type: 'string' }, items: { type: 'array', items: { type: 'object' } } } } } } }, responses: { '201': { description: 'Batch created' }, ...errorResponses } },
};

paths['/v1/gateway/payout-batches/{batchId}'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get payout batch', operationId: 'gatewayGetPayoutBatch', security: [{ bearerAuth: [] }], parameters: [{ name: 'batchId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Batch details', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' }, total_amount: { type: 'number' }, items_count: { type: 'integer' } } } } } }, ...errorResponses } },
};

// ─── PayPal Payouts ───
paths['/v1/gateway/payouts/paypal'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create PayPal payout', description: 'Send money to a PayPal recipient via EMAIL, PHONE, or PAYPAL_ID. Currency must be PayPal-supported (USD, EUR, GBP).', operationId: 'gatewayCreatePayPalPayout', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'amount', 'currency', 'recipient_type', 'receiver', 'tx_ref'], properties: { merchant_id: { type: 'string', format: 'uuid' }, amount: { type: 'number', example: 5000 }, currency: { type: 'string', example: 'USD', description: 'PayPal-supported currency (not XAF)' }, recipient_type: { type: 'string', enum: ['EMAIL', 'PHONE', 'PAYPAL_ID'] }, receiver: { type: 'string', example: 'recipient@example.com' }, note: { type: 'string' }, tx_ref: { type: 'string' } } } } } }, responses: { '201': { description: 'PayPal payout created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayPayout' } } } }, ...errorResponses } },
};

paths['/v1/gateway/withdraw-to-paypal'] = {
  post: { tags: ['Payment Gateway'], summary: 'Withdraw to PayPal', description: 'Withdraw KOB account balance to a PayPal email. Account is debited immediately with automatic reversal on failure.', operationId: 'gatewayWithdrawToPayPal', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount', 'account_id', 'paypal_email'], properties: { amount: { type: 'number', example: 10000 }, account_id: { type: 'string', format: 'uuid' }, paypal_email: { type: 'string', format: 'email' }, currency: { type: 'string', default: 'USD' }, narration: { type: 'string' } } } } } }, responses: { '201': { description: 'Withdrawal initiated', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, amount: { type: 'number' }, fee_amount: { type: 'number' }, total_debited: { type: 'number' }, currency: { type: 'string' }, status: { type: 'string' }, paypal_email: { type: 'string' }, batch_id: { type: 'string' }, tx_ref: { type: 'string' } } } } } }, ...errorResponses } },
};

paths['/v1/gateway/disputes'] = {
  get: { tags: ['Payment Gateway'], summary: 'List disputes', operationId: 'gatewayListDisputes', security: [{ bearerAuth: [] }], parameters: [...paginationParams], responses: listResponse('GatewayDispute', 'Disputes list') },
};

paths['/v1/gateway/disputes/{disputeId}'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get dispute', operationId: 'gatewayGetDispute', security: [{ bearerAuth: [] }], parameters: [{ name: 'disputeId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Dispute details', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayDispute' } } } }, ...errorResponses } },
};

paths['/v1/gateway/disputes/{disputeId}/evidence'] = {
  post: { tags: ['Payment Gateway'], summary: 'Submit dispute evidence', operationId: 'gatewaySubmitDisputeEvidence', security: [{ bearerAuth: [] }], parameters: [{ name: 'disputeId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['evidence_text'], properties: { evidence_text: { type: 'string' }, evidence_type: { type: 'string' }, file_url: { type: 'string' } } } } } }, responses: { '200': successResult('Evidence submitted'), ...errorResponses } },
};

paths['/v1/gateway/settlements'] = {
  get: { tags: ['Payment Gateway'], summary: 'List settlements', operationId: 'gatewayListSettlements', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: listResponse('GatewaySettlement', 'Settlements list') },
};

paths['/v1/gateway/settlements/{settlementId}'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get settlement', operationId: 'gatewayGetSettlement', security: [{ bearerAuth: [] }], parameters: [{ name: 'settlementId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Settlement details', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewaySettlement' } } } }, ...errorResponses } },
};

paths['/v1/gateway/beneficiaries'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create beneficiary', operationId: 'gatewayCreateBeneficiary', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'name', 'channel'], properties: { merchant_id: { type: 'string' }, name: { type: 'string' }, channel: { type: 'string' }, phone: { type: 'string' }, bank_account: { type: 'string' }, bank_code: { type: 'string' } } } } } }, responses: { '201': { description: 'Beneficiary created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayBeneficiary' } } } }, ...errorResponses } },
  get: { tags: ['Payment Gateway'], summary: 'List beneficiaries', operationId: 'gatewayListBeneficiaries', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: listResponse('GatewayBeneficiary', 'Beneficiaries list') },
};

paths['/v1/gateway/beneficiaries/{beneficiaryId}'] = {
  delete: { tags: ['Payment Gateway'], summary: 'Delete beneficiary', operationId: 'gatewayDeleteBeneficiary', security: [{ bearerAuth: [] }], parameters: [{ name: 'beneficiaryId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '204': { description: 'Beneficiary deleted' }, ...errorResponses } },
};

paths['/v1/gateway/reports/transactions'] = {
  get: { tags: ['Payment Gateway'], summary: 'Transaction report', operationId: 'gatewayReportTransactions', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, { name: 'from', in: 'query', schema: { type: 'string' } }, { name: 'to', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'Transaction report with summary', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/GatewayCharge' } }, summary: { type: 'object', properties: { total_volume: { type: 'number' }, total_count: { type: 'integer' }, total_fees: { type: 'number' } } } } } } } }, ...errorResponses } },
};

paths['/v1/gateway/reports/settlements'] = {
  get: { tags: ['Payment Gateway'], summary: 'Settlement report', operationId: 'gatewayReportSettlements', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, { name: 'from', in: 'query', schema: { type: 'string' } }, { name: 'to', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'Settlement report with summary', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/GatewaySettlement' } }, summary: { type: 'object', properties: { total_settled: { type: 'number' }, total_fees: { type: 'number' }, period: { type: 'string' } } } } } } } }, ...errorResponses } },
};

paths['/v1/gateway/export/transactions'] = {
  get: { tags: ['Payment Gateway'], summary: 'Export transactions as CSV', operationId: 'gatewayExportTransactions', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, { name: 'from', in: 'query', schema: { type: 'string' } }, { name: 'to', in: 'query', schema: { type: 'string' } }, { name: 'format', in: 'query', schema: { type: 'string', default: 'csv' } }], responses: { '200': { description: 'CSV file download', content: { 'text/csv': { schema: { type: 'string' } } } }, ...errorResponses } },
};

// ─── Preauthorization (Auth + Capture) ───
paths['/v1/gateway/charges/preauth'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create preauthorized charge', description: 'Hold funds on a card without immediately capturing. Uses Stripe PaymentIntent with capture_method=manual.', operationId: 'gatewayPreauthCharge', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'amount', 'tx_ref'], properties: { merchant_id: { type: 'string', format: 'uuid' }, amount: { type: 'number', example: 50000 }, currency: { type: 'string', default: 'USD' }, customer_email: { type: 'string' }, customer_name: { type: 'string' }, tx_ref: { type: 'string' }, metadata: { type: 'object' } } } } } }, responses: { '201': { description: 'Preauthorized charge created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayCharge' } } } }, ...errorResponses } },
};

paths['/v1/gateway/charges/{chargeId}/capture'] = {
  post: { tags: ['Payment Gateway'], summary: 'Capture authorized charge', description: 'Capture a previously authorized charge (full or partial).', operationId: 'gatewayCaptureCharge', security: [{ bearerAuth: [] }], parameters: [{ name: 'chargeId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { amount: { type: 'number', description: 'Partial capture amount. Omit for full capture.' } } } } } }, responses: { '200': { description: 'Charge captured', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' }, captured_amount: { type: 'number' } } } } } }, ...errorResponses } },
};

paths['/v1/gateway/charges/{chargeId}/void'] = {
  post: { tags: ['Payment Gateway'], summary: 'Void authorized charge', description: 'Release an authorized hold without capturing.', operationId: 'gatewayVoidCharge', security: [{ bearerAuth: [] }], parameters: [{ name: 'chargeId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['charge_id'], properties: { charge_id: { type: 'string' } } } } } }, responses: { '200': { description: 'Charge voided', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', example: 'voided' } } } } } }, ...errorResponses } },
};

// ─── OTP Validation ───
paths['/v1/gateway/charges/validate'] = {
  post: { tags: ['Payment Gateway'], summary: 'Validate charge with OTP', description: 'Submit an OTP to complete a pending mobile money or card charge that requires validation.', operationId: 'gatewayValidateCharge', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['charge_id', 'otp'], properties: { charge_id: { type: 'string', format: 'uuid' }, otp: { type: 'string', example: '123456' }, flw_ref: { type: 'string', description: 'Flutterwave reference (optional, auto-resolved from charge)' } } } } } }, responses: { '200': { description: 'Charge validation result', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: ['successful', 'failed'] }, message: { type: 'string' } } } } } }, ...errorResponses } },
};

// ─── Virtual Accounts ───
paths['/v1/gateway/virtual-accounts'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create virtual account', description: 'Provision a dedicated virtual account number for pay-with-transfer collection.', operationId: 'gatewayCreateVirtualAccount', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'email'], properties: { merchant_id: { type: 'string', format: 'uuid' }, email: { type: 'string' }, bvn: { type: 'string' }, currency: { type: 'string', default: 'NGN' }, is_permanent: { type: 'boolean', default: false }, narration: { type: 'string' } } } } } }, responses: { '201': { description: 'Virtual account created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayVirtualAccount' } } } }, ...errorResponses } },
  get: { tags: ['Payment Gateway'], summary: 'List virtual accounts', operationId: 'gatewayListVirtualAccounts', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Virtual accounts list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/GatewayVirtualAccount' } } } } } } }, ...errorResponses } },
};

paths['/v1/gateway/virtual-accounts/{accountId}'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get virtual account', operationId: 'gatewayGetVirtualAccount', security: [{ bearerAuth: [] }], parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Virtual account details', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayVirtualAccount' } } } }, ...errorResponses } },
};

// ─── Merchant Wallet / Balances ───
paths['/v1/gateway/balances'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get merchant balances', description: 'Retrieve available, pending, and ledger balances across currencies.', operationId: 'gatewayGetMerchantBalance', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Merchant wallet balances', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/GatewayMerchantWallet' } } } } } } }, ...errorResponses } },
};

// ─── Bank / BVN Verification ───
paths['/v1/gateway/verify-bank-account'] = {
  post: { tags: ['Payment Gateway'], summary: 'Verify bank account', description: 'Resolve a bank account number and retrieve the account holder name.', operationId: 'gatewayVerifyBankAccount', security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['account_number', 'account_bank'], properties: { account_number: { type: 'string', example: '1234567890' }, account_bank: { type: 'string', example: '044', description: 'Bank code' } } } } } }, responses: { '200': { description: 'Account verification result', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayBankVerification' } } } }, ...errorResponses } },
};

paths['/v1/gateway/resolve-bvn'] = {
  post: { tags: ['Payment Gateway'], summary: 'Resolve BVN', description: 'Resolve a Bank Verification Number (BVN) to retrieve identity details.', operationId: 'gatewayResolveBvn', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['bvn'], properties: { bvn: { type: 'string', example: '12345678901' } } } } } }, responses: { '200': { description: 'BVN resolution result', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayBvnResolution' } } } }, ...errorResponses } },
};

// ─── Account Funding & Withdrawal ───
paths['/v1/gateway/fund-account'] = {
  post: { tags: ['Payment Gateway'], summary: 'Fund a KOB account', description: 'Add funds to a user\'s KOB account via Mobile Money, Card, or Bank Transfer. On successful provider charge, the account balance is automatically credited.', operationId: 'gatewayFundAccount', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount', 'channel', 'account_id'], properties: { amount: { type: 'number', example: 50000 }, currency: { type: 'string', default: 'XAF' }, channel: { type: 'string', enum: ['mobile_money', 'card', 'bank_transfer'] }, account_id: { type: 'string', format: 'uuid', description: 'Target KOB account to credit' }, source_phone: { type: 'string', description: 'Required for mobile_money' }, source_email: { type: 'string', description: 'Required for card' }, metadata: { type: 'object' } } } } } }, responses: { '200': { description: 'Funding charge initiated', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, account_id: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' }, channel: { type: 'string' }, provider: { type: 'string' }, status: { type: 'string' }, fee_amount: { type: 'number' }, net_amount: { type: 'number' }, tx_ref: { type: 'string' }, redirect_url: { type: 'string' }, created_at: { type: 'string' } } } } } }, ...errorResponses } },
};

paths['/v1/gateway/withdraw-to-bank'] = {
  post: { tags: ['Payment Gateway'], summary: 'Withdraw to external bank', description: 'Withdraw funds from a user\'s KOB account to an external bank account via Flutterwave. Debits the account immediately; reverses if payout fails.', operationId: 'gatewayWithdrawToBank', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount', 'account_id', 'account_number', 'beneficiary_name'], properties: { amount: { type: 'number', example: 25000 }, account_id: { type: 'string', format: 'uuid', description: 'Source KOB account to debit' }, bank_code: { type: 'string', example: 'SGCM' }, account_number: { type: 'string', example: '1234567890' }, beneficiary_name: { type: 'string', example: 'Jean Dupont' }, narration: { type: 'string' }, channel: { type: 'string', default: 'bank_transfer' } } } } } }, responses: { '200': { description: 'Withdrawal initiated', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, account_id: { type: 'string' }, amount: { type: 'number' }, fee_amount: { type: 'number' }, total_debited: { type: 'number' }, currency: { type: 'string' }, status: { type: 'string' }, beneficiary_name: { type: 'string' }, beneficiary_account: { type: 'string' }, tx_ref: { type: 'string' }, created_at: { type: 'string' } } } } } }, ...errorResponses } },
};
// ─── Internal Account Transfer ───
paths['/v1/banking/internal-transfer'] = {
  post: { tags: ['Banking Operations'], summary: 'Internal account-to-account transfer', description: 'Transfer funds between two accounts within KOB. Validates source ownership, checks balance, creates a Debit transaction, and updates balances atomically.', operationId: 'bankingInternalTransfer', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['source_account_id', 'destination_account_id', 'amount'], properties: { source_account_id: { type: 'string', format: 'uuid', description: 'Account to debit (must belong to authenticated user)' }, destination_account_id: { type: 'string', format: 'uuid', description: 'Account to credit' }, amount: { type: 'number', example: 25000 }, currency: { type: 'string', default: 'XAF' }, reference: { type: 'string', description: 'Custom reference (auto-generated if omitted)' }, description: { type: 'string', description: 'Transfer narration' } } } } } }, responses: { '200': { description: 'Transfer completed', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, transaction_reference: { type: 'string' }, transaction_id: { type: 'string', format: 'uuid' }, status: { type: 'string', example: 'Booked' }, amount: { type: 'number' }, currency: { type: 'string' } } } } } }, ...errorResponses } },
};

// ─── Facilitated Bank Transfer ───
paths['/v1/banking/facilitated-transfer'] = {
  post: { tags: ['Payment Facilitation'], summary: 'Institution-facilitated bank transfer', description: 'Initiate a bank payout facilitated by an institution through the Flutterwave rail. Institution is derived from the authenticated user and must have use_kob_flutterwave enabled. KOB fee is calculated automatically and the transaction is tagged for settlement.', operationId: 'bankingFacilitatedTransfer', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['account_bank', 'account_number', 'amount'], properties: { account_bank: { type: 'string', example: 'SGCM', description: 'Destination bank SWIFT/local code' }, account_number: { type: 'string', example: '1234567890' }, amount: { type: 'number', example: 100000 }, currency: { type: 'string', default: 'XAF' }, narration: { type: 'string', example: 'Salary payment' }, beneficiary_name: { type: 'string', example: 'Jean Dupont' }, metadata: { type: 'object', example: { invoice_id: 'INV-98765' } } } } } } }, responses: { '200': { description: 'Facilitated transfer initiated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, transaction_ref: { type: 'string' }, transaction_id: { type: 'string', format: 'uuid' }, transfer_id: { type: 'integer' }, kob_fee_amount: { type: 'number' }, net_amount: { type: 'number' }, status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] } } } } } }, ...errorResponses } },
};

// ─── Facilitated Mobile Money Charge ───
paths['/v1/banking/facilitated-mobile-money-charge'] = {
  post: { tags: ['Payment Facilitation'], summary: 'Facilitated mobile money collection', description: 'Initiate a mobile money charge using KOB\'s pre-verified Flutterwave account. The institution must have use_kob_flutterwave enabled. KOB fee is automatically calculated and the transaction is tagged for settlement.', operationId: 'facilitatedMobileMoneyCharge', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['phone_number', 'amount'], properties: { phone_number: { type: 'string', example: '237677123456', description: 'Customer phone number (E.164)' }, amount: { type: 'number', example: 5000 }, currency: { type: 'string', default: 'XAF' }, email: { type: 'string', example: 'customer@example.com' }, redirect_url: { type: 'string', example: 'https://yoursite.com/callback' }, metadata: { type: 'object', example: { order_id: 'ORD-12345' } } } } } } }, responses: { '200': { description: 'Mobile money charge initiated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, transaction_ref: { type: 'string' }, transaction_id: { type: 'string', format: 'uuid' }, flutterwave_link: { type: 'string', description: 'Payment link for customer redirect' }, kob_fee_amount: { type: 'number' }, net_amount: { type: 'number' } } } } } }, ...errorResponses } },
};

// ─── Settlement Calculate ───
paths['/v1/settlement/calculate'] = {
  post: { tags: ['Payment Facilitation'], summary: 'Calculate settlement balance', description: 'Calculate the settlement balance for the authenticated institution over a given period. Returns total inflows, outflows, KOB fees, and net settlement amount with a breakdown by payment method.', operationId: 'settlementCalculate', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { period_start: { type: 'string', format: 'date-time', description: 'Start of period (defaults to first day of current month)' }, period_end: { type: 'string', format: 'date-time', description: 'End of period (defaults to now)' } } } } } }, responses: { '200': { description: 'Settlement balance calculated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, institution_id: { type: 'string', format: 'uuid' }, institution_name: { type: 'string' }, period_start: { type: 'string' }, period_end: { type: 'string' }, total_inflows: { type: 'number' }, total_outflows: { type: 'number' }, total_kob_fees: { type: 'number' }, net_settlement_amount: { type: 'number' }, transaction_count: { type: 'integer' }, meets_minimum_threshold: { type: 'boolean' }, can_settle: { type: 'boolean' }, breakdown: { type: 'object' } } } } } }, ...errorResponses } },
};

// ─── Settlement Process ───
paths['/v1/settlement/process'] = {
  post: { tags: ['Payment Facilitation'], summary: 'Process settlement payout', description: 'Process a settlement payout for a facilitated institution. Admin-only. Debits the net settlement amount and transfers to the institution\'s configured bank or mobile money account via Flutterwave.', operationId: 'settlementProcess', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['institution_id', 'period_start', 'period_end'], properties: { institution_id: { type: 'string', format: 'uuid' }, period_start: { type: 'string', format: 'date-time' }, period_end: { type: 'string', format: 'date-time' } } } } } }, responses: { '200': { description: 'Settlement processed', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, settlement_id: { type: 'string', format: 'uuid' }, settlement_ref: { type: 'string' }, net_amount: { type: 'number' }, flutterwave_transfer_id: { type: 'integer' }, status: { type: 'string', enum: ['processing', 'completed', 'failed'] } } } } } }, ...errorResponses } },
};

// ─── Risk Scoring ───
paths['/v1/gateway/risk/score'] = {
  post: { tags: ['Payment Gateway'], summary: 'Score transaction risk', description: 'Run velocity, amount-threshold, and pattern-anomaly checks against a proposed transaction. Returns a 0–100 risk score, flags, and recommended action (allow | flag_for_review | block).', operationId: 'gatewayRiskScore', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'amount', 'channel'], properties: { merchant_id: { type: 'string', format: 'uuid' }, amount: { type: 'number', example: 500000 }, currency: { type: 'string', default: 'XAF' }, channel: { type: 'string', enum: ['mobile_money', 'card', 'bank_transfer', 'ussd'] }, customer_email: { type: 'string' }, customer_phone: { type: 'string' }, customer_ip: { type: 'string' }, metadata: { type: 'object' } } } } } }, responses: { '200': { description: 'Risk assessment result', content: { 'application/json': { schema: { type: 'object', properties: { risk_score: { type: 'integer', minimum: 0, maximum: 100, example: 35 }, risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }, flags: { type: 'array', items: { type: 'string' }, example: ['high_amount'] }, recommended_action: { type: 'string', enum: ['allow', 'flag_for_review', 'block'] }, checks: { type: 'object', properties: { velocity: { type: 'object', properties: { passed: { type: 'boolean' }, tx_count_1h: { type: 'integer' }, limit: { type: 'integer' } } }, amount_threshold: { type: 'object', properties: { passed: { type: 'boolean' }, threshold: { type: 'number' } } }, pattern_anomaly: { type: 'object', properties: { passed: { type: 'boolean' }, anomaly_type: { type: 'string' } } } } }, evaluated_at: { type: 'string', format: 'date-time' } } } } } }, ...errorResponses } },
};

// ─── Gateway Exchange Rate ───
paths['/v1/gateway/exchange-rate'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get exchange rate', description: 'Look up real-time exchange rates for multi-currency charges and settlements. Powered by Frankfurter API.', operationId: 'gatewayExchangeRate', security: [], parameters: [{ name: 'from', in: 'query', required: true, schema: { type: 'string', example: 'XAF' }, description: 'Source currency (ISO 4217)' }, { name: 'to', in: 'query', required: true, schema: { type: 'string', example: 'USD' }, description: 'Target currency (ISO 4217)' }, { name: 'amount', in: 'query', schema: { type: 'number', default: 1 }, description: 'Amount to convert' }], responses: { '200': { description: 'Exchange rate result', content: { 'application/json': { schema: { type: 'object', properties: { from: { type: 'string', example: 'XAF' }, to: { type: 'string', example: 'USD' }, rate: { type: 'number', example: 0.0016 }, amount: { type: 'number', example: 100000 }, converted: { type: 'number', example: 160.00 }, timestamp: { type: 'string', format: 'date-time' }, source: { type: 'string', example: 'frankfurter' } } } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT LINKS
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/gateway/payment-links'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create payment link', operationId: 'gatewayCreatePaymentLink', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'name', 'amount'], properties: { merchant_id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string', default: 'XAF' }, redirect_url: { type: 'string' }, max_uses: { type: 'integer' }, expires_at: { type: 'string', format: 'date-time' } } } } } }, responses: { '201': { description: 'Payment link created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayPaymentLink' } } } }, ...errorResponses } },
  get: { tags: ['Payment Gateway'], summary: 'List payment links', operationId: 'gatewayListPaymentLinks', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, { name: 'slug', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: listResponse('GatewayPaymentLink', 'Payment links') },
};

paths['/v1/gateway/payment-links/{linkId}'] = {
  put: { tags: ['Payment Gateway'], summary: 'Update payment link', operationId: 'gatewayUpdatePaymentLink', security: [{ bearerAuth: [] }], parameters: [{ name: 'linkId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, amount: { type: 'number' }, status: { type: 'string' }, redirect_url: { type: 'string' } } } } } }, responses: { '200': { description: 'Payment link updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayPaymentLink' } } } }, ...errorResponses } },
  delete: { tags: ['Payment Gateway'], summary: 'Delete payment link', operationId: 'gatewayDeletePaymentLink', security: [{ bearerAuth: [] }], parameters: [{ name: 'linkId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '204': { description: 'Payment link deleted' }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT PLANS
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/gateway/payment-plans'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create payment plan', operationId: 'gatewayCreatePaymentPlan', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'name', 'amount', 'interval'], properties: { merchant_id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string', default: 'XAF' }, interval: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] }, duration: { type: 'integer' } } } } } }, responses: { '201': { description: 'Plan created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayPaymentPlan' } } } }, ...errorResponses } },
  get: { tags: ['Payment Gateway'], summary: 'List payment plans', operationId: 'gatewayListPaymentPlans', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: listResponse('GatewayPaymentPlan', 'Payment plans') },
};

paths['/v1/gateway/payment-plans/{planId}'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get payment plan', operationId: 'gatewayGetPaymentPlan', security: [{ bearerAuth: [] }], parameters: [{ name: 'planId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Plan details', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayPaymentPlan' } } } }, ...errorResponses } },
  put: { tags: ['Payment Gateway'], summary: 'Update payment plan', operationId: 'gatewayUpdatePaymentPlan', security: [{ bearerAuth: [] }], parameters: [{ name: 'planId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, amount: { type: 'number' }, status: { type: 'string' } } } } } }, responses: { '200': { description: 'Plan updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayPaymentPlan' } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/gateway/subscriptions'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create subscription', operationId: 'gatewayCreateSubscription', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['plan_id', 'customer_email'], properties: { plan_id: { type: 'string', format: 'uuid' }, customer_email: { type: 'string' }, customer_phone: { type: 'string' }, token_id: { type: 'string', description: 'Saved payment token for recurring charges' }, metadata: { type: 'object' } } } } } }, responses: { '201': { description: 'Subscription created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewaySubscription' } } } }, ...errorResponses } },
  get: { tags: ['Payment Gateway'], summary: 'List subscriptions', operationId: 'gatewayListSubscriptions', security: [{ bearerAuth: [] }], parameters: [{ name: 'plan_id', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: listResponse('GatewaySubscription', 'Subscriptions') },
};

paths['/v1/gateway/subscriptions/{subscriptionId}'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get subscription', operationId: 'gatewayGetSubscription', security: [{ bearerAuth: [] }], parameters: [{ name: 'subscriptionId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Subscription details', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewaySubscription' } } } }, ...errorResponses } },
};

paths['/v1/gateway/subscriptions/cancel'] = {
  post: { tags: ['Payment Gateway'], summary: 'Cancel subscription', operationId: 'gatewayCancelSubscription', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['subscription_id'], properties: { subscription_id: { type: 'string', format: 'uuid' }, reason: { type: 'string' } } } } } }, responses: { '200': { description: 'Subscription cancelled', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewaySubscription' } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// SUBACCOUNTS / SPLIT PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/gateway/subaccounts'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create subaccount', operationId: 'gatewayCreateSubaccount', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'business_name', 'settlement_bank', 'account_number'], properties: { merchant_id: { type: 'string', format: 'uuid' }, business_name: { type: 'string' }, settlement_bank: { type: 'string' }, account_number: { type: 'string' }, split_type: { type: 'string', enum: ['percentage', 'flat'] }, split_value: { type: 'number' }, country: { type: 'string', default: 'CM' } } } } } }, responses: { '201': { description: 'Subaccount created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewaySubaccount' } } } }, ...errorResponses } },
  get: { tags: ['Payment Gateway'], summary: 'List subaccounts', operationId: 'gatewayListSubaccounts', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: listResponse('GatewaySubaccount', 'Subaccounts') },
};

paths['/v1/gateway/subaccounts/{subaccountId}'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get subaccount', operationId: 'gatewayGetSubaccount', security: [{ bearerAuth: [] }], parameters: [{ name: 'subaccountId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Subaccount details', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewaySubaccount' } } } }, ...errorResponses } },
  put: { tags: ['Payment Gateway'], summary: 'Update subaccount', operationId: 'gatewayUpdateSubaccount', security: [{ bearerAuth: [] }], parameters: [{ name: 'subaccountId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { business_name: { type: 'string' }, split_type: { type: 'string' }, split_value: { type: 'number' } } } } } }, responses: { '200': { description: 'Subaccount updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewaySubaccount' } } } }, ...errorResponses } },
  delete: { tags: ['Payment Gateway'], summary: 'Delete subaccount', operationId: 'gatewayDeleteSubaccount', security: [{ bearerAuth: [] }], parameters: [{ name: 'subaccountId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '204': { description: 'Subaccount deleted' }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMERS & TOKENIZATION
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/gateway/customers'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create customer', operationId: 'gatewayCreateCustomer', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'email'], properties: { merchant_id: { type: 'string', format: 'uuid' }, email: { type: 'string' }, phone: { type: 'string' }, name: { type: 'string' }, metadata: { type: 'object' } } } } } }, responses: { '201': { description: 'Customer created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayCustomer' } } } }, ...errorResponses } },
  get: { tags: ['Payment Gateway'], summary: 'List customers', operationId: 'gatewayListCustomers', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: listResponse('GatewayCustomer', 'Customers') },
};

paths['/v1/gateway/customers/{customerId}'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get customer', operationId: 'gatewayGetCustomer', security: [{ bearerAuth: [] }], parameters: [{ name: 'customerId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Customer details', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayCustomer' } } } }, ...errorResponses } },
  put: { tags: ['Payment Gateway'], summary: 'Update customer', operationId: 'gatewayUpdateCustomer', security: [{ bearerAuth: [] }], parameters: [{ name: 'customerId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, phone: { type: 'string' }, name: { type: 'string' }, metadata: { type: 'object' } } } } } }, responses: { '200': { description: 'Customer updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayCustomer' } } } }, ...errorResponses } },
};

paths['/v1/gateway/customers/{customerId}/tokens'] = {
  get: { tags: ['Payment Gateway'], summary: 'List customer tokens', operationId: 'gatewayListCustomerTokens', security: [{ bearerAuth: [] }], parameters: [{ name: 'customerId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Customer payment tokens', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/GatewayCustomerToken' } } } } } } }, ...errorResponses } },
};

paths['/v1/gateway/customers/{customerId}/tokens/{tokenId}'] = {
  delete: { tags: ['Payment Gateway'], summary: 'Revoke customer token', operationId: 'gatewayRevokeCustomerToken', security: [{ bearerAuth: [] }], parameters: [{ name: 'customerId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'tokenId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '204': { description: 'Token revoked' }, ...errorResponses } },
};

paths['/v1/gateway/charges/token'] = {
  post: { tags: ['Payment Gateway'], summary: 'Charge a saved token', operationId: 'gatewayChargeToken', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['token_id', 'amount', 'tx_ref'], properties: { token_id: { type: 'string', format: 'uuid' }, amount: { type: 'number' }, currency: { type: 'string', default: 'XAF' }, tx_ref: { type: 'string' }, metadata: { type: 'object' } } } } } }, responses: { '201': { description: 'Token charge created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayCharge' } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// CHARGE EVENTS
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/gateway/charges/{chargeId}/events'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get charge events', description: 'Retrieve the full event timeline for a charge.', operationId: 'gatewayGetChargeEvents', security: [{ bearerAuth: [] }], parameters: [{ name: 'chargeId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Charge event timeline', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/GatewayChargeEvent' } } } } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// RECONCILIATION
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/gateway/reconciliation'] = {
  post: { tags: ['Payment Gateway'], summary: 'Run reconciliation', operationId: 'gatewayRunReconciliation', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'period_start', 'period_end'], properties: { merchant_id: { type: 'string', format: 'uuid' }, period_start: { type: 'string', format: 'date' }, period_end: { type: 'string', format: 'date' }, provider: { type: 'string', enum: ['flutterwave', 'stripe', 'paypal'], description: 'Payment provider to reconcile against' } } } } } }, responses: { '200': { description: 'Reconciliation started', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayReconciliationRun' } } } }, ...errorResponses } },
  get: { tags: ['Payment Gateway'], summary: 'List reconciliation runs', operationId: 'gatewayListReconciliationRuns', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: listResponse('GatewayReconciliationRun', 'Reconciliation runs') },
};

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS — FEES
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/gateway/reports/fees'] = {
  get: { tags: ['Payment Gateway'], summary: 'Fee report', operationId: 'gatewayReportFees', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, { name: 'from', in: 'query', schema: { type: 'string' } }, { name: 'to', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'Fee report with totals by channel', content: { 'application/json': { schema: { type: 'object', properties: { total_fees: { type: 'number' }, by_channel: { type: 'object', additionalProperties: { type: 'number' } }, period: { type: 'string' } } } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// PAYOUT RETRY
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/gateway/payouts/{payoutId}/retry'] = {
  post: { tags: ['Payment Gateway'], summary: 'Retry failed payout', operationId: 'gatewayRetryPayout', security: [{ bearerAuth: [] }], parameters: [{ name: 'payoutId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], responses: { '200': { description: 'Payout retried', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayPayout' } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// MERCHANT ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/merchants'] = {
  post: { tags: ['Merchant Onboarding'], summary: 'Create merchant', operationId: 'merchantCreate', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['business_name', 'business_type', 'contact_email'], properties: { business_name: { type: 'string' }, business_type: { type: 'string' }, contact_email: { type: 'string' }, contact_phone: { type: 'string' }, country: { type: 'string', default: 'CM' }, action: { type: 'string', enum: ['create', 'submit', 'activate', 'suspend'], default: 'create' } } } } } }, responses: { '201': { description: 'Merchant created', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayMerchant' } } } }, ...errorResponses } },
  get: { tags: ['Merchant Onboarding'], summary: 'List merchants', operationId: 'merchantList', security: [{ bearerAuth: [] }], parameters: [{ name: 'status', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: listResponse('GatewayMerchant', 'Merchants') },
  patch: { tags: ['Merchant Onboarding'], summary: 'Update merchant', operationId: 'merchantUpdate', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { merchant_id: { type: 'string' }, business_name: { type: 'string' }, contact_email: { type: 'string' }, logo_url: { type: 'string' } } } } } }, responses: { '200': { description: 'Merchant updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayMerchant' } } } }, ...errorResponses } },
};

paths['/v1/merchants/kyb'] = {
  post: { tags: ['Merchant Onboarding'], summary: 'Submit KYB verification', operationId: 'merchantSubmitKyb', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id'], properties: { merchant_id: { type: 'string' }, registration_number: { type: 'string' }, tax_id: { type: 'string' }, documents: { type: 'array', items: { type: 'object' } } } } } } }, responses: { '200': successResult('KYB submitted'), ...errorResponses } },
  get: { tags: ['Merchant Onboarding'], summary: 'Get KYB status', operationId: 'merchantGetKyb', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'KYB verification status', content: { 'application/json': { schema: { type: 'object', properties: { merchant_id: { type: 'string' }, kyb_status: { type: 'string', enum: ['not_submitted', 'pending', 'approved', 'rejected'] }, submitted_at: { type: 'string', format: 'date-time' }, reviewed_at: { type: 'string', format: 'date-time' } } } } } }, ...errorResponses } },
};

paths['/v1/merchants/api-keys'] = {
  post: { tags: ['Merchant Onboarding'], summary: 'Issue API key', operationId: 'merchantIssueApiKey', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id'], properties: { merchant_id: { type: 'string' }, environment: { type: 'string', enum: ['sandbox', 'production'] } } } } } }, responses: { '201': { description: 'API key issued', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, public_key: { type: 'string' }, secret_key: { type: 'string', description: 'Shown only once' }, environment: { type: 'string' }, label: { type: 'string' } } } } } }, ...errorResponses } },
  get: { tags: ['Merchant Onboarding'], summary: 'List API keys', operationId: 'merchantListApiKeys', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'API keys list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, public_key: { type: 'string' }, environment: { type: 'string' }, label: { type: 'string' }, is_active: { type: 'boolean' }, created_at: { type: 'string', format: 'date-time' } } } } } } } } }, ...errorResponses } },
  delete: { tags: ['Merchant Onboarding'], summary: 'Revoke API key', operationId: 'merchantRevokeApiKey', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['key_id'], properties: { key_id: { type: 'string' } } } } } }, responses: { '204': { description: 'API key revoked' }, ...errorResponses } },
};

paths['/v1/merchants/settlement-accounts'] = {
  post: { tags: ['Merchant Onboarding'], summary: 'Add settlement account', operationId: 'merchantAddSettlementAccount', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'account_number', 'bank_code'], properties: { merchant_id: { type: 'string' }, account_number: { type: 'string' }, bank_code: { type: 'string' }, bank_name: { type: 'string' }, currency: { type: 'string', default: 'XAF' } } } } } }, responses: { '201': successResult('Settlement account added'), ...errorResponses } },
  get: { tags: ['Merchant Onboarding'], summary: 'List settlement accounts', operationId: 'merchantListSettlementAccounts', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Settlement accounts', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, account_number: { type: 'string' }, bank_name: { type: 'string' }, currency: { type: 'string' }, is_primary: { type: 'boolean' } } } } } } } } }, ...errorResponses } },
};

paths['/v1/merchants/webhooks'] = {
  post: { tags: ['Merchant Onboarding'], summary: 'Register merchant webhook', operationId: 'merchantRegisterWebhook', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'url', 'events'], properties: { merchant_id: { type: 'string' }, url: { type: 'string', format: 'uri' }, events: { type: 'array', items: { type: 'string' } } } } } } }, responses: { '201': { description: 'Webhook registered' }, ...errorResponses } },
  get: { tags: ['Merchant Onboarding'], summary: 'List merchant webhooks', operationId: 'merchantListWebhooks', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Merchant webhooks', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Webhook' } } } } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// OAUTH REVOCATION & USERINFO
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/oauth/revoke'] = {
  post: { tags: ['OAuth'], summary: 'Revoke token', description: 'Revoke an access or refresh token (RFC 7009). Always returns 200.', operationId: 'oauthRevoke', security: [], requestBody: { required: true, content: { 'application/x-www-form-urlencoded': { schema: { type: 'object', required: ['token', 'client_id', 'client_secret'], properties: { token: { type: 'string' }, token_type_hint: { type: 'string', enum: ['access_token', 'refresh_token'] }, client_id: { type: 'string' }, client_secret: { type: 'string' } } } } } }, responses: { '200': { description: 'Token revoked (or was already invalid)' }, ...errorResponses } },
};

paths['/v1/oauth/userinfo'] = {
  get: { tags: ['OAuth'], summary: 'Get user info', description: 'OpenID Connect UserInfo endpoint. Returns claims about the authenticated user based on the access token scope.', operationId: 'oauthUserInfo', security: [{ bearerAuth: [] }], responses: { '200': { description: 'User claims', content: { 'application/json': { schema: { type: 'object', properties: { sub: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, phone_number: { type: 'string' }, updated_at: { type: 'integer' } } } } } }, '401': { description: 'Invalid or expired token' }, '403': { description: 'Token missing openid scope' } } },
};

// ═══════════════════════════════════════════════════════════════════════════
// CONSUMER TOOLS — PIGGY BANK
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/consumer/piggybank'] = {
  post: { tags: ['Consumer Tools'], summary: 'Create savings goal', description: 'Create a personal savings goal (Piggy Bank) with target amount and schedule.', operationId: 'piggybankCreate', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'target_amount', 'currency'], properties: { name: { type: 'string', example: 'Emergency Fund' }, target_amount: { type: 'number', example: 500000 }, currency: { type: 'string', default: 'XAF' }, frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] }, contribution_amount: { type: 'number', example: 10000 }, target_date: { type: 'string', format: 'date' } } } } } }, responses: { '201': { description: 'Piggy bank created' }, ...errorResponses } },
};

paths['/v1/consumer/piggybank/pay'] = {
  post: { tags: ['Consumer Tools'], summary: 'Make piggy bank payment', description: 'Contribute to a savings goal. Impacts credit score positively (+3 to +10 points for on-time payments).', operationId: 'piggybankPay', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['piggybank_id', 'amount'], properties: { piggybank_id: { type: 'string', format: 'uuid' }, amount: { type: 'number', example: 10000 } } } } } }, responses: { '200': { description: 'Payment recorded' }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// CONSUMER TOOLS — NJANGI (GROUP SAVINGS)
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/consumer/njangi'] = {
  post: { tags: ['Consumer Tools'], summary: 'Create Njangi group', description: 'Create a rotating savings circle (Njangi/tontine) with contribution schedule and payout rules.', operationId: 'njangiCreate', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'contribution_amount', 'frequency'], properties: { name: { type: 'string', example: 'Office Njangi' }, contribution_amount: { type: 'number', example: 25000 }, currency: { type: 'string', default: 'XAF' }, frequency: { type: 'string', enum: ['weekly', 'monthly'] }, max_members: { type: 'integer', example: 10 }, payout_method: { type: 'string', enum: ['random', 'sequential', 'manual'], default: 'random' } } } } } }, responses: { '201': { description: 'Njangi group created' }, ...errorResponses } },
};

paths['/v1/consumer/njangi/join'] = {
  post: { tags: ['Consumer Tools'], summary: 'Join Njangi group', operationId: 'njangiJoin', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['group_id'], properties: { group_id: { type: 'string', format: 'uuid' } } } } } }, responses: { '200': successResult('Joined group'), ...errorResponses } },
};

paths['/v1/consumer/njangi/contribute'] = {
  post: { tags: ['Consumer Tools'], summary: 'Make Njangi contribution', description: 'Submit a contribution to the group pot. Late contributions are reported as negative credit events.', operationId: 'njangiContribute', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['group_id', 'amount'], properties: { group_id: { type: 'string', format: 'uuid' }, amount: { type: 'number', example: 25000 } } } } } }, responses: { '200': successResult('Contribution recorded'), ...errorResponses } },
};

paths['/v1/consumer/njangi/payout'] = {
  post: { tags: ['Consumer Tools'], summary: 'Trigger Njangi payout', description: 'Disburse the accumulated pot to the next eligible member.', operationId: 'njangiPayout', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['group_id'], properties: { group_id: { type: 'string', format: 'uuid' }, recipient_id: { type: 'string', format: 'uuid', description: 'Override random selection (manual mode only)' } } } } } }, responses: { '200': successResult('Payout initiated'), ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// FUNDING INTENTS
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/gateway/funding-intents'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create funding intent', description: 'Create an intent to fund a merchant or user account. Supports Stripe, PayPal, and mobile money sources.', operationId: 'gatewayCreateFundingIntent', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount', 'currency', 'source'], properties: { amount: { type: 'number', example: 50000 }, currency: { type: 'string', default: 'XAF' }, source: { type: 'string', enum: ['stripe', 'paypal', 'mobile_money'] }, metadata: { type: 'object' } } } } } }, responses: { '201': { description: 'Funding intent created', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, amount: { type: 'number' }, currency: { type: 'string' }, source: { type: 'string' }, status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled', 'failed'] }, redirect_url: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } } } } } }, ...errorResponses } },
  get: { tags: ['Payment Gateway'], summary: 'List funding intents', operationId: 'gatewayListFundingIntents', security: [{ bearerAuth: [] }], parameters: [{ name: 'status', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: { '200': { description: 'Funding intents list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' }, source: { type: 'string' }, status: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
};

paths['/v1/gateway/funding-intents/{intentId}'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get funding intent', operationId: 'gatewayGetFundingIntent', security: [{ bearerAuth: [] }], parameters: [{ name: 'intentId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Funding intent details', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' }, source: { type: 'string' }, status: { type: 'string' }, redirect_url: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } } } } } }, ...errorResponses } },
};

paths['/v1/gateway/funding-intents/{intentId}/cancel'] = {
  post: { tags: ['Payment Gateway'], summary: 'Cancel funding intent', operationId: 'gatewayCancelFundingIntent', security: [{ bearerAuth: [] }], parameters: [{ name: 'intentId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': successResult('Funding intent cancelled'), ...errorResponses } },
};

paths['/v1/gateway/funding-intents/{intentId}/confirm'] = {
  post: { tags: ['Payment Gateway'], summary: 'Confirm funding intent', description: 'Confirm a funding intent after provider payment succeeds.', operationId: 'gatewayConfirmFundingIntent', security: [{ bearerAuth: [] }], parameters: [{ name: 'intentId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': successResult('Funding confirmed and account credited'), ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// TELLER OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/teller/transaction'] = {
  post: { tags: ['Banking Operations'], summary: 'Teller transaction', description: 'Process a cash deposit or withdrawal at a bank branch by an authorized teller.', operationId: 'tellerTransaction', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['account_id', 'amount', 'transaction_type'], properties: { account_id: { type: 'string', format: 'uuid' }, amount: { type: 'number', example: 100000 }, currency: { type: 'string', default: 'XAF' }, transaction_type: { type: 'string', enum: ['deposit', 'withdrawal'] }, narration: { type: 'string' }, branch_id: { type: 'string', format: 'uuid' } } } } } }, responses: { '200': { description: 'Transaction processed', content: { 'application/json': { schema: { type: 'object', properties: { transaction_id: { type: 'string', format: 'uuid' }, status: { type: 'string' }, amount: { type: 'number' }, balance_after: { type: 'number' } } } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// OPERATIONAL CONTROLS — Withdrawal Policies & Staff Authorization
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/admin/withdrawal-policies'] = {
  get: { tags: ['Operational Controls'], summary: 'List withdrawal policies', operationId: 'listWithdrawalPolicies', security: [{ bearerAuth: [] }], parameters: [{ name: 'institution_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Withdrawal policies list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, role_type: { type: 'string' }, single_txn_limit: { type: 'number' }, daily_total_limit: { type: 'number' }, status: { type: 'string' } } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
  post: { tags: ['Operational Controls'], summary: 'Create withdrawal policy', operationId: 'createWithdrawalPolicy', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['institution_id', 'role_type', 'single_txn_limit', 'daily_total_limit'], properties: { institution_id: { type: 'string', format: 'uuid' }, branch_id: { type: 'string', format: 'uuid' }, currency: { type: 'string', default: 'XAF' }, channel: { type: 'string' }, role_type: { type: 'string', enum: ['teller', 'assistant_manager', 'branch_manager', 'general_manager'] }, single_txn_limit: { type: 'number', example: 500000 }, daily_total_limit: { type: 'number', example: 5000000 }, auto_approve_threshold: { type: 'number', example: 100000 }, requires_dual_approval_above: { type: 'number' }, escalation_target_role: { type: 'string', enum: ['assistant_manager', 'branch_manager', 'general_manager'] }, can_override_lower_role: { type: 'boolean' }, effective_from: { type: 'string', format: 'date' }, effective_to: { type: 'string', format: 'date' } } } } } }, responses: { '201': successResult('Policy created'), ...errorResponses } },
};

paths['/v1/admin/withdrawal-policies/{policyId}'] = {
  get: { tags: ['Operational Controls'], summary: 'Get withdrawal policy', operationId: 'getWithdrawalPolicy', security: [{ bearerAuth: [] }], parameters: [{ name: 'policyId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Policy details', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, role_type: { type: 'string' }, single_txn_limit: { type: 'number' }, daily_total_limit: { type: 'number' }, auto_approve_threshold: { type: 'number' }, status: { type: 'string' } } } } } }, ...errorResponses } },
  patch: { tags: ['Operational Controls'], summary: 'Update withdrawal policy', operationId: 'updateWithdrawalPolicy', security: [{ bearerAuth: [] }], parameters: [{ name: 'policyId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { single_txn_limit: { type: 'number' }, daily_total_limit: { type: 'number' }, status: { type: 'string' }, effective_to: { type: 'string', format: 'date' } } } } } }, responses: { '200': successResult('Policy updated'), ...errorResponses } },
};

paths['/v1/admin/staff/authorizations'] = {
  get: { tags: ['Operational Controls'], summary: 'List staff authorizations', operationId: 'listStaffAuthorizations', security: [{ bearerAuth: [] }], parameters: [{ name: 'institution_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Staff authorizations', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, user_id: { type: 'string' }, role_type: { type: 'string' }, status: { type: 'string' } } } } } } } } }, ...errorResponses } },
  post: { tags: ['Operational Controls'], summary: 'Create staff authorization', operationId: 'createStaffAuthorization', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['institution_id', 'user_id', 'role_type'], properties: { institution_id: { type: 'string', format: 'uuid' }, branch_id: { type: 'string', format: 'uuid' }, user_id: { type: 'string', format: 'uuid' }, role_type: { type: 'string', enum: ['teller', 'assistant_manager', 'branch_manager', 'general_manager'] }, max_override_limit: { type: 'number' }, can_approve_overdraft: { type: 'boolean' }, can_approve_withdrawal_override: { type: 'boolean' }, can_suspend_overdraft: { type: 'boolean' } } } } } }, responses: { '201': successResult('Authorization created'), ...errorResponses } },
};

paths['/v1/admin/staff/authorizations/{authorizationId}'] = {
  get: { tags: ['Operational Controls'], summary: 'Get staff authorization', operationId: 'getStaffAuthorization', security: [{ bearerAuth: [] }], parameters: [{ name: 'authorizationId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Authorization details', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, user_id: { type: 'string' }, role_type: { type: 'string' }, max_override_limit: { type: 'number' }, status: { type: 'string' } } } } } }, ...errorResponses } },
  patch: { tags: ['Operational Controls'], summary: 'Update staff authorization', operationId: 'updateStaffAuthorization', security: [{ bearerAuth: [] }], parameters: [{ name: 'authorizationId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { max_override_limit: { type: 'number' }, can_approve_overdraft: { type: 'boolean' }, can_approve_withdrawal_override: { type: 'boolean' }, status: { type: 'string' } } } } } }, responses: { '200': successResult('Authorization updated'), ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// APPROVAL WORKFLOWS
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/banking/withdrawal-requests'] = {
  post: { tags: ['Approval Workflows'], summary: 'Create withdrawal request', description: 'Create a withdrawal request. If the amount exceeds the staff member\'s policy limit, the request is automatically routed into the approval workflow.', operationId: 'createWithdrawalRequest', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['institution_id', 'account_id', 'amount'], properties: { institution_id: { type: 'string', format: 'uuid' }, branch_id: { type: 'string', format: 'uuid' }, account_id: { type: 'string', format: 'uuid' }, amount: { type: 'number', example: 2000000 }, currency: { type: 'string', default: 'XAF' }, channel: { type: 'string', default: 'branch' }, reason: { type: 'string' } } } } } }, responses: { '200': { description: 'Request auto-approved and executed' }, '202': { description: 'Request requires manager approval', content: { 'application/json': { schema: { type: 'object', properties: { requires_approval: { type: 'boolean', example: true }, withdrawal_request_id: { type: 'string', format: 'uuid' }, approval_status: { type: 'string' }, pending_role: { type: 'string' } } } } } }, ...errorResponses } },
  get: { tags: ['Approval Workflows'], summary: 'List withdrawal requests', operationId: 'listWithdrawalRequests', security: [{ bearerAuth: [] }], parameters: [{ name: 'institution_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } }, { name: 'status', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: { '200': { description: 'Withdrawal requests', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, account_id: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' }, status: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
};

paths['/v1/banking/withdrawal-requests/{requestId}'] = {
  get: { tags: ['Approval Workflows'], summary: 'Get withdrawal request', operationId: 'getWithdrawalRequest', security: [{ bearerAuth: [] }], parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Withdrawal request details', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, account_id: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' }, status: { type: 'string' }, approval_id: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } } } } } }, ...errorResponses } },
};

paths['/v1/banking/withdrawal-requests/{requestId}/submit'] = {
  post: { tags: ['Approval Workflows'], summary: 'Submit draft withdrawal request', operationId: 'submitWithdrawalRequest', security: [{ bearerAuth: [] }], parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': successResult('Request submitted'), ...errorResponses } },
};

paths['/v1/banking/withdrawal-requests/{requestId}/cancel'] = {
  post: { tags: ['Approval Workflows'], summary: 'Cancel withdrawal request', operationId: 'cancelWithdrawalRequest', security: [{ bearerAuth: [] }], parameters: [{ name: 'requestId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string' } } } } } }, responses: { '200': successResult('Request cancelled'), ...errorResponses } },
};

paths['/v1/banking/approvals'] = {
  get: { tags: ['Approval Workflows'], summary: 'List approval requests', operationId: 'listApprovals', security: [{ bearerAuth: [] }], parameters: [{ name: 'institution_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } }, { name: 'status', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: { '200': { description: 'Approval requests with action history', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, entity_type: { type: 'string' }, status: { type: 'string' }, submitted_by: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
};

paths['/v1/banking/approvals/{approvalId}'] = {
  get: { tags: ['Approval Workflows'], summary: 'Get approval request', operationId: 'getApproval', security: [{ bearerAuth: [] }], parameters: [{ name: 'approvalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Approval with full action audit trail', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, entity_type: { type: 'string' }, entity_id: { type: 'string' }, status: { type: 'string' }, actions: { type: 'array', items: { type: 'object', properties: { action: { type: 'string' }, acted_by: { type: 'string' }, comments: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } } } } } } } } }, ...errorResponses } },
};

paths['/v1/banking/approvals/{approvalId}/approve'] = {
  post: { tags: ['Approval Workflows'], summary: 'Approve request', description: 'Approve a pending request. The approver must have the required operational role. If the entity is a withdrawal, it is automatically executed after approval.', operationId: 'approveRequest', security: [{ bearerAuth: [] }], parameters: [{ name: 'approvalId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { comments: { type: 'string' } } } } } }, responses: { '200': successResult('Approved (and executed if withdrawal)'), ...errorResponses } },
};

paths['/v1/banking/approvals/{approvalId}/reject'] = {
  post: { tags: ['Approval Workflows'], summary: 'Reject request', operationId: 'rejectRequest', security: [{ bearerAuth: [] }], parameters: [{ name: 'approvalId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' }, comments: { type: 'string' } } } } } }, responses: { '200': successResult('Rejected'), ...errorResponses } },
};

paths['/v1/banking/approvals/{approvalId}/escalate'] = {
  post: { tags: ['Approval Workflows'], summary: 'Escalate to higher authority', operationId: 'escalateRequest', security: [{ bearerAuth: [] }], parameters: [{ name: 'approvalId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { target_role: { type: 'string', enum: ['branch_manager', 'general_manager'] }, comments: { type: 'string' } } } } } }, responses: { '200': successResult('Escalated'), ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// OVERDRAFT
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/accounts/{accountId}/overdraft'] = {
  get: { tags: ['Overdraft'], summary: 'Get overdraft profile', description: 'Returns overdraft eligibility, approved limit, utilised and available amounts, risk band, and score factors.', operationId: 'getOverdraftProfile', security: [{ bearerAuth: [] }], parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Overdraft profile with score factors', content: { 'application/json': { schema: { type: 'object', properties: { eligible: { type: 'boolean' }, recommended_limit: { type: 'number', example: 250000 }, approved_limit: { type: 'number', example: 200000 }, utilised_amount: { type: 'number', example: 50000 }, available_amount: { type: 'number', example: 150000 }, risk_band: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'] }, status: { type: 'string', enum: ['active', 'suspended', 'revoked', 'pending_approval', 'inactive'] } } } } } }, ...errorResponses } },
};

paths['/v1/accounts/{accountId}/overdraft/recalculate'] = {
  post: { tags: ['Overdraft'], summary: 'Recalculate overdraft eligibility', description: 'Re-evaluates account behavior (salary consistency, savings, balance, tenure, activity, repayment history, credit score) and produces an explainable overdraft recommendation.', operationId: 'recalculateOverdraft', security: [{ bearerAuth: [] }], parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Recalculated overdraft profile with score factor breakdown', content: { 'application/json': { schema: { type: 'object', properties: { eligible: { type: 'boolean' }, recommended_limit: { type: 'number' }, risk_band: { type: 'string' }, score_factors: { type: 'object' } } } } } }, ...errorResponses } },
};

paths['/v1/accounts/{accountId}/overdraft/request'] = {
  post: { tags: ['Overdraft'], summary: 'Request overdraft facility', description: 'Request an overdraft. Automatically scores the account and either auto-approves (high score) or routes to manager approval.', operationId: 'requestOverdraft', security: [{ bearerAuth: [] }], parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { requested_limit: { type: 'number', example: 300000 } } } } } }, responses: { '200': { description: 'Auto-approved' }, '202': { description: 'Pending manager approval' }, ...errorResponses } },
};

paths['/v1/accounts/{accountId}/overdraft/approve'] = {
  post: { tags: ['Overdraft'], summary: 'Approve overdraft', operationId: 'approveOverdraft', security: [{ bearerAuth: [] }], parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['approved_limit'], properties: { approved_limit: { type: 'number', example: 200000 }, comments: { type: 'string' } } } } } }, responses: { '200': { description: 'Overdraft approved and activated' }, ...errorResponses } },
};

paths['/v1/accounts/{accountId}/overdraft/suspend'] = {
  post: { tags: ['Overdraft'], summary: 'Suspend overdraft', operationId: 'suspendOverdraft', security: [{ bearerAuth: [] }], parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } } } }, responses: { '200': { description: 'Overdraft suspended' }, ...errorResponses } },
};

paths['/v1/accounts/{accountId}/overdraft/revoke'] = {
  post: { tags: ['Overdraft'], summary: 'Revoke overdraft', operationId: 'revokeOverdraft', security: [{ bearerAuth: [] }], parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } } } }, responses: { '200': { description: 'Overdraft revoked' }, ...errorResponses } },
};

paths['/v1/accounts/{accountId}/overdraft/reinstate'] = {
  post: { tags: ['Overdraft'], summary: 'Reinstate overdraft', operationId: 'reinstateOverdraft', security: [{ bearerAuth: [] }], parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { new_limit: { type: 'number' }, comments: { type: 'string' } } } } } }, responses: { '200': { description: 'Overdraft reinstated' }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// WALLETS (Phase 6)
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/wallets'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create custodial wallet', operationId: 'walletCreate', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['currency'], properties: { currency: { type: 'string', default: 'XAF' }, label: { type: 'string' }, metadata: { type: 'object' } } } } } }, responses: { '201': { description: 'Wallet created' }, ...errorResponses } },
  get: { tags: ['Payment Gateway'], summary: 'List wallets', operationId: 'walletList', security: [{ bearerAuth: [] }], parameters: [...paginationParams], responses: { '200': { description: 'Wallets list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/GatewayMerchantWallet' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
};

paths['/v1/wallets/{walletId}'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get wallet balance', operationId: 'walletGet', security: [{ bearerAuth: [] }], parameters: [{ name: 'walletId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Wallet with Available, Pending, Ledger balances', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayMerchantWallet' } } } }, ...errorResponses } },
};

paths['/v1/wallets/{walletId}/credit'] = {
  post: { tags: ['Payment Gateway'], summary: 'Credit wallet', operationId: 'walletCredit', security: [{ bearerAuth: [] }], parameters: [{ name: 'walletId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount', 'currency'], properties: { amount: { type: 'number' }, currency: { type: 'string' }, description: { type: 'string' } } } } } }, responses: { '200': { description: 'Wallet credited' }, ...errorResponses } },
};

paths['/v1/wallets/{walletId}/debit'] = {
  post: { tags: ['Payment Gateway'], summary: 'Debit wallet', operationId: 'walletDebit', security: [{ bearerAuth: [] }], parameters: [{ name: 'walletId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount', 'currency'], properties: { amount: { type: 'number' }, currency: { type: 'string' }, description: { type: 'string' } } } } } }, responses: { '200': { description: 'Wallet debited' }, ...errorResponses } },
};

paths['/v1/wallets/{walletId}/freeze'] = {
  post: { tags: ['Payment Gateway'], summary: 'Freeze/unfreeze wallet', operationId: 'walletFreeze', security: [{ bearerAuth: [] }], parameters: [{ name: 'walletId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['action'], properties: { action: { type: 'string', enum: ['freeze', 'unfreeze'] }, reason: { type: 'string' } } } } } }, responses: { '200': { description: 'Wallet frozen/unfrozen' }, ...errorResponses } },
};

paths['/v1/wallets/{walletId}/statement'] = {
  get: { tags: ['Payment Gateway'], summary: 'Wallet statement', operationId: 'walletStatement', security: [{ bearerAuth: [] }], parameters: [{ name: 'walletId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } }, ...paginationParams], responses: { '200': { description: 'Wallet transaction history', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' }, balance_after: { type: 'number' }, created_at: { type: 'string', format: 'date-time' } } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// ESCROW (Phase 4)
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/escrow'] = {
  post: { tags: ['Payment Gateway'], summary: 'Create escrow hold', operationId: 'escrowCreate', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'amount', 'currency'], properties: { merchant_id: { type: 'string', format: 'uuid' }, amount: { type: 'number' }, currency: { type: 'string', default: 'XAF' }, description: { type: 'string' }, release_conditions: { type: 'object' }, expires_at: { type: 'string', format: 'date-time' } } } } } }, responses: { '201': { description: 'Escrow created' }, ...errorResponses } },
  get: { tags: ['Payment Gateway'], summary: 'List escrow holds', operationId: 'escrowList', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'released', 'refunded', 'frozen', 'expired'] } }, ...paginationParams], responses: { '200': { description: 'Escrow holds', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' }, status: { type: 'string', enum: ['active', 'released', 'refunded', 'frozen', 'expired'] }, created_at: { type: 'string', format: 'date-time' } } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
};

paths['/v1/escrow/{escrowId}/fund'] = {
  post: { tags: ['Payment Gateway'], summary: 'Fund escrow', operationId: 'escrowFund', security: [{ bearerAuth: [] }], parameters: [{ name: 'escrowId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount'], properties: { amount: { type: 'number' }, source_wallet_id: { type: 'string' } } } } } }, responses: { '200': { description: 'Escrow funded' }, ...errorResponses } },
};

paths['/v1/escrow/{escrowId}/release'] = {
  post: { tags: ['Payment Gateway'], summary: 'Release escrow', operationId: 'escrowRelease', security: [{ bearerAuth: [] }], parameters: [{ name: 'escrowId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { amount: { type: 'number', description: 'Partial release amount (omit for full)' }, recipient_wallet_id: { type: 'string' } } } } } }, responses: { '200': { description: 'Escrow released' }, ...errorResponses } },
};

paths['/v1/escrow/{escrowId}/refund'] = {
  post: { tags: ['Payment Gateway'], summary: 'Refund escrow', operationId: 'escrowRefund', security: [{ bearerAuth: [] }], parameters: [{ name: 'escrowId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string' } } } } } }, responses: { '200': { description: 'Escrow refunded' }, ...errorResponses } },
};

paths['/v1/escrow/{escrowId}/freeze'] = {
  post: { tags: ['Payment Gateway'], summary: 'Freeze escrow', operationId: 'escrowFreeze', security: [{ bearerAuth: [] }], parameters: [{ name: 'escrowId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['action'], properties: { action: { type: 'string', enum: ['freeze', 'unfreeze'] }, reason: { type: 'string' } } } } } }, responses: { '200': { description: 'Escrow frozen/unfrozen' }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPLIANCE (Phase 4 & 6)
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/compliance/screen'] = {
  post: { tags: ['KYC & Compliance'], summary: 'Pre-payout compliance screen', description: 'Evaluate transaction against KYC risk scores, sanctions, PEP status, and velocity limits. Returns approve/review/deny.', operationId: 'complianceScreen', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['user_id', 'amount', 'currency'], properties: { user_id: { type: 'string', format: 'uuid' }, amount: { type: 'number' }, currency: { type: 'string' }, destination_type: { type: 'string' }, destination_country: { type: 'string' } } } } } }, responses: { '200': { description: 'Screening decision', content: { 'application/json': { schema: { type: 'object', properties: { decision: { type: 'string', enum: ['approve', 'review', 'deny'] }, risk_score: { type: 'integer' }, checks: { type: 'object' } } } } } }, ...errorResponses } },
};

paths['/v1/compliance/sar'] = {
  post: { tags: ['KYC & Compliance'], summary: 'File SAR', description: 'File a Suspicious Activity Report.', operationId: 'sarFile', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['subject_user_id', 'activity_type', 'description'], properties: { subject_user_id: { type: 'string', format: 'uuid' }, activity_type: { type: 'string' }, description: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' } } } } } }, responses: { '201': { description: 'SAR filed' }, ...errorResponses } },
  get: { tags: ['KYC & Compliance'], summary: 'List SARs', operationId: 'sarList', security: [{ bearerAuth: [] }], parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'filed', 'under_review', 'escalated', 'submitted', 'closed'] } }, ...paginationParams], responses: { '200': { description: 'SAR list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' }, risk_level: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
};

paths['/v1/compliance/sar/{sarId}/review'] = {
  post: { tags: ['KYC & Compliance'], summary: 'Review SAR', operationId: 'sarReview', security: [{ bearerAuth: [] }], parameters: [{ name: 'sarId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['action'], properties: { action: { type: 'string', enum: ['approve', 'escalate', 'close', 'request_info'] }, notes: { type: 'string' } } } } } }, responses: { '200': { description: 'SAR reviewed' }, ...errorResponses } },
};

paths['/v1/compliance/sar/{sarId}/submit'] = {
  post: { tags: ['KYC & Compliance'], summary: 'Submit SAR to regulator', operationId: 'sarSubmit', security: [{ bearerAuth: [] }], parameters: [{ name: 'sarId', in: 'path', required: true, schema: { type: 'string' } }, idempotencyHeader], responses: { '200': successResult('SAR submitted'), ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// SAFEGUARDING (Phase 4)
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/safeguarding/reconcile'] = {
  post: { tags: ['KYC & Compliance'], summary: 'Run safeguarding reconciliation', description: 'Reconcile total e-money liabilities against actual wallet and escrow balances.', operationId: 'safeguardingReconcile', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Reconciliation result with discrepancy details', content: { 'application/json': { schema: { type: 'object', properties: { total_liabilities: { type: 'number' }, total_assets: { type: 'number' }, discrepancy: { type: 'number' }, status: { type: 'string' } } } } } }, ...errorResponses } },
};

paths['/v1/safeguarding/snapshots'] = {
  get: { tags: ['KYC & Compliance'], summary: 'List safeguarding snapshots', operationId: 'safeguardingSnapshots', security: [{ bearerAuth: [] }], parameters: [{ name: 'from', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } }, ...paginationParams], responses: { '200': { description: 'Daily safeguarding snapshots', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { snapshot_date: { type: 'string', format: 'date' }, total_liabilities: { type: 'number' }, total_assets: { type: 'number' }, discrepancy: { type: 'number' }, status: { type: 'string' } } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// INSTANT PAYOUTS & PAYOUT RAILS (Phase 6)
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/payouts/instant'] = {
  post: { tags: ['Payment Gateway'], summary: 'Instant payout', description: 'Route payout through fastest available rail (MoMo instant, bank express, Visa Direct).', operationId: 'payoutInstant', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'amount', 'currency', 'channel'], properties: { merchant_id: { type: 'string', format: 'uuid' }, amount: { type: 'number' }, currency: { type: 'string' }, channel: { type: 'string', enum: ['momo_instant', 'bank_express', 'visa_direct'] }, beneficiary_phone: { type: 'string' }, beneficiary_account: { type: 'string' }, beneficiary_name: { type: 'string' } } } } } }, responses: { '201': { description: 'Instant payout initiated', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayPayout' } } } }, ...errorResponses } },
};

paths['/v1/payouts/push-to-card'] = {
  post: { tags: ['Payment Gateway'], summary: 'Push-to-card payout', description: 'Visa Direct card push disbursement.', operationId: 'payoutPushToCard', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'amount', 'currency', 'card_number'], properties: { merchant_id: { type: 'string', format: 'uuid' }, amount: { type: 'number' }, currency: { type: 'string' }, card_number: { type: 'string' }, card_holder_name: { type: 'string' } } } } } }, responses: { '201': { description: 'Push-to-card initiated', content: { 'application/json': { schema: { $ref: '#/components/schemas/GatewayPayout' } } } }, ...errorResponses } },
};

paths['/v1/payouts/rails'] = {
  get: { tags: ['Payment Gateway'], summary: 'List available payout rails', description: 'Returns available rails by country and currency with estimated delivery times.', operationId: 'payoutRails', security: [{ bearerAuth: [] }], parameters: [{ name: 'country', in: 'query', schema: { type: 'string' } }, { name: 'currency', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'Available payout rails with speeds and fees', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { rail: { type: 'string' }, country: { type: 'string' }, currency: { type: 'string' }, estimated_delivery: { type: 'string' }, fee: { type: 'number' } } } } } } } } }, ...errorResponses } },
};

paths['/v1/payouts/{payoutId}/cancel'] = {
  post: { tags: ['Payment Gateway'], summary: 'Cancel pending payout', operationId: 'payoutCancel', security: [{ bearerAuth: [] }], parameters: [{ name: 'payoutId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string' } } } } } }, responses: { '200': successResult('Payout cancelled and funds returned to wallet'), ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// TREASURY (Phase 6)
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/treasury/float'] = {
  get: { tags: ['Payment Gateway'], summary: 'Get treasury float balance', description: 'Current float balances across all provider accounts.', operationId: 'treasuryFloat', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Float balances by provider and currency', content: { 'application/json': { schema: { type: 'object', properties: { balances: { type: 'array', items: { type: 'object', properties: { provider: { type: 'string' }, currency: { type: 'string' }, balance: { type: 'number' } } } } } } } } }, ...errorResponses } },
};

paths['/v1/treasury/replenish'] = {
  post: { tags: ['Payment Gateway'], summary: 'Replenish treasury float', operationId: 'treasuryReplenish', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['provider', 'amount', 'currency'], properties: { provider: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' } } } } } }, responses: { '200': successResult('Replenishment initiated'), ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// SLA MONITORING (Phase 7)
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/sla/metrics'] = {
  get: { tags: ['Monitoring'], summary: 'SLA metrics', description: 'Uptime percentages, latency percentiles (p50/p95/p99), and error rates.', operationId: 'slaMetrics', security: [{ bearerAuth: [] }], parameters: [{ name: 'from', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { '200': { description: 'SLA metric data', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { service_name: { type: 'string' }, uptime_pct: { type: 'number' }, p50_ms: { type: 'number' }, p95_ms: { type: 'number' }, p99_ms: { type: 'number' }, error_rate: { type: 'number' } } } } } } } } }, ...errorResponses } },
  post: { tags: ['Monitoring'], summary: 'Record SLA metric', operationId: 'slaMetricRecord', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['service_name'], properties: { service_name: { type: 'string' }, uptime_pct: { type: 'number' }, p50_ms: { type: 'number' }, p95_ms: { type: 'number' }, p99_ms: { type: 'number' }, error_rate: { type: 'number' } } } } } }, responses: { '201': successResult('Metric recorded'), ...errorResponses } },
};

paths['/v1/sla/incidents'] = {
  get: { tags: ['Monitoring'], summary: 'List incidents', operationId: 'slaIncidentList', security: [{ bearerAuth: [] }], parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['open', 'investigating', 'resolved'] } }, ...paginationParams], responses: { '200': { description: 'Incident list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, severity: { type: 'string' }, status: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
  post: { tags: ['Monitoring'], summary: 'Create incident', operationId: 'slaIncidentCreate', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title', 'severity'], properties: { title: { type: 'string' }, description: { type: 'string' }, severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }, affected_services: { type: 'array', items: { type: 'string' } } } } } } }, responses: { '201': { description: 'Incident created', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, severity: { type: 'string' }, status: { type: 'string' } } } } } }, ...errorResponses } },
};

paths['/v1/sla/incidents/{incidentId}'] = {
  patch: { tags: ['Monitoring'], summary: 'Update incident', operationId: 'slaIncidentUpdate', security: [{ bearerAuth: [] }], parameters: [{ name: 'incidentId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['investigating', 'resolved'] }, resolution_notes: { type: 'string' } } } } } }, responses: { '200': successResult('Incident updated'), ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOKS V2 (Phase 7)
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/webhooks/v2/endpoints'] = {
  post: { tags: ['Webhooks'], summary: 'Register webhook endpoint (v2)', description: 'Register a new webhook endpoint with event filtering and unique signing secret.', operationId: 'webhookV2Create', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['merchant_id', 'url', 'events'], properties: { merchant_id: { type: 'string', format: 'uuid' }, url: { type: 'string', format: 'uri' }, events: { type: 'array', items: { type: 'string' } }, description: { type: 'string' } } } } } }, responses: { '201': { description: 'Endpoint created with signing secret (shown once)', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, secret: { type: 'string', description: 'whsec_... — shown only on creation' }, events: { type: 'array', items: { type: 'string' } } } } } } }, ...errorResponses } },
  get: { tags: ['Webhooks'], summary: 'List webhook endpoints (v2)', operationId: 'webhookV2List', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Webhook endpoints', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, events: { type: 'array', items: { type: 'string' } }, is_active: { type: 'boolean' } } } } } } } } }, ...errorResponses } },
};

paths['/v1/webhooks/v2/endpoints/{endpointId}'] = {
  patch: { tags: ['Webhooks'], summary: 'Update webhook endpoint', operationId: 'webhookV2Update', security: [{ bearerAuth: [] }], parameters: [{ name: 'endpointId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string' }, events: { type: 'array', items: { type: 'string' } }, is_active: { type: 'boolean' } } } } } }, responses: { '200': successResult('Endpoint updated'), ...errorResponses } },
  delete: { tags: ['Webhooks'], summary: 'Delete webhook endpoint', operationId: 'webhookV2Delete', security: [{ bearerAuth: [] }], parameters: [{ name: 'endpointId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '204': { description: 'Endpoint deleted' }, ...errorResponses } },
};

paths['/v1/webhooks/v2/deliveries'] = {
  get: { tags: ['Webhooks'], summary: 'List webhook deliveries', description: 'View delivery attempts and retry history.', operationId: 'webhookV2Deliveries', security: [{ bearerAuth: [] }], parameters: [{ name: 'endpoint_id', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'delivered', 'failed'] } }, ...paginationParams], responses: { '200': { description: 'Delivery logs', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, endpoint_id: { type: 'string' }, event_type: { type: 'string' }, status: { type: 'string' }, http_status: { type: 'integer' }, attempted_at: { type: 'string', format: 'date-time' } } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// SANDBOX SIMULATION (Phase 7)
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/sandbox/payout-sim'] = {
  post: { tags: ['Sandbox'], summary: 'Simulate payout scenario', description: 'Run a payout through a pre-seeded sandbox scenario (e.g. insufficient_funds, network_timeout, reversed_after_success).', operationId: 'sandboxPayoutSim', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['scenario', 'amount', 'currency'], properties: { scenario: { type: 'string', enum: ['instant_success', 'delayed_success', 'insufficient_funds', 'network_timeout', 'compliance_hold', 'reversed_after_success', 'partial_failure'] }, amount: { type: 'number' }, currency: { type: 'string' }, merchant_id: { type: 'string', format: 'uuid' }, webhook_url: { type: 'string', format: 'uri' } } } } } }, responses: { '200': { description: 'Simulation result with timeline and webhook callbacks', content: { 'application/json': { schema: { type: 'object', properties: { scenario: { type: 'string' }, payout: { $ref: '#/components/schemas/GatewayPayout' }, timeline: { type: 'array', items: { type: 'object', properties: { event: { type: 'string' }, timestamp: { type: 'string' }, status: { type: 'string' } } } } } } } } }, ...errorResponses } },
  get: { tags: ['Sandbox'], summary: 'List sandbox scenarios', operationId: 'sandboxScenarioList', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Available sandbox payout scenarios', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' } } } } } } } } }, ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// RECONCILIATION MISMATCHES (Phase 5)
// ═══════════════════════════════════════════════════════════════════════════
paths['/v1/reconciliation/mismatches'] = {
  get: { tags: ['Payment Gateway'], summary: 'List reconciliation mismatches', operationId: 'reconciliationMismatches', security: [{ bearerAuth: [] }], parameters: [{ name: 'merchant_id', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string', enum: ['open', 'resolved', 'ignored'] } }, ...paginationParams], responses: { '200': { description: 'Mismatch list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, charge_id: { type: 'string' }, expected_amount: { type: 'number' }, actual_amount: { type: 'number' }, status: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
};

paths['/v1/reconciliation/mismatches/{mismatchId}/resolve'] = {
  post: { tags: ['Payment Gateway'], summary: 'Resolve mismatch', operationId: 'reconciliationResolve', security: [{ bearerAuth: [] }], parameters: [{ name: 'mismatchId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['resolution'], properties: { resolution: { type: 'string', enum: ['adjust_ledger', 'adjust_provider', 'ignore'] }, notes: { type: 'string' } } } } } }, responses: { '200': successResult('Mismatch resolved'), ...errorResponses } },
};

// ── Bank Directory ────────────────────────────────────────────────────
paths['/v1/directory/banks'] = {
  get: { tags: ['Bank Directory'], summary: 'List active banks', description: 'Public directory of active banks integrated with KOB.', operationId: 'directoryBanksList', responses: { '200': { description: 'List of active banks', content: { 'application/json': { schema: { type: 'object', properties: { banks: { type: 'array', items: { '$ref': '#/components/schemas/Bank' } } } } } } }, ...errorResponses } },
};

paths['/v1/banks/register'] = {
  post: { tags: ['Bank Directory'], summary: 'Register a bank', description: 'Register a new bank/ASPSP in the directory.', operationId: 'bankRegister', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['legal_name', 'short_code'], properties: { legal_name: { type: 'string', example: 'Afriland First Bank' }, display_name: { type: 'string' }, short_code: { type: 'string', example: 'AFB' }, swift_bic: { type: 'string' }, bank_code: { type: 'string' }, contact_email: { type: 'string' }, support_phone: { type: 'string' }, integration_mode: { type: 'string', enum: ['connector_push', 'connector_pull', 'file_feed', 'hybrid'] } } } } } }, responses: { '201': { description: 'Bank registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/Bank' } } } }, ...errorResponses } },
};

paths['/v1/banks'] = {
  get: { tags: ['Bank Directory'], summary: 'List all banks (admin)', description: 'Admin-only list of all banks including draft/suspended.', operationId: 'banksList', security: [{ bearerAuth: [] }], parameters: [...paginationParams], responses: { '200': { description: 'Banks list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Bank' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
};

paths['/v1/banks/{bankId}'] = {
  get: { tags: ['Bank Directory'], summary: 'Get bank details', operationId: 'banksGet', security: [{ bearerAuth: [] }], parameters: [{ name: 'bankId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Bank details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Bank' } } } }, ...errorResponses } },
  put: { tags: ['Bank Directory'], summary: 'Update bank', operationId: 'banksUpdate', security: [{ bearerAuth: [] }], parameters: [{ name: 'bankId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { display_name: { type: 'string' }, contact_email: { type: 'string' }, support_phone: { type: 'string' }, integration_mode: { type: 'string' } } } } } }, responses: { '200': { description: 'Bank updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Bank' } } } }, ...errorResponses } },
};

paths['/v1/banks/{bankId}/approve'] = {
  post: { tags: ['Bank Directory'], summary: 'Approve bank (admin)', operationId: 'bankApprove', security: [{ bearerAuth: [] }], parameters: [{ name: 'bankId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': successResult('Bank approved and set to active'), ...errorResponses } },
};

paths['/v1/banks/{bankId}/suspend'] = {
  post: { tags: ['Bank Directory'], summary: 'Suspend bank (admin)', operationId: 'bankSuspend', security: [{ bearerAuth: [] }], parameters: [{ name: 'bankId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': successResult('Bank suspended'), ...errorResponses } },
};

paths['/v1/banks/{bankId}/connectors'] = {
  get: { tags: ['Bank Connectors'], summary: 'List connectors', operationId: 'connectorsList', security: [{ bearerAuth: [] }], parameters: [{ name: 'bankId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Connector instances list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, connector_type: { type: 'string' }, environment: { type: 'string' }, status: { type: 'string' } } } } } } } } }, ...errorResponses } },
  post: { tags: ['Bank Connectors'], summary: 'Register connector', operationId: 'connectorRegister', security: [{ bearerAuth: [] }], parameters: [{ name: 'bankId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'environment'], properties: { name: { type: 'string' }, environment: { type: 'string', enum: ['sandbox', 'prod'] }, base_url: { type: 'string' }, connector_type: { type: 'string', enum: ['rest', 'iso20022', 'file'] } } } } } }, responses: { '201': successResult('Connector registered'), ...errorResponses } },
};

paths['/v1/banks/{bankId}/connectors/{connectorId}/health'] = {
  get: { tags: ['Bank Connectors'], summary: 'Connector health', operationId: 'connectorHealth', security: [{ bearerAuth: [] }], parameters: [{ name: 'bankId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, { name: 'connectorId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Connector health status', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, latency_ms: { type: 'number' }, last_check_at: { type: 'string', format: 'date-time' } } } } } }, ...errorResponses } },
};

paths['/v1/banks/{bankId}/connectors/{connectorId}/certificates'] = {
  post: { tags: ['Bank Connectors'], summary: 'Upload mTLS certificate', operationId: 'connectorCertUpload', security: [{ bearerAuth: [] }], parameters: [{ name: 'bankId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, { name: 'connectorId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['certificate_pem'], properties: { certificate_pem: { type: 'string' } } } } } }, responses: { '201': successResult('Certificate uploaded'), ...errorResponses } },
};

// ── Bank Data Ingestion (Internal / Connector) ────────────────────────
paths['/v1/internal/connectors/{bankId}/accounts'] = {
  post: { tags: ['Bank Connectors'], summary: 'Bulk ingest accounts', description: 'Bank connector pushes account data (mTLS required).', operationId: 'connectorIngestAccounts', security: [{ mtls: [] }], parameters: [{ name: 'bankId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['accounts'], properties: { accounts: { type: 'array', items: { type: 'object', properties: { external_account_id: { type: 'string' }, account_type: { type: 'string' }, currency: { type: 'string', default: 'XAF' }, nickname: { type: 'string' } } } }, correlation_id: { type: 'string' } } } } } }, responses: { '200': { description: 'Ingestion result with counts', content: { 'application/json': { schema: { type: 'object', properties: { inserted: { type: 'integer' }, updated: { type: 'integer' }, errors: { type: 'integer' }, correlation_id: { type: 'string' } } } } } }, ...errorResponses } },
};

paths['/v1/internal/connectors/{bankId}/transactions'] = {
  post: { tags: ['Bank Connectors'], summary: 'Bulk ingest transactions', description: 'Bank connector pushes transaction data (mTLS required).', operationId: 'connectorIngestTransactions', security: [{ mtls: [] }], parameters: [{ name: 'bankId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['transactions'], properties: { transactions: { type: 'array', items: { type: 'object', properties: { external_tx_id: { type: 'string' }, account_id: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' }, credit_debit: { type: 'string', enum: ['credit', 'debit'] }, booking_date: { type: 'string', format: 'date' }, reference: { type: 'string' } } } }, correlation_id: { type: 'string' } } } } } }, responses: { '200': { description: 'Ingestion result', content: { 'application/json': { schema: { type: 'object', properties: { inserted: { type: 'integer' }, updated: { type: 'integer' }, errors: { type: 'integer' }, correlation_id: { type: 'string' } } } } } }, ...errorResponses } },
};

// ── Interbank Engine ──────────────────────────────────────────────────
paths['/v1/interbank/payments'] = {
  get: { tags: ['Interbank'], summary: 'List interbank payments', operationId: 'interbankPaymentsList', security: [{ bearerAuth: [] }], parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['created', 'validated', 'submitted', 'accepted', 'rejected', 'in_process', 'settled', 'failed', 'reversed', 'expired'] } }, ...paginationParams], responses: { '200': { description: 'Interbank payments list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/InterbankPayment' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
  post: { tags: ['Interbank'], summary: 'Create interbank payment', operationId: 'interbankPaymentCreate', security: [{ bearerAuth: [] }], parameters: [idempotencyHeader], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['debtor_participant_id', 'creditor_participant_id', 'amount'], properties: { debtor_participant_id: { type: 'string', format: 'uuid' }, creditor_participant_id: { type: 'string', format: 'uuid' }, debtor_account_ref: { type: 'string' }, creditor_account_ref: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string', default: 'XAF' }, external_reference: { type: 'string' } } } } } }, responses: { '201': { description: 'Payment created', content: { 'application/json': { schema: { $ref: '#/components/schemas/InterbankPayment' } } } }, ...errorResponses } },
};

paths['/v1/interbank/payments/{paymentId}'] = {
  get: { tags: ['Interbank'], summary: 'Get interbank payment', operationId: 'interbankPaymentGet', security: [{ bearerAuth: [] }], parameters: [{ name: 'paymentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Payment details with status events', content: { 'application/json': { schema: { $ref: '#/components/schemas/InterbankPayment' } } } }, ...errorResponses } },
};

paths['/v1/interbank/payments/{paymentId}/submit'] = {
  post: { tags: ['Interbank'], summary: 'Submit interbank payment', description: 'Generates pacs.008 and dispatches to creditor bank.', operationId: 'interbankPaymentSubmit', security: [{ bearerAuth: [] }], parameters: [{ name: 'paymentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': successResult('Payment submitted with pacs.008 generated'), ...errorResponses } },
};

paths['/v1/interbank/participants'] = {
  get: { tags: ['Interbank'], summary: 'List participants', operationId: 'interbankParticipantsList', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Interbank participants list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, swift_bic: { type: 'string' }, status: { type: 'string' } } } } } } } } }, ...errorResponses } },
};

paths['/v1/interbank/messages'] = {
  get: { tags: ['Interbank'], summary: 'List ISO 20022 messages', operationId: 'interbankMessagesList', security: [{ bearerAuth: [] }], parameters: [{ name: 'payment_id', in: 'query', schema: { type: 'string' } }, ...paginationParams], responses: { '200': { description: 'ISO messages list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, message_type: { type: 'string' }, direction: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
};

// ── Bank PSU Linking ──────────────────────────────────────────────────
paths['/v1/banks/{bankId}/link'] = {
  post: { tags: ['Bank Directory'], summary: 'Link PSU to bank', description: 'Start linking a user to a bank for AISP/PISP access.', operationId: 'bankLinkPsu', security: [{ bearerAuth: [] }], parameters: [{ name: 'bankId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['external_customer_id'], properties: { external_customer_id: { type: 'string' } } } } } }, responses: { '200': successResult('Link initiated'), ...errorResponses } },
};

// ── Bank Payments (Connector Rail) ────────────────────────────────────
paths['/v1/banks/{bankId}/payments'] = {
  get: { tags: ['Bank Connectors'], summary: 'List bank payments', operationId: 'bankPaymentsList', security: [{ bearerAuth: [] }], parameters: [{ name: 'bankId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, ...paginationParams], responses: { '200': { description: 'Bank payments list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Payment' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }, ...errorResponses } },
};

paths['/v1/internal/connectors/{bankId}/payments/status'] = {
  post: { tags: ['Bank Connectors'], summary: 'Payment status callback', description: 'Bank connector pushes payment status update.', operationId: 'connectorPaymentStatus', security: [{ mtls: [] }], parameters: [{ name: 'bankId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['payment_id', 'status'], properties: { payment_id: { type: 'string' }, status: { type: 'string', enum: ['accepted', 'completed', 'failed', 'reversed'] }, details: { type: 'object' } } } } } }, responses: { '200': successResult('Status updated'), ...errorResponses } },
};

// ═══════════════════════════════════════════════════════════════════════════
// PAY BY BANK — Redirect-Based SCA
// ═══════════════════════════════════════════════════════════════════════════
schemas['PayByBankIntent'] = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    merchant_id: { type: 'string', format: 'uuid' },
    consent_id: { type: 'string' },
    amount: { type: 'number', example: 50000 },
    currency: { type: 'string', example: 'XAF' },
    redirect_uri: { type: 'string', format: 'uri' },
    state: { type: 'string' },
    status: { type: 'string', enum: ['awaiting_auth', 'authorized', 'submitted', 'processing', 'completed', 'failed', 'expired', 'rejected'] },
    merchant_name: { type: 'string' },
    merchant_logo_url: { type: 'string', format: 'uri', nullable: true },
    description: { type: 'string', nullable: true },
    authorization_url: { type: 'string', format: 'uri' },
    expires_at: { type: 'string', format: 'date-time' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

schemas['CreatePayByBankIntentRequest'] = {
  type: 'object',
  required: ['merchant_id', 'amount', 'redirect_uri', 'state'],
  properties: {
    merchant_id: { type: 'string', format: 'uuid' },
    amount: { type: 'number', example: 50000 },
    currency: { type: 'string', default: 'XAF' },
    redirect_uri: { type: 'string', format: 'uri' },
    state: { type: 'string', description: 'Opaque state for CSRF protection' },
    description: { type: 'string' },
    creditor_account: { type: 'string' },
    creditor_name: { type: 'string' },
    customer_email: { type: 'string', format: 'email' },
  },
};

paths['/v1/pay-by-bank/intents'] = {
  post: {
    tags: ['Pay by Bank'], summary: 'Create payment intent', operationId: 'payByBankCreateIntent',
    security: [{ bearerAuth: [] }],
    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePayByBankIntentRequest' } } } },
    responses: {
      '201': { description: 'Intent created', content: { 'application/json': { schema: { type: 'object', properties: { intent_id: { type: 'string' }, consent_id: { type: 'string' }, authorization_url: { type: 'string' }, expires_at: { type: 'string' }, status: { type: 'string' } } } } } },
      ...errorResponses,
    },
  },
  get: {
    tags: ['Pay by Bank'], summary: 'List merchant payment intents', operationId: 'payByBankListIntents',
    security: [{ bearerAuth: [] }],
    parameters: [{ name: 'status', in: 'query', schema: { type: 'string' } }, ...paginationParams],
    responses: { '200': { description: 'Intent list', content: { 'application/json': { schema: { type: 'object', properties: { intents: { type: 'array', items: { $ref: '#/components/schemas/PayByBankIntent' } } } } } } }, ...errorResponses },
  },
};

paths['/v1/pay-by-bank/intents/{intentId}'] = {
  get: {
    tags: ['Pay by Bank'], summary: 'Get payment intent status', operationId: 'payByBankGetIntent',
    security: [{ bearerAuth: [] }],
    parameters: [{ name: 'intentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: { '200': { description: 'Intent details', content: { 'application/json': { schema: { $ref: '#/components/schemas/PayByBankIntent' } } } }, ...errorResponses },
  },
};

paths['/v1/pay-by-bank/intents/{intentId}/authorize'] = {
  post: {
    tags: ['Pay by Bank'], summary: 'Authorize payment (user SCA)', operationId: 'payByBankAuthorize',
    security: [{ bearerAuth: [] }],
    parameters: [{ name: 'intentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { debtor_account: { type: 'string' } } } } } },
    responses: { '200': { description: 'Payment authorized', content: { 'application/json': { schema: { type: 'object', properties: { redirect_url: { type: 'string' }, status: { type: 'string' } } } } } }, ...errorResponses },
  },
};

paths['/v1/pay-by-bank/intents/{intentId}/reject'] = {
  post: {
    tags: ['Pay by Bank'], summary: 'Reject payment intent', operationId: 'payByBankReject',
    security: [{ bearerAuth: [] }],
    parameters: [{ name: 'intentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    responses: { '200': { description: 'Payment rejected', content: { 'application/json': { schema: { type: 'object', properties: { redirect_url: { type: 'string' }, status: { type: 'string' } } } } } }, ...errorResponses },
  },
};

paths['/v1/pay-by-bank/callback'] = {
  post: {
    tags: ['Pay by Bank'], summary: 'Bank connector callback', description: 'Internal callback from bank connector confirming payment execution.', operationId: 'payByBankCallback',
    security: [{ mtls: [] }],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['intent_id', 'status'], properties: { intent_id: { type: 'string' }, status: { type: 'string', enum: ['completed', 'failed'] }, failure_reason: { type: 'string' } } } } } },
    responses: { '200': successResult('Callback processed'), ...errorResponses },
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openapiSpec = {
      openapi: '3.1.0',
      info: {
        title: 'Kang Open Banking API',
        version: '4.17.0',
        summary: 'Unified Open Banking API for Cameroon',
        description: 'COBAC & BEAC compliant Open Banking API providing Account Information (AISP), Payment Initiation (PISP), Credit Scoring, Loans, Savings, Mobile Money, Double-Entry Ledger, Virtual Cards, Custodial Wallets, Escrow, Compliance Screening, SLA Monitoring, POS Commerce, Bank Directory, Bank Connector Kit, Interbank Engine (ISO 20022), and comprehensive financial services for the Central African region. All monetary examples use XAF (Central African CFA Franc).',
        'x-changelog-url': 'https://kangopenbanking.com/changelog.json',
        contact: {
          name: 'Kang Open Banking Support',
          email: 'support@kangopenbanking.com',
          url: 'https://kangopenbanking.com/contact',
        },
        termsOfService: 'https://kangopenbanking.com/terms',
        license: { name: 'Proprietary', url: 'https://kangopenbanking.com/terms' },
      },
      servers: [
        { url: `${Deno.env.get('SUPABASE_URL')!}/functions/v1`, description: 'Direct Supabase Edge Functions Backend (Production)' },
      ],
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Monitoring', description: 'Health and readiness probes' },
        { name: 'OAuth', description: 'OAuth 2.0 / OIDC / FAPI 1.0 Advanced' },
        { name: 'Authentication', description: 'Phone auth, PIN, password management' },
        { name: 'Security', description: 'CAPTCHA, SCA (Strong Customer Authentication)' },
        { name: 'Certificates', description: 'mTLS certificate management (RFC 8705)' },
        { name: 'AISP', description: 'Account Information Service Provider (PSD2/Open Banking)' },
        { name: 'PISP', description: 'Payment Initiation Service Provider' },
        { name: 'Consent Management', description: 'AISP/PISP consent lifecycle' },
        { name: 'Credit Scoring', description: 'Credit scores, simulation, and reports' },
        { name: 'Loans', description: 'Loan products, applications, disbursement, repayment, schedules' },
        { name: 'Savings', description: 'Savings products, accounts, interest accrual' },
        { name: 'Ledger', description: 'Double-entry accounting (chart of accounts, journal entries)' },
        { name: 'Mobile Money', description: 'MTN & Orange Mobile Money integration' },
        { name: 'Payments', description: 'Flutterwave & Stripe payment processing' },
        { name: 'Banking Operations', description: 'Bulk transfers, exchange rates' },
        { name: 'Virtual Cards', description: 'Virtual card issuance and management' },
        { name: 'Standards', description: 'ISO 20022 & SWIFT message processing' },
        { name: 'KYC & Compliance', description: 'Identity verification, sanctions screening' },
        { name: 'Webhooks', description: 'Webhook registration and delivery' },
        { name: 'Admin', description: 'Administrative endpoints (RBAC protected)' },
        { name: 'Communications', description: 'Email, SMS, push notifications' },
        { name: 'Settlement', description: 'Settlement calculation, processing, invoicing' },
        { name: 'Institution', description: 'Institution registration and management' },
        { name: 'CrediQ', description: 'Credit health monitoring and action plans' },
        { name: 'PostiQ', description: 'Address verification and postal codes' },
        { name: 'WooCommerce', description: 'WooCommerce payment plugin integration' },
        { name: 'POS', description: 'Point-of-sale commerce — catalog, orders, payments, refunds, inventory' },
        { name: 'Catalog', description: 'POS product and variant management' },
        { name: 'Inventory', description: 'Stock tracking per location with immutable audit trail' },
        { name: 'POS Payments', description: 'Multi-method payment capture for POS orders (MoMo, Card, PayPal, Bank)' },
        { name: 'POS Refunds/Returns', description: 'Order refunds with optional restocking and WooCommerce sync' },
        { name: 'WooCommerce Integration', description: 'WooCommerce store connection, product import, inventory sync, webhook ingestion' },
        { name: 'Sandbox', description: 'Sandbox environment management' },
        { name: 'Developer', description: 'Developer app registration' },
        { name: 'Payment Gateway', description: 'Unified payment gateway — charges, payouts, refunds, disputes, settlements, beneficiaries, preauthorization, virtual accounts, merchant wallets, OTP validation, bank/BVN verification, payment links, subscriptions, split payments, tokenization, reconciliation' },
        { name: 'Payment Facilitation', description: 'White-label payment processing — facilitated charges, settlement calculation and processing' },
        { name: 'Merchant Onboarding', description: 'Merchant lifecycle — registration, KYB verification, API keys, settlement accounts, webhooks' },
        { name: 'Consumer Tools', description: 'Consumer financial tools — Piggy Bank (savings goals) and Njangi (group rotation savings)' },
        { name: 'Bank Directory', description: 'Bank/ASPSP registration, lifecycle management, PSU linking, and public directory' },
        { name: 'Bank Connectors', description: 'Bank connector registration, mTLS certificates, data ingestion (accounts, transactions), health monitoring, and payment status callbacks' },
        { name: 'Interbank', description: 'Interbank payment engine — ISO 20022 pacs.008/pacs.002 messaging, participant management, and payment lifecycle (10-state machine)' },
        { name: 'Pay by Bank', description: 'Redirect-based Pay by Bank with Strong Customer Authentication (SCA) — payment intents, hosted authorization, webhook events (authorized, submitted, completed, failed)' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'OAuth 2.0 access token',
          },
          mtls: {
            type: 'mutualTLS',
            description: 'Client certificate (RFC 8705)',
          },
          oauth2: {
            type: 'oauth2',
            flows: {
              authorizationCode: {
                authorizationUrl: `${Deno.env.get('SUPABASE_URL')!}/functions/v1/oauth-authorize`,
                tokenUrl: `${Deno.env.get('SUPABASE_URL')!}/functions/v1/oauth-token`,
                scopes: {
                  openid: 'OpenID Connect',
                  accounts: 'Read account information',
                  balances: 'Read balances',
                  transactions: 'Read transactions',
                  payments: 'Initiate payments',
                  offline_access: 'Refresh tokens',
                },
              },
            },
          },
        },
        schemas,
        parameters: {
          IdempotencyKey: idempotencyHeader,
          Limit: paginationParams[0],
          Offset: paginationParams[1],
        },
      },
      paths,
    };

    return new Response(JSON.stringify(openapiSpec, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error serving OpenAPI spec:', error);
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        error_code: 'SPEC_001',
        message: 'Failed to generate OpenAPI specification',
        error_id: `err_${Date.now()}`,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
