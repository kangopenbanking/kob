import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Share2, Heart, ShieldCheck, MapPin, ArrowRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { giveting, formatMoney, progressPct, categoryColor, GIVETING_CATEGORIES } from '@/lib/giveting';

/**
 * Public campaign detail page.
 * - No auth required (edge action `get` uses the service client for the read).
 * - Shareable link at /g/:slug with Open Graph + Twitter card meta.
 * - Anyone can view cover, title, story, category badge, progress, and the
 *   feed of successful donations. Donating still requires the authenticated
 *   in-app flow (button links to /app/giveting/c/:slug/donate).
 */
export default function GivetingPublicCampaign() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [organiser, setOrganiser] = useState<any>(null);
  const [donations, setDonations] = useState<any[]>([]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res: any = await giveting('get', { slug });
        if (cancelled) return;
        setCampaign(res.campaign);
        setOrganiser(res.organiser);
        const d: any = await giveting('list-donations', {
          campaign_id: res.campaign.id,
          limit: 20,
        });
        if (!cancelled) setDonations(d.donations ?? []);
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message ?? 'Could not load fundraiser');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const share = async () => {
    const url = window.location.href;
    const title = campaign?.title ?? 'Fundraiser';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch {
      /* user cancelled */
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center">
        <h1 className="text-2xl font-semibold">Fundraiser not found</h1>
        <p className="mt-2 text-muted-foreground">
          This link may have expired or the campaign has been removed.
        </p>
        <Button asChild className="mt-6"><Link to="/">Back to home</Link></Button>
      </div>
    );
  }

  const cat = GIVETING_CATEGORIES.find(c => c.slug === campaign.category_slug);
  const catHsl = categoryColor(campaign.category_slug);
  const pct = progressPct(campaign.total_raised_minor, campaign.goal_amount_minor);
  const canonical = `https://kob.lovable.app/g/${campaign.slug}`;
  const description = (campaign.story ?? '').slice(0, 200).replace(/\s+/g, ' ').trim()
    || `Support ${campaign.title} on Giveting.`;

  return (
    <>
      <Helmet>
        <title>{campaign.title} — Giveting</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={campaign.title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        {campaign.cover_media_url && <meta property="og:image" content={campaign.cover_media_url} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={campaign.title} />
        <meta name="twitter:description" content={description} />
        {campaign.cover_media_url && <meta name="twitter:image" content={campaign.cover_media_url} />}
      </Helmet>

      <div className="giveting-theme min-h-screen bg-background">
        <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
          {/* Cover */}
          <Card className="overflow-hidden">
            {campaign.cover_media_url ? (
              <img
                src={campaign.cover_media_url}
                alt={campaign.title}
                className="h-72 w-full object-cover"
                loading="eager"
              />
            ) : (
              <div
                className="h-56 w-full"
                style={{ background: `hsl(${catHsl} / 0.15)` }}
              />
            )}
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      style={{
                        background: `hsl(${catHsl} / 0.12)`,
                        color: `hsl(${catHsl})`,
                        borderColor: `hsl(${catHsl} / 0.24)`,
                      }}
                      className="border"
                    >
                      {cat?.label ?? campaign.category_slug}
                    </Badge>
                    {campaign.verified_badge && (
                      <Badge variant="outline" className="gap-1">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </Badge>
                    )}
                    {(campaign.location_city || campaign.location_country) && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[campaign.location_city, campaign.location_country].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-semibold leading-tight">{campaign.title}</h1>
                  {organiser?.full_name && (
                    <p className="text-sm text-muted-foreground">
                      Organised by {organiser.full_name}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="icon" onClick={share} aria-label="Share">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-semibold">
                      {formatMoney(campaign.total_raised_minor, campaign.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      raised of {formatMoney(campaign.goal_amount_minor, campaign.currency)} goal
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {campaign.donor_count ?? 0} donors
                  </div>
                </div>
                <Progress value={pct} />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild size="lg" className="flex-1">
                  <Link to={`/app/giveting/c/${campaign.slug}/donate`}>
                    <Heart className="h-4 w-4 mr-2" /> Donate
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to={`/app/giveting/c/${campaign.slug}`}>
                    Open in app <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>

          {/* Story */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-2">About this fundraiser</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {campaign.story}
            </p>
          </Card>

          {/* Donations feed */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Recent donations</h2>
              <span className="text-xs text-muted-foreground">
                {campaign.donor_count ?? 0} total
              </span>
            </div>
            {donations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Be the first to donate.
              </p>
            ) : (
              <ul className="divide-y">
                {donations.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {d.is_anonymous ? 'Anonymous' : (d.donor_display_name ?? 'Donor')}
                      </div>
                      {d.comment && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {d.comment}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {formatMoney(d.amount_minor, d.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {d.source ?? 'wallet'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <p className="pb-6 pt-2 text-center text-xs text-muted-foreground">
            <ExternalLink className="inline h-3 w-3 mr-1" />
            Powered by Giveting
          </p>
        </div>
      </div>
    </>
  );
}
