import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Search, UtensilsCrossed, Pill, MapPin, History, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoreCard } from "@/components/daily-needs/StoreCard";
import { Skeleton } from "@/components/ui/skeleton";
import foodCardAsset from "@/assets/food_card.png.asset.json";
import pharmacyCardAsset from "@/assets/pharmacy_card.png.asset.json";

function CardImage({ src, alt, className, heightRatioClass }: { src: string; alt: string; className?: string; heightRatioClass?: string }) {
  const [loaded, setLoaded] = useState(false);
  const handleLoad = useCallback(() => setLoaded(true), []);
  return (
    <div className={`pointer-events-none absolute -right-3 bottom-0 w-auto overflow-hidden ${heightRatioClass ?? "h-[78%] sm:h-[82%]"}`}>
      {!loaded && <Skeleton className="absolute inset-0 rounded-none bg-white/20" />}
      <img
        src={src}
        alt={alt}
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        onLoad={handleLoad}
        className={`h-full w-auto object-contain object-bottom drop-shadow-[0_8px_16px_rgba(0,0,0,0.25)] transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
      />
    </div>
  );
}

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
    <div className="pb-10 animate-fade-in">
      {/* Hero header */}
      <div className="relative bg-[hsl(20,90%,55%)] text-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"
            className="text-white hover:bg-white/15 hover:text-white -ml-2">
            <ChevronLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Daily Needs</h1>
            <p className="text-xs text-white/85">Food, pharmacy & essentials delivered</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/app/daily-needs/search?q=${encodeURIComponent(query)}`)}
            placeholder="Search food or pharmacy"
            className="pl-10 h-12 rounded-2xl bg-white text-foreground border-0 shadow-lg"
          />
        </div>
      </div>

      <div className="px-4 mt-6 space-y-8">

        <section className="grid grid-cols-2 gap-3">
          <Card
            onClick={() => navigate("/app/daily-needs/food")}
            className="relative cursor-pointer overflow-hidden aspect-[3/4] flex flex-col justify-between p-4 border-0 shadow-md hover-scale transition-all bg-[hsl(20,90%,55%)] text-white"
          >
            <CardImage
              src={foodCardAsset.url}
              alt=""
              heightRatioClass="h-[78%] sm:h-[82%]"
              className="sm:-right-2"
            />
            <div className="relative size-11 rounded-2xl border-2 border-white/70 flex items-center justify-center">
              <UtensilsCrossed className="size-5" strokeWidth={2} />
            </div>
            <div className="relative">
              <h2 className="font-bold text-lg">Food</h2>
              <p className="text-xs text-white/85">Restaurants & meals</p>
            </div>
          </Card>
          <Card
            onClick={() => navigate("/app/daily-needs/pharmacy")}
            className="relative cursor-pointer overflow-hidden aspect-[3/4] flex flex-col justify-between p-4 border-0 shadow-md hover-scale transition-all bg-[hsl(160,65%,40%)] text-white"
          >
            <CardImage
              src={pharmacyCardAsset.url}
              alt=""
              heightRatioClass="h-[82%] sm:h-[86%]"
              className="sm:-right-2"
            />
            <div className="relative size-11 rounded-2xl border-2 border-white/70 flex items-center justify-center">
              <Pill className="size-5" strokeWidth={2} />
            </div>
            <div className="relative">
              <h2 className="font-bold text-lg">Pharmacy</h2>
              <p className="text-xs text-white/85">Medicine & wellness</p>
            </div>
          </Card>
        </section>


        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="size-4 text-[hsl(20,90%,55%)]" strokeWidth={2} /> Nearby stores
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
            <History className="size-4 text-[hsl(220,70%,55%)]" strokeWidth={2} /> Recent orders
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your past orders will appear here.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((o) => (
                <Card key={o.id} onClick={() => navigate(`/app/daily-needs/orders/${o.id}`)} className="p-3 flex items-center gap-3 cursor-pointer hover:bg-accent transition-colors">
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
            <Sparkles className="size-4 text-[hsl(280,60%,55%)]" strokeWidth={2} /> Recommended for you
          </h2>
          <p className="text-sm text-muted-foreground">Suggestions will appear as you order.</p>
        </section>
      </div>
    </div>
  );
}
