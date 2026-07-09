import { Store, MapPin, Star, ShoppingBag, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getTemplate, type StorefrontTemplateId } from '@/lib/storefront-templates';
import { SafeImage } from "@/components/common/SafeImage";

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
  templateId?: StorefrontTemplateId;
  primaryColor?: string;
  accentColor?: string;
}

export function StorePreview({
  storeName, description, category, city, country, currency,
  logoUrl, bannerUrl, isPublished, rating,
  templateId, primaryColor = '#7c3aed', accentColor = '#c084fc',
}: StorePreviewProps) {
  const tpl = getTemplate(templateId);
  const { preview } = tpl;
  const showBanner = preview.bannerHeight !== 'h-0';
  const isStacked = preview.layout === 'stacked';
  const isSide = preview.layout === 'side';

  const logoShapeClass =
    preview.logoShape === 'circle' ? 'rounded-full' :
    preview.logoShape === 'square' ? 'rounded-lg' : 'rounded-2xl';

  return (
    <div
      className={cn('max-w-sm mx-auto bg-background overflow-hidden border border-border/50 shadow-lg', preview.radius)}
      style={{ borderColor: `${accentColor}33` }}
    >
      {showBanner && (
        <div className={cn('relative bg-muted', preview.bannerHeight)}>
          {bannerUrl ? (
            <SafeImage src={bannerUrl} alt="Store banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: `${primaryColor}20` }}>
              <Store className="w-10 h-10" style={{ color: `${primaryColor}66` }} />
            </div>
          )}
          {preview.overlayOpacity > 0 && (
            <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${preview.overlayOpacity / 100})` }} />
          )}
          {preview.accentBar && (
            <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: accentColor }} />
          )}
          {isPublished && (
            <Badge className="absolute top-3 right-3 bg-emerald-500/90 text-white border-0 text-[10px]">Open</Badge>
          )}
          {isStacked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10">
              <div className={cn('w-16 h-16 border-4 border-background overflow-hidden bg-background shadow-sm', logoShapeClass)}>
                {logoUrl ? <SafeImage src={logoUrl} alt={`${storeName || 'Store'} logo`} className="w-full h-full object-cover" /> : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: `${primaryColor}1a` }}>
                    <Store className="w-6 h-6" style={{ color: primaryColor }} />
                  </div>
                )}
              </div>
              <h3 className="text-base font-bold text-white mt-2 drop-shadow">{storeName || 'Your Store Name'}</h3>
            </div>
          )}
        </div>
      )}

      {!isStacked && !isSide && showBanner && (
        <div className="relative px-4 -mt-8">
          <div className={cn('w-16 h-16 border-4 border-background overflow-hidden bg-muted shadow-sm', logoShapeClass)}>
            {logoUrl ? <SafeImage src={logoUrl} alt={`${storeName || 'Store'} logo`} className="w-full h-full object-cover" /> : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: `${primaryColor}1a` }}>
                <Store className="w-6 h-6" style={{ color: primaryColor }} />
              </div>
            )}
          </div>
        </div>
      )}

      <div className={cn('px-4 pt-2 pb-5 space-y-3', isSide && 'pt-4')}>
        {isSide ? (
          <div className="flex items-center gap-3">
            <div className={cn('w-14 h-14 overflow-hidden bg-muted shrink-0 border border-border/40', logoShapeClass)}>
              {logoUrl ? <SafeImage src={logoUrl} alt={`${storeName || 'Store'} logo`} className="w-full h-full object-cover" /> : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: `${primaryColor}1a` }}>
                  <Store className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-foreground truncate">{storeName || 'Your Store Name'}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {category && <Badge variant="secondary" className="text-[10px] h-5">{category}</Badge>}
                {city && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                    <MapPin className="w-3 h-3" /> {city}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : !isStacked && (
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
        )}

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
          <Button
            size="sm"
            className="flex-1 h-9 text-xs rounded-lg text-white hover:opacity-90"
            style={{ background: primaryColor }}
          >
            Browse Products
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs rounded-lg"
            style={{ borderColor: `${accentColor}80`, color: primaryColor }}
          >
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
