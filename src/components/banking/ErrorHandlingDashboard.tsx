import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, TrendingUp } from "lucide-react";

interface ErrorLog {
  id: string;
  event_type: string;
  event_category: string;
  risk_score: number;
  created_at: string;
  metadata: any;
}

export function ErrorHandlingDashboard() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({
    total_errors: 0,
    critical_errors: 0,
    avg_risk_score: 0,
  });

  const fetchErrors = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('security_audit_logs')
        .select('*', { count: 'exact' })
        .in('event_category', ['error', 'payment', 'transaction'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('event_category', filter);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setErrors(data || []);

      // Calculate stats
      const criticalErrors = (data || []).filter(e => e.risk_score && e.risk_score > 70).length;
      const avgRisk = (data || []).reduce((sum, e) => sum + (e.risk_score || 0), 0) / (data || []).length;

      setStats({
        total_errors: count || 0,
        critical_errors: criticalErrors,
        avg_risk_score: Math.round(avgRisk),
      });
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, [filter]);

  const getRiskBadge = (score: number) => {
    if (score >= 70) return <Badge variant="destructive">Critical</Badge>;
    if (score >= 40) return <Badge variant="secondary">Medium</Badge>;
    return <Badge>Low</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_errors}</div>
            <p className="text-xs text-muted-foreground">Last 100 events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.critical_errors}</div>
            <p className="text-xs text-muted-foreground">Risk score {'>'} 70</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Risk Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avg_risk_score}</div>
            <p className="text-xs text-muted-foreground">Across all events</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Error & Event Logs</CardTitle>
          <CardDescription>
            Monitor system errors and security events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
                <SelectItem value="payment">Payments</SelectItem>
                <SelectItem value="transaction">Transactions</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchErrors} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {stats.critical_errors > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{stats.critical_errors} critical errors</strong> detected. Immediate attention required.
              </AlertDescription>
            </Alert>
          )}

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : errors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No events found
                    </TableCell>
                  </TableRow>
                ) : (
                  errors.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">{log.event_type}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.event_category}</Badge>
                      </TableCell>
                      <TableCell>{getRiskBadge(log.risk_score || 0)}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {JSON.stringify(log.metadata)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
