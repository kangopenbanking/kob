import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { giveting, GIVETING_CATEGORIES } from '@/lib/giveting';
import { CampaignCard } from '@/components/customer-app/giveting/CampaignCard';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const GivetingDiscover: React.FC = () => {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res: any = await giveting('discover', {
          search: q || undefined,
          category: category || undefined,
        });
        if (!cancelled) setItems(res.campaigns ?? []);
      } catch (e: any) {
        toast.error(e.message ?? 'Failed to load campaigns');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, category]);

  return (
    <div className="px-5 pt-6">
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find fundraisers"
          className="h-12 rounded-full border-border/70 bg-muted/40 pl-11 pr-4 text-sm"
        />
      </div>

      <div className="mb-5 -mx-5 overflow-x-auto px-5 pb-1">
        <div className="flex gap-2">
          <Button
            variant={!category ? 'default' : 'outline'}
            onClick={() => setCategory(null)}
            className={cn('h-9 rounded-full px-4 text-xs font-medium', !category && 'shadow-sm')}
            size="sm"
          >
            All
          </Button>
          {GIVETING_CATEGORIES.map((c) => (
            <Button
              key={c.slug}
              variant={category === c.slug ? 'default' : 'outline'}
              onClick={() => setCategory(c.slug === category ? null : c.slug)}
              className="h-9 shrink-0 rounded-full px-4 text-xs font-medium"
              size="sm"
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 w-full rounded-3xl" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">No campaigns found. Try a different search.</p>
      ) : (
        <div className="space-y-4">
          {items.map((c) => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      )}
    </div>
  );
};

export default GivetingDiscover;
