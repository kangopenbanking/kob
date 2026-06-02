import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Wallet, TrendingUp, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export default function DriverEarnings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: d } = await supabase.from("ddn_drivers").select("id").eq("user_id", user.id).maybeSingle();
      if (!d) { setLoading(false); return; }
      const [{ data: w }, { data: h }] = await Promise.all([
        supabase.from("ddn_driver_wallets").select("*").eq("driver_id", d.id).maybeSingle(),
        supabase.from("ddn_driver_earnings").select("*").eq("driver_id", d.id).order("created_at", { ascending: false }).limit(50),
      ]);
      setWallet(w); setHistory(h ?? []); setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-4 space-y-3"><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;

  return (
    <div className="pb-24 animate-fade-in">
      <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(160,65%,38%)] via-[hsl(170,60%,40%)] to-[hsl(195,70%,45%)] text-white px-4 pt-4 pb-10 rounded-b-[2rem]">
        <div className="absolute -top-16 -right-10 size-52 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"
            className="text-white hover:bg-white/15 hover:text-white -ml-2">
            <ChevronLeft />
          </Button>
          <h1 className="text-2xl font-bold">Earnings</h1>
          <Button variant="ghost" size="sm" className="ml-auto text-white hover:bg-white/15 hover:text-white" onClick={() => navigate("/app/driver/payouts")}>
            Payouts
          </Button>
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/85">
            <div className="size-7 rounded-xl border-2 border-white/70 flex items-center justify-center">
              <Wallet className="size-3.5" strokeWidth={2} />
            </div>
            Available balance
          </div>
          <p className="text-4xl font-bold mt-2">{Number(wallet?.available_xaf ?? 0).toLocaleString()} <span className="text-lg font-medium opacity-80">XAF</span></p>
        </div>
      </div>

      <div className="px-4 -mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 border-0 shadow-md bg-[hsl(45,90%,55%)] text-white">
            <div className="size-8 rounded-xl border-2 border-white/70 flex items-center justify-center mb-2">
              <Clock className="size-4" strokeWidth={2} />
            </div>
            <p className="text-xs text-white/85">Pending</p>
            <p className="text-lg font-bold">{Number(wallet?.pending_xaf ?? 0).toLocaleString()} XAF</p>
          </Card>
          <Card className="p-4 border-0 shadow-md bg-[hsl(220,75%,50%)] text-white">
            <div className="size-8 rounded-xl border-2 border-white/70 flex items-center justify-center mb-2">
              <TrendingUp className="size-4" strokeWidth={2} />
            </div>
            <p className="text-xs text-white/85">Lifetime</p>
            <p className="text-lg font-bold">{Number(wallet?.lifetime_earned_xaf ?? 0).toLocaleString()} XAF</p>
          </Card>
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <TrendingUp className="size-4 text-[hsl(160,65%,40%)]" strokeWidth={2} /> Recent deliveries
          </h2>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No deliveries yet.</p>
          ) : (
            history.map((h) => (
              <Card key={h.id} className="p-3 flex items-center justify-between hover:bg-accent transition-colors">
                <div>
                  <p className="text-sm font-semibold text-[hsl(160,65%,40%)]">+{Number(h.driver_earnings_xaf).toLocaleString()} XAF</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString()} · platform {Number(h.platform_fee_xaf).toLocaleString()}
                  </p>
                </div>
                <span className="text-xs capitalize text-muted-foreground">{h.status}</span>
              </Card>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
