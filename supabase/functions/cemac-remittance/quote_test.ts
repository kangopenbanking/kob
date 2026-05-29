// Deno unit tests for CEMAC remittance quote math.
// Run: deno test --allow-env --allow-net supabase/functions/cemac-remittance/quote_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Pure helpers — mirror those embedded in cemac-remittance/index.ts so the
// math stays under test even if the edge function is offline.
function calcQuote(amountXaf: number, feeBps: number, fxRate = 1) {
  if (!Number.isInteger(amountXaf) || amountXaf <= 0) throw new Error("amount must be positive integer XAF");
  const fee = Math.floor((amountXaf * feeBps) / 10_000);
  const net = amountXaf - fee;
  const receiveXaf = Math.floor(net * fxRate);
  return { amountXaf, fee, net, receiveXaf, fxRate };
}

Deno.test("calcQuote — 50,000 XAF at 100 bps fee, 1:1 FX (CM→GA)", () => {
  const q = calcQuote(50_000, 100, 1);
  assertEquals(q.fee, 500);
  assertEquals(q.net, 49_500);
  assertEquals(q.receiveXaf, 49_500);
});

Deno.test("calcQuote — zero bps (free corridor)", () => {
  const q = calcQuote(10_000, 0, 1);
  assertEquals(q.fee, 0);
  assertEquals(q.net, 10_000);
});

Deno.test("calcQuote — rejects non-integer / non-positive amount", () => {
  let threw = false;
  try {
    calcQuote(-1, 100, 1);
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("calcQuote — high-fee corridor (250 bps)", () => {
  const q = calcQuote(100_000, 250, 1);
  assertEquals(q.fee, 2_500);
  assertEquals(q.net, 97_500);
});
