// Deno unit tests — Phase 1B-R1I-a.3 hardening of webhook-replay-protection.
//
// Covers:
//   1. computePayloadFingerprint stability + input sensitivity
//   2. enforceReplayWindow: absent, valid, invalid, outside-window
//   3. checkAndRegisterWebhook: fresh insert, duplicate same body,
//      fingerprint mismatch, stale reserve-then-crash retry.
//
// Uses an in-memory Supabase-like stub — no network, no DB.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  checkAndRegisterWebhook,
  computePayloadFingerprint,
  enforceReplayWindow,
} from "./webhook-replay-protection.ts";

/**
 * Minimal in-memory stand-in for the tiny slice of the Supabase client this
 * helper touches: `.from(table).select(...).eq(...).eq(...).gte(...).maybeSingle()`
 * and `.from(table).insert(...).select(...).single()`.
 */
function makeStubClient(initialRows: Array<Record<string, unknown>> = []) {
  const rows: Array<Record<string, unknown>> = [...initialRows];
  let nextId = rows.length + 1;
  return {
    _rows: rows,
    from(_table: string) {
      const filters: Array<(r: Record<string, unknown>) => boolean> = [];
      const q = {
        select(_cols: string) { return q; },
        eq(col: string, val: unknown) { filters.push((r) => r[col] === val); return q; },
        gte(col: string, val: unknown) {
          filters.push((r) => String(r[col]) >= String(val));
          return q;
        },
        async maybeSingle() {
          const found = rows.find((r) => filters.every((f) => f(r)));
          return { data: found ?? null, error: null };
        },
        async single() {
          const found = rows.find((r) => filters.every((f) => f(r)));
          return { data: found ?? null, error: found ? null : { code: "PGRST116" } };
        },
        insert(row: Record<string, unknown>) {
          const id = `row_${nextId++}`;
          const stored = { id, created_at: new Date().toISOString(), ...row };
          rows.push(stored);
          return {
            select(_c: string) {
              return {
                async single() { return { data: { id }, error: null }; },
              };
            },
          };
        },
      };
      return q;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

Deno.test("computePayloadFingerprint is deterministic and input-sensitive", async () => {
  const a = await computePayloadFingerprint('{"x":1}');
  const b = await computePayloadFingerprint('{"x":1}');
  const c = await computePayloadFingerprint('{"x":2}');
  assertEquals(a, b);
  assert(a !== c);
  assertEquals(a.length, 64);
});

Deno.test("enforceReplayWindow tolerates absent timestamps", () => {
  assertEquals(enforceReplayWindow(null).ok, true);
  assertEquals(enforceReplayWindow(undefined).ok, true);
  assertEquals(enforceReplayWindow("").ok, true);
});

Deno.test("enforceReplayWindow accepts fresh, rejects stale and invalid", () => {
  const now = 1_700_000_000_000;
  assertEquals(enforceReplayWindow(now / 1000, 300, now).ok, true);
  assertEquals(enforceReplayWindow(now, 300, now).ok, true);
  const stale = enforceReplayWindow((now - 10 * 60 * 1000) / 1000, 300, now);
  assertEquals(stale.ok, false);
  if (!stale.ok) assertEquals(stale.reason, "outside_replay_window");
  const bad = enforceReplayWindow("not-a-number", 300, now);
  assertEquals(bad.ok, false);
  if (!bad.ok) assertEquals(bad.reason, "invalid_timestamp");
});

Deno.test("checkAndRegisterWebhook: fresh delivery inserts row", async () => {
  const svc = makeStubClient();
  const r = await checkAndRegisterWebhook(svc, {
    source: "nium",
    event_id: "evt_1",
    payload: { a: 1 },
    payload_fingerprint: await computePayloadFingerprint('{"a":1}'),
  });
  assertEquals(r.duplicate, false);
  assertEquals(r.reason, "ok");
  assert(r.inbox_id);
});

Deno.test("checkAndRegisterWebhook: duplicate same body returns duplicate_within_ttl", async () => {
  const fp = await computePayloadFingerprint('{"a":1}');
  const svc = makeStubClient([{
    id: "row_seed",
    source: "nium",
    event_id: "evt_dup",
    payload: { a: 1 },
    is_processed: true,
    created_at: new Date().toISOString(),
  }]);
  const r = await checkAndRegisterWebhook(svc, {
    source: "nium",
    event_id: "evt_dup",
    payload: { a: 1 },
    payload_fingerprint: fp,
  });
  assertEquals(r.duplicate, true);
  assertEquals(r.mismatch, undefined);
  assertEquals(r.reason, "duplicate_within_ttl");
});

Deno.test("checkAndRegisterWebhook: mutated body triggers fingerprint mismatch", async () => {
  const svc = makeStubClient([{
    id: "row_seed",
    source: "nium",
    event_id: "evt_bad",
    payload: { a: 1 },
    is_processed: true,
    created_at: new Date().toISOString(),
  }]);
  const r = await checkAndRegisterWebhook(svc, {
    source: "nium",
    event_id: "evt_bad",
    payload: { a: 999 },
    payload_fingerprint: await computePayloadFingerprint('{"a":999}'),
  });
  assertEquals(r.duplicate, true);
  assertEquals(r.mismatch, true);
  assertEquals(r.reason, "payload_fingerprint_mismatch");
});

Deno.test("checkAndRegisterWebhook: unprocessed stale row is reclaimed for retry", async () => {
  const oldTs = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
  const svc = makeStubClient([{
    id: "row_stale",
    source: "nium",
    event_id: "evt_stale",
    payload: { a: 1 },
    is_processed: false,
    created_at: oldTs,
  }]);
  const r = await checkAndRegisterWebhook(svc, {
    source: "nium",
    event_id: "evt_stale",
    payload: { a: 1 },
    payload_fingerprint: await computePayloadFingerprint('{"a":1}'),
    stale_retry_after_seconds: 60,
  });
  assertEquals(r.duplicate, false);
  assertEquals(r.retried, true);
  assertEquals(r.reason, "stale_retry_reclaimed");
  assertEquals(r.inbox_id, "row_stale");
});

Deno.test("checkAndRegisterWebhook: fresh unprocessed row still deduped (not yet stale)", async () => {
  const svc = makeStubClient([{
    id: "row_hot",
    source: "nium",
    event_id: "evt_hot",
    payload: { a: 1 },
    is_processed: false,
    created_at: new Date().toISOString(),
  }]);
  const r = await checkAndRegisterWebhook(svc, {
    source: "nium",
    event_id: "evt_hot",
    payload: { a: 1 },
    payload_fingerprint: await computePayloadFingerprint('{"a":1}'),
    stale_retry_after_seconds: 90,
  });
  assertEquals(r.duplicate, true);
  assertEquals(r.reason, "duplicate_within_ttl");
});
