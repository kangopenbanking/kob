// Unit tests for the PTP missed-fee helper.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { computeMissedFee } from './ptp-fee.ts';

Deno.test('disabled product returns enabled=false', () => {
  const r = computeMissedFee({ ptp_missed_fee_enabled: false, ptp_missed_fee_type: 'fixed', ptp_missed_fee_value: 10 }, 100);
  assertEquals(r.enabled, false);
  assertEquals(r.amount, 0);
});

Deno.test('fixed fee returns the fixed value', () => {
  const r = computeMissedFee({ ptp_missed_fee_enabled: true, ptp_missed_fee_type: 'fixed', ptp_missed_fee_value: 10 }, 250);
  assertEquals(r.enabled, true);
  assertEquals(r.amount, 10);
  assertEquals(r.type, 'fixed');
  assertEquals(r.capped, false);
});

Deno.test('percentage fee multiplies missed amount', () => {
  const r = computeMissedFee({ ptp_missed_fee_enabled: true, ptp_missed_fee_type: 'percentage', ptp_missed_fee_value: 5 }, 200);
  assertEquals(r.amount, 10); // 5% of 200
  assertEquals(r.type, 'percentage');
});

Deno.test('percentage fee is capped when cap is set', () => {
  const r = computeMissedFee(
    { ptp_missed_fee_enabled: true, ptp_missed_fee_type: 'percentage', ptp_missed_fee_value: 10, ptp_missed_fee_cap: 15 },
    500,
  );
  assertEquals(r.amount, 15);
  assertEquals(r.capped, true);
  assertEquals(r.raw_amount, 50);
});

Deno.test('missed amount <= 0 returns disabled', () => {
  const r = computeMissedFee({ ptp_missed_fee_enabled: true, ptp_missed_fee_type: 'fixed', ptp_missed_fee_value: 10 }, 0);
  assertEquals(r.enabled, false);
});

Deno.test('null product returns disabled', () => {
  const r = computeMissedFee(null, 100);
  assertEquals(r.enabled, false);
});
