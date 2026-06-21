// E2E smoke test for the Promise to Pay edge functions (sandbox).
// Exercises: create → match (partial) → match (full → kept) → sweep (broken)
import 'https://deno.land/std@0.224.0/dotenv/load.ts';
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL')!;
const ANON = Deno.env.get('VITE_SUPABASE_PUBLISHABLE_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TEST_USER = Deno.env.get('PTP_TEST_USER_ID');
const TEST_LOAN = Deno.env.get('PTP_TEST_LOAN_ID');

Deno.test({
  name: 'ptp create → match partial → match full → kept',
  ignore: !SERVICE || !TEST_USER || !TEST_LOAN,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: created, error: cErr } = await admin.from('promise_to_pay').insert({
      user_id: TEST_USER!,
      loan_account_id: TEST_LOAN!,
      promised_amount: 100,
      promised_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      payment_method: 'pay_by_bank',
    }).select('*').single();
    assert(!cErr, cErr?.message);
    assertEquals(created!.status, 'scheduled');

    // partial match
    let r = await fetch(`${SUPABASE_URL}/functions/v1/ptp-settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE}` },
      body: JSON.stringify({ mode: 'match', loan_account_id: TEST_LOAN, amount: 40 }),
    });
    const partial = await r.json();
    assertEquals(partial.promise.status, 'partially_kept');

    // full match
    r = await fetch(`${SUPABASE_URL}/functions/v1/ptp-settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE}` },
      body: JSON.stringify({ mode: 'match', loan_account_id: TEST_LOAN, amount: 60 }),
    });
    const full = await r.json();
    assertEquals(full.promise.status, 'kept');

    // cleanup
    await admin.from('promise_to_pay').delete().eq('id', created!.id);
  },
});

Deno.test({
  name: 'ptp sweep marks overdue as broken',
  ignore: !SERVICE || !TEST_USER || !TEST_LOAN,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: overdue } = await admin.from('promise_to_pay').insert({
      user_id: TEST_USER!,
      loan_account_id: TEST_LOAN!,
      promised_amount: 50,
      promised_date: new Date().toISOString().slice(0, 10),
      payment_method: 'pay_by_bank',
    }).select('*').single();
    // backdate
    await admin.from('promise_to_pay').update({ promised_date: '2020-01-01' }).eq('id', overdue!.id);
    const r = await fetch(`${SUPABASE_URL}/functions/v1/ptp-settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE}` },
      body: JSON.stringify({ mode: 'sweep', grace_days: 0 }),
    });
    const out = await r.json();
    assert(out.broken >= 1);
    const { data: after } = await admin.from('promise_to_pay').select('status').eq('id', overdue!.id).single();
    assertEquals(after?.status, 'broken');
    await admin.from('promise_to_pay').delete().eq('id', overdue!.id);
  },
});
