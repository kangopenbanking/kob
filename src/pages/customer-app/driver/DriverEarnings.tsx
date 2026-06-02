import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Wallet, TrendingUp } from "lucide-react";
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
    <div className="px-4 pt-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft /></Button>
        <h1 className="text-xl font-semibold">Earnings</h1>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
          <Wallet className="size-3.5" /> Available balance
        </div>
        <p className="text-3xl font-bold">{Number(wallet?.available_xaf ?? 0).toLocaleString()} XAF</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="font-medium">{Number(wallet?.pending_xaf ?? 0).toLocaleString()} XAF</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lifetime</p>
            <p className="font-medium">{Number(wallet?.lifetime_earned_xaf ?? 0).toLocaleString()} XAF</p>
          </div>
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <TrendingUp className="size-4" /> Recent deliveries
        </h2>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No deliveries yet.</p>
        ) : (
          history.map((h) => (
            <Card key={h.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">+{Number(h.driver_earnings_xaf).toLocaleString()} XAF</p>
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
  );
}
