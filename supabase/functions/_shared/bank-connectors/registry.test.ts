// Unit tests for bank connector registry — all four adapter types resolvable.

import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { getBankConnector, listAdapterTypes } from './registry.ts';
import type { BankAdapterType } from './types.ts';

Deno.test('registry: lists all four adapter types', () => {
  const types = listAdapterTypes();
  assertEquals(types.length, 4);
  for (const t of ['rest', 'sql', 'file', 'soap'] as BankAdapterType[]) {
    assert(types.includes(t), `missing type ${t}`);
  }
});

Deno.test('registry: every adapter type resolves to a connector with full contract', () => {
  for (const t of listAdapterTypes()) {
    const c = getBankConnector(t);
    assert(c, `missing connector for ${t}`);
    for (const fn of [
      'getAccountDetails', 'getBalance', 'getTransactions',
      'initiateTransfer', 'reconcile', 'healthCheck',
      'requiredCredentialFields', 'requiredConfigFields',
    ]) {
      assert(typeof (c as unknown as Record<string, unknown>)[fn] === 'function', `${t} missing ${fn}`);
    }
  }
});

Deno.test('registry: unknown type throws', () => {
  assertThrows(() => getBankConnector('unknown' as BankAdapterType));
});
