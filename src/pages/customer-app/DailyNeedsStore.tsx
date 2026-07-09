import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Clock, Star, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { QuantityStepper } from "@/components/daily-needs/QuantityStepper";
import { CartFloatingBar } from "@/components/daily-needs/CartFloatingBar";
import { useDailyNeedsCart, formatXAF } from "@/hooks/useDailyNeedsCart";
import { toast } from "sonner";
import { SafeImage } from "@/components/common/SafeImage";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price_xaf: number;
  category_id: string | null;
  is_otc: boolean | null;
  requires_prescription: boolean | null;
}

interface Category {
  id: string;
  name: string;
  position: number | null;
}

export default function DailyNeedsStore() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const cart = useDailyNeedsCart();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const filter = (searchParams.get("filter") ?? "all") as "all" | "otc" | "rx";
  const isPharmacy = store?.vertical === "pharmacy";

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [{ data: s }, { data: p }, { data: c }] = await Promise.all([
        supabase.from("daily_needs_stores").select("*").eq("id", id).maybeSingle(),
        supabase.from("daily_needs_products")
          .select("id, name, price_xaf, description, requires_prescription, is_otc, category_id")
          .eq("store_id", id).eq("is_available", true)
          .order("name"),
        supabase.from("daily_needs_categories")
          .select("id, name, position")
          .eq("store_id", id)
          .order("position", { ascending: true }),
      ]);
      setStore(s);
      setProducts((p ?? []) as Product[]);
      setCategories((c ?? []) as Category[]);
      setLoading(false);
    })();
  }, [id]);

  const filteredProducts = useMemo(() => {
    if (!isPharmacy || filter === "all") return products;
    if (filter === "rx") return products.filter((p) => p.requires_prescription);
    if (filter === "otc") return products.filter((p) => !p.requires_prescription);
    return products;
  }, [products, filter, isPharmacy]);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    const uncategorized: Product[] = [];
    for (const prod of filteredProducts) {
      if (!prod.category_id) { uncategorized.push(prod); continue; }
      const arr = map.get(prod.category_id) ?? [];
      arr.push(prod);
      map.set(prod.category_id, arr);
    }
    const ordered = categories
      .filter((c) => map.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, items: map.get(c.id)! }));
    if (uncategorized.length) ordered.push({ id: "__other", name: "Other", items: uncategorized });
    return ordered;
  }, [filteredProducts, categories]);

  useEffect(() => {
    if (!activeCat && grouped.length) setActiveCat(grouped[0].id);
  }, [grouped, activeCat]);

  const scrollToCat = (catId: string) => {
    setActiveCat(catId);
    sectionRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const qtyInCart = (productId: string) =>
    cart.items.find((i) => i.product_id === productId)?.quantity ?? 0;

  const handleAdd = (p: Product) => {
    if (!store) return;
    if (p.requires_prescription) {
      toast.info("Prescription required — you'll upload it at checkout");
    }
    cart.addItem(
      { store_id: store.id, store_name: store.name, store_vertical: store.vertical },
      {
        product_id: p.id,
        name: p.name,
        price_xaf: Number(p.price_xaf),
        quantity: 1,
        image_url: null,
        requires_prescription: !!p.requires_prescription,
      },
    );
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-8 w-1/2 rounded" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }
  if (!store) return <div className="p-8 text-center text-muted-foreground">Store not found.</div>;

  return (
    <div className="pb-28">
      <div className="relative aspect-[16/9] bg-muted">
        {store.banner_url && <SafeImage src={store.banner_url} alt={store.name} className="size-full object-cover" />}
        <Button variant="secondary" size="icon" onClick={() => navigate(-1)} className="absolute top-3 left-3" aria-label="Back">
          <ChevronLeft />
        </Button>
      </div>

      <div className="px-4 py-4 space-y-1 border-b">
        <h1 className="text-2xl font-semibold">{store.name}</h1>
        {store.description && <p className="text-sm text-muted-foreground">{store.description}</p>}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-1">
          {store.rating != null && (
            <span className="inline-flex items-center gap-1"><Star className="size-3.5" /> {Number(store.rating).toFixed(1)}</span>
          )}
          {store.preparation_time_min != null && (
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {store.preparation_time_min} min</span>
          )}
          {store.minimum_order_xaf != null && Number(store.minimum_order_xaf) > 0 && (
            <span className="inline-flex items-center gap-1"><Info className="size-3.5" /> Min {formatXAF(Number(store.minimum_order_xaf))}</span>
          )}
        </div>
        {isPharmacy && (
          <div className="flex gap-2 pt-3">
            {(["all", "otc", "rx"] as const).map((k) => (
              <button
                key={k}
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  if (k === "all") next.delete("filter"); else next.set("filter", k);
                  setSearchParams(next, { replace: true });
                }}
                className={`h-8 px-3 rounded-full text-xs font-medium transition border ${
                  filter === k
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:bg-muted"
                }`}
                aria-pressed={filter === k}
              >
                {k === "all" ? "All items" : k === "otc" ? "OTC" : "Prescription"}
              </button>
            ))}
          </div>
        )}
      </div>

      {grouped.length > 1 && (
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
          <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none">
            {grouped.map((g) => (
              <button
                key={g.id}
                onClick={() => scrollToCat(g.id)}
                className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium transition ${
                  activeCat === g.id
                    ? "bg-foreground text-background"
                    : "bg-muted text-foreground hover:bg-muted/80"
                }`}
                aria-pressed={activeCat === g.id}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-6">
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No items yet.</p>
        ) : grouped.map((g) => (
          <section
            key={g.id}
            ref={(el) => { sectionRefs.current[g.id] = el; }}
            className="space-y-2"
            aria-labelledby={`cat-${g.id}`}
          >
            <h2 id={`cat-${g.id}`} className="font-semibold text-sm text-foreground">{g.name}</h2>
            {g.items.map((p) => {
              const qty = qtyInCart(p.id);
              return (
                <Card key={p.id} className="p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{p.name}</p>
                    {p.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>}
                    {p.requires_prescription && (
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 inline-flex items-center gap-1">
                        <Info className="size-3" /> Prescription required
                      </p>
                    )}
                    <p className="font-semibold text-sm mt-2">{formatXAF(Number(p.price_xaf))}</p>
                  </div>
                  {/* product images come in a later phase via daily_needs_product_images join */}
                  <div className="shrink-0 self-end">
                    {qty === 0 ? (
                      <Button size="sm" variant="outline" onClick={() => handleAdd(p)} aria-label={`Add ${p.name} to cart`}>
                        Add
                      </Button>
                    ) : (
                      <QuantityStepper
                        value={qty}
                        size="sm"
                        onChange={(n) => cart.updateQuantity(p.id, n)}
                        ariaLabel={`Quantity of ${p.name}`}
                      />
                    )}
                  </div>
                </Card>
              );
            })}
          </section>
        ))}
      </div>

      <CartFloatingBar />
    </div>
  );
}
