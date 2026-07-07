import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { ProgressRing } from './ProgressRing';
import { formatMoney, progressPct } from '@/lib/giveting';
import { ShieldCheck } from 'lucide-react';

interface CampaignCardProps {
  campaign: any;
  variant?: 'default' | 'compact';
}

export const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, variant = 'default' }) => {
  const pct = progressPct(campaign.total_raised_minor, campaign.goal_amount_minor);

  return (
    <Link to={`/app/giveting/c/${campaign.slug}`} className="block">
      <Card className="overflow-hidden rounded-3xl border-border/70 transition-shadow hover:shadow-md">
        {variant === 'default' && (
          <div className="relative h-40 w-full overflow-hidden bg-muted">
            {campaign.cover_media_url ? (
              <img src={campaign.cover_media_url} alt={campaign.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                <span className="text-sm font-medium">No cover image</span>
              </div>
            )}
            {campaign.verified_badge && (
              <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/95 px-2 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified
              </div>
            )}
          </div>
        )}
        <div className="flex items-start gap-4 p-4">
          {variant === 'compact' && campaign.cover_media_url && (
            <img src={campaign.cover_media_url} alt="" className="h-20 w-20 flex-shrink-0 rounded-2xl object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-base font-semibold text-foreground">{campaign.title}</h3>
            {campaign.location_city && (
              <p className="mt-0.5 text-xs text-muted-foreground">{campaign.location_city}{campaign.location_country ? `, ${campaign.location_country}` : ''}</p>
            )}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-sm font-semibold text-foreground">
                  {formatMoney(campaign.total_raised_minor, campaign.currency)} <span className="text-xs font-normal text-muted-foreground">raised</span>
                </p>
              </div>
              {variant === 'default' && <ProgressRing pct={pct} size={44} stroke={4} />}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};
