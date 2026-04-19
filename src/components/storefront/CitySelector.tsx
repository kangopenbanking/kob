import { useMemo, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CAMEROON_CITIES } from '@/lib/storefront-data';
import { Label } from '@/components/ui/label';

interface CitySelectorProps {
  region: string;
  city: string;
  onRegionChange: (r: string) => void;
  onCityChange: (c: string) => void;
  countryCode?: string;
  className?: string;
}

/**
 * City selector with built-in "Add custom city/village" support.
 * - Lists all known cities for the chosen region.
 * - Lets the user type and persist a custom city/village name.
 */
export function CitySelector({
  region, city, onRegionChange, onCityChange, countryCode = 'CM', className,
}: CitySelectorProps) {
  const regions = Object.keys(CAMEROON_CITIES);
  const knownCities = useMemo(() => CAMEROON_CITIES[region] || [], [region]);
  const isCustom = !!city && !knownCities.includes(city);
  const [adding, setAdding] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const commitCustom = () => {
    const v = customValue.trim();
    if (!v) return;
    onCityChange(v);
    setAdding(false);
    setCustomValue('');
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Region</Label>
          <select
            value={region}
            onChange={(e) => { onRegionChange(e.target.value); onCityChange(''); }}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">City / Village</Label>
          {adding ? (
            <div className="flex gap-1">
              <Input
                autoFocus
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && commitCustom()}
                placeholder="Type city or village…"
                className="h-10 rounded-xl text-sm flex-1"
              />
              <Button type="button" size="icon" variant="outline" className="h-10 w-10 rounded-xl" onClick={commitCustom}>
                <Check className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-10 w-10 rounded-xl" onClick={() => { setAdding(false); setCustomValue(''); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <select
              value={city}
              onChange={(e) => {
                if (e.target.value === '__custom__') { setAdding(true); return; }
                onCityChange(e.target.value);
              }}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select city / village…</option>
              {isCustom && <option value={city}>{city} (custom)</option>}
              {knownCities.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__custom__">＋ Add custom city / village…</option>
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
