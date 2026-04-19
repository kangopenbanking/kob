import { useMemo, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CAMEROON_CITIES } from '@/lib/storefront-data';
import { cn } from '@/lib/utils';

interface CitySelectorProps {
  region: string;
  value: string;
  onChange: (city: string) => void;
  className?: string;
}

/**
 * City picker with inline custom city/village entry.
 * Lists cities from the selected region; if not listed, merchants can add their village/town.
 */
export function CitySelector({ region, value, onChange, className }: CitySelectorProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const cities = useMemo(() => {
    const base = CAMEROON_CITIES[region] || [];
    // Ensure value is selectable even if it's a previously-added custom city
    if (value && !base.includes(value)) return [...base, value];
    return base;
  }, [region, value]);

  const commitDraft = () => {
    const v = draft.trim();
    if (v.length < 2) return;
    onChange(v);
    setDraft('');
    setAdding(false);
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {!adding ? (
        <div className="flex gap-2">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select city or village...</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-xl gap-1 px-3"
            onClick={() => { setAdding(true); setDraft(''); }}
            title="Add custom city or village"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitDraft(); }
              if (e.key === 'Escape') { setAdding(false); setDraft(''); }
            }}
            placeholder="Type your village or town name..."
            className="flex-1 h-10 rounded-xl text-sm"
          />
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={commitDraft}
            disabled={draft.trim().length < 2}
            title="Save city"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={() => { setAdding(false); setDraft(''); }}
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        Don't see your village? Tap <strong>Add</strong> to enter it manually.
      </p>
    </div>
  );
}
