import { Store, MapPin, Star, ShoppingBag, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface StorePreviewProps {
  storeName: string;
  description: string;
  category: string;
  city: string;
  country: string;
  currency: string;
  logoUrl: string;
  bannerUrl: string;
  isPublished: boolean;
  rating?: number;
}

export function StorePreview({ storeName, description, category, city, country, currency, logoUrl, bannerUrl, isPublished, rating }: StorePreviewProps) {
  return (
    <div className="max-w-sm mx-auto bg-background rounded-2xl overflow-hidden border border-border/50 shadow-lg">
      {/* Banner */}
      <div className="relative h-36 bg-muted">
        {bannerUrl ? (
          <img src={bannerUrl} alt="Store banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[hsl(var(--fi-purple))]/20 flex items-center justify-center">
            <Store className="w-10 h-10 text-[hsl(var(--fi-purple))]/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/20" />
        {isPublished && (
          <Badge className="absolute top-3 right-3 bg-emerald-500/90 text-white border-0 text-[10px]">Open</Badge>
        )}
      </div>

      {/* Logo + Name */}
      <div className="relative px-4 -mt-8">
        <div className="w-16 h-16 rounded-2xl border-4 border-background overflow-hidden bg-muted shadow-sm">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[hsl(var(--fi-purple))]/10 flex items-center justify-center">
              <Store className="w-6 h-6 text-[hsl(var(--fi-purple))]" />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-2 pb-5 space-y-3">
        <div>
          <h3 className="text-base font-bold text-foreground">{storeName || 'Your Store Name'}</h3>
          <div className="flex items-center gap-2 mt-1">
            {category && <Badge variant="secondary" className="text-[10px] h-5">{category}</Badge>}
            {city && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="w-3 h-3" /> {city}, {country}
              </span>
            )}
          </div>
        </div>

        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{description}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            {rating?.toFixed(1) || '4.8'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Open now
          </span>
          <span className="flex items-center gap-1">
            <ShoppingBag className="w-3.5 h-3.5" /> {currency}
          </span>
        </div>

        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1 h-9 text-xs rounded-lg bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white">
            Browse Products
          </Button>
          <Button size="sm" variant="outline" className="h-9 text-xs rounded-lg">
            Store Info
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StorePreviewDialog({ children, ...props }: StorePreviewProps & { children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-sm font-semibold">Store Preview — How customers see your store</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <StorePreview {...props} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
