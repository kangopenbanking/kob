import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { StoreCard } from "@/components/daily-needs/StoreCard";
import { Skeleton } from "@/components/ui/skeleton";

type Sort = "rating" | "fastest" | "name";

const CUISINE_FILTERS = ["All", "Local", "Fast food", "Breakfast", "Drinks", "Healthy", "Desserts"] as const;

export default function DailyNeedsFood() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [cuisine, setCuisine] = useState<string>(params.get("c") ?? "All");
  const [sort, setSort] = useState<Sort>((params.get("s") as Sort) ?? "rating");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const orderCol = sort === "fastest" ? "preparation_time_min" : sort === "name" ? "name" : "rating";
      const ascending = sort !== "rating";
      const { data } = await supabase
        .from("daily_needs_stores")
        .select("id, name, banner_url, rating, preparation_time_min, vertical")
        .eq("vertical", "food")
        .eq("status", "active")
        .order(orderCol, { ascending });
      if (!cancelled) { setStores(data ?? []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [sort]);

  // Sync URL state for shareable filters
  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (cuisine && cuisine !== "All") next.set("c", cuisine);
    if (sort !== "rating") next.set("s", sort);
    setParams(next, { replace: true });
  }, [query, cuisine, sort, setParams]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores.filter((s) => {
      const matchesQ = !q || s.name?.toLowerCase().includes(q);
      // Cuisine filter applied client-side once tags are introduced; for now "All" passes everything.
      const matchesC = cuisine === "All";
      return matchesQ && matchesC;
    });
  }, [stores, query, cuisine]);

  return (
    <div className="pb-28 animate-fade-in">
      <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(20,90%,55%)] to-[hsl(15,80%,50%)] text-white px-4 pt-4 pb-8 rounded-b-[2rem]">
        <div className="absolute -top-16 -right-12 size-44 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"
            className="text-white hover:bg-white/15 hover:text-white -ml-2">
            <ChevronLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Food</h1>
            <p className="text-xs text-white/85">Hot meals, snacks & drinks</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search restaurants or dishes"
            className="pl-10 h-11 rounded-2xl bg-white text-foreground border-0 shadow-lg"
            aria-label="Search restaurants"
          />
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
          {CUISINE_FILTERS.map((c) => (
            <button
              key={c}
              onClick={() => setCuisine(c)}
              className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition ${
                cuisine === c
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
              aria-pressed={cuisine === c}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <SlidersHorizontal className="size-3.5" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="bg-transparent text-foreground font-medium focus:outline-none"
            aria-label="Sort restaurants"
          >
            <option value="rating">Top rated</option>
            <option value="fastest">Fastest</option>
            <option value="name">A–Z</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <p className="text-sm text-muted-foreground">No restaurants match your search.</p>
          {(query || cuisine !== "All") && (
            <Button variant="outline" size="sm" onClick={() => { setQuery(""); setCuisine("All"); }}>Clear filters</Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">{visible.map((s) => <StoreCard key={s.id} store={s} />)}</div>
      )}
      </div>
    </div>
  );
}
