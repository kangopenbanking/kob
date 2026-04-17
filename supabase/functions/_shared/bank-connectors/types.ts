// Unified BankConnector contract for bank-account-level operations.
// Sits ALONGSIDE PaymentConnector — payment connectors remain unchanged.
// Implementations: rest-bank, sql-bank, file-bank, soap-bank.

export type BankAdapterType = 'rest' | 'sql' | 'file' | 'soap';
export type BankConnectorEnvironment = 'sandbox' | 'live';

export interface BankAccountDetails {
  external_account_id: string;
  account_holder_name?: string;
  account_type?: string;
  identification_scheme?: string;
  identification_value?: string;
  currency: string;
  status?: string;
  raw?: unknown;
}

export interface BankBalance {
  account_id: string;
  amount: number;
  currency: string;
  balance_type: string;
  as_of_datetime: string;
  raw?: unknown;
}

export interface BankTransaction {
  external_tx_id: string;
  account_id: string;
  booking_date: string;
  value_date?: string;
  amount: number;
  currency: string;
  credit_debit: 'Credit' | 'Debit';
  reference?: string;
  description?: string;
  raw?: unknown;
}

export interface DateRange {
  from: string; // ISO
  to: string;   // ISO
}

export interface TransferPayload {
  from_account: string;
  to_account: string;
  amount: number;
  currency: string;
  reference: string;
  description?: string;
  beneficiary_name?: string;
  beneficiary_bank_code?: string;
}

export interface TransferResult {
  success: boolean;
  bank_tx_id?: string;
  status: 'pending' | 'executed' | 'failed';
  raw?: unknown;
  error?: string;
}

export interface ReconcileResult {
  total_compared: number;
  matched: number;
  missing_in_kob: number;
  missing_in_bank: number;
  amount_mismatches: number;
  details?: Array<Record<string, unknown>>;
}

export interface BankHealthResult {
  healthy: boolean;
  latency_ms?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface BankConnectorContext {
  bank_id: string;
  config_id: string;
  credentials: Record<string, string>;
  config: Record<string, unknown>;
  environment: BankConnectorEnvironment;
  watermark?: string | null;
}

export interface BankConnector {
  type: BankAdapterType;
  getAccountDetails(ctx: BankConnectorContext, externalAccountId: string): Promise<BankAccountDetails>;
  getBalance(ctx: BankConnectorContext, externalAccountId: string): Promise<BankBalance>;
  getTransactions(ctx: BankConnectorContext, externalAccountId: string, range: DateRange): Promise<BankTransaction[]>;
  initiateTransfer(ctx: BankConnectorContext, payload: TransferPayload): Promise<TransferResult>;
  reconcile(ctx: BankConnectorContext, range: DateRange): Promise<ReconcileResult>;
  healthCheck(ctx: BankConnectorContext): Promise<BankHealthResult>;
  requiredCredentialFields(): string[];
  requiredConfigFields(): string[];
}
