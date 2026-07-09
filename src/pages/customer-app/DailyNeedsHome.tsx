import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Search, UtensilsCrossed, Pill, MapPin, History, Sparkles, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoreCard } from "@/components/daily-needs/StoreCard";
import { Skeleton } from "@/components/ui/skeleton";
// Bundle card images directly so they ship in the built app and work
// on installed PWAs / custom domains where /__l5e/ CDN paths are unavailable.
import foodCardUrl from "@/assets/food_card.png";
import pharmacyCardUrl from "@/assets/pharmacy_card.png";
const foodCardAsset = { url: foodCardUrl };
const pharmacyCardAsset = { url: pharmacyCardUrl };
import { SafeImage } from "@/components/common/SafeImage";

function CardImage({ src, alt, className, heightRatioClass }: { src: string; alt: string; className?: string; heightRatioClass?: string }) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    <div className={`pointer-events-none absolute -right-3 bottom-0 h-full w-[70%] ${heightRatioClass ?? ""}`}>
      {!loaded && <Skeleton className="absolute inset-y-0 right-0 w-1/2 rounded-none bg-white/20" />}
      <SafeImage
        ref={imgRef}
        src={src}
        alt={alt}
        aria-hidden="true"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`absolute right-0 bottom-0 h-[88%] w-auto max-w-none object-contain object-bottom drop-shadow-[0_8px_16px_rgba(0,0,0,0.25)] transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
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
          .select("id, store_id, total_xaf, status, created_at, daily_needs_stores(name, banner_url, vertical)")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (cancelled) return;
      setNearby(stores ?? []);
      setRecent(orders ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const ACTIVE = new Set(["received", "accepted", "preparing", "ready", "picked_up", "on_the_way", "arriving"]);
  const activeFor = (vertical: "food" | "pharmacy") =>
    recent.find((o) => o.daily_needs_stores?.vertical === vertical && ACTIVE.has(o.status));
  const goVertical = (vertical: "food" | "pharmacy") => {
    const active = activeFor(vertical);
    if (active) navigate(`/app/daily-needs/orders/${active.id}/details`);
    else navigate(`/app/daily-needs/${vertical}`);
  };

  return (
    <div className="pb-10 animate-fade-in">
      {/* Hero header */}
      <div className="relative bg-[hsl(20,90%,55%)] text-white px-4 pt-4 pb-5">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"
            className="text-white hover:bg-white/15 hover:text-white -ml-2">
            <ChevronLeft />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight">Daily Needs</h1>
            <p className="text-xs text-white/85">Food, pharmacy & essentials delivered</p>
          </div>
          <Button
            onClick={() => navigate("/app/daily-needs/orders")}
            size="sm"
            variant="secondary"
            className="h-9 rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-sm gap-1.5 px-3"
            aria-label="My orders"
          >
            <Receipt className="size-4" strokeWidth={2} />
            <span className="text-xs font-semibold">My orders</span>
          </Button>
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
            onClick={() => goVertical("food")}
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
              {activeFor("food") && (
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-white/95">
                  <span className="size-1.5 rounded-full bg-white animate-pulse" /> Active order
                </p>
              )}
            </div>
          </Card>
          <Card
            onClick={() => goVertical("pharmacy")}
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
              {activeFor("pharmacy") && (
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-white/95">
                  <span className="size-1.5 rounded-full bg-white animate-pulse" /> Active order
                </p>
              )}
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
                <Card key={o.id} onClick={() => navigate(`/app/daily-needs/orders/${o.id}/details`)} className="p-3 flex items-center gap-3 cursor-pointer hover:bg-accent transition-colors">
                  <div className="size-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {o.daily_needs_stores?.banner_url && <SafeImage src={o.daily_needs_stores.banner_url} alt="" className="size-full object-cover" />}
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
