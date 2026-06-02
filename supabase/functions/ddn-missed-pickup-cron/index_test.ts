import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleMissedPickupCron } from "./index.ts";

// Minimal fake supabase client. The cron only ever calls .rpc() and .from().select().
function makeFakeSb(opts: {
  rpcResult?: { data?: number; error?: { message: string } };
  pushEnabled?: boolean;
  stuck?: Array<{ id: string; driver_id: string; assigned_at: string }>;
}) {
  return {
    rpc: (_name: string) => Promise.resolve(opts.rpcResult ?? { data: 0, error: null }),
    from: (table: string) => {
      if (table === "ddn_assignments") {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          not: () => Promise.resolve({ data: opts.stuck ?? [], error: null }),
        };
        return chain;
      }
      // Anything else (config table read by isDriverPushEnabled) returns disabled
      const cfg: any = {
        select: () => cfg,
        eq: () => cfg,
        maybeSingle: () => Promise.resolve({ data: { enabled: opts.pushEnabled ?? false }, error: null }),
        single: () => Promise.resolve({ data: { enabled: opts.pushEnabled ?? false }, error: null }),
      };
      return cfg;
    },
  };
}

Deno.test("OPTIONS preflight returns ok", async () => {
  const res = await handleMissedPickupCron(new Request("http://x", { method: "OPTIONS" }), makeFakeSb({}));
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("RPC error bubbles up as 500", async () => {
  const res = await handleMissedPickupCron(
    new Request("http://x", { method: "POST" }),
    makeFakeSb({ rpcResult: { data: undefined, error: { message: "boom" } } }),
  );
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.ok, false);
  assertEquals(body.error, "boom");
});

Deno.test("Flagged count is returned and push fanout skipped when push disabled", async () => {
  const res = await handleMissedPickupCron(
    new Request("http://x", { method: "POST" }),
    makeFakeSb({ rpcResult: { data: 3, error: null }, pushEnabled: false }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
  assertEquals(body.flagged_count, 3);
  assertEquals(body.pushed, 0);
});

Deno.test("Edge case: zero stuck assignments still returns ok", async () => {
  const res = await handleMissedPickupCron(
    new Request("http://x", { method: "POST" }),
    makeFakeSb({ rpcResult: { data: 0, error: null }, pushEnabled: true, stuck: [] }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.flagged_count, 0);
  assertEquals(body.pushed, 0);
});
