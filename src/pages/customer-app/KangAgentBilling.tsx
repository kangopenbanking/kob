// Kang Agent — User billing history
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type LogRow = {
  id: string;
  payment_reference: string;
  amount: number;
  currency: string;
  status: "success" | "failed";
  reason: string | null;
  created_at: string;
};
type LedgerRow = { id: string; points_change: number; reason: string; created_at: string };

const isKangReason = (r: string | null | undefined) =>
  !!r && /kang|subscription/i.test(r);

export default function KangAgentBilling() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const db = supabase as any;
      const [{ data: l }, { data: le }] = await Promise.all([
        db.from("kang_billing_logs")
          .select("id, payment_reference, amount, currency, status, reason, created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
        db.from("credit_score_ledger")
          .select("id, points_change, reason, created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
      ]);
      setLogs((l as LogRow[]) ?? []);
      setLedger(((le as LedgerRow[]) ?? []).filter((x) => isKangReason(x.reason)));
      setLoading(false);
    })();
  }, [navigate]);

  const impactFor = (log: LogRow): number | null => {
    // Match by closest timestamp within 5 minutes and matching sign expectation
    const t = new Date(log.created_at).getTime();
    const window = 5 * 60 * 1000;
    const candidates = ledger.filter((le) => Math.abs(new Date(le.created_at).getTime() - t) < window);
    if (candidates.length === 0) return null;
    const wanted = log.status === "success" ? 1 : -1;
    const pick = candidates.find((c) => Math.sign(c.points_change) === wanted) ?? candidates[0];
    return pick.points_change;
  };

  const copy = async (ref: string) => {
    try {
      await navigator.clipboard.writeText(ref);
      setCopied(ref);
      toast.success("Payment reference copied");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="flex flex-col bg-background" style={{ minHeight: "calc(100dvh - 5rem)" }}>
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/85 backdrop-blur px-3 py-2.5">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate("/app/kang-agent")} aria-label="Back">
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold leading-tight">Billing History</h1>
          <p className="text-[11px] text-muted-foreground leading-tight">Kang Agent subscription payments</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-3 py-4 space-y-2">
        {loading ? (
          <>
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
          </>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Receipt className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">No billing transactions yet.</p>
            <p className="text-[11px] mt-1">Your Kang Agent Premium payments will appear here.</p>
          </div>
        ) : (
          logs.map((log) => {
            const impact = impactFor(log);
            const dt = new Date(log.created_at);
            const shortRef = `${log.payment_reference.slice(0, 8)}…${log.payment_reference.slice(-4)}`;
            return (
              <Card key={log.id} className="p-3 rounded-2xl border border-border/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold">
                        -{Math.round(log.amount).toLocaleString()} {log.currency}
                      </span>
                      {log.status === "success" ? (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px] h-5 px-1.5">
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px] h-5 px-1.5">
                          Failed
                        </Badge>
                      )}
                      {impact != null && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-5 px-1.5 ${
                            impact > 0
                              ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                              : "border-destructive/40 text-destructive"
                          }`}
                        >
                          {impact > 0 ? "+" : ""}{impact} score
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {log.reason ?? "Subscription payment"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <code className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded font-mono">
                        {shortRef}
                      </code>
                      <button
                        onClick={() => copy(log.payment_reference)}
                        className="p-0.5 rounded hover:bg-muted transition"
                        aria-label="Copy reference"
                      >
                        {copied === log.payment_reference ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-foreground/80">{dt.toLocaleDateString()}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
