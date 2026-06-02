import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { StoreCard } from "@/components/daily-needs/StoreCard";

export default function DailyNeedsSearch() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = (params.get("q") ?? "").trim();
    if (!term) { setStores([]); setProducts([]); return; }
    setLoading(true);
    let cancelled = false;
    (async () => {
      const [{ data: s }, { data: p }] = await Promise.all([
        supabase.from("daily_needs_stores")
          .select("id,name,banner_url,rating,preparation_time_min,vertical")
          .eq("status", "active").ilike("name", `%${term}%`).limit(15),
        supabase.from("daily_needs_products")
          .select("id,name,price_xaf,store_id,daily_needs_stores(name)")
          .ilike("name", `%${term}%`).limit(20),
      ]);
      if (cancelled) return;
      setStores(s ?? []);
      setProducts(p ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [params]);

  const submit = () => setParams({ q });

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft className="size-5" />
        </Button>
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Search food, pharmacy, products"
            className="pl-10 h-10"
          />
        </div>
      </header>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : !params.get("q") ? (
        <EmptyState icon={<SearchIcon className="size-6 text-muted-foreground" />} title="Start searching" description="Find restaurants, pharmacies and products." />
      ) : stores.length === 0 && products.length === 0 ? (
        <EmptyState icon={<SearchIcon className="size-6 text-muted-foreground" />} title="No results" description={`Nothing matched "${params.get("q")}"`} />
      ) : (
        <div className="space-y-6">
          {stores.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-2 text-foreground">Stores</h2>
              <div className="grid gap-3">{stores.map((s) => <StoreCard key={s.id} store={s} />)}</div>
            </section>
          )}
          {products.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-2 text-foreground">Products</h2>
              <div className="space-y-2">
                {products.map((p) => (
                  <Card key={p.id} onClick={() => navigate(`/app/daily-needs/store/${p.store_id}`)} className="p-3 flex items-center justify-between cursor-pointer hover:bg-accent">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.daily_needs_stores?.name}</p>
                    </div>
                    <p className="text-sm font-semibold">{Number(p.price_xaf).toLocaleString()} XAF</p>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
