import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Tag, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function DailyNeedsPromos() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("daily_needs_promos")
        .select("id, code, description, discount_xaf, discount_percent, min_subtotal_xaf, expires_at, store_id, daily_needs_stores(name)")
        .eq("active", true)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setPromos(data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast({ title: "Code copied", description: code });
  };

  const discountLabel = (p: any) =>
    p.discount_percent ? `${p.discount_percent}% off` : `${Number(p.discount_xaf).toLocaleString()} XAF off`;

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft className="size-5" />
        </Button>
        <h1 className="text-xl font-semibold">Promotions</h1>
      </header>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : promos.length === 0 ? (
        <EmptyState icon={<Tag className="size-6 text-muted-foreground" />} title="No active promos" description="Check back soon for new deals." />
      ) : (
        <div className="space-y-2">
          {promos.map((p) => (
            <Card key={p.id} className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{discountLabel(p)}</p>
                  {p.daily_needs_stores?.name && <p className="text-xs text-muted-foreground">at {p.daily_needs_stores.name}</p>}
                </div>
                <Button variant="outline" size="sm" onClick={() => copy(p.code)}><Copy className="size-3 mr-1" />{p.code}</Button>
              </div>
              {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
              <div className="flex justify-between text-[11px] text-muted-foreground">
                {p.min_subtotal_xaf > 0 && <span>Min spend {Number(p.min_subtotal_xaf).toLocaleString()} XAF</span>}
                {p.expires_at && <span>Until {format(new Date(p.expires_at), "MMM d")}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
