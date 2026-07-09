import { Card } from "@/components/ui/card";
import { Clock, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SafeImage } from "@/components/common/SafeImage";

interface Store {
  id: string;
  name: string;
  logo_url?: string | null;
  banner_url?: string | null;
  rating?: number | null;
  preparation_time_min?: number | null;
  vertical?: string;
}

export function StoreCard({ store, hrefSuffix = "" }: { store: Store; hrefSuffix?: string }) {
  const navigate = useNavigate();
  return (
    <Card
      onClick={() => navigate(`/app/daily-needs/store/${store.id}${hrefSuffix}`)}
      className="overflow-hidden cursor-pointer border-border/50 hover:border-border transition-colors"
    >
      <div className="aspect-[16/9] bg-muted overflow-hidden">
        {store.banner_url ? (
          <SafeImage src={store.banner_url} alt={store.name} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-muted" />
        )}
      </div>
      <div className="p-4 space-y-1">
        <h3 className="font-semibold text-foreground leading-tight">{store.name}</h3>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {store.rating != null && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5" /> {Number(store.rating).toFixed(1)}
            </span>
          )}
          {store.preparation_time_min != null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {store.preparation_time_min} min
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
