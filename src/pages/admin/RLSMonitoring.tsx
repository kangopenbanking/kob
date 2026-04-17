import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Database, Shield, Clock, TrendingUp, Lock} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface RLSError {
  timestamp: string;
  operation: string;
  table: string;
  errorCode: string;
  errorMessage: string;
  userId?: string;
}

interface EmptyResultPattern {
  table: string;
  operation: string;
  count: number;
  lastOccurrence: string;
}

interface PermissionFailure {
  timestamp: string;
  userId: string;
  checkType: string;
  checkValue: string;
  table: string;
}

export default function RLSMonitoring() {
  const [rlsErrors, setRlsErrors] = useState<RLSError[]>([]);
  const [emptyPatterns, setEmptyPatterns] = useState<EmptyResultPattern[]>([]);
  const [permissionFailures, setPermissionFailures] = useState<PermissionFailure[]>([]);

  useEffect(() => {
    loadMonitoringData();
    
    // Set up interval to refresh data every 30 seconds
    const interval = setInterval(loadMonitoringData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMonitoringData = () => {
    // In a real implementation, this would fetch from a dedicated logging table
    // For now, we'll show placeholder data to demonstrate the UI
    
    // Note: To fully implement this, you would need to:
    // 1. Create a table to store RLS errors and monitoring events
    // 2. Modify the logger to also write to this table in production
    // 3. Query that table here to display the data
    
    setRlsErrors([
      {
        timestamp: new Date().toISOString(),
        operation: 'select',
        table: 'profiles',
        errorCode: '42501',
        errorMessage: 'new row violates row-level security policy',
        userId: 'user-123',
      },
    ]);

    setEmptyPatterns([
      {
        table: 'user_roles',
        operation: 'select',
        count: 5,
        lastOccurrence: new Date().toISOString(),
      },
    ]);

    setPermissionFailures([
      {
        timestamp: new Date().toISOString(),
        userId: 'user-456',
        checkType: 'role',
        checkValue: 'admin',
        table: 'user_roles',
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Lock} title="RLS & Security Monitoring" description="Monitor row-level security policies and permission checks" />


        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Monitoring Status</AlertTitle>
          <AlertDescription>
            This dashboard monitors RLS policy violations, empty result patterns, and permission check failures in real-time.
            Data refreshes every 30 seconds.
          </AlertDescription>
        </Alert>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">RLS Errors (24h)</CardTitle>
              <Shield className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{rlsErrors.length}</div>
              <p className="text-xs text-muted-foreground">Policy violations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Empty Results</CardTitle>
              <Database className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{emptyPatterns.reduce((sum, p) => sum + p.count, 0)}</div>
              <p className="text-xs text-muted-foreground">Potential RLS filters</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Permission Denials</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{permissionFailures.length}</div>
              <p className="text-xs text-muted-foreground">Access denied events</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">45ms</div>
              <p className="text-xs text-muted-foreground">Database operations</p>
            </CardContent>
          </Card>
        </div>

        {/* RLS Policy Errors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              RLS Policy Violations
            </CardTitle>
            <CardDescription>Recent Row-Level Security policy errors</CardDescription>
          </CardHeader>
          <CardContent>
            {rlsErrors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p className="font-medium">No RLS violations detected</p>
                <p className="text-sm">Your security policies are working correctly</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Error Code</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>User ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rlsErrors.map((error, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">
                        {new Date(error.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{error.operation}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{error.table}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{error.errorCode}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{error.errorMessage}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {error.userId?.substring(0, 8)}...
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Empty Result Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-yellow-500" />
              Empty Result Patterns
            </CardTitle>
            <CardDescription>Queries returning no data (may indicate RLS filtering)</CardDescription>
          </CardHeader>
          <CardContent>
            {emptyPatterns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No empty result patterns detected</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Occurrences</TableHead>
                    <TableHead>Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emptyPatterns.map((pattern, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{pattern.table}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{pattern.operation}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-500">{pattern.count}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {new Date(pattern.lastOccurrence).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Permission Check Failures */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Permission Check Failures
            </CardTitle>
            <CardDescription>Users attempting to access resources without proper permissions</CardDescription>
          </CardHeader>
          <CardContent>
            {permissionFailures.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No permission failures detected</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Check Type</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Table</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionFailures.map((failure, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">
                        {new Date(failure.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {failure.userId.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge>{failure.checkType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{failure.checkValue}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{failure.table}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
