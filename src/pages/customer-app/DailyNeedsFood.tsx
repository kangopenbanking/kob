import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  Search,
  SlidersHorizontal,
  UtensilsCrossed,
  Soup,
  Pizza,
  Coffee,
  CupSoda,
  Salad,
  IceCream,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { StoreCard } from "@/components/daily-needs/StoreCard";
import { Skeleton } from "@/components/ui/skeleton";

type Sort = "rating" | "fastest" | "name";

type CuisineFilter = {
  key: string;
  label: string;
  icon: LucideIcon;
  // Tailwind classes for the inactive (tinted) state
  tint: string;
  // Tailwind classes for the active (filled) state
  active: string;
};

const CUISINE_FILTERS: CuisineFilter[] = [
  { key: "All",       label: "All",        icon: UtensilsCrossed, tint: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-200 dark:border-slate-700",   active: "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100" },
  { key: "Local",     label: "Local",      icon: Soup,            tint: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",   active: "bg-amber-600 text-white border-amber-600" },
  { key: "Fast food", label: "Fast food",  icon: Pizza,           tint: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900",               active: "bg-red-600 text-white border-red-600" },
  { key: "Breakfast", label: "Breakfast",  icon: Coffee,          tint: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900", active: "bg-orange-600 text-white border-orange-600" },
  { key: "Drinks",    label: "Drinks",     icon: CupSoda,         tint: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900",               active: "bg-sky-600 text-white border-sky-600" },
  { key: "Healthy",   label: "Healthy",    icon: Salad,           tint: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900", active: "bg-emerald-600 text-white border-emerald-600" },
  { key: "Desserts",  label: "Desserts",   icon: IceCream,        tint: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-200 dark:border-pink-900",         active: "bg-pink-600 text-white border-pink-600" },
];

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
      <div className="relative bg-[hsl(20,90%,55%)] text-white px-4 pt-4 pb-5">

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
          {CUISINE_FILTERS.map((c) => {
            const Icon = c.icon;
            const isActive = cuisine === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCuisine(c.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 h-9 pl-2.5 pr-3.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                  isActive
                    ? `${c.active} shadow-sm scale-[1.02]`
                    : `${c.tint} hover:scale-[1.02] hover:shadow-sm`
                }`}
                aria-pressed={isActive}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {c.label}
              </button>
            );
          })}
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
