import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const EUR_PEGGED: Record<string, number> = {
  XAF: 655.957,
  XOF: 655.957,
};

async function fetchFrankfurter(from: string, to: string, amount: number): Promise<{ rate: number; date: string } | null> {
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}&amount=${amount}`);
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data.rates?.[to];
    return rate ? { rate: rate / amount, date: data.date } : null;
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const from = url.searchParams.get('from') || 'XAF';
    const to = url.searchParams.get('to') || 'USD';
    const amount = parseFloat(url.searchParams.get('amount') || '1');

    let rate: number | null = null;
    const fromPeg = EUR_PEGGED[from] ?? null;
    const toPeg = EUR_PEGGED[to] ?? null;

    if (from === to) {
      rate = 1;
    } else if (fromPeg && fromPeg > 0 && toPeg && toPeg > 0) {
      rate = toPeg / fromPeg;
    } else if (toPeg && toPeg > 0) {
      if (from === 'EUR') { rate = toPeg; }
      else {
        const r = await fetchFrankfurter(from, 'EUR', 1);
        if (r) rate = r.rate * toPeg;
      }
    } else if (fromPeg && fromPeg > 0) {
      if (to === 'EUR') { rate = 1 / fromPeg; }
      else {
        const r = await fetchFrankfurter('EUR', to, 1);
        if (r) rate = r.rate / fromPeg;
      }
    } else {
      const r = await fetchFrankfurter(from, to, 1);
      if (r) rate = r.rate;
    }

    if (rate === null) {
      return new Response(JSON.stringify({ error: 'fx_lookup_failed', message: 'Unable to fetch exchange rate' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      from, to, rate,
      amount,
      converted: Math.round(amount * rate * 100) / 100,
      timestamp: new Date().toISOString(),
      source: 'frankfurter',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] exchange-rate error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
