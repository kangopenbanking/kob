import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Brain, RefreshCw, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function AnomalyDetection() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reports, isLoading } = useQuery({
    queryKey: ["anomaly-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_anomaly_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const runAnalysis = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-anomaly-detection");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anomaly-reports"] });
      toast({
        title: "Analysis completed",
        description: "AI anomaly detection has been run successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      await runAnalysis.mutateAsync();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const latestReport = reports?.[0];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Anomaly Detection</h1>
          <p className="text-muted-foreground">
            Powered by Lovable AI to analyze API patterns and flag suspicious behavior
          </p>
        </div>
        <Button onClick={handleRunAnalysis} disabled={isAnalyzing} size="lg">
          <Brain className="mr-2 h-5 w-5" />
          {isAnalyzing ? "Analyzing..." : "Run AI Analysis"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{reports?.length || 0}</div>
          <div className="text-sm text-muted-foreground">Total Analyses</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-red-600">
            {reports?.filter((r) => r.anomalies_detected).length || 0}
          </div>
          <div className="text-sm text-muted-foreground">Anomalies Detected</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">
            {reports?.filter((r) => !r.anomalies_detected).length || 0}
          </div>
          <div className="text-sm text-muted-foreground">Normal Activity</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">
            {latestReport
              ? new Date(latestReport.created_at).toLocaleDateString()
              : "N/A"}
          </div>
          <div className="text-sm text-muted-foreground">Last Analysis</div>
        </Card>
      </div>

      {/* Latest Analysis */}
      {latestReport && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Latest AI Analysis
            </h2>
            <div className="flex items-center gap-2">
              {latestReport.anomalies_detected ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Anomalies Detected
                </Badge>
              ) : (
                <Badge className="gap-1 bg-green-500">
                  <CheckCircle2 className="h-3 w-3" />
                  Normal Activity
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {new Date(latestReport.created_at).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Quick Stats */}
          {latestReport.analysis_data && (
            <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Total Requests</p>
                <p className="text-lg font-bold">
                  {(latestReport.analysis_data as any).total_requests?.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Errors</p>
                <p className="text-lg font-bold text-red-600">
                  {(latestReport.analysis_data as any).total_errors}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Suspicious Clients</p>
                <p className="text-lg font-bold text-yellow-600">
                  {(latestReport.analysis_data as any).suspicious_clients?.length || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Top Endpoints</p>
                <p className="text-lg font-bold">
                  {(latestReport.analysis_data as any).top_endpoints?.length || 0}
                </p>
              </div>
            </div>
          )}

          {/* AI Analysis */}
          <div className="prose prose-sm max-w-none">
            <div className="bg-accent p-6 rounded-lg">
              <ReactMarkdown>{latestReport.ai_analysis}</ReactMarkdown>
            </div>
          </div>

          {/* Top Endpoints */}
          {(latestReport.analysis_data as any)?.top_endpoints && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top Endpoints by Traffic
              </h3>
              <div className="grid gap-2">
                {(latestReport.analysis_data as any).top_endpoints.slice(0, 5).map((endpoint: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono">{endpoint.endpoint}</span>
                      <Badge variant="secondary">{endpoint.requests} requests</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={parseFloat(endpoint.error_rate) > 5 ? "destructive" : "secondary"}>
                        {endpoint.error_rate}% errors
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {endpoint.avg_response_time}ms avg
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suspicious Clients */}
          {(latestReport.analysis_data as any)?.suspicious_clients?.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                Suspicious Client Activity
              </h3>
              <div className="space-y-2">
                {(latestReport.analysis_data as any).suspicious_clients.slice(0, 5).map((client: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 border border-yellow-200 rounded-lg bg-yellow-50">
                    <div>
                      <span className="font-mono text-sm">{client.client}</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {client.requests} requests
                      </p>
                    </div>
                    <Badge variant="destructive">{client.error_rate}% error rate</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Historical Reports */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Analysis History</h2>
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-center text-muted-foreground">Loading...</p>
          ) : reports?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No analyses yet. Click "Run AI Analysis" to start.
            </p>
          ) : (
            reports?.map((report) => (
              <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">
                      {new Date(report.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(report.analysis_data as any)?.total_requests || 0} requests analyzed
                    </p>
                  </div>
                </div>
                {report.anomalies_detected ? (
                  <Badge variant="destructive">Anomalies Found</Badge>
                ) : (
                  <Badge className="bg-green-500">Normal</Badge>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
