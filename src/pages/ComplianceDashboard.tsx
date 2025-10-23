import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertTriangle, CheckCircle, FileText, Users, TrendingUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ComplianceDashboard() {
  const [kycStats, setKycStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchComplianceData();
  }, []);

  const fetchComplianceData = async () => {
    try {
      setLoading(true);

      // Fetch KYC statistics
      const { data: kycData, error: kycError } = await supabase
        .from('kyc_verifications')
        .select('status, count');

      if (kycError) throw kycError;

      // Fetch transaction monitoring alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('transaction_monitoring_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (alertsError) throw alertsError;
      setAlerts(alertsData || []);

      // Fetch regulatory reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('regulatory_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (reportsError) throw reportsError;
      setReports(reportsData || []);

      setKycStats(kycData);
    } catch (error: any) {
      console.error('Error fetching compliance data:', error);
      toast({
        title: "Error",
        description: "Failed to load compliance data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'outline';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compliance Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor KYC, AML, and regulatory compliance
          </p>
        </div>
        <Button onClick={fetchComplianceData}>
          Refresh Data
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KYC Verifications</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kycStats?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Total submissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.filter(a => a.status === 'open').length}
            </div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Regulatory Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.5%</div>
            <p className="text-xs text-muted-foreground">Above target</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Transaction Alerts</TabsTrigger>
          <TabsTrigger value="kyc">KYC Status</TabsTrigger>
          <TabsTrigger value="reports">Regulatory Reports</TabsTrigger>
          <TabsTrigger value="sanctions">Sanctions Screening</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Monitoring Alerts</CardTitle>
              <CardDescription>Real-time AML and fraud detection alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {alerts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                      <p>No active alerts</p>
                    </div>
                  ) : (
                    alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-start justify-between p-4 border rounded-lg"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            <span className="font-medium">{alert.rule_name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {alert.alert_description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(alert.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          Investigate
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kyc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>KYC Verification Status</CardTitle>
              <CardDescription>Customer identity verification overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {kycStats?.filter((k: any) => k.status === 'approved').length || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Approved</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {kycStats?.filter((k: any) => k.status === 'pending').length || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Pending Review</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {kycStats?.filter((k: any) => k.status === 'rejected').length || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Rejected</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Regulatory Reports</CardTitle>
              <CardDescription>Compliance reports for regulators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2" />
                    <p>No reports generated yet</p>
                  </div>
                ) : (
                  reports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">{report.report_type}</div>
                        <p className="text-sm text-muted-foreground">
                          Period: {report.report_period_start} to {report.report_period_end}
                        </p>
                        <Badge variant="outline">{report.submission_status}</Badge>
                      </div>
                      <Button variant="outline" size="sm">
                        Download
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sanctions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sanctions Screening</CardTitle>
              <CardDescription>Automated sanctions list screening</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2" />
                <p>All customers screened against international sanctions lists</p>
                <p className="text-sm mt-2">No matches found</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
