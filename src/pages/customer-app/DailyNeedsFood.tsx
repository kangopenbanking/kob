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

const LS_KEY = "kob:daily-needs:food-filters";

type Persisted = { cuisines?: string[]; sort?: Sort };

function readPersisted(): Persisted {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : {};
  } catch {
    return {};
  }
}

export default function DailyNeedsFood() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(params.get("q") ?? "");

  // Multi-select cuisines. URL takes precedence, then localStorage, else ["All"].
  const initialCuisines = (() => {
    const fromUrl = params.get("c");
    if (fromUrl) return fromUrl.split(",").filter(Boolean);
    const stored = readPersisted().cuisines;
    if (stored && stored.length) return stored;
    return ["All"];
  })();
  const [cuisines, setCuisines] = useState<string[]>(initialCuisines);

  const initialSort = ((params.get("s") as Sort) ?? readPersisted().sort ?? "rating") as Sort;
  const [sort, setSort] = useState<Sort>(initialSort);

  const toggleCuisine = (key: string) => {
    setCuisines((prev) => {
      if (key === "All") return ["All"];
      const without = prev.filter((k) => k !== "All");
      const next = without.includes(key) ? without.filter((k) => k !== key) : [...without, key];
      return next.length === 0 ? ["All"] : next;
    });
  };

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

  // Persist + sync URL state for shareable filters
  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (cuisines.length && !(cuisines.length === 1 && cuisines[0] === "All")) {
      next.set("c", cuisines.join(","));
    }
    if (sort !== "rating") next.set("s", sort);
    setParams(next, { replace: true });
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify({ cuisines, sort }));
    } catch {
      /* ignore */
    }
  }, [query, cuisines, sort, setParams]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = cuisines.includes("All");
    return stores.filter((s) => {
      const matchesQ = !q || s.name?.toLowerCase().includes(q);
      // Cuisine tags not yet on store rows — "All" passes everything; specific picks pass once tags exist.
      const matchesC = all;
      return matchesQ && matchesC;
    });
  }, [stores, query, cuisines]);

  const activeCount = cuisines.includes("All") ? 0 : cuisines.length;

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
        {/* Sort + active filter summary — own row so it never overlaps the category pills */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground min-w-0 truncate">
            {activeCount > 0 ? (
              <span>
                <span className="font-semibold text-foreground">{activeCount}</span>{" "}
                {activeCount === 1 ? "filter" : "filters"} active
                <button
                  type="button"
                  onClick={() => setCuisines(["All"])}
                  className="ml-2 underline underline-offset-2 hover:text-foreground"
                >
                  Clear
                </button>
              </span>
            ) : (
              <span>Showing all categories</span>
            )}
          </div>
          <div className="shrink-0 inline-flex items-center gap-1.5 text-xs">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
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

        {/* Category pills:
            - Mobile: horizontal touch-scroll, snap, generous tap target (h-10).
            - sm+: wraps into a tidy grid so nothing clips behind sort. */}
        <div
          role="group"
          aria-label="Filter by category"
          className="-mx-4 px-4 flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none sm:mx-0 sm:px-0 sm:overflow-visible sm:flex-wrap sm:snap-none"
        >
          {CUISINE_FILTERS.map((c) => {
            const Icon = c.icon;
            const isActive = cuisines.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleCuisine(c.key)}
                className={`snap-start shrink-0 inline-flex items-center gap-1.5 h-10 pl-3 pr-3.5 rounded-full text-xs font-semibold border transition-all duration-200 active:scale-95 ${
                  isActive
                    ? `${c.active} shadow-sm`
                    : `${c.tint} hover:shadow-sm`
                }`}
                aria-pressed={isActive}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {c.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No restaurants match your search.</p>
            {(query || activeCount > 0) && (
              <Button variant="outline" size="sm" onClick={() => { setQuery(""); setCuisines(["All"]); }}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">{visible.map((s) => <StoreCard key={s.id} store={s} />)}</div>
        )}
      </div>
    </div>
  );
}
