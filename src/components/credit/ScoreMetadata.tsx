import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, format, isPast, differenceInDays } from 'date-fns';

interface ScoreMetadataProps {
  scoreVersion?: string;
  calculatedAt: string;
  nextUpdateDate?: string;
  expiresAt?: string;
}

const ScoreMetadata = ({ 
  scoreVersion, 
  calculatedAt, 
  nextUpdateDate, 
  expiresAt 
}: ScoreMetadataProps) => {
  const calcDate = new Date(calculatedAt);
  const nextUpdate = nextUpdateDate ? new Date(nextUpdateDate) : null;
  const expiry = expiresAt ? new Date(expiresAt) : null;
  
  const isExpired = expiry ? isPast(expiry) : false;
  const daysUntilExpiry = expiry ? differenceInDays(expiry, new Date()) : null;
  
  const getFreshnessStatus = () => {
    if (isExpired) {
      return { label: 'Expired', color: 'destructive' as const, icon: AlertCircle };
    }
    if (daysUntilExpiry !== null) {
      if (daysUntilExpiry <= 7) {
        return { label: 'Expiring Soon', color: 'secondary' as const, icon: AlertCircle };
      }
      if (daysUntilExpiry <= 30) {
        return { label: 'Recent', color: 'secondary' as const, icon: Clock };
      }
    }
    return { label: 'Fresh', color: 'default' as const, icon: RefreshCw };
  };

  const freshnessStatus = getFreshnessStatus();
  const FreshnessIcon = freshnessStatus.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Score Information</CardTitle>
          <Badge variant={freshnessStatus.color} className="gap-1">
            <FreshnessIcon className="h-3 w-3" />
            {freshnessStatus.label}
          </Badge>
        </div>
        <CardDescription className="text-sm">
          Metadata about your credit score calculation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Score Version */}
          {scoreVersion && (
            <div className="flex items-start justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-muted">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium">Score Version</div>
                  <div className="text-xs text-muted-foreground">Algorithm version</div>
                </div>
              </div>
              <Badge variant="outline">{scoreVersion}</Badge>
            </div>
          )}

          {/* Calculated At */}
          <div className="flex items-start justify-between pb-3 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium">Last Calculated</div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(calcDate, { addSuffix: true })}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{format(calcDate, 'MMM d, yyyy')}</div>
              <div className="text-xs text-muted-foreground">{format(calcDate, 'h:mm a')}</div>
            </div>
          </div>

          {/* Next Update */}
          {nextUpdate && (
            <div className="flex items-start justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-muted">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium">Next Update</div>
                  <div className="text-xs text-muted-foreground">Scheduled recalculation</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{format(nextUpdate, 'MMM d, yyyy')}</div>
                <div className="text-xs text-muted-foreground">
                  {isPast(nextUpdate) ? 'Overdue' : formatDistanceToNow(nextUpdate, { addSuffix: true })}
                </div>
              </div>
            </div>
          )}

          {/* Expires At */}
          {expiry && (
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-muted">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium">Expires</div>
                  <div className="text-xs text-muted-foreground">Score becomes stale</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-semibold ${isExpired ? 'text-destructive' : ''}`}>
                  {format(expiry, 'MMM d, yyyy')}
                </div>
                {!isExpired && daysUntilExpiry !== null && (
                  <div className="text-xs text-muted-foreground">
                    {daysUntilExpiry} days remaining
                  </div>
                )}
                {isExpired && (
                  <div className="text-xs text-destructive">Refresh required</div>
                )}
              </div>
            </div>
          )}

          {/* Refresh Schedule Info */}
          <div className="pt-4 border-t">
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="text-xs font-semibold mb-2">Automatic Recalculation Triggers</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• New loan application submitted</li>
                <li>• Manual refresh requested</li>
                <li>• 30-day cache expiration</li>
                <li>• Significant financial events</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScoreMetadata;
