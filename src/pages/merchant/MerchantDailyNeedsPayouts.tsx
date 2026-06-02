import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Wallet, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

type Order = { id: string; total_xaf: number; service_fee_xaf: number; delivery_fee_xaf: number; created_at: string; delivered_at: string | null };

export default function MerchantDailyNeedsPayouts() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: stores } = await supabase.from("daily_needs_stores").select("id").eq("merchant_id", user.id);
      const ids = (stores ?? []).map((s) => s.id);
      if (ids.length === 0) { setLoading(false); return; }

      const since = subDays(new Date(), 90).toISOString();
      const { data } = await supabase
        .from("daily_needs_orders")
        .select("id,total_xaf,service_fee_xaf,delivery_fee_xaf,created_at,delivered_at")
        .in("store_id", ids)
        .eq("status", "delivered")
        .eq("escrow_status", "released")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      setOrders((data ?? []) as any);
      setLoading(false);
    })();
  }, []);

  const totalGross = orders.reduce((s, o) => s + Number(o.total_xaf), 0);
  const totalFees = orders.reduce((s, o) => s + Number(o.service_fee_xaf) + Number(o.delivery_fee_xaf), 0);
  const totalNet = totalGross - totalFees;

  const exportCsv = () => {
    const rows = [["order_id", "delivered_at", "gross_xaf", "service_fee_xaf", "delivery_fee_xaf", "net_xaf"]];
    for (const o of orders) {
      const net = Number(o.total_xaf) - Number(o.service_fee_xaf) - Number(o.delivery_fee_xaf);
      rows.push([o.id, o.delivered_at ?? "", String(o.total_xaf), String(o.service_fee_xaf), String(o.delivery_fee_xaf), String(net)]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ddn-payouts-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Daily Needs Payouts</h1>
          <p className="text-sm text-muted-foreground">Released escrow earnings (last 90 days)</p>
        </div>
        {orders.length > 0 && <Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-4 mr-1" />CSV</Button>}
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Gross</p><p className="text-sm font-semibold">{Math.round(totalGross).toLocaleString()}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Fees</p><p className="text-sm font-semibold">-{Math.round(totalFees).toLocaleString()}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Net</p><p className="text-sm font-semibold text-emerald-600">{Math.round(totalNet).toLocaleString()}</p></Card>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : orders.length === 0 ? (
        <EmptyState icon={<Wallet className="size-6 text-muted-foreground" />} title="No payouts yet" description="Completed Daily Needs orders will appear here." />
      ) : (
        <Card className="divide-y">
          {orders.map((o) => {
            const net = Number(o.total_xaf) - Number(o.service_fee_xaf) - Number(o.delivery_fee_xaf);
            return (
              <div key={o.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">{o.id.slice(0, 8)}…</p>
                  <p className="text-[11px] text-muted-foreground">{o.delivered_at ? format(new Date(o.delivered_at), "MMM d, HH:mm") : "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{Math.round(net).toLocaleString()} XAF</p>
                  <Badge variant="outline" className="text-[10px]">net</Badge>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
