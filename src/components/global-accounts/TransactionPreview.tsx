import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ALLOWED_NIUM_POP_CODES,
  DEFAULT_NIUM_POP_CODE,
  type NiumPopCode,
} from "@/constants/nium-compliance";
import { cn } from "@/lib/utils";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";

interface Breakdown {
  source_amount: number;
  source_currency: string;
  fx_rate_nium: number;
  fx_spread_bps: number;
  xaf_gross: number;
  xaf_spread_revenue: number;
  xaf_withdrawal_fee: number;
  xaf_net_credited: number;
  routing: "KANG_WALLET" | "MOBILE_MONEY";
}

const xaf = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " XAF";

const Row = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className={cn("font-medium tabular-nums", accent && "text-foreground font-semibold")}>
      {value}
    </span>
  </div>
);

interface Props {
  currency: string;
  defaultRouting: "KANG_WALLET" | "MOBILE_MONEY";
  sampleAmount?: number;
}

/**
 * Transaction Preview — double-spread FX transparency.
 *
 * COMPLIANCE CHECK: gross → Nium FX → KOB spread → MoMo fee → Net XAF must
 * be visible to the user before they confirm any cash-out preference change.
 * Cites: BEAC Règlement 02/18/CEMAC/UMAC/CM (transparency of FX charges).
 */
export function TransactionPreview({ currency, defaultRouting, sampleAmount = 100 }: Props) {
  const [popCode, setPopCode] = useState<NiumPopCode>(DEFAULT_NIUM_POP_CODE);
  const [routing, setRouting] = useState(defaultRouting);
  const [amount, setAmount] = useState(sampleAmount);
  const [data, setData] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke("nium-quote-payout", {
        body: { source_amount: amount, source_currency: currency, routing },
      })
      .then(({ data, error }) => {
        if (cancel) return;
        if (error) setError(extractEdgeFunctionError(error, "Preview temporarily unavailable. Please try again."));
        else setData(data as Breakdown);
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [amount, currency, routing]);

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
              Transaction preview
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              See the net XAF you'd receive at today's rate.
            </div>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="text-muted-foreground">Sample amount</span>
            <div className="flex items-center rounded-md border bg-background px-2 h-9">
              <span className="text-muted-foreground mr-1">{currency}</span>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Number(e.target.value || 0)))}
                className="w-full bg-transparent outline-none text-sm tabular-nums"
                aria-label="Sample amount"
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Route</span>
            <select
              value={routing}
              onChange={(e) => setRouting(e.target.value as Breakdown["routing"])}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              aria-label="Cash-out route"
            >
              <option value="KANG_WALLET">Kang Wallet</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
            </select>
          </label>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-xs text-muted-foreground">Purpose of payment (BEAC)</legend>
          <div className="grid grid-cols-2 gap-2">
            {ALLOWED_NIUM_POP_CODES.map((code) => (
              <label
                key={code}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs cursor-pointer",
                  popCode === code
                    ? "border-foreground bg-muted/40"
                    : "border-border hover:bg-muted/30",
                )}
              >
                <input
                  type="radio"
                  name="pop"
                  className="sr-only"
                  checked={popCode === code}
                  onChange={() => setPopCode(code)}
                />
                <span className="font-medium">{code}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5">
          {loading && (
            <>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
            </>
          )}
          {error && (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Quote unavailable. {error}</span>
            </div>
          )}
          {!loading && !error && data && (
            <>
              <Row
                label={`Gross (${currency})`}
                value={`${data.source_amount.toLocaleString()} ${currency}`}
              />
              <Row
                label={`Nium FX rate`}
                value={`1 ${currency} = ${data.fx_rate_nium.toFixed(2)} XAF`}
              />
              <Row label="XAF gross" value={xaf(data.xaf_gross)} />
              <Row
                label={`KOB FX spread (${(data.fx_spread_bps / 100).toFixed(2)}%)`}
                value={`− ${xaf(data.xaf_spread_revenue)}`}
              />
              {routing === "MOBILE_MONEY" && (
                <Row
                  label="Mobile Money fee"
                  value={`− ${xaf(data.xaf_withdrawal_fee)}`}
                />
              )}
              <div className="my-1 h-px bg-border/70" />
              <Row label="Net to you" value={xaf(data.xaf_net_credited)} accent />
            </>
          )}
        </div>

        <p className="text-[11px] leading-snug text-muted-foreground">
          Indicative only. The final amount uses the FX rate live at the moment Nium credits
          the funds. BEAC requires every cross-border settlement to declare a Purpose of
          Payment; only the two codes above are accepted.
        </p>
      </CardContent>
    </Card>
  );
}
