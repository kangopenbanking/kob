import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDailyNeeds() {
  const [stores, setStores] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, o] = await Promise.all([
        supabase.from("daily_needs_stores").select("id, name, vertical, status, created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("daily_needs_orders").select("id, status, total_xaf, created_at, daily_needs_stores(name)").order("created_at", { ascending: false }).limit(50),
      ]);
      setStores(s.data ?? []); setOrders(o.data ?? []); setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Daily Needs — Admin</h1>
        <Button asChild variant="outline">
          <Link to="/admin/daily-needs/how-it-works">
            <ListChecks className="h-4 w-4 mr-2" /> Edit "How it works" guides
          </Link>
        </Button>
      </div>
      <section className="space-y-3">
        <h2 className="font-semibold">Stores</h2>
        {loading ? <Skeleton className="h-40" /> : (
          <Card className="divide-y">
            {stores.map((s) => (
              <div key={s.id} className="p-3 flex justify-between items-center">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{s.vertical}</p>
                </div>
                <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
              </div>
            ))}
            {stores.length === 0 && <p className="p-4 text-sm text-muted-foreground">No stores.</p>}
          </Card>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Recent orders</h2>
        {loading ? <Skeleton className="h-40" /> : (
          <Card className="divide-y">
            {orders.map((o) => (
              <div key={o.id} className="p-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{o.daily_needs_stores?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{o.status.replace(/_/g, " ")}</p>
                </div>
                <p className="text-sm font-semibold">{Number(o.total_xaf).toLocaleString()} XAF</p>
              </div>
            ))}
            {orders.length === 0 && <p className="p-4 text-sm text-muted-foreground">No orders.</p>}
          </Card>
        )}
      </section>
    </div>
  );
}
