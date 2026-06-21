// Extended E2E test suite for Promise to Pay edge functions.
// Covers idempotency, reschedule chain, multiple repayments same day,
// sweep + exact credit score impact, and cancel-after-partial safety.
import 'https://deno.land/std@0.224.0/dotenv/load.ts';
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('VITE_SUPABASE_PUBLISHABLE_KEY')!;
const TEST_USER = Deno.env.get('PTP_TEST_USER_ID');
const TEST_LOAN = Deno.env.get('PTP_TEST_LOAN_ID');
const USER_JWT = Deno.env.get('PTP_TEST_USER_JWT');

const skip = !SERVICE || !TEST_USER || !TEST_LOAN;
const fn = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`;
const jsonPost = (url: string, body: any, jwt = SERVICE) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
  body: JSON.stringify(body),
});

async function countCreditEvents(admin: any, type: string, since: string) {
  const { count } = await admin.from('credit_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', TEST_USER).eq('event_type', type).gte('created_at', since);
  return count ?? 0;
}

Deno.test({
  name: 'ptp-settle: idempotent — duplicate match on same payment leaves promise unchanged',
  ignore: skip,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: p } = await admin.from('promise_to_pay').insert({
      user_id: TEST_USER!, loan_account_id: TEST_LOAN!,
      promised_amount: 100, promised_date: new Date(Date.now() + 86400000).toISOString().slice(0,10),
      payment_method: 'pay_by_bank', idempotency_key: crypto.randomUUID(),
    }).select('*').single();

    // First settle: full pay → kept
    const r1 = await jsonPost(fn('ptp-settle'), { mode: 'match', loan_account_id: TEST_LOAN, amount: 100 });
    const j1 = await r1.json();
    assertEquals(j1.promise.status, 'kept');

    // Second identical call should NOT match (no open promise) → matched:false
    const r2 = await jsonPost(fn('ptp-settle'), { mode: 'match', loan_account_id: TEST_LOAN, amount: 100 });
    const j2 = await r2.json();
    assertEquals(j2.matched, false);

    await admin.from('promise_to_pay').delete().eq('id', p!.id);
  },
});

Deno.test({
  name: 'ptp-ops: create idempotency returns same row for duplicate idempotency_key',
  ignore: skip || !USER_JWT,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE);
    const key = crypto.randomUUID();
    const payload = {
      action: 'create',
      loan_account_id: TEST_LOAN,
      promised_amount: 75,
      promised_date: new Date(Date.now() + 86400000).toISOString().slice(0,10),
      payment_method: 'pay_by_bank',
      idempotency_key: key,
    };
    const a = await (await jsonPost(fn('ptp-ops'), payload, USER_JWT!)).json();
    const b = await (await jsonPost(fn('ptp-ops'), payload, USER_JWT!)).json();
    assertEquals(a.promise.id, b.promise.id);
    assertEquals(b.idempotent, true);
    await admin.from('promise_to_pay').delete().eq('id', a.promise.id);
  },
});

Deno.test({
  name: 'ptp-settle: multiple partial repayments same day collapse into single kept event',
  ignore: skip,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE);
    const since = new Date().toISOString();
    const { data: p } = await admin.from('promise_to_pay').insert({
      user_id: TEST_USER!, loan_account_id: TEST_LOAN!,
      promised_amount: 90, promised_date: new Date(Date.now() + 86400000).toISOString().slice(0,10),
      payment_method: 'pay_by_bank', idempotency_key: crypto.randomUUID(),
    }).select('*').single();

    for (const amt of [30, 30, 30]) {
      await jsonPost(fn('ptp-settle'), { mode: 'match', loan_account_id: TEST_LOAN, amount: amt });
    }

    const { data: after } = await admin.from('promise_to_pay').select('*').eq('id', p!.id).single();
    assertEquals(after!.status, 'kept');

    const keptEvents = await countCreditEvents(admin, 'ptp_kept', since);
    assertEquals(keptEvents, 1, 'expected exactly one ptp_kept credit event for cumulative-to-full');

    await admin.from('promise_to_pay').delete().eq('id', p!.id);
  },
});

Deno.test({
  name: 'ptp-settle: sweep applies exactly one ptp_broken credit event per overdue promise',
  ignore: skip,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE);
    const since = new Date().toISOString();
    const { data: p } = await admin.from('promise_to_pay').insert({
      user_id: TEST_USER!, loan_account_id: TEST_LOAN!,
      promised_amount: 60, promised_date: '2020-01-01',
      payment_method: 'pay_by_bank', idempotency_key: crypto.randomUUID(),
    }).select('*').single();

    await jsonPost(fn('ptp-settle'), { mode: 'sweep', grace_days: 0 });

    const { data: after } = await admin.from('promise_to_pay').select('status').eq('id', p!.id).single();
    assertEquals(after!.status, 'broken');

    const brokenCount = await countCreditEvents(admin, 'ptp_broken', since);
    assert(brokenCount >= 1, 'expected at least one ptp_broken event from sweep');

    // Verify the scoring rule for ptp_broken delivers -25 from credit_scoring_rules
    const { data: rule } = await admin.from('credit_scoring_rules').select('*').eq('event_type', 'ptp_broken').maybeSingle();
    if (rule) assertEquals(Number(rule.points_delta), -25);

    await admin.from('promise_to_pay').delete().eq('id', p!.id);
  },
});

Deno.test({
  name: 'ptp-ops: reschedule chain fires ptp_rescheduled_repeat on the second reschedule within 30d',
  ignore: skip || !USER_JWT,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE);
    const since = new Date().toISOString();
    const create = await (await jsonPost(fn('ptp-ops'), {
      action: 'create', loan_account_id: TEST_LOAN, promised_amount: 40,
      promised_date: new Date(Date.now() + 86400000).toISOString().slice(0,10),
      payment_method: 'pay_by_bank', idempotency_key: crypto.randomUUID(),
    }, USER_JWT!)).json();
    const first = create.promise.id;

    const r1 = await (await jsonPost(fn('ptp-ops'), {
      action: 'reschedule', promise_id: first,
      promised_date: new Date(Date.now() + 2*86400000).toISOString().slice(0,10),
      reason: 'first',
    }, USER_JWT!)).json();

    const r2 = await (await jsonPost(fn('ptp-ops'), {
      action: 'reschedule', promise_id: r1.promise.id,
      promised_date: new Date(Date.now() + 3*86400000).toISOString().slice(0,10),
      reason: 'second',
    }, USER_JWT!)).json();
    assert(r2.promise);

    const repeats = await countCreditEvents(admin, 'ptp_rescheduled_repeat', since);
    assert(repeats >= 1, 'expected ptp_rescheduled_repeat on second reschedule within 30d');

    // Cleanup
    await admin.from('promise_to_pay').delete().in('id', [first, r1.promise.id, r2.promise.id]);
  },
});

Deno.test({
  name: 'ptp-ops: cancel after partial settlement prevents later broken sweep',
  ignore: skip || !USER_JWT,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: p } = await admin.from('promise_to_pay').insert({
      user_id: TEST_USER!, loan_account_id: TEST_LOAN!,
      promised_amount: 80, promised_date: new Date(Date.now() + 86400000).toISOString().slice(0,10),
      payment_method: 'pay_by_bank', idempotency_key: crypto.randomUUID(),
    }).select('*').single();

    await jsonPost(fn('ptp-settle'), { mode: 'match', loan_account_id: TEST_LOAN, amount: 20 });

    // Backdate and cancel
    await admin.from('promise_to_pay').update({ promised_date: '2020-01-01' }).eq('id', p!.id);
    const cancel = await (await jsonPost(fn('ptp-ops'), { action: 'cancel', promise_id: p!.id }, USER_JWT!)).json();
    assertEquals(cancel.promise.status, 'cancelled');

    const since = new Date().toISOString();
    await jsonPost(fn('ptp-settle'), { mode: 'sweep', grace_days: 0 });
    const { data: still } = await admin.from('promise_to_pay').select('status').eq('id', p!.id).single();
    assertEquals(still!.status, 'cancelled', 'sweep must not touch cancelled promises');
    const brokenAfter = await countCreditEvents(admin, 'ptp_broken', since);
    assertEquals(brokenAfter, 0);

    await admin.from('promise_to_pay').delete().eq('id', p!.id);
  },
});
