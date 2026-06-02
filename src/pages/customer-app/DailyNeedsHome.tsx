import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, UtensilsCrossed, Pill, MapPin, History, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoreCard } from "@/components/daily-needs/StoreCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function DailyNeedsHome() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [nearby, setNearby] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: stores }, { data: orders }] = await Promise.all([
        supabase.from("daily_needs_stores")
          .select("id, name, banner_url, rating, preparation_time_min, vertical")
          .eq("status", "active")
          .limit(8),
        supabase.from("daily_needs_orders")
          .select("id, store_id, total_xaf, status, created_at, daily_needs_stores(name, banner_url)")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (cancelled) return;
      setNearby(stores ?? []);
      setRecent(orders ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="px-4 pt-6 pb-8 space-y-8">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Daily Needs</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/app/daily-needs/search?q=${encodeURIComponent(query)}`)}
            placeholder="Search food or pharmacy"
            className="pl-10 h-12 rounded-2xl"
          />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <Card
          onClick={() => navigate("/app/daily-needs/food")}
          className="cursor-pointer overflow-hidden aspect-[3/4] flex flex-col justify-end p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20 border-border/50"
        >
          <UtensilsCrossed className="size-7 text-foreground/80 mb-auto" />
          <div>
            <h2 className="font-semibold text-foreground">Food</h2>
            <p className="text-xs text-muted-foreground">Restaurants & meals</p>
          </div>
        </Card>
        <Card
          onClick={() => navigate("/app/daily-needs/pharmacy")}
          className="cursor-pointer overflow-hidden aspect-[3/4] flex flex-col justify-end p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 border-border/50"
        >
          <Pill className="size-7 text-foreground/80 mb-auto" />
          <div>
            <h2 className="font-semibold text-foreground">Pharmacy</h2>
            <p className="text-xs text-muted-foreground">Medicine & wellness</p>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin className="size-4" /> Nearby stores
        </h2>
        {loading ? (
          <div className="grid gap-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
        ) : nearby.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stores yet in your area.</p>
        ) : (
          <div className="grid gap-3">
            {nearby.map((s) => <StoreCard key={s.id} store={s} />)}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <History className="size-4" /> Recent orders
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Your past orders will appear here.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((o) => (
              <Card key={o.id} onClick={() => navigate(`/app/daily-needs/orders/${o.id}`)} className="p-3 flex items-center gap-3 cursor-pointer">
                <div className="size-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  {o.daily_needs_stores?.banner_url && <img src={o.daily_needs_stores.banner_url} alt="" className="size-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{o.daily_needs_stores?.name ?? "Order"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{o.status.replace(/_/g, " ")}</p>
                </div>
                <p className="text-sm font-semibold">{Number(o.total_xaf).toLocaleString()} XAF</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="size-4" /> Recommended for you
        </h2>
        <p className="text-sm text-muted-foreground">Suggestions will appear as you order.</p>
      </section>
    </div>
  );
}
