import React, { useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Upload, Check, Palette } from 'lucide-react';
import { toast } from 'sonner';
// Bundled directly so backgrounds display on installed PWAs / custom domains
// where the /__l5e/ CDN paths are not served.
import bgUnityUrl from '@/assets/card-backgrounds/bg-unity.png';
import bgCameroonUrl from '@/assets/card-backgrounds/bg-cameroon.png';
import bgSilkUrl from '@/assets/card-backgrounds/bg-silk.webp';
import bgEmeraldUrl from '@/assets/card-backgrounds/bg-emerald.png';
const bgUnity = { url: bgUnityUrl };
const bgCameroon = { url: bgCameroonUrl };
const bgSilk = { url: bgSilkUrl };
const bgEmerald = { url: bgEmeraldUrl };

export interface CardBackground {
  id: string;
  label: string;
  url: string;
}

export const PRESET_BACKGROUNDS: CardBackground[] = [
  { id: 'preset-emerald', label: 'Emerald', url: bgEmerald.url },
  { id: 'preset-cameroon', label: 'Cameroon', url: bgCameroon.url },
  { id: 'preset-unity', label: 'Unity', url: bgUnity.url },
  { id: 'preset-silk', label: 'Silk', url: bgSilk.url },
];

const STORAGE_PREFIX = 'kob:card-bg:';

export function getCardBackground(cardId: string): string | null {
  try { return localStorage.getItem(STORAGE_PREFIX + cardId); } catch { return null; }
}
export function setCardBackground(cardId: string, url: string | null) {
  try {
    if (url) localStorage.setItem(STORAGE_PREFIX + cardId, url);
    else localStorage.removeItem(STORAGE_PREFIX + cardId);
  } catch { /* ignore */ }
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cardId: string;
  currentUrl: string | null;
  onChange: (url: string | null) => void;
}

export const CardBackgroundPicker: React.FC<Props> = ({ open, onOpenChange, cardId, currentUrl, onChange }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const apply = (url: string | null) => {
    setCardBackground(cardId, url);
    onChange(url);
    toast.success(url ? 'Background applied' : 'Background reset');
  };

  const handleUpload = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be under 3 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      if (!url.startsWith('data:image/')) { toast.error('Could not read image'); return; }
      apply(url);
      onOpenChange(false);
    };
    reader.onerror = () => toast.error('Could not read image');
    reader.readAsDataURL(file);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4" strokeWidth={1.5} /> Card background
          </SheetTitle>
          <SheetDescription>Pick a look for your card or upload your own image.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {PRESET_BACKGROUNDS.map((bg) => {
            const active = currentUrl === bg.url;
            return (
              <button
                key={bg.id}
                type="button"
                onClick={() => apply(bg.url)}
                className={`relative overflow-hidden rounded-2xl border-2 transition ${
                  active ? 'border-primary' : 'border-transparent'
                }`}
                style={{ aspectRatio: '1.586' }}
              >
                <img src={bg.url} alt={bg.label} className="h-full w-full object-cover" />
                <span className="absolute bottom-1 left-2 text-[10px] font-semibold text-[hsl(0,0%,100%)] drop-shadow">
                  {bg.label}
                </span>
                {active && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3 w-3 text-primary-foreground" strokeWidth={2.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = '';
          }}
        />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm font-semibold text-foreground"
          >
            <Upload className="h-4 w-4" strokeWidth={1.5} /> Upload image
          </button>
          <button
            type="button"
            onClick={() => { apply(null); onOpenChange(false); }}
            className="rounded-2xl border border-border bg-card p-3 text-sm font-semibold text-muted-foreground"
          >
            Use default
          </button>
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">
          Custom backgrounds are stored on this device only.
        </p>
      </SheetContent>
    </Sheet>
  );
};
