import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ShoppingBag, Clock, XCircle, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { format, subDays } from "date-fns";

export default function MerchantDailyNeedsAnalytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    orders30d: 0, gmv: 0, avgBasket: 0, cancelRate: 0, avgPrep: 0, avgRating: 0,
  });
  const [chart, setChart] = useState<{ day: string; orders: number; gmv: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: stores } = await supabase.from("daily_needs_stores").select("id,preparation_time_min,rating").eq("merchant_id", user.id);
      const ids = (stores ?? []).map((s) => s.id);
      if (ids.length === 0) { setLoading(false); return; }

      const since = subDays(new Date(), 30).toISOString();
      const { data: orders } = await supabase
        .from("daily_needs_orders")
        .select("id,status,total_xaf,created_at")
        .in("store_id", ids)
        .gte("created_at", since);

      const rows = orders ?? [];
      const completed = rows.filter((o) => o.status === "delivered");
      const cancelled = rows.filter((o) => o.status === "cancelled");
      const gmv = completed.reduce((s, o) => s + Number(o.total_xaf), 0);
      const avgBasket = completed.length ? gmv / completed.length : 0;
      const cancelRate = rows.length ? (cancelled.length / rows.length) * 100 : 0;

      const { data: revs } = await supabase.from("daily_needs_reviews").select("rating").in("store_id", ids);
      const avgRating = revs?.length ? revs.reduce((s, r) => s + r.rating, 0) / revs.length : 0;

      // bucket by day
      const buckets = new Map<string, { orders: number; gmv: number }>();
      for (let i = 29; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "MMM d");
        buckets.set(d, { orders: 0, gmv: 0 });
      }
      for (const o of completed) {
        const d = format(new Date(o.created_at), "MMM d");
        const b = buckets.get(d);
        if (b) { b.orders += 1; b.gmv += Number(o.total_xaf); }
      }

      const avgPrep = (stores ?? []).reduce((s, x) => s + (x.preparation_time_min ?? 0), 0) / (stores!.length || 1);

      setStats({ orders30d: rows.length, gmv, avgBasket, cancelRate, avgPrep, avgRating });
      setChart(Array.from(buckets.entries()).map(([day, v]) => ({ day, ...v })));
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }

  const tile = (label: string, value: string, Icon: any, sub?: string) => (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </Card>
  );

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Daily Needs Analytics</h1>
        <p className="text-sm text-muted-foreground">Last 30 days</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {tile("Orders", stats.orders30d.toLocaleString(), ShoppingBag)}
        {tile("GMV", `${Math.round(stats.gmv).toLocaleString()} XAF`, TrendingUp)}
        {tile("Avg basket", `${Math.round(stats.avgBasket).toLocaleString()} XAF`, ShoppingBag)}
        {tile("Cancel rate", `${stats.cancelRate.toFixed(1)}%`, XCircle)}
        {tile("Avg prep time", `${Math.round(stats.avgPrep)} min`, Clock)}
        {tile("Avg rating", stats.avgRating ? stats.avgRating.toFixed(1) : "—", Star)}
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium text-sm">Daily orders</p>
          <Badge variant="outline">30d</Badge>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <XAxis dataKey="day" hide />
              <YAxis hide />
              <Tooltip />
              <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
