import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function DailyNeedsStore() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: p }] = await Promise.all([
        supabase.from("daily_needs_stores").select("*").eq("id", id!).maybeSingle(),
        supabase.from("daily_needs_products")
          .select("id, name, price_xaf, description, requires_prescription, is_otc")
          .eq("store_id", id!).eq("is_available", true)
          .order("name"),
      ]);
      setStore(s); setProducts(p ?? []); setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-4 space-y-3"><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-32 rounded-xl" /></div>;
  if (!store) return <div className="p-8 text-center text-muted-foreground">Store not found.</div>;

  return (
    <div className="pb-8">
      <div className="relative aspect-[16/9] bg-muted">
        {store.banner_url && <img src={store.banner_url} alt={store.name} className="size-full object-cover" />}
        <Button variant="secondary" size="icon" onClick={() => navigate(-1)} className="absolute top-3 left-3" aria-label="Back">
          <ChevronLeft />
        </Button>
      </div>
      <div className="px-4 py-4 space-y-1 border-b">
        <h1 className="text-2xl font-semibold">{store.name}</h1>
        {store.description && <p className="text-sm text-muted-foreground">{store.description}</p>}
        <div className="flex gap-4 text-sm text-muted-foreground pt-1">
          {store.rating != null && <span className="inline-flex items-center gap-1"><Star className="size-3.5" /> {Number(store.rating).toFixed(1)}</span>}
          <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {store.preparation_time_min} min</span>
        </div>
      </div>
      <div className="px-4 py-4 space-y-2">
        <h2 className="font-semibold text-sm text-foreground">Menu</h2>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items yet.</p>
        ) : products.map((p) => (
          <Card key={p.id} className="p-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{p.name}</p>
              {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
              {p.requires_prescription && <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Prescription required</p>}
            </div>
            <div className="text-right">
              <p className="font-semibold text-sm">{Number(p.price_xaf).toLocaleString()} XAF</p>
              <Button size="sm" variant="outline" className="mt-1">Add</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
