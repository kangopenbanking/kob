import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Shield, Ban, RefreshCw, Clock, ShieldAlert} from "lucide-react";
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface SuspiciousActivity {
  id: string;
  user_id: string;
  activity_type: string;
  severity: string;
  description: string;
  ip_address: any;
  user_agent: string;
  action_taken: string;
  created_at: string;
}

interface FailedLogin {
  id: string;
  email: string;
  ip_address: any;
  attempt_count: number;
  last_attempt_at: string;
  blocked_until: string | null;
  failure_reason: string;
}

export default function SecurityMonitoring() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [suspiciousActivities, setSuspiciousActivities] = useState<SuspiciousActivity[]>([]);
  const [failedLogins, setFailedLogins] = useState<FailedLogin[]>([]);
  const [stats, setStats] = useState({
    totalAlerts: 0,
    criticalAlerts: 0,
    blockedIPs: 0,
    failedLogins24h: 0
  });

  useEffect(() => {
    checkAdminAccess();
    loadSecurityData();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!hasAdminRole) {
      toast.error('Access denied');
      navigate('/');
    }
  };

  const loadSecurityData = async () => {
    try {
      setLoading(true);

      // Load suspicious activities
      const { data: activities, error: activitiesError } = await supabase
        .from('suspicious_activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (activitiesError) throw activitiesError;

      // Load failed login attempts
      const { data: logins, error: loginsError } = await supabase
        .from('failed_login_attempts')
        .select('*')
        .order('last_attempt_at', { ascending: false })
        .limit(50);

      if (loginsError) throw loginsError;

      setSuspiciousActivities(activities || []);
      setFailedLogins(logins || []);

      // Calculate stats
      const criticalCount = activities?.filter(a => a.severity === 'critical').length || 0;
      const blockedCount = logins?.filter(l => l.blocked_until && new Date(l.blocked_until) > new Date()).length || 0;
      const recent24h = logins?.filter(l => {
        const diff = Date.now() - new Date(l.last_attempt_at).getTime();
        return diff < 24 * 60 * 60 * 1000;
      }).length || 0;

      setStats({
        totalAlerts: activities?.length || 0,
        criticalAlerts: criticalCount,
        blockedIPs: blockedCount,
        failedLogins24h: recent24h
      });

    } catch (error) {
      logger.error('Error loading security data:', error);
      toast.error('Failed to load security data');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">Medium</Badge>;
      default:
        return <Badge variant="secondary">Low</Badge>;
    }
  };

  const unblockIP = async (loginId: string) => {
    try {
      const { error } = await supabase
        .from('failed_login_attempts')
        .update({ blocked_until: null, attempt_count: 0 })
        .eq('id', loginId);

      if (error) throw error;

      toast.success('IP unblocked successfully');
      loadSecurityData();
    } catch (error) {
      logger.error('Error unblocking IP:', error);
      toast.error('Failed to unblock IP');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 flex items-center justify-center min-h-screen">
      <AdminPageHeader icon={ShieldAlert} title="Security Monitoring" description="Monitor security events, threats, and access patterns" />

        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAlerts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.criticalAlerts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked IPs</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.blockedIPs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Logins (24h)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failedLogins24h}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="suspicious" className="space-y-4">
        <TabsList>
          <TabsTrigger value="suspicious">Suspicious Activities</TabsTrigger>
          <TabsTrigger value="failed-logins">Failed Login Attempts</TabsTrigger>
        </TabsList>

        <TabsContent value="suspicious" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suspicious Activities</CardTitle>
              <CardDescription>Recent suspicious user activities detected</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Activity Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Action Taken</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suspiciousActivities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>{getSeverityBadge(activity.severity)}</TableCell>
                      <TableCell>{activity.activity_type}</TableCell>
                      <TableCell>{activity.description}</TableCell>
                      <TableCell>
                        <code className="text-xs">{activity.ip_address}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{activity.action_taken || 'Flagged'}</Badge>
                      </TableCell>
                      <TableCell>{new Date(activity.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failed-logins" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Failed Login Attempts</CardTitle>
              <CardDescription>Monitor and manage failed authentication attempts</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Last Attempt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedLogins.map((login) => (
                    <TableRow key={login.id}>
                      <TableCell>{login.email}</TableCell>
                      <TableCell>
                        <code className="text-xs">{login.ip_address}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={login.attempt_count > 5 ? 'destructive' : 'secondary'}>
                          {login.attempt_count}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(login.last_attempt_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {login.blocked_until && new Date(login.blocked_until) > new Date() ? (
                          <Badge variant="destructive">Blocked</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {login.blocked_until && new Date(login.blocked_until) > new Date() && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unblockIP(login.id)}
                          >
                            Unblock
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
