import type { BankConnector, BankAdapterType } from './types.ts';
import { restBankConnector } from './rest-bank.ts';
import { sqlBankConnector } from './sql-bank.ts';
import { fileBankConnector } from './file-bank.ts';

const REGISTRY: Record<BankAdapterType, BankConnector> = {
  rest: restBankConnector,
  sql: sqlBankConnector,
  file: fileBankConnector,
  // soap is implemented in payment-connectors/soap-bank.ts and exposed for transfers there.
  // For the unified BankConnector contract we provide a thin facade in soap when needed.
  soap: restBankConnector, // placeholder — SOAP transfers handled via existing payment-connector path
};

export function getBankConnector(type: BankAdapterType): BankConnector {
  const c = REGISTRY[type];
  if (!c) throw new Error(`Unknown bank adapter type: ${type}`);
  return c;
}

export function listAdapterTypes(): BankAdapterType[] {
  return ['rest', 'sql', 'file', 'soap'];
}
