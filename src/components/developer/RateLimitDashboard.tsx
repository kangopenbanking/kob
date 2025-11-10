import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RateLimitData {
  per_minute: {
    current: number;
    limit: number;
    percentage: number;
  };
  per_day: {
    current: number;
    limit: number;
    percentage: number;
  };
}

export function RateLimitDashboard({ apiKeyId, tier = 'free' }: { apiKeyId?: string; tier?: string }) {
  const [rateLimits, setRateLimits] = useState<RateLimitData | null>(null);
  const [loading, setLoading] = useState(true);

  const limits = {
    free: { per_minute: 60, per_day: 1000 },
    basic: { per_minute: 300, per_day: 10000 },
    pro: { per_minute: 1000, per_day: 100000 },
  };

  const tierLimits = limits[tier as keyof typeof limits] || limits.free;

  useEffect(() => {
    fetchRateLimits();
    const interval = setInterval(fetchRateLimits, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [apiKeyId]);

  const fetchRateLimits = async () => {
    try {
      if (!apiKeyId) {
        setLoading(false);
        return;
      }

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const oneDayAgo = new Date(now.getTime() - 86400000);

      // Fetch minute count
      const { count: minuteCount } = await supabase
        .from('sandbox_api_usage')
        .select('*', { count: 'exact', head: true })
        .eq('api_key_id', apiKeyId)
        .gte('created_at', oneMinuteAgo.toISOString());

      // Fetch daily count
      const { count: dailyCount } = await supabase
        .from('sandbox_api_usage')
        .select('*', { count: 'exact', head: true })
        .eq('api_key_id', apiKeyId)
        .gte('created_at', oneDayAgo.toISOString());

      setRateLimits({
        per_minute: {
          current: minuteCount || 0,
          limit: tierLimits.per_minute,
          percentage: ((minuteCount || 0) / tierLimits.per_minute) * 100,
        },
        per_day: {
          current: dailyCount || 0,
          limit: tierLimits.per_day,
          percentage: ((dailyCount || 0) / tierLimits.per_day) * 100,
        },
      });
    } catch (error) {
      console.error('Error fetching rate limits:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 80) return 'text-destructive';
    if (percentage >= 50) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-destructive';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 80) return <AlertTriangle className="h-5 w-5 text-destructive" />;
    if (percentage >= 50) return <TrendingUp className="h-5 w-5 text-yellow-500" />;
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  };

  const getStatusBadge = (percentage: number) => {
    if (percentage >= 80) return <Badge variant="destructive">Warning</Badge>;
    if (percentage >= 50) return <Badge className="bg-yellow-500">Caution</Badge>;
    return <Badge className="bg-green-500">Healthy</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rate Limit Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!rateLimits) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rate Limit Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No API key selected</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Rate Limit Status</CardTitle>
          {getStatusBadge(Math.max(rateLimits.per_minute.percentage, rateLimits.per_day.percentage))}
        </div>
        <CardDescription>
          Real-time usage monitoring for tier: <strong>{tier.toUpperCase()}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Per Minute */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(rateLimits.per_minute.percentage)}
              <span className="font-medium">Per Minute</span>
            </div>
            <span className={`text-sm font-medium ${getStatusColor(rateLimits.per_minute.percentage)}`}>
              {rateLimits.per_minute.current} / {rateLimits.per_minute.limit}
            </span>
          </div>
          <Progress 
            value={rateLimits.per_minute.percentage} 
            className="h-3"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{rateLimits.per_minute.percentage.toFixed(1)}% used</span>
            {rateLimits.per_minute.percentage >= 80 && (
              <span className="text-destructive font-medium">
                {rateLimits.per_minute.limit - rateLimits.per_minute.current} requests remaining
              </span>
            )}
          </div>
        </div>

        {/* Per Day */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(rateLimits.per_day.percentage)}
              <span className="font-medium">Per Day</span>
            </div>
            <span className={`text-sm font-medium ${getStatusColor(rateLimits.per_day.percentage)}`}>
              {rateLimits.per_day.current} / {rateLimits.per_day.limit}
            </span>
          </div>
          <Progress 
            value={rateLimits.per_day.percentage} 
            className="h-3"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{rateLimits.per_day.percentage.toFixed(1)}% used</span>
            {rateLimits.per_day.percentage >= 80 && (
              <span className="text-destructive font-medium">
                {rateLimits.per_day.limit - rateLimits.per_day.current} requests remaining
              </span>
            )}
          </div>
        </div>

        {/* Warning Message */}
        {(rateLimits.per_minute.percentage >= 80 || rateLimits.per_day.percentage >= 80) && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Rate Limit Warning</p>
                <p className="text-xs text-muted-foreground">
                  You're approaching your rate limit. Consider upgrading your tier or reducing request frequency.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Status Indicators:</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">&lt; 50%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-muted-foreground">50-80%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-muted-foreground">&gt; 80%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}