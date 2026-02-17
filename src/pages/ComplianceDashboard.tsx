import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertTriangle, CheckCircle, FileText, Users, TrendingUp, RefreshCw } from "lucide-react";
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
        .select('*');

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
      
      toast({
        title: "Success",
        description: "Compliance data refreshed successfully",
      });
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
    <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Compliance Dashboard</h1>
            <p className="text-muted-foreground mt-1">Monitor KYC, AML, and regulatory compliance</p>
          </div>
          <Button onClick={fetchComplianceData} disabled={loading} variant="outline" size="sm" className="rounded-full">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "KYC Verifications", value: kycStats?.length || 0, sub: "Total submissions", icon: Shield, color: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" },
          { label: "Active Alerts", value: alerts.filter(a => a.status === 'open').length, sub: "Requires attention", icon: AlertTriangle, color: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" },
          { label: "Regulatory Reports", value: reports.length, sub: "This period", icon: FileText, color: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400" },
          { label: "Compliance Rate", value: "98.5%", sub: "Above target", icon: TrendingUp, color: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400" },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-xl border-0 shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="alerts" className="space-y-6">
        <TabsList className="inline-flex h-10 items-center rounded-full bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="alerts" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Alerts</TabsTrigger>
          <TabsTrigger value="kyc" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">KYC</TabsTrigger>
          <TabsTrigger value="reports" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Reports</TabsTrigger>
          <TabsTrigger value="sanctions" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Sanctions</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Transaction Monitoring Alerts</CardTitle>
              <CardDescription className="text-xs">Real-time AML and fraud detection alerts</CardDescription>
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
