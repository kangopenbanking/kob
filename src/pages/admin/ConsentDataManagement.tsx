import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from '@/lib/logger';
import { loggedQuery } from '@/lib/database-logger';
import { Loader2, Trash2, Database, Calendar, BarChart3, AlertCircle, FileCheck} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, subDays, subYears } from "date-fns";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface ConsentStats {
  total_events: number;
  events_by_type: Array<{ event_type: string; count: number }>;
  events_last_30_days: number;
  events_older_than_2_years: number;
  oldest_event_date: string | null;
  newest_event_date: string | null;
}

interface CleanupResult {
  deleted_count: number;
  retention_period_days: number;
  cutoff_date: string;
  execution_time_ms: number;
}

export default function ConsentDataManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [stats, setStats] = useState<ConsentStats | null>(null);
  const [lastCleanup, setLastCleanup] = useState<CleanupResult | null>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  useEffect(() => {
    fetchConsentStatistics();
    fetchRecentEvents();
    fetchLastCleanupRun();
  }, []);

  const fetchConsentStatistics = async () => {
    try {
      setLoading(true);

      // Get total events
      const totalQuery = supabase
        .from('consent_events')
        .select('*', { count: 'exact', head: true });
      
      const totalResult = await loggedQuery(
        totalQuery,
        {
          type: 'select',
          table: 'consent_events',
          description: 'Count total consent events',
        }
      );

      if (totalResult.error) throw totalResult.error;
      const totalCount = totalResult.count;

      // Get events by type
      const { data: byTypeData, error: byTypeError } = await supabase
        .from('consent_events')
        .select('event_type')
        .order('event_type');

      if (byTypeError) throw byTypeError;

      const eventsByType = byTypeData?.reduce((acc: any[], event) => {
        const existing = acc.find(e => e.event_type === event.event_type);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ event_type: event.event_type, count: 1 });
        }
        return acc;
      }, []) || [];

      // Get events in last 30 days
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { count: last30DaysCount, error: last30Error } = await supabase
        .from('consent_events')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo);

      if (last30Error) throw last30Error;

      // Get events older than 2 years
      const twoYearsAgo = subYears(new Date(), 2).toISOString();
      const { count: oldEventsCount, error: oldError } = await supabase
        .from('consent_events')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', twoYearsAgo);

      if (oldError) throw oldError;

      // Get oldest and newest event dates
      const { data: oldestEvent } = await supabase
        .from('consent_events')
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      const { data: newestEvent } = await supabase
        .from('consent_events')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setStats({
        total_events: totalCount || 0,
        events_by_type: eventsByType,
        events_last_30_days: last30DaysCount || 0,
        events_older_than_2_years: oldEventsCount || 0,
        oldest_event_date: oldestEvent?.created_at || null,
        newest_event_date: newestEvent?.created_at || null,
      });

      logger.info('Consent statistics loaded successfully', {
        totalEvents: totalCount,
        eventTypes: eventsByType.length,
        oldEventsCount,
      });
    } catch (error: any) {
      logger.error('Error fetching consent statistics:', error);
      
      if (error?.code === '42501') {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "You don't have permission to access consent event statistics.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to fetch consent event statistics: ${error?.message || 'Unknown error'}`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentEvents = async () => {
    try {
      const query = supabase
        .from('consent_events')
        .select('id, event_type, consent_type, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(10);
      
      const result = await loggedQuery(
        query,
        {
          type: 'select',
          table: 'consent_events',
          description: 'Fetch recent consent events',
        }
      );

      if (result.error) {
        logger.warn('Failed to fetch recent consent events', result.error);
        return;
      }

      setRecentEvents((result.data as any[]) || []);
    } catch (error) {
      logger.error('Error fetching recent events:', error);
    }
  };

  const fetchLastCleanupRun = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('details, created_at')
        .eq('action_type', 'gdpr_data_retention')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.details) {
        setLastCleanup(data.details as unknown as CleanupResult);
      }
    } catch (error) {
      console.error('Error fetching last cleanup run:', error);
    }
  };

  const handleManualCleanup = async () => {
    try {
      setCleanupLoading(true);
      logger.info('Starting manual GDPR consent data cleanup');

      const { data, error } = await supabase.functions.invoke('gdpr-consent-retention', {
        body: { manual_trigger: true },
      });

      if (error) throw error;

      logger.info('Manual cleanup completed successfully', {
        deletedCount: data.data.deleted_count,
      });

      toast({
        title: "Cleanup Completed",
        description: `Successfully deleted ${data.data.deleted_count} consent events older than 2 years.`,
      });

      // Refresh statistics
      await fetchConsentStatistics();
      await fetchLastCleanupRun();
    } catch (error: any) {
      logger.error('Error triggering manual cleanup:', error);
      toast({
        variant: "destructive",
        title: "Cleanup Failed",
        description: `Failed to execute data retention cleanup: ${error?.message || 'Unknown error'}`,
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 flex items-center justify-center min-h-[400px]">
      <AdminPageHeader icon={FileCheck} title="Consent Data Management" description="Manage open banking consent records and data access permissions" />

        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button
          onClick={handleManualCleanup}
          disabled={cleanupLoading || (stats?.events_older_than_2_years || 0) === 0}
          className="gap-2"
        >
          {cleanupLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Manual Cleanup
        </Button>
      </div>

      {/* Alert if there are events to clean up */}
      {stats && stats.events_older_than_2_years > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Data Retention Notice</AlertTitle>
          <AlertDescription>
            There are {stats.events_older_than_2_years} consent events older than 2 years that can be cleaned up for GDPR compliance.
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_events.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              All consent events recorded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 30 Days</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.events_last_30_days.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Recent activity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eligible for Deletion</CardTitle>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.events_older_than_2_years.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Older than 2 years
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Event Types</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.events_by_type.length}</div>
            <p className="text-xs text-muted-foreground">
              Different event types
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Last Cleanup Run */}
      {lastCleanup && (
        <Card>
          <CardHeader>
            <CardTitle>Last Cleanup Run</CardTitle>
            <CardDescription>Most recent automated data retention cleanup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium">Deleted Events</p>
                <p className="text-2xl font-bold text-destructive">{lastCleanup.deleted_count}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Retention Period</p>
                <p className="text-2xl font-bold">{lastCleanup.retention_period_days} days</p>
              </div>
              <div>
                <p className="text-sm font-medium">Execution Time</p>
                <p className="text-2xl font-bold">{lastCleanup.execution_time_ms}ms</p>
              </div>
              <div>
                <p className="text-sm font-medium">Cutoff Date</p>
                <p className="text-sm font-medium">{format(new Date(lastCleanup.cutoff_date), 'PP')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Events by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Events by Type</CardTitle>
          <CardDescription>Distribution of consent event types</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Type</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.events_by_type.map((event) => (
                <TableRow key={event.event_type}>
                  <TableCell className="font-medium">
                    <Badge variant="outline">{event.event_type}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{event.count.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {((event.count / (stats?.total_events || 1)) * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Consent Events</CardTitle>
          <CardDescription>Latest 10 consent events logged in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Type</TableHead>
                <TableHead>Consent Type</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>User ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <Badge>{event.event_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{event.consent_type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(event.created_at), 'PPp')}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {event.user_id?.substring(0, 8)}...
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Data Timeline */}
      {stats?.oldest_event_date && stats?.newest_event_date && (
        <Card>
          <CardHeader>
            <CardTitle>Data Timeline</CardTitle>
            <CardDescription>Range of consent events in the system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Oldest Event</p>
                <p className="text-lg font-semibold">
                  {format(new Date(stats.oldest_event_date), 'PPP')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Newest Event</p>
                <p className="text-lg font-semibold">
                  {format(new Date(stats.newest_event_date), 'PPP')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
