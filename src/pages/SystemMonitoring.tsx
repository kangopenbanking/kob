import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock,
  FileText,
  TrendingUp,
  Shield,
  Loader2
} from "lucide-react";

const SystemMonitoring = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [healthChecks, setHealthChecks] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  
  // New incident form
  const [newIncident, setNewIncident] = useState({
    severity: "medium",
    incident_type: "performance",
    title: "",
    description: ""
  });

  useEffect(() => {
    fetchHealthChecks();
    fetchAlerts();
    fetchIncidents();
    fetchReports();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchHealthChecks();
      fetchAlerts();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchHealthChecks = async () => {
    const { data } = await supabase
      .from("system_health_checks")
      .select("*")
      .order("checked_at", { ascending: false })
      .limit(20);
    if (data) setHealthChecks(data);
  };

  const fetchAlerts = async () => {
    const { data } = await supabase
      .from("system_alerts")
      .select("id, alert_type, message, severity, status, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setAlerts(data);
  };

  const fetchIncidents = async () => {
    const { data } = await supabase
      .from("incident_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setIncidents(data);
  };

  const fetchReports = async () => {
    const { data } = await supabase
      .from("compliance_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setReports(data);
  };

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('system-health-check');
      
      if (error) throw error;
      const result = data;
      
      toast({
        title: "Health Check Complete",
        description: `System status: ${result.status}`
      });
      
      await fetchHealthChecks();
    } catch (error: any) {
      toast({
        title: "Health Check Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    const { error } = await supabase
      .from("system_alerts")
      .update({ 
        is_acknowledged: true,
        acknowledged_at: new Date().toISOString()
      } as any)
      .eq("id", alertId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({ title: "Alert acknowledged" });
      fetchAlerts();
    }
  };

  const createIncident = async () => {
    if (!newIncident.title) {
      toast({
        title: "Title Required",
        description: "Please enter an incident title",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("incident_logs").insert(newIncident);

      if (error) throw error;

      toast({ title: "Incident created successfully" });
      setNewIncident({
        severity: "medium",
        incident_type: "performance",
        title: "",
        description: ""
      });
      fetchIncidents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateComplianceReport = async () => {
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date();

      const { data, error } = await supabase.rpc("generate_compliance_report", {
        _start_date: startDate.toISOString().split('T')[0],
        _end_date: endDate.toISOString().split('T')[0],
        _report_type: "monthly"
      });

      if (error) throw error;

      toast({
        title: "Report Generated",
        description: "Monthly compliance report created successfully"
      });
      
      fetchReports();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-500"><CheckCircle2 className="mr-1 h-3 w-3" /> Healthy</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500"><AlertTriangle className="mr-1 h-3 w-3" /> Degraded</Badge>;
      case "down":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Down</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case "low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4">
            <Activity className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">System Monitoring</span>
          </div>
          <h1 className="text-3xl font-bold">System Health & Compliance</h1>
          <p className="text-muted-foreground mt-2">
            Monitor system performance, manage incidents, and generate compliance reports
          </p>
        </div>

        <Tabs defaultValue="health" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="health">
              <Activity className="mr-2 h-4 w-4" />
              Health
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="incidents">
              <Shield className="mr-2 h-4 w-4" />
              Incidents
            </TabsTrigger>
            <TabsTrigger value="compliance">
              <FileText className="mr-2 h-4 w-4" />
              Compliance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="health" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>System Health Status</CardTitle>
                    <CardDescription>Real-time service monitoring</CardDescription>
                  </div>
                  <Button onClick={runHealthCheck} disabled={loading}>
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Activity className="mr-2 h-4 w-4" />
                    )}
                    Run Check
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {healthChecks.slice(0, 5).map((check) => (
                    <div key={check.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        {getStatusBadge(check.status)}
                        <div>
                          <p className="font-medium">{check.service_name}</p>
                          {check.error_message && (
                            <p className="text-sm text-destructive">{check.error_message}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {check.response_time_ms}ms
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(check.checked_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {healthChecks.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No health checks yet. Run a check to get started.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
                <CardDescription>Unacknowledged system alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start justify-between p-3 border rounded">
                      <div className="flex-1">
                        {getSeverityBadge(alert.severity)}
                        <Badge variant="outline" className="ml-2">{alert.alert_type}</Badge>
                        <p className="font-medium mt-2">{alert.message}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No active alerts. System is running smoothly.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="incidents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Incident</CardTitle>
                <CardDescription>Report a new system incident</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Severity</Label>
                    <Select value={newIncident.severity} onValueChange={(v) => setNewIncident({...newIncident, severity: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={newIncident.incident_type} onValueChange={(v) => setNewIncident({...newIncident, incident_type: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="performance">Performance</SelectItem>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="availability">Availability</SelectItem>
                        <SelectItem value="data">Data</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newIncident.title}
                    onChange={(e) => setNewIncident({...newIncident, title: e.target.value})}
                    placeholder="Brief description of the incident"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newIncident.description}
                    onChange={(e) => setNewIncident({...newIncident, description: e.target.value})}
                    rows={4}
                    placeholder="Detailed incident information..."
                  />
                </div>
                <Button onClick={createIncident} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create Incident
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Incidents</CardTitle>
                <CardDescription>Latest incident reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {incidents.map((incident) => (
                    <div key={incident.id} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        {getSeverityBadge(incident.severity)}
                        <Badge variant="outline">{incident.status}</Badge>
                      </div>
                      <p className="font-medium">{incident.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{incident.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(incident.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Compliance Reports</CardTitle>
                    <CardDescription>Generate regulatory compliance reports</CardDescription>
                  </div>
                  <Button onClick={generateComplianceReport} disabled={loading}>
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <TrendingUp className="mr-2 h-4 w-4" />
                    )}
                    Generate Report
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reports.map((report) => (
                    <div key={report.id} className="p-4 border rounded">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <Badge variant="outline">{report.report_type}</Badge>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(report.report_period_start).toLocaleDateString()} - {new Date(report.report_period_end).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(report.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total Consents</p>
                          <p className="text-2xl font-bold">{report.total_consents}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">API Calls</p>
                          <p className="text-2xl font-bold">{report.total_api_calls}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payments</p>
                          <p className="text-2xl font-bold">{report.total_payments}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Unique TPPs</p>
                          <p className="text-2xl font-bold">{report.unique_tpps}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {reports.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No reports generated yet. Click the button above to generate your first report.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
};

export default SystemMonitoring;
