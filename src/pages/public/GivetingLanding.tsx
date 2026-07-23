import React, { useEffect, useMemo, useState } from 'react';
import heroBgAsset from '@/assets/kang-giveting-2.png.asset.json';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Heart, Search, ShieldCheck, ArrowRight, HeartPulse, LifeBuoy, Flower,
  GraduationCap, Users, PawPrint, Briefcase, Church, Home, Trophy, Plane,
  HandHeart, Sparkles, Medal, Palette, Calendar, Leaf, MessageCircleHeart,
  Globe2, Lock, TrendingUp,
} from 'lucide-react';
import {
  giveting, GIVETING_CATEGORIES, formatMoney, progressPct, categoryColor,
} from '@/lib/giveting';

const CAT_ICON: Record<string, React.ElementType> = {
  medical: HeartPulse, emergencies: LifeBuoy, memorial: Flower, education: GraduationCap,
  community: Users, animals: PawPrint, business: Briefcase, faith: Church,
  family: Home, sports: Trophy, travel: Plane, volunteer: HandHeart,
  wishes: Sparkles, competitions: Medal, creative: Palette, events: Calendar,
  environment: Leaf,
};

export default function GivetingLanding() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res: any = await giveting('discover', {
          search: q || undefined,
          category: category || undefined,
          limit: 12,
        });
        if (!cancelled) setCampaigns(res?.campaigns ?? []);
      } catch {
        if (!cancelled) setCampaigns([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, category]);

  const totals = useMemo(() => {
    const raised = campaigns.reduce((n, c) => n + Number(c.total_raised_minor || 0), 0);
    const donors = campaigns.reduce((n, c) => n + Number(c.donor_count || 0), 0);
    return { raised, donors, count: campaigns.length };
  }, [campaigns]);

  return (
    <div className="giveting-theme min-h-screen bg-background">
      <Helmet>
        <title>Giveting — Fundraise for what matters | Kang</title>
        <meta name="description" content="Start a fundraiser or donate to real causes across Africa. Giveting from Kang makes it simple, secure and mobile-first — from medical bills to memorials, education, community and more." />
        <link rel="canonical" href="https://kob.lovable.app/giveting" />
        <meta property="og:title" content="Giveting — Fundraise for what matters" />
        <meta property="og:description" content="Start a fundraiser or donate to real causes. Secure, mobile-first, powered by Kang." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://kob.lovable.app/giveting" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      {/* HERO */}
      <section
        className="relative overflow-hidden border-b border-border/60 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBgAsset.url})` }}
      >
        <div className="absolute inset-0 bg-secondary/70" aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background px-3 py-1.5 text-xs font-semibold text-primary">
              <Heart className="h-3.5 w-3.5" strokeWidth={2} /> Powered by Kang
            </div>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Fundraising for what really matters.
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
              Raise money for medical bills, memorials, education, community projects and every moment
              in between. Fast to start, safe to run, and built for mobile from day one.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-sm font-semibold">
                <Link to="/app/giveting/new">Start a fundraiser</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-primary/40 px-7 text-sm font-semibold text-primary hover:bg-primary/5 hover:text-primary">
                <Link to="/app/giveting/discover">Discover fundraisers <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> KYC-verified organisers</span>
              <span className="inline-flex items-center gap-1.5"><Lock className="h-4 w-4 text-primary" /> PIN-secured donations</span>
              <span className="inline-flex items-center gap-1.5"><Globe2 className="h-4 w-4 text-primary" /> XAF, XOF, EUR, USD, GBP</span>
            </div>
          </div>

          <div className="relative">
            <Card className="overflow-hidden border-border/70 shadow-xl">
              <div className="h-64 bg-primary/10">
                <div className="flex h-full w-full items-center justify-center">
                  <Heart className="h-24 w-24 text-primary" strokeWidth={1.2} />
                </div>
              </div>
              <div className="space-y-4 p-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified fundraiser
                </div>
                <h3 className="text-lg font-bold text-foreground">Help Amina reach her surgery goal</h3>
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-lg font-black text-primary">2,450,000 XAF</span>
                    <span className="text-xs text-muted-foreground">of 3,000,000 XAF</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: '82%' }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>147 donors</span><span>82% raised</span>
                  </div>
                </div>
                <Button asChild className="h-11 w-full rounded-full text-sm font-semibold">
                  <Link to="/app/giveting/discover">Explore live fundraisers</Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* IMPACT STRIP */}
      <section className="border-b border-border/60 bg-background">
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-4 px-5 py-8 text-center sm:gap-8">
          <div>
            <p className="text-2xl font-black text-primary sm:text-3xl">{totals.count}+</p>
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">Active fundraisers</p>
          </div>
          <div>
            <p className="text-2xl font-black text-primary sm:text-3xl">{totals.donors.toLocaleString()}</p>
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">Kind donors</p>
          </div>
          <div>
            <p className="text-2xl font-black text-primary sm:text-3xl">{formatMoney(totals.raised, 'XAF')}</p>
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">Raised so far</p>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">Browse by category</h2>
            <p className="mt-2 text-sm text-muted-foreground">Seventeen ways to give — pick a cause that moves you.</p>
          </div>
          <Button asChild variant="ghost" className="justify-start text-primary hover:bg-primary/5 hover:text-primary sm:justify-center">
            <Link to="/app/giveting/discover">See every fundraiser <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {GIVETING_CATEGORIES.map((c) => {
            const Icon = CAT_ICON[c.slug] ?? Heart;
            const active = category === c.slug;
            return (
              <button
                key={c.slug}
                onClick={() => setCategory(active ? null : c.slug)}
                className={`group flex flex-col items-center gap-3 rounded-2xl border p-5 text-center transition-all ${
                  active
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm'
                }`}
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ background: `hsl(${c.hsl} / 0.12)` }}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.8} style={{ color: `hsl(${c.hsl})` }} />
                </span>
                <span className="text-sm font-semibold text-foreground">{c.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* LIVE FUNDRAISERS */}
      <section className="border-y border-border/60 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">Fundraisers running now</h2>
              <p className="mt-2 text-sm text-muted-foreground">Real people. Real causes. Every donation goes further.</p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search fundraisers"
                className="h-11 rounded-full border-border/70 bg-background pl-11 pr-4 text-sm"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-80 w-full rounded-3xl" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Heart className="h-6 w-6 text-primary" strokeWidth={1.8} />
              </div>
              <p className="text-base font-semibold text-foreground">No fundraisers match your search yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">Be the first to start one for this cause.</p>
              <Button asChild className="mt-6 h-11 rounded-full px-6 font-semibold">
                <Link to="/app/giveting/new">Start a fundraiser</Link>
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c) => {
                const catHsl = categoryColor(c.category_slug || c.category);
                const pct = progressPct(c.total_raised_minor, c.goal_amount_minor);
                return (
                  <Link
                    key={c.id}
                    to={`/g/${c.slug}`}
                    className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                  >
                    <div className="relative h-44 w-full overflow-hidden bg-primary/5">
                      {c.cover_media_url ? (
                        <img
                          src={c.cover_media_url}
                          alt={c.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-primary/10">
                          <Heart className="h-12 w-12 text-primary" strokeWidth={1.4} />
                        </div>
                      )}
                      {c.verified_badge && (
                        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/95 px-2 py-1 text-xs font-semibold text-primary">
                          <ShieldCheck className="h-3.5 w-3.5" /> Verified
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <Badge
                        variant="secondary"
                        className="mb-3 self-start border"
                        style={{
                          background: `hsl(${catHsl} / 0.12)`,
                          color: `hsl(${catHsl})`,
                          borderColor: `hsl(${catHsl} / 0.24)`,
                        }}
                      >
                        {c.category_label ?? c.category}
                      </Badge>
                      <h3 className="line-clamp-2 text-base font-bold text-foreground group-hover:text-primary">
                        {c.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.story?.slice(0, 140)}</p>
                      <div className="mt-4">
                        <div className="mb-1.5 flex items-baseline justify-between">
                          <span className="text-sm font-black text-primary">{formatMoney(c.total_raised_minor, c.currency)}</span>
                          <span className="text-xs text-muted-foreground">of {formatMoney(c.goal_amount_minor, c.currency)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{c.donor_count ?? 0} donors</span><span>{pct}%</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">How Giveting works</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Three simple steps from an idea to funds in your wallet. No middlemen, no paperwork, just Kang.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            { i: '01', t: 'Start your fundraiser', d: 'Pick a category, set a goal and share your story with a cover image. Free in under 3 minutes.', I: Sparkles },
            { i: '02', t: 'Share and receive donations', d: 'Send your link anywhere. Supporters donate securely from their Kang wallet in any supported currency.', I: MessageCircleHeart },
            { i: '03', t: 'Withdraw to your wallet', d: 'Move raised funds to your Kang wallet, bank or mobile money — with clear, transparent fees.', I: TrendingUp },
          ].map((s) => (
            <Card key={s.i} className="p-6">
              <span className="text-xs font-black uppercase tracking-wider text-primary">{s.i}</span>
              <div className="mt-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                <s.I className="h-5 w-5 text-primary" strokeWidth={1.8} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-foreground">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 bg-primary">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 py-16 text-center">
          <h2 className="max-w-2xl text-3xl font-black leading-tight text-primary-foreground sm:text-4xl">
            Every big thing started with someone deciding to help.
          </h2>
          <p className="max-w-xl text-sm text-primary-foreground/90 sm:text-base">
            Start a fundraiser today, or send a small donation to someone who is counting on us all.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full bg-background px-7 text-sm font-semibold text-primary hover:bg-background/90">
              <Link to="/app/giveting/new">Start a fundraiser</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-primary-foreground/50 bg-transparent px-7 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link to="/app/giveting/discover">Browse fundraisers</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* GIVETING FOOTER (page-scoped) */}
      <footer className="border-t border-border/60 bg-background">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="inline-flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Heart className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <span className="text-lg font-black tracking-tight text-foreground">Giveting</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              A mobile-first fundraising module inside Kang. Built for Africa, ready for the world.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Giveting</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/app/giveting/discover" className="text-muted-foreground hover:text-primary">Discover fundraisers</Link></li>
              <li><Link to="/app/giveting/new" className="text-muted-foreground hover:text-primary">Start a fundraiser</Link></li>
              <li><Link to="/app/giveting" className="text-muted-foreground hover:text-primary">Open in Kang</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Categories</h4>
            <ul className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
              {GIVETING_CATEGORIES.slice(0, 8).map((c) => (
                <li key={c.slug}>
                  <button
                    onClick={() => { setCategory(c.slug); window.scrollTo({ top: 700, behavior: 'smooth' }); }}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Trust & safety</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/faq" className="text-muted-foreground hover:text-primary">FAQ</Link></li>
              <li><Link to="/contact" className="text-muted-foreground hover:text-primary">Contact support</Link></li>
              <li><Link to="/privacy" className="text-muted-foreground hover:text-primary">Privacy</Link></li>
              <li><Link to="/data-protection" className="text-muted-foreground hover:text-primary">Data protection</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60 hidden">
          <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Kang Open Banking. Giveting is a fundraising service operated by Kang.
          </p>
        </div>
      </footer>
    </div>
  );
}
