import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShieldCheck } from 'lucide-react';
import { giveting, formatMoney, progressPct } from '@/lib/giveting';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

/**
 * Auto-scrolling, bi-directional carousel of currently active fundraisers.
 * Renders as a professional card strip meant to sit on the consumer home
 * just before the "Recent Activities" section.
 */
export const GivetingHomeCarousel: React.FC<Props> = ({ className }) => {
  const nav = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dirRef = useRef<1 | -1>(1);
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await giveting('discover', { limit: 12 });
        setItems(res.campaigns ?? []);
      } catch {
        setItems([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!items || items.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    let paused = false;
    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('touchstart', onEnter, { passive: true });
    el.addEventListener('touchend', onLeave, { passive: true });

    const tick = () => {
      if (!paused && el) {
        const max = el.scrollWidth - el.clientWidth;
        if (max > 0) {
          let next = el.scrollLeft + dirRef.current * 0.6;
          if (next >= max) { next = max; dirRef.current = -1; }
          else if (next <= 0) { next = 0; dirRef.current = 1; }
          el.scrollLeft = next;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('touchstart', onEnter);
      el.removeEventListener('touchend', onLeave);
    };
  }, [items]);

  if (!items || items.length === 0) return null;

  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Fundraisers to support
        </p>
        <button
          onClick={() => nav('/app/giveting/discover')}
          className="text-xs font-semibold text-primary"
        >
          Explore all
        </button>
      </div>

      <div
        ref={scrollRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((c) => {
          const pct = progressPct(c.total_raised_minor, c.goal_amount_minor);
          return (
            <article
              key={c.id}
              className="group relative w-[78%] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              <button
                onClick={() => nav(`/app/giveting/c/${c.slug}`)}
                className="block h-40 w-full overflow-hidden bg-muted text-left"
                aria-label={`Open ${c.title}`}
              >
                {c.cover_media_url ? (
                  <img
                    src={c.cover_media_url}
                    alt={c.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                    <Heart className="h-10 w-10" strokeWidth={1.4} />
                  </div>
                )}
              </button>

              <div className="space-y-2 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 min-h-[2.5rem] text-center text-sm font-semibold text-foreground">
                    {c.title}
                  </h3>
                  {c.verified_badge && (
                    <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  )}
                </div>

                <div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-foreground">
                    {formatMoney(c.total_raised_minor, c.currency)}
                    <span className="ml-1 font-normal text-muted-foreground">raised</span>
                  </p>
                </div>

                <Button
                  onClick={() => nav(`/app/giveting/c/${c.slug}/donate`)}
                  size="sm"
                  className="h-9 w-full rounded-full text-xs font-semibold"
                >
                  <Heart className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.2} /> Donate
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default GivetingHomeCarousel;
