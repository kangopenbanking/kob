import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Zap, Activity, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const ENDPOINTS = [
  "/aisp-accounts",
  "/aisp-balances",
  "/mobile-money-charge",
  "/credit-score-calculate",
  "/loan-apply",
  "/api-health",
];

export default function LoadTesting() {
  const [endpoint, setEndpoint] = useState(ENDPOINTS[0]);
  const [concurrentRequests, setConcurrentRequests] = useState(10);
  const [duration, setDuration] = useState(30);
  const [payload, setPayload] = useState("{}");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const runLoadTest = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + (100 / duration);
      });
    }, 1000);

    try {
      const { data, error } = await supabase.functions.invoke("load-test-runner", {
        body: {
          endpoint,
          concurrent_requests: concurrentRequests,
          duration_seconds: duration,
          payload: JSON.parse(payload),
        },
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      setResults(data);
      toast({
        title: "Load test completed",
        description: `Processed ${data.total_requests} requests`,
      });
    } catch (error: any) {
      clearInterval(progressInterval);
      toast({
        title: "Load test failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getHealthColor = (successRate: number) => {
    if (successRate >= 99) return "text-green-600";
    if (successRate >= 95) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Load Testing Tool</h1>
        <p className="text-muted-foreground">
          Simulate high traffic and stress test your edge functions
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuration */}
        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Test Configuration</h2>

          <div className="space-y-2">
            <Label>Endpoint</Label>
            <Select value={endpoint} onValueChange={setEndpoint}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENDPOINTS.map((ep) => (
                  <SelectItem key={ep} value={ep}>
                    {ep}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Concurrent Requests</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={concurrentRequests}
              onChange={(e) => setConcurrentRequests(parseInt(e.target.value))}
              disabled={isRunning}
            />
            <p className="text-xs text-muted-foreground">
              Number of simultaneous requests (1-100)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Duration (seconds)</Label>
            <Input
              type="number"
              min="10"
              max="300"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              disabled={isRunning}
            />
            <p className="text-xs text-muted-foreground">
              Test duration (10-300 seconds)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Request Payload (JSON)</Label>
            <Textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className="font-mono text-sm"
              disabled={isRunning}
              placeholder="{}"
            />
          </div>

          {isRunning && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Running test...</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          <Button
            onClick={runLoadTest}
            disabled={isRunning}
            className="w-full"
            size="lg"
          >
            <Zap className="mr-2 h-4 w-4" />
            {isRunning ? "Test Running..." : "Start Load Test"}
          </Button>
        </Card>

        {/* Results */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>

          {!results ? (
            <div className="text-center py-20 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No results yet. Configure and run a load test.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold">{results.total_requests}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className={`text-2xl font-bold ${getHealthColor(parseFloat(results.success_rate))}`}>
                    {results.success_rate}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Requests/sec</p>
                  <p className="text-2xl font-bold">{results.requests_per_second}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Avg Response</p>
                  <p className="text-2xl font-bold">{results.avg_response_time}ms</p>
                </div>
              </div>

              {/* Response Time Stats */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Response Time Statistics</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Min</p>
                    <p className="font-mono text-sm">{results.min_response_time}ms</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">P95</p>
                    <p className="font-mono text-sm">{results.p95_response_time}ms</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max</p>
                    <p className="font-mono text-sm">{results.max_response_time}ms</p>
                  </div>
                </div>
              </div>

              {/* Status Codes */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Status Code Distribution</h3>
                <div className="space-y-2">
                  {Object.entries(results.status_codes).map(([code, count]: [string, any]) => (
                    <div key={code} className="flex items-center justify-between">
                      <Badge variant={parseInt(code) < 400 ? "secondary" : "destructive"}>
                        {code}
                      </Badge>
                      <span className="text-sm">{count} requests</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Errors */}
              {results.sample_errors && results.sample_errors.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Sample Errors
                  </h3>
                  <div className="space-y-2">
                    {results.sample_errors.slice(0, 3).map((error: string, i: number) => (
                      <div key={i} className="text-xs font-mono bg-muted p-2 rounded">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Health Assessment */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Health Assessment</h3>
                <div className="flex items-center gap-2">
                  {parseFloat(results.success_rate) >= 99 ? (
                    <>
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <span className="text-green-600 font-medium">Excellent Performance</span>
                    </>
                  ) : parseFloat(results.success_rate) >= 95 ? (
                    <>
                      <Activity className="h-5 w-5 text-yellow-600" />
                      <span className="text-yellow-600 font-medium">Good with Minor Issues</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      <span className="text-red-600 font-medium">Needs Attention</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Recommendations */}
      {results && parseFloat(results.success_rate) < 99 && (
        <Card className="p-6 border-yellow-200 bg-yellow-50">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Recommendations
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {parseFloat(results.avg_response_time) > 500 && (
              <li>Response times are high. Consider optimizing database queries or adding caching.</li>
            )}
            {results.failed_requests > 0 && (
              <li>Failed requests detected. Check error logs and implement retry logic.</li>
            )}
            {parseFloat(results.requests_per_second) < 10 && (
              <li>Low throughput detected. Consider scaling infrastructure or optimizing code.</li>
            )}
          </ul>
        </Card>
      )}
    </div>
  );
}
