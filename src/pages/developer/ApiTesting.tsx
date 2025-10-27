import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Play, 
  Download,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TestResult {
  endpoint: string;
  method: string;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  responseTime?: number;
  statusCode?: number;
  error?: string;
  category: string;
}

const API_ENDPOINTS = [
  // Authentication & OAuth
  { category: "Authentication", endpoint: "/oauth-token", method: "POST", requiresAuth: false },
  { category: "Authentication", endpoint: "/oauth-authorize", method: "GET", requiresAuth: false },
  { category: "Authentication", endpoint: "/oidc-config", method: "GET", requiresAuth: false },
  { category: "Authentication", endpoint: "/jwks-endpoint", method: "GET", requiresAuth: false },
  
  // AISP Endpoints
  { category: "AISP", endpoint: "/aisp-accounts", method: "GET", requiresAuth: true },
  { category: "AISP", endpoint: "/aisp-create-consent", method: "POST", requiresAuth: true },
  
  // PISP Endpoints  
  { category: "PISP", endpoint: "/pisp-create-consent", method: "POST", requiresAuth: true },
  { category: "PISP", endpoint: "/pisp-domestic-payment", method: "POST", requiresAuth: true },
  
  // Mobile Money
  { category: "Mobile Money", endpoint: "/mobile-money-charge", method: "POST", requiresAuth: true },
  
  // Banking Operations
  { category: "Banking", endpoint: "/generate-bank-statement", method: "POST", requiresAuth: true },
  
  // System
  { category: "System", endpoint: "/system-health-check", method: "GET", requiresAuth: false },
];

export default function ApiTesting() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [progress, setProgress] = useState(0);

  const testEndpoint = async (endpoint: typeof API_ENDPOINTS[0]): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      // For endpoints requiring auth, skip if no token available
      if (endpoint.requiresAuth) {
        return {
          endpoint: endpoint.endpoint,
          method: endpoint.method,
          status: 'skipped',
          category: endpoint.category,
          error: 'Requires authentication (skipped in test mode)'
        };
      }

      // Special handling for OAuth endpoints
      if (endpoint.endpoint === '/oauth-token') {
        // oauth-token expects form-encoded data
        const formData = new URLSearchParams();
        formData.append('grant_type', 'client_credentials');
        formData.append('client_id', 'test_client');
        formData.append('client_secret', 'test_secret');
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
          }
        );
        
        const responseTime = Date.now() - startTime;
        
        return {
          endpoint: endpoint.endpoint,
          method: endpoint.method,
          status: response.ok ? 'success' : 'failed',
          responseTime,
          statusCode: response.status,
          error: response.ok ? undefined : `Edge Function returned a non-2xx status code`,
          category: endpoint.category
        };
      }
      
      if (endpoint.endpoint === '/oauth-authorize') {
        // oauth-authorize requires query parameters
        const params = new URLSearchParams({
          client_id: 'test_client',
          redirect_uri: 'https://example.com/callback',
          response_type: 'code',
          scope: 'openid accounts',
          state: 'test_state',
          code_challenge: 'test_challenge',
          code_challenge_method: 'S256'
        });
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-authorize?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
            }
          }
        );
        
        const responseTime = Date.now() - startTime;
        
        return {
          endpoint: endpoint.endpoint,
          method: endpoint.method,
          status: response.ok ? 'success' : 'failed',
          responseTime,
          statusCode: response.status,
          error: response.ok ? undefined : `Edge Function returned a non-2xx status code`,
          category: endpoint.category
        };
      }

      // Test the endpoint using Supabase functions
      const { data, error } = await supabase.functions.invoke(
        endpoint.endpoint.replace('/', ''),
        {
          method: endpoint.method as 'GET' | 'POST',
          body: endpoint.method === 'POST' ? {} : undefined
        }
      );

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          endpoint: endpoint.endpoint,
          method: endpoint.method,
          status: 'failed',
          responseTime,
          statusCode: error.status || 500,
          error: error.message,
          category: endpoint.category
        };
      }

      return {
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        status: 'success',
        responseTime,
        statusCode: 200,
        category: endpoint.category
      };
    } catch (err: any) {
      return {
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        status: 'failed',
        responseTime: Date.now() - startTime,
        error: err.message,
        category: endpoint.category
      };
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    setResults([]);
    setProgress(0);

    const testResults: TestResult[] = [];
    
    for (let i = 0; i < API_ENDPOINTS.length; i++) {
      const endpoint = API_ENDPOINTS[i];
      const result = await testEndpoint(endpoint);
      testResults.push(result);
      setResults([...testResults]);
      setProgress(((i + 1) / API_ENDPOINTS.length) * 100);
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setTesting(false);
    
    const successCount = testResults.filter(r => r.status === 'success').length;
    const failedCount = testResults.filter(r => r.status === 'failed').length;
    const skippedCount = testResults.filter(r => r.status === 'skipped').length;
    
    toast.success(`Tests completed: ${successCount} passed, ${failedCount} failed, ${skippedCount} skipped`);
  };

  const downloadReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        success: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
      },
      results: results
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-test-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryStats = (category: string) => {
    const categoryResults = results.filter(r => r.category === category);
    return {
      total: categoryResults.length,
      success: categoryResults.filter(r => r.status === 'success').length,
      failed: categoryResults.filter(r => r.status === 'failed').length,
      skipped: categoryResults.filter(r => r.status === 'skipped').length,
    };
  };

  const categories = Array.from(new Set(API_ENDPOINTS.map(e => e.category)));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">API Testing Dashboard</h1>
        <p className="text-xl text-muted-foreground">
          Comprehensive testing of all documented API endpoints
        </p>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          This testing dashboard runs automated tests against the API endpoints. 
          Endpoints requiring authentication will be skipped unless proper credentials are provided.
        </AlertDescription>
      </Alert>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Test Controls</CardTitle>
          <CardDescription>Run comprehensive tests on all API endpoints</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={runAllTests} 
              disabled={testing}
              size="lg"
              className="flex-1"
            >
              <Play className="mr-2 h-4 w-4" />
              {testing ? 'Testing...' : 'Run All Tests'}
            </Button>
            
            {results.length > 0 && (
              <Button 
                onClick={downloadReport} 
                variant="outline"
                size="lg"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Report
              </Button>
            )}
          </div>

          {testing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Testing Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      {results.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{results.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-green-600">Passed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {results.filter(r => r.status === 'success').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-red-600">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {results.filter(r => r.status === 'failed').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-yellow-600">Skipped</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {results.filter(r => r.status === 'skipped').length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results by Category */}
      {results.length > 0 && categories.map(category => {
        const stats = getCategoryStats(category);
        const categoryResults = results.filter(r => r.category === category);
        
        return (
          <Card key={category}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{category}</CardTitle>
                  <CardDescription>
                    {stats.success}/{stats.total} passed • {stats.failed} failed • {stats.skipped} skipped
                  </CardDescription>
                </div>
                <Badge variant={stats.failed > 0 ? "destructive" : "default"}>
                  {Math.round((stats.success / stats.total) * 100)}% Success
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {categoryResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      {result.status === 'success' && (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      )}
                      {result.status === 'failed' && (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      {result.status === 'skipped' && (
                        <Clock className="h-5 w-5 text-yellow-600" />
                      )}
                      {result.status === 'pending' && (
                        <Clock className="h-5 w-5 text-muted-foreground animate-spin" />
                      )}
                      
                      <div>
                        <div className="font-mono text-sm">
                          <Badge variant="outline" className="mr-2">
                            {result.method}
                          </Badge>
                          {result.endpoint}
                        </div>
                        {result.error && (
                          <p className="text-sm text-red-600 mt-1">{result.error}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {result.responseTime && (
                        <span>{result.responseTime}ms</span>
                      )}
                      {result.statusCode && (
                        <Badge variant={result.statusCode < 400 ? "default" : "destructive"}>
                          {result.statusCode}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {results.length === 0 && !testing && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Play className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Ready to Test</p>
            <p className="text-muted-foreground text-center max-w-md">
              Click "Run All Tests" to start comprehensive testing of all documented API endpoints
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
