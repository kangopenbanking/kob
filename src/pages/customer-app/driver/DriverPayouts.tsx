import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Receipt, CheckCircle2, Clock, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

type Earning = {
  id: string;
  assignment_id: string;
  gross_fee_xaf: number;
  platform_fee_xaf: number;
  driver_earnings_xaf: number;
  status: "pending" | "available" | "paid_out";
  payout_reference: string | null;
  payout_method: string | null;
  paid_at: string | null;
  settled_at: string;
  created_at: string;
};

const statusMeta: Record<string, { label: string; tone: string; icon: any }> = {
  pending:    { label: "Pending",   tone: "bg-amber-500/15 text-amber-600",   icon: Clock },
  available:  { label: "Available", tone: "bg-primary/15 text-primary",       icon: Wallet },
  paid_out:   { label: "Paid out",  tone: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle2 },
};

export default function DriverPayouts() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Earning[]>([]);
  const [filter, setFilter] = useState<"all" | "available" | "paid_out">("all");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: d } = await supabase.from("ddn_drivers").select("id").eq("user_id", user.id).maybeSingle();
      if (!d) { setLoading(false); return; }
      const { data } = await supabase
        .from("ddn_driver_earnings")
        .select("id, assignment_id, gross_fee_xaf, platform_fee_xaf, driver_earnings_xaf, status, payout_reference, payout_method, paid_at, settled_at, created_at")
        .eq("driver_id", d.id)
        .order("settled_at", { ascending: false })
        .limit(200);
      setItems((data ?? []) as Earning[]);
      setLoading(false);
    })();
  }, []);

  const visible = filter === "all" ? items : items.filter(i => i.status === filter);
  const totals = items.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + i.driver_earnings_xaf;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="pb-24 animate-fade-in">
      <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(220,75%,50%)] via-[hsl(225,70%,55%)] to-[hsl(260,60%,55%)] text-white px-4 pt-4 pb-10 rounded-b-[2rem]">
        <div className="absolute -top-12 -right-10 size-44 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"
            className="text-white hover:bg-white/15 hover:text-white -ml-2">
            <ChevronLeft />
          </Button>
          <div className="size-10 rounded-2xl border-2 border-white/70 flex items-center justify-center">
            <Receipt className="size-5" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold">Payout history</h1>
        </div>
        <div className="relative grid grid-cols-3 gap-2">
          {(["pending", "available", "paid_out"] as const).map((k) => {
            const M = statusMeta[k];
            const Icon = M.icon;
            const tones: Record<string, string> = {
              pending: "bg-[hsl(45,90%,55%)]",
              available: "bg-[hsl(160,65%,40%)]",
              paid_out: "bg-[hsl(280,55%,50%)]",
            };
            return (
              <Card key={k} className={`p-3 border-0 shadow-md text-white ${tones[k]}`}>
                <div className="size-7 rounded-lg border-2 border-white/70 flex items-center justify-center mb-1.5">
                  <Icon className="size-3.5" strokeWidth={2} />
                </div>
                <p className="text-[10px] uppercase tracking-wider text-white/85">{M.label}</p>
                <p className="text-sm font-bold">{Number(totals[k] ?? 0).toLocaleString()}</p>
                <p className="text-[10px] text-white/80">XAF</p>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        <div className="flex gap-2 text-xs">
          {(["all", "available", "paid_out"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full border transition ${filter === k ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
            >
              {k === "all" ? "All" : statusMeta[k].label}
            </button>
          ))}
        </div>

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></div>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <Receipt className="size-8 mx-auto mb-2 text-muted-foreground/50" />
          No payouts yet.
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((e) => {
            const M = statusMeta[e.status];
            const Icon = M.icon;
            return (
              <Card key={e.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">+{Number(e.driver_earnings_xaf).toLocaleString()} XAF</p>
                    <p className="text-[11px] text-muted-foreground">
                      Settled {new Date(e.settled_at).toLocaleString()}
                    </p>
                    {e.payout_reference && (
                      <p className="text-[11px] font-mono text-muted-foreground truncate">
                        Ref: {e.payout_reference}{e.payout_method ? ` · ${e.payout_method}` : ""}
                      </p>
                    )}
                    {e.paid_at && (
                      <p className="text-[11px] text-emerald-600">Paid {new Date(e.paid_at).toLocaleString()}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className={`gap-1 ${M.tone}`}>
                    <Icon className="size-3" /> {M.label}
                  </Badge>
                </div>
                <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground border-t pt-2">
                  <span>Gross {Number(e.gross_fee_xaf).toLocaleString()}</span>
                  <span>Platform −{Number(e.platform_fee_xaf).toLocaleString()}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
